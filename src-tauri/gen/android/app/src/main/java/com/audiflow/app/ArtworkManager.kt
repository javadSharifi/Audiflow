package com.audiflow.app

import android.content.Context
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.util.Log
import androidx.annotation.Keep
import java.io.File
import java.io.FileOutputStream

/**
 * ArtworkManager: Responsible for extracting, caching, and serving audio cover art.
 *
 * Employs stable caching under cacheDir/artworks/ keyed by track URI/path hash,
 * reusable across UI and notification lock-screen components.
 */
@Keep
object ArtworkManager {
  private const val TAG = "ArtworkManager"

  /**
   * Stable cache file for a track's embedded artwork.
   */
  fun artworkCacheFileFor(context: Context, cacheKey: String): File? {
    return try {
      if (cacheKey.isBlank()) return null
      val dir = File(context.cacheDir, "artworks")
      if (!dir.exists()) dir.mkdirs()
      val name = "art_" + Math.abs(cacheKey.hashCode()).toString() + ".jpg"
      File(dir, name)
    } catch (_: Throwable) {
      null
    }
  }

  /**
   * Extract embedded picture of an audio track and cache it as a JPEG.
   */
  fun getEmbeddedArtwork(context: Context, audioRef: String): String {
    try {
      if (audioRef.isBlank()) return ""
      val out = artworkCacheFileFor(context, audioRef) ?: return ""
      if (out.exists() && out.length() > 0) return out.absolutePath

      val retriever = MediaMetadataRetriever()
      try {
        if (audioRef.startsWith("content://")) {
          retriever.setDataSource(context, Uri.parse(audioRef))
        } else {
          val rawPath = if (audioRef.startsWith("file://")) {
            Uri.parse(audioRef).path ?: audioRef
          } else {
            audioRef
          }
          if (rawPath.isBlank()) return ""
          retriever.setDataSource(rawPath)
        }
        val bytes = retriever.embeddedPicture ?: return ""
        if (bytes.isEmpty()) return ""
        FileOutputStream(out).use { it.write(bytes) }
      } finally {
        try {
          retriever.release()
        } catch (_: Throwable) {}
      }
      return if (out.exists() && out.length() > 0) out.absolutePath else ""
    } catch (t: Throwable) {
      Log.w(TAG, "getEmbeddedArtwork failed", t)
      return ""
    }
  }

  /**
   * Delete cached artwork for a specific URI/path.
   */
  fun deleteArtworkCache(context: Context, cacheKey: String) {
    try {
      artworkCacheFileFor(context, cacheKey)?.delete()
    } catch (_: Throwable) {}
  }
}
