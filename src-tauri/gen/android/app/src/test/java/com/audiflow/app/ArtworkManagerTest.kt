package com.audiflow.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import android.content.Context
import java.io.File
import java.lang.reflect.Method

/**
 * Unit tests for ArtworkManager.
 *
 * Covers:
 *  - artworkCacheFileFor: stable naming (art_<abs(hash)>.jpg)
 *  - artworkCacheFileFor: blank key returns null
 *  - artworkCacheFileFor: different keys produce different names
 *  - artworkCacheFileFor: same key always produces same name (idempotent)
 *  - artworkCacheFileFor: artwork dir is created under cacheDir/artworks/
 *  - deleteArtworkCache: removes the cached file when it exists
 */
class ArtworkManagerTest {

    @get:Rule
    val tmpFolder = TemporaryFolder()

    private fun mockContextWith(cacheDir: File): Context {
        val ctx = mock(Context::class.java)
        `when`(ctx.cacheDir).thenReturn(cacheDir)
        return ctx
    }

    @Test
    fun artworkCacheFileFor_blankKey_returnsNull() {
        val ctx = mockContextWith(tmpFolder.root)
        assertNull(ArtworkManager.artworkCacheFileFor(ctx, ""))
        assertNull(ArtworkManager.artworkCacheFileFor(ctx, "   "))
    }

    @Test
    fun artworkCacheFileFor_nonBlankKey_returnsFileUnderArtworksDir() {
        val cacheDir = tmpFolder.newFolder("cache")
        val ctx = mockContextWith(cacheDir)
        val result = ArtworkManager.artworkCacheFileFor(ctx, "content://media/123")
        assertNotNull(result)
        assertEquals("artworks", result!!.parentFile?.name)
    }

    @Test
    fun artworkCacheFileFor_namingScheme_matchesExpectedPattern() {
        val cacheDir = tmpFolder.newFolder("cache2")
        val ctx = mockContextWith(cacheDir)
        val key = "content://media/external/audio/123"
        val result = ArtworkManager.artworkCacheFileFor(ctx, key)!!
        val expectedName = "art_" + Math.abs(key.hashCode()).toString() + ".jpg"
        assertEquals(expectedName, result.name)
    }

    @Test
    fun artworkCacheFileFor_idempotent_sameKeyReturnsSameName() {
        val cacheDir = tmpFolder.newFolder("cache3")
        val ctx = mockContextWith(cacheDir)
        val key = "/storage/emulated/0/Music/song.mp3"
        val r1 = ArtworkManager.artworkCacheFileFor(ctx, key)!!
        val r2 = ArtworkManager.artworkCacheFileFor(ctx, key)!!
        assertEquals(r1.name, r2.name)
        assertEquals(r1.absolutePath, r2.absolutePath)
    }

    @Test
    fun artworkCacheFileFor_differentKeys_produceDifferentNames() {
        val cacheDir = tmpFolder.newFolder("cache4")
        val ctx = mockContextWith(cacheDir)
        val r1 = ArtworkManager.artworkCacheFileFor(ctx, "key-one")!!
        val r2 = ArtworkManager.artworkCacheFileFor(ctx, "key-two")!!
        assertTrue(
            "Different keys must produce different cache file names",
            r1.name != r2.name
        )
    }

    @Test
    fun artworkCacheFileFor_createsArtworksDirectory() {
        val cacheDir = tmpFolder.newFolder("cache5")
        val ctx = mockContextWith(cacheDir)
        val result = ArtworkManager.artworkCacheFileFor(ctx, "some-key")!!
        assertTrue("artworks dir must exist after first call", result.parentFile!!.exists())
    }

    @Test
    fun deleteArtworkCache_removesFile_whenItExists() {
        val cacheDir = tmpFolder.newFolder("cache6")
        val ctx = mockContextWith(cacheDir)
        val key = "content://media/456"

        // Materialise the file so there's something to delete.
        val artFile = ArtworkManager.artworkCacheFileFor(ctx, key)!!
        artFile.parentFile?.mkdirs()
        artFile.writeText("fake_jpg_bytes")
        assertTrue("Pre-condition: artwork file must exist", artFile.exists())

        ArtworkManager.deleteArtworkCache(ctx, key)
        assertTrue("Post-condition: artwork file must be deleted", !artFile.exists())
    }

    @Test
    fun deleteArtworkCache_doesNotThrow_whenFileAbsent() {
        val cacheDir = tmpFolder.newFolder("cache7")
        val ctx = mockContextWith(cacheDir)
        // Should silently succeed even with no file present.
        ArtworkManager.deleteArtworkCache(ctx, "nonexistent-key")
    }
}
