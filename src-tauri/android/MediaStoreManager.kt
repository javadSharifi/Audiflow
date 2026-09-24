package com.audiflow.app

import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.os.Build
import android.provider.MediaStore
import android.util.Log
import androidx.annotation.Keep
import java.io.File
import org.json.JSONObject

/**
 * MediaStoreManager: Queries, publishes, and deletes audio tracks via Android MediaStore.
 */
@Keep
object MediaStoreManager {
  private const val TAG = "MediaStoreManager"
  private const val BUFFER_SIZE = 64 * 1024

  /** MIME type for an audio output extension (all our supported formats). */
  private fun mimeFor(ext: String): String = when (ext.lowercase()) {
    "mp3" -> "audio/mpeg"
    "aac" -> "audio/aac"
    "m4a" -> "audio/mp4"
    "opus" -> "audio/opus"
    "ogg" -> "audio/ogg"
    "wav" -> "audio/x-wav"
    "flac" -> "audio/flac"
    else -> "audio/mpeg"
  }

  /**
   * Publish finished outputs into the shared media collection Music/Audiflow.
   */
  fun publishOutputs(context: Context, joined: String): String {
    if (joined.isBlank()) return joined
    val results = ArrayList<String>()
    for (path in joined.split("\n")) {
      try {
        val src = File(path)
        // Only publish files produced by our own internal output dir.
        if (!src.exists() || !src.absolutePath.startsWith(context.filesDir.absolutePath)) {
          results.add(path)
          continue
        }

        val values = ContentValues().apply {
          put(MediaStore.Audio.Media.DISPLAY_NAME, src.name)
          put(MediaStore.Audio.Media.MIME_TYPE, mimeFor(src.extension))
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            put(MediaStore.Audio.Media.RELATIVE_PATH, "Music/Audiflow")
          }
        }
        val uri = context.contentResolver.insert(
          MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, values
        )
        if (uri == null) {
          Log.w(TAG, "MediaStore insert failed for $path")
          results.add(path)
          continue
        }

        val copied = context.contentResolver.openOutputStream(uri)?.use { os ->
          src.inputStream().use { input ->
            input.copyTo(os, BUFFER_SIZE)
            true
          }
        } ?: false
        if (!copied) {
          Log.w(TAG, "Copy to MediaStore failed for $path")
          try {
            context.contentResolver.delete(uri, null, null)
          } catch (t: Throwable) {
            Log.w(TAG, "Could not clean up MediaStore row $uri", t)
          }
          results.add(path)
          continue
        }

        val published = "Music/Audiflow/${src.name}"
        Log.i(TAG, "Published output: $path -> $published")
        if (!src.delete()) {
          Log.w(TAG, "Internal output copy could not be removed: $path")
        }
        results.add(published)
      } catch (e: Throwable) {
        Log.w(TAG, "publishOutputs failed for $path", e)
        results.add(path)
      }
    }
    return results.joinToString("\n")
  }

  /**
   * Query all music files from the device via MediaStore.
   */
  fun queryMediaStoreMusic(context: Context): String {
    try {
      MediaScanSynchronizer.syncStorageDirectories(context)
    } catch (t: Throwable) {
      Log.w(TAG, "MediaScanSynchronizer failed (continuing query)", t)
    }

    val resolver = context.contentResolver
    val tracks = ArrayList<String>()

    val projection = arrayOf(
      MediaStore.Audio.Media._ID,
      MediaStore.Audio.Media.TITLE,
      MediaStore.Audio.Media.ARTIST,
      MediaStore.Audio.Media.ALBUM,
      MediaStore.Audio.Media.DURATION,
      MediaStore.Audio.Media.SIZE,
      MediaStore.Audio.Media.MIME_TYPE,
      MediaStore.Audio.Media.DISPLAY_NAME,
      MediaStore.Audio.Media.DATE_ADDED,
      MediaStore.Audio.Media.DATE_MODIFIED,
      MediaStore.Audio.Media.ALBUM_ID,
      MediaStore.Audio.Media.DATA
    )

    val selection = "(${MediaStore.Audio.Media.IS_MUSIC} != 0 OR ${MediaStore.Audio.Media.MIME_TYPE} LIKE 'audio/%') AND ${MediaStore.Audio.Media.SIZE} > 0"
    val sortOrder = "${MediaStore.Audio.Media.DATE_ADDED} DESC"

    try {
      resolver.query(
        MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
        projection,
        selection,
        null,
        sortOrder
      )?.use { cursor ->
        val idCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
        val titleCol = cursor.getColumnIndex(MediaStore.Audio.Media.TITLE)
        val artistCol = cursor.getColumnIndex(MediaStore.Audio.Media.ARTIST)
        val albumCol = cursor.getColumnIndex(MediaStore.Audio.Media.ALBUM)
        val durCol = cursor.getColumnIndex(MediaStore.Audio.Media.DURATION)
        val sizeCol = cursor.getColumnIndex(MediaStore.Audio.Media.SIZE)
        val mimeCol = cursor.getColumnIndex(MediaStore.Audio.Media.MIME_TYPE)
        val nameCol = cursor.getColumnIndex(MediaStore.Audio.Media.DISPLAY_NAME)
        val addedCol = cursor.getColumnIndex(MediaStore.Audio.Media.DATE_ADDED)
        val modCol = cursor.getColumnIndex(MediaStore.Audio.Media.DATE_MODIFIED)
        val albumIdCol = cursor.getColumnIndex(MediaStore.Audio.Media.ALBUM_ID)
        val dataCol = cursor.getColumnIndex(MediaStore.Audio.Media.DATA)

        while (cursor.moveToNext()) {
          val id = cursor.getLong(idCol)
          val uri = ContentUris.withAppendedId(
            MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
            id
          ).toString()

          val title = if (titleCol >= 0) cursor.getString(titleCol) else null
          val artist = if (artistCol >= 0) cursor.getString(artistCol) else null
          val album = if (albumCol >= 0) cursor.getString(albumCol) else null
          val dur = if (durCol >= 0) cursor.getLong(durCol) else 0L
          val size = if (sizeCol >= 0) cursor.getLong(sizeCol) else 0L
          val mime = if (mimeCol >= 0) cursor.getString(mimeCol) ?: "audio/mpeg" else "audio/mpeg"
          val name = if (nameCol >= 0) cursor.getString(nameCol) ?: "Track $id" else "Track $id"
          val added = if (addedCol >= 0) cursor.getLong(addedCol) * 1000L else 0L
          val mod = if (modCol >= 0) cursor.getLong(modCol) * 1000L else added
          val albumId = if (albumIdCol >= 0) cursor.getLong(albumIdCol) else -1L
          val coverUri = if (albumId > 0) "content://media/external/audio/albumart/$albumId" else null
          val rawPath = if (dataCol >= 0) cursor.getString(dataCol) else null
          val validPath = if (!rawPath.isNullOrBlank() && File(rawPath).exists() && File(rawPath).canRead()) rawPath else null

          val ext = if (name.contains('.')) name.substringAfterLast('.').lowercase() else "mp3"

          val json = JSONObject().apply {
            put("id", "android_$id")
            put("uri", uri)
            put("path", if (validPath != null) validPath else JSONObject.NULL)
            put("name", name)
            put("title", if (!title.isNullOrBlank()) title else name)
            put("artist", if (!artist.isNullOrBlank() && artist != "<unknown>") artist else JSONObject.NULL)
            put("album", if (!album.isNullOrBlank() && album != "<unknown>") album else JSONObject.NULL)
            put("durationSecs", dur / 1000.0)
            put("sizeBytes", size)
            put("mimeType", mime)
            put("format", ext)
            put("createdTimestampMs", added)
            put("modifiedTimestampMs", mod)
            put("coverUrl", if (coverUri != null) coverUri else JSONObject.NULL)
          }
          tracks.add(json.toString())
        }
      }
    } catch (e: Throwable) {
      Log.e(TAG, "queryMediaStoreMusic failed", e)
    }

    return "[" + tracks.joinToString(",") + "]"
  }

  /**
   * Delete an audio track from the device.
   */
  fun deleteAudioTrack(context: Context, uriString: String): String {
    ArtworkManager.deleteArtworkCache(context, uriString)
    return try {
      val resolver = context.contentResolver
      if (uriString.startsWith("content://")) {
        val uri = android.net.Uri.parse(uriString)
        val deletedRows = resolver.delete(uri, null, null)
        if (deletedRows > 0) {
          "OK"
        } else {
          "Delete returned 0 rows"
        }
      } else {
        val file = File(if (uriString.startsWith("file://")) android.net.Uri.parse(uriString).path ?: uriString else uriString)
        if (file.exists() && file.delete()) {
          "OK"
        } else {
          "Could not delete local file"
        }
      }
    } catch (e: SecurityException) {
      Log.w(TAG, "Delete audio track threw SecurityException on $uriString", e)
      "SECURITY_EXCEPTION"
    } catch (e: Throwable) {
      Log.e(TAG, "Delete audio track failed on $uriString", e)
      e.message ?: "Unknown error"
    }
  }
}
