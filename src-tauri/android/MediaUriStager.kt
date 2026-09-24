package com.audiflow.app

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Log
import android.webkit.MimeTypeMap
import androidx.annotation.Keep
import java.io.File
import java.io.FileOutputStream

/**
 * MediaUriStager: handles caching, copying, and metadata lookup for Android Content URIs.
 *
 * Implements lazy staging: files are read or copied to app cache only when
 * necessary for conversion/probing, avoiding upfront bulk copying.
 */
@Keep
object MediaUriStager {
  private const val TAG = "MediaUriStager"
  private const val BUFFER_SIZE = 64 * 1024 // 64 KB buffer
  private const val SAFETY_MARGIN_BYTES = 50L * 1024 * 1024 // 50 MB safety margin

  /**
   * Lightweight metadata lookup (name / size / duration) for picked URIs —
   * NO file copying. Used to populate the file list; actual staging happens
   * lazily right before each conversion runs.
   *
   * Output is one line per input: `name\tsize\tdurationMs\tok\tperm`
   */
  fun statUri(context: Context, joined: String, onPermissionDenied: () -> Unit = {}): String {
    val resolver = context.contentResolver
    if (joined.isBlank()) return ""
    val out = ArrayList<String>()
    for (uriString in joined.split("\n")) {
      var name = ""
      var size = 0L
      var durationMs = 0L
      var ok = 1
      var perm = 0
      try {
        if (uriString.startsWith("/") || uriString.startsWith("file://")) {
          val filePath = if (uriString.startsWith("file://")) uriString.substring(7) else uriString
          val f = File(filePath)
          if (f.exists() && f.isFile) {
            name = f.name
            size = f.length()
            ok = 1
          } else {
            ok = 0
          }
        } else {
          val uri = Uri.parse(uriString)
          try {
            resolver.takePersistableUriPermission(
              uri,
              android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION
            )
          } catch (_: Throwable) {
          }
          try {
            resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { c ->
              if (c.moveToFirst()) {
                val ni = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (ni >= 0 && !c.getString(ni).isNullOrBlank()) name = c.getString(ni)
                val si = c.getColumnIndex(OpenableColumns.SIZE)
                if (si >= 0 && !c.isNull(si)) size = c.getLong(si).coerceAtLeast(0)
              }
            } ?: run { ok = 0 }
          } catch (e: SecurityException) {
            Log.w(TAG, "statUri access denied for $uriString", e)
            ok = 0
            perm = 1
            onPermissionDenied()
          } catch (e: Throwable) {
            Log.w(TAG, "statUri metadata query failed for $uriString", e)
            ok = 0
          }
          // Duration only exists on media-store collections; document URIs
          // throw on the unknown column — that just means "unknown duration".
          try {
            resolver.query(uri, arrayOf("duration"), null, null, null)?.use { c ->
              if (c.moveToFirst()) {
                val di = c.getColumnIndex("duration")
                if (di >= 0 && !c.isNull(di)) durationMs = c.getLong(di)
              }
            }
          } catch (_: Throwable) {
          }
          if (name.isNotEmpty() && !name.contains(".")) {
            val mime = resolver.getType(uri)
            val ext = MimeTypeMap.getSingleton().getExtensionFromMimeType(mime)
            if (!ext.isNullOrBlank()) name = "$name.$ext"
          }
        }
        // Names must stay on ONE protocol line: strip line/field separators.
        name = name.replace(Regex("[\\n\\r\\t]"), " ")
      } catch (e: Throwable) {
        Log.w(TAG, "statUri failed for $uriString", e)
        ok = 0
      }
      out.add("$name\t$size\t$durationMs\t$ok\t$perm")
    }
    return out.joinToString("\n")
  }

  /**
   * Resolve an input URI or path to a local readable POSIX file.
   */
  fun resolveUriToLocalPath(context: Context, uriString: String, onPermissionDenied: () -> Unit = {}): String {
    // Plain filesystem path → use it as-is.
    if (!uriString.startsWith("content://") && !uriString.startsWith("file://")) {
      val f = File(uriString)
      if (f.exists() && f.canRead()) {
        return f.absolutePath
      }
    }
    // file:// URI → decode to its absolute path, but ONLY when it is
    // actually readable (scoped storage can hand back paths that exist on
    // disk yet deny access).
    if (uriString.startsWith("file://")) {
      val decoded = Uri.parse(uriString).path
      if (decoded != null && File(decoded).canRead()) {
        return decoded
      }
      Log.w(TAG, "file:// URI is not readable: $uriString")
      return "STAGE_ERROR|file is not readable"
    }
    return try {
      try {
        stageUriToCache(context, uriString)
      } catch (e: SecurityException) {
        Log.e(TAG, "Permission denied while resolving URI: $uriString", e)
        onPermissionDenied()
        "STAGE_ERROR|permission denied by system"
      } catch (e: Throwable) {
        Log.e(TAG, "Failed to resolve URI to local path: $uriString", e)
        "STAGE_ERROR|${e.message ?: e.javaClass.simpleName}"
      }
    } catch (e: Throwable) {
      Log.e(TAG, "resolveUriToLocalPath hard failure", e)
      "STAGE_ERROR|unexpected error"
    }
  }

  private fun stageUriToCache(context: Context, uriString: String): String {
    val resolver = context.contentResolver
    val uri = Uri.parse(uriString)
    var fileName = "media_${System.currentTimeMillis()}"
    var reportedSize = 0L

    try {
      resolver.takePersistableUriPermission(
        uri,
        android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION
      )
    } catch (_: Throwable) {
    }

    // 1. Query metadata: DISPLAY_NAME & SIZE from ContentResolver
    try {
      resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { cursor ->
        if (cursor.moveToFirst()) {
          val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
          if (nameIndex >= 0) {
            val name = cursor.getString(nameIndex)
            if (!name.isNullOrBlank()) {
              fileName = name
            }
          }
          val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
          if (sizeIndex >= 0) {
            reportedSize = cursor.getLong(sizeIndex)
          }
        }
      }
    } catch (e: Throwable) {
      Log.w(TAG, "Could not query ContentResolver metadata for $uriString", e)
    }

    // If fileName lacks extension, infer from mimeType
    if (!fileName.contains(".")) {
      val mime = resolver.getType(uri)
      val ext = MimeTypeMap.getSingleton().getExtensionFromMimeType(mime)
      if (!ext.isNullOrBlank()) {
        fileName = "$fileName.$ext"
      }
    }

    // 2. Pre-check cache storage capacity
    val availableCacheSpace = context.cacheDir.usableSpace
    Log.i(TAG, "Staging $fileName ($reportedSize bytes). Available cache: $availableCacheSpace bytes")
    if (reportedSize > 0 && availableCacheSpace < (reportedSize + SAFETY_MARGIN_BYTES)) {
      throw IllegalStateException(
        "Insufficient cache storage space. Required: ${reportedSize / (1024 * 1024)} MB, Available: ${availableCacheSpace / (1024 * 1024)} MB"
      )
    }

    val stagingDir = File(context.cacheDir, "staged_inputs")
    if (!stagingDir.exists()) {
      stagingDir.mkdirs()
    }

    // Keep Unicode (e.g. Persian) titles — only strip filesystem-illegal
    // and control characters so output names stay meaningful.
    val safeName = fileName.replace(Regex("[\\\\/:*?\"<>|\\x00-\\x1F]"), "_")
    val dot = safeName.lastIndexOf('.')
    val stem = if (dot > 0) safeName.substring(0, dot) else safeName
    val ext = if (dot > 0) safeName.substring(dot) else ""
    var destFile = File(stagingDir, safeName)

    // Reuse if already staged with matching non-zero size
    if (destFile.exists() && destFile.length() > 0 && (reportedSize <= 0 || destFile.length() == reportedSize)) {
      Log.i(TAG, "Reusing already staged file: ${destFile.absolutePath}")
      return destFile.absolutePath
    }

    var n = 1
    var claimed = destFile.createNewFile()
    while (!claimed) {
      destFile = File(stagingDir, "$stem ($n)$ext")
      if (destFile.exists() && destFile.length() > 0 && (reportedSize <= 0 || destFile.length() == reportedSize)) {
        Log.i(TAG, "Reusing already staged file: ${destFile.absolutePath}")
        return destFile.absolutePath
      }
      claimed = destFile.createNewFile()
      n++
    }

    Log.i(TAG, "Copying Content URI to local cache: $uriString -> ${destFile.absolutePath}")
    val inputStream = try {
      resolver.openInputStream(uri)
    } catch (t: Throwable) {
      Log.w(TAG, "openInputStream failed, trying openFileDescriptor", t)
      null
    } ?: try {
      resolver.openFileDescriptor(uri, "r")?.let { pfd ->
        java.io.FileInputStream(pfd.fileDescriptor)
      }
    } catch (t: Throwable) {
      Log.w(TAG, "openFileDescriptor also failed", t)
      null
    } ?: throw IllegalStateException("Cannot open input stream for $uriString (Permission denied or file unavailable)")

    inputStream.use { input ->
      FileOutputStream(destFile).use { output ->
        val buffer = ByteArray(BUFFER_SIZE)
        var bytesRead: Int
        while (input.read(buffer).also { bytesRead = it } != -1) {
          output.write(buffer, 0, bytesRead)
        }
        output.flush()
      }
    }

    Log.i(TAG, "Staging completed successfully: ${destFile.absolutePath} (${destFile.length()} bytes)")
    return destFile.absolutePath
  }

  fun cleanupStagingDirectory(context: Context) {
    try {
      val stagingDir = File(context.cacheDir, "staged_inputs")
      if (stagingDir.exists() && stagingDir.isDirectory) {
        val files = stagingDir.listFiles()
        if (files != null) {
          for (file in files) {
            file.delete()
          }
          Log.i(TAG, "Cleaned up ${files.size} orphaned staged files from cache")
        }
      }
    } catch (e: Throwable) {
      Log.w(TAG, "Error cleaning up staging directory", e)
    }
  }
}
