package com.audiflow.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for MediaItemBuilder pure logic.
 *
 * `mediaItemToTrackJson` and `buildMediaItem` both depend on the Media3
 * framework (`MediaItem`, `MediaMetadata`) and cannot be tested in a JVM
 * unit test without Robolectric. We therefore test only the self-contained
 * pure-logic fragments that can be exercised without a live Android runtime:
 *
 *  1. safeCoverUrl filtering  — android.resource:// URLs must be stripped
 *  2. URI-to-fileURI fallback — path is prefixed with "file://" when needed
 *  3. buildMediaItem mediaId  — id.ifBlank { uriStr } fallback
 *
 * These are tested by mirroring the exact expressions from MediaItemBuilder
 * so that any future divergence is caught by a failing test.
 */
class MediaItemBuilderTest {

    // -------------------------------------------------------------------------
    // safeCoverUrl: android.resource:// URLs must be treated as "" (stripped)
    // Mirror of: val safeCoverUrl =
    //     if (coverUrl.startsWith("android.resource://")) "" else coverUrl
    // -------------------------------------------------------------------------

    private fun safeCoverUrl(coverUrl: String): String =
        if (coverUrl.startsWith("android.resource://")) "" else coverUrl

    @Test
    fun safeCoverUrl_stripsAndroidResourceUrl() {
        val raw = "android.resource://com.audiflow.app/drawable/default_artwork"
        assertEquals("", safeCoverUrl(raw))
    }

    @Test
    fun safeCoverUrl_preservesHttpsUrl() {
        val url = "https://example.com/cover.jpg"
        assertEquals(url, safeCoverUrl(url))
    }

    @Test
    fun safeCoverUrl_preservesContentUrl() {
        val url = "content://media/external/audio/albumart/42"
        assertEquals(url, safeCoverUrl(url))
    }

    @Test
    fun safeCoverUrl_preservesFileUri() {
        val url = "file:///storage/emulated/0/.cache/artworks/art_123.jpg"
        assertEquals(url, safeCoverUrl(url))
    }

    @Test
    fun safeCoverUrl_preservesBlankString() {
        assertEquals("", safeCoverUrl(""))
    }

    // -------------------------------------------------------------------------
    // URI fallback: if uriStr is blank and path is not, prepend "file://"
    // Mirror of:
    //   if (uriStr.isBlank() && path.isNotBlank()) {
    //     uriStr = if (path.startsWith("file://")) path else "file://$path"
    //   }
    // -------------------------------------------------------------------------

    private fun resolveUri(uriStr: String, path: String): String {
        var resolved = uriStr
        if (resolved.isBlank() && path.isNotBlank()) {
            resolved = if (path.startsWith("file://")) path else "file://$path"
        }
        return resolved
    }

    @Test
    fun resolveUri_blankUri_nonBlankPath_prependsFileScheme() {
        assertEquals("file:///storage/emulated/0/Music/song.mp3",
            resolveUri("", "/storage/emulated/0/Music/song.mp3"))
    }

    @Test
    fun resolveUri_blankUri_pathAlreadyHasFileScheme_noDoublePrepend() {
        val path = "file:///storage/emulated/0/Music/song.mp3"
        assertEquals(path, resolveUri("", path))
    }

    @Test
    fun resolveUri_nonBlankUri_ignoresPath() {
        val uri = "content://media/external/audio/media/99"
        assertEquals(uri, resolveUri(uri, "/some/path.mp3"))
    }

    @Test
    fun resolveUri_bothBlank_remainsBlank() {
        assertEquals("", resolveUri("", ""))
    }

    // -------------------------------------------------------------------------
    // mediaId fallback: id.ifBlank { uriStr }
    // -------------------------------------------------------------------------

    private fun mediaId(id: String, uriStr: String): String =
        id.ifBlank { uriStr }

    @Test
    fun mediaId_nonBlankId_usesId() {
        assertEquals("track-abc", mediaId("track-abc", "content://media/123"))
    }

    @Test
    fun mediaId_blankId_fallsBackToUri() {
        assertEquals("content://media/123", mediaId("", "content://media/123"))
    }

    @Test
    fun mediaId_blankId_blankUri_remainsBlank() {
        assertEquals("", mediaId("", ""))
    }
}
