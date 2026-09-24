package com.audiflow.app

import android.content.Context
import android.net.Uri
import androidx.annotation.Keep
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import org.json.JSONObject

/**
 * MediaItemBuilder: Translates track JSON definitions into Media3 MediaItem instances
 * and formats MediaItems back to JSON for IPC/listeners.
 */
@Keep
object MediaItemBuilder {

  fun buildMediaItem(trackObj: JSONObject, context: Context?): MediaItem {
    val id = trackObj.optString("id", "")
    val rawUri = trackObj.optString("uri", "")
    var uriStr = rawUri
    val path = trackObj.optString("path", "")
    val title = trackObj.optString("title", trackObj.optString("name", "Unknown Title"))
    val artist = trackObj.optString("artist", "Unknown Artist")
    val album = trackObj.optString("album", "Unknown Album")
    val coverUrl = trackObj.optString("coverUrl", "")

    // Fallback to local file path if URI is empty
    if (uriStr.isBlank() && path.isNotBlank()) {
      uriStr = if (path.startsWith("file://")) path else "file://$path"
    }

    val mediaUri = Uri.parse(uriStr)

    val metadataBuilder = MediaMetadata.Builder()
      .setTitle(title)
      .setArtist(artist)
      .setAlbumTitle(album)
      .setDisplayTitle(title)

    var artworkSet = false
    try {
      if (context != null) {
        val cacheKey = rawUri.ifBlank { path }.ifBlank { id }
        val cached = ArtworkManager.artworkCacheFileFor(context, cacheKey)
        if (cached != null && cached.exists() && cached.length() > 0) {
          metadataBuilder.setArtworkUri(Uri.fromFile(cached))
          artworkSet = true
        }
      }
    } catch (_: Throwable) {}

    if (!artworkSet && coverUrl.isNotBlank()) {
      try {
        metadataBuilder.setArtworkUri(Uri.parse(coverUrl))
      } catch (_: Throwable) {}
    }

    // Final fallback: bundled default artwork
    if (!artworkSet && coverUrl.isBlank()) {
      try {
        if (context != null) {
          metadataBuilder.setArtworkUri(
            Uri.parse("android.resource://${context.packageName}/drawable/default_artwork")
          )
        }
      } catch (_: Throwable) {}
    }

    val extras = android.os.Bundle().apply {
      putString("track_id", id)
      putString("raw_uri", uriStr)
      putString("raw_path", path)
      putString("cover_url", coverUrl)
    }

    metadataBuilder.setExtras(extras)

    return MediaItem.Builder()
      .setMediaId(id.ifBlank { uriStr })
      .setUri(mediaUri)
      .setMediaMetadata(metadataBuilder.build())
      .build()
  }

  fun mediaItemToTrackJson(mediaItem: MediaItem?): String {
    if (mediaItem == null) return "{}"
    val meta = mediaItem.mediaMetadata
    val extras = meta.extras
    val id = extras?.getString("track_id") ?: mediaItem.mediaId
    val uri = extras?.getString("raw_uri") ?: mediaItem.requestMetadata.mediaUri?.toString() ?: ""
    val path = extras?.getString("raw_path") ?: ""
    val coverUrl = extras?.getString("cover_url") ?: meta.artworkUri?.toString() ?: ""
    val safeCoverUrl =
      if (coverUrl.startsWith("android.resource://")) "" else coverUrl

    val json = JSONObject().apply {
      put("id", id)
      put("uri", uri)
      put("path", if (path.isNotBlank()) path else JSONObject.NULL)
      put("title", meta.title?.toString() ?: "Unknown Title")
      put("artist", meta.artist?.toString() ?: "Unknown Artist")
      put("album", meta.albumTitle?.toString() ?: "Unknown Album")
      put("coverUrl", if (safeCoverUrl.isNotBlank()) safeCoverUrl else JSONObject.NULL)
    }
    return json.toString()
  }
}
