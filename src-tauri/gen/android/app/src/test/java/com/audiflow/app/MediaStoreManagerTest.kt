package com.audiflow.app

import org.junit.Assert.assertEquals
import org.junit.Test
import java.lang.reflect.Method

/**
 * Unit tests for MediaStoreManager.
 *
 * The `mimeFor` function is private. We test it via reflection since it is
 * a pure, deterministic mapping function with no side effects.
 * Any future visibility change (e.g. promoting to internal) would let these
 * tests migrate to a direct call trivially.
 *
 * We do NOT test publishOutputs, queryMediaStoreMusic, or deleteAudioTrack
 * here — those require a live ContentResolver and belong in instrumentation tests.
 */
class MediaStoreManagerTest {

    /** Reflective accessor for the private `mimeFor(ext: String): String` method. */
    private fun mimeFor(ext: String): String {
        val method: Method = MediaStoreManager::class.java
            .getDeclaredMethod("mimeFor", String::class.java)
        method.isAccessible = true
        // MediaStoreManager is a Kotlin object (singleton); pass the companion instance.
        return method.invoke(MediaStoreManager, ext) as String
    }

    // -------------------------------------------------------------------------
    // Exact extension → MIME mappings (must match the when block in MediaStoreManager)
    // -------------------------------------------------------------------------

    @Test fun mimeFor_mp3_returnsAudioMpeg()  = assertEquals("audio/mpeg",  mimeFor("mp3"))
    @Test fun mimeFor_aac_returnsAudioAac()   = assertEquals("audio/aac",   mimeFor("aac"))
    @Test fun mimeFor_m4a_returnsAudioMp4()   = assertEquals("audio/mp4",   mimeFor("m4a"))
    @Test fun mimeFor_opus_returnsAudioOpus() = assertEquals("audio/opus",  mimeFor("opus"))
    @Test fun mimeFor_ogg_returnsAudioOgg()   = assertEquals("audio/ogg",   mimeFor("ogg"))
    @Test fun mimeFor_wav_returnsAudioXWav()  = assertEquals("audio/x-wav", mimeFor("wav"))
    @Test fun mimeFor_flac_returnsAudioFlac() = assertEquals("audio/flac",  mimeFor("flac"))

    // -------------------------------------------------------------------------
    // Case-insensitivity: the source calls ext.lowercase() before the when block.
    // -------------------------------------------------------------------------

    @Test fun mimeFor_uppercaseMp3_returnsAudioMpeg() = assertEquals("audio/mpeg", mimeFor("MP3"))
    @Test fun mimeFor_upperM4A_returnsAudioMp4()      = assertEquals("audio/mp4",  mimeFor("M4A"))
    @Test fun mimeFor_mixedFlac_returnsAudioFlac()    = assertEquals("audio/flac", mimeFor("FLaC"))

    // -------------------------------------------------------------------------
    // Unknown extensions must fall back to audio/mpeg (the else branch).
    // -------------------------------------------------------------------------

    @Test fun mimeFor_unknownExt_defaultsToAudioMpeg() {
        assertEquals("audio/mpeg", mimeFor("xyz"))
        assertEquals("audio/mpeg", mimeFor(""))
        assertEquals("audio/mpeg", mimeFor("wma"))
    }
}
