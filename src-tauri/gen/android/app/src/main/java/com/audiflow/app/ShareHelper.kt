package com.audiflow.app

import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import android.util.Log
import android.webkit.MimeTypeMap
import androidx.annotation.Keep
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import org.json.JSONObject

/**
 * ShareHelper: Stages and serves audio files to Android system share sheet via FileProvider.
 */
@Keep
object ShareHelper {
  private const val TAG = "ShareHelper"
  private const val BUFFER_SIZE = 64 * 1024

  fun shareAudioTrack(context: Context, jsonArgs: String): String {
    return try {
      var uriString = jsonArgs
      var title = "Audio Track"
      var mimeType = "audio/*"
      try {
        val trimmed = jsonArgs.trim()
        if (trimmed.startsWith("{")) {
          val obj = JSONObject(trimmed)
          uriString = obj.optString("uri", jsonArgs)
          val t = obj.optString("title", "")
          if (t.isNotBlank()) title = t
          val m = obj.optString("mimeType", "")
          if (m.isNotBlank()) mimeType = m
        }
      } catch (_: Throwable) {}
      if (uriString.isBlank()) return "Empty track reference"
      if (uriString.startsWith("http://") || uriString.startsWith("https://")) {
        return "Streaming tracks cannot be shared"
      }

      // 1. Display name for the staged copy.
      val resolver = context.contentResolver
      var displayName: String? = null
      if (uriString.startsWith("content://")) {
        try {
          resolver.query(
            Uri.parse(uriString),
            arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null
          )?.use { c ->
            if (c.moveToFirst()) {
              val ni = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
              if (ni >= 0) displayName = c.getString(ni)
            }
          }
        } catch (_: Throwable) {}
      } else {
        val raw = if (uriString.startsWith("file://")) Uri.parse(uriString).path else uriString
        if (!raw.isNullOrBlank()) displayName = File(raw).name.takeIf { it.isNotBlank() }
      }
      if (displayName.isNullOrBlank()) {
        val ext = MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType)
        displayName = "shared_audio" + if (!ext.isNullOrBlank()) ".$ext" else ".mp3"
      }
      val safeName = displayName!!.replace(Regex("[\\\\/:*?\"<>|\\x00-\\x1F]"), "_")

      // 2. Stage into our own cache so FileProvider can serve it.
      val shareDir = File(context.cacheDir, "share_tmp")
      try {
        if (shareDir.exists()) {
          shareDir.listFiles()?.forEach {
            try {
              it.delete()
            } catch (_: Throwable) {}
          }
        } else {
          shareDir.mkdirs()
        }
      } catch (_: Throwable) {}
      val destFile = File(shareDir, safeName)
      val inputStream = try {
        if (uriString.startsWith("content://")) {
          resolver.openInputStream(Uri.parse(uriString))
        } else {
          val raw = if (uriString.startsWith("file://")) Uri.parse(uriString).path ?: uriString else uriString
          FileInputStream(File(raw))
        }
      } catch (t: Throwable) {
        Log.w(TAG, "shareAudioTrack: cannot open source", t)
        null
      } ?: return "Cannot read this audio file"
      try {
        inputStream.use { input ->
          FileOutputStream(destFile).use { output ->
            val buffer = ByteArray(BUFFER_SIZE)
            var n: Int
            while (input.read(buffer).also { n = it } != -1) output.write(buffer, 0, n)
            output.flush()
          }
        }
      } catch (t: Throwable) {
        Log.w(TAG, "shareAudioTrack: staging failed", t)
        try {
          destFile.delete()
        } catch (_: Throwable) {}
        return "Cannot read this audio file"
      }
      if (!destFile.exists() || destFile.length() <= 0) {
        try {
          destFile.delete()
        } catch (_: Throwable) {}
        return "Cannot read this audio file"
      }

      // 3. Serve via FileProvider with explicit grants.
      val contentUri = try {
        FileProvider.getUriForFile(
          context, context.packageName + ".fileprovider", destFile
        )
      } catch (t: Throwable) {
        Log.w(TAG, "shareAudioTrack: FileProvider failed", t)
        try {
          destFile.delete()
        } catch (_: Throwable) {}
        return "Cannot prepare file for sharing"
      }
      val shareIntent = Intent(Intent.ACTION_SEND).apply {
        type = mimeType
        putExtra(Intent.EXTRA_STREAM, contentUri)
        putExtra(Intent.EXTRA_SUBJECT, title)
        clipData = ClipData.newUri(context.contentResolver, title, contentUri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      // Per-package grants: the chooser target resolves later, so grant to every candidate
      try {
        val candidates =
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.packageManager.queryIntentActivities(
              shareIntent,
              PackageManager.ResolveInfoFlags.of(
                PackageManager.MATCH_DEFAULT_ONLY.toLong()
              )
            )
          } else {
            @Suppress("DEPRECATION")
            context.packageManager.queryIntentActivities(
              shareIntent, PackageManager.MATCH_DEFAULT_ONLY
            )
          }
        for (info in candidates) {
          try {
            context.grantUriPermission(
              info.activityInfo.packageName, contentUri, Intent.FLAG_GRANT_READ_URI_PERMISSION
            )
          } catch (_: Throwable) {}
        }
      } catch (_: Throwable) {}
      val chooser = Intent.createChooser(shareIntent, title).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      try {
        context.startActivity(chooser)
      } catch (t: Throwable) {
        Log.w(TAG, "shareAudioTrack: no app to share with", t)
        return "No app available to share with"
      }
      "OK"
    } catch (t: Throwable) {
      Log.e(TAG, "Failed to share audio track", t)
      t.message ?: "Unknown error"
    }
  }

  fun shareAudioTrack(context: Context, uriString: String, title: String, mimeType: String): String {
    return try {
      val uri = Uri.parse(uriString)
      val shareIntent = Intent(Intent.ACTION_SEND).apply {
        type = if (mimeType.isNotBlank()) mimeType else "audio/*"
        putExtra(Intent.EXTRA_STREAM, uri)
        putExtra(Intent.EXTRA_SUBJECT, title)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      val chooser = Intent.createChooser(shareIntent, title).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      context.startActivity(chooser)
      "OK"
    } catch (e: Throwable) {
      Log.e(TAG, "Failed to share audio track: $uriString", e)
      e.message ?: "Unknown error"
    }
  }
}
