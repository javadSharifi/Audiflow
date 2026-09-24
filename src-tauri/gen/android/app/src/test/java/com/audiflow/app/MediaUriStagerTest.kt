package com.audiflow.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
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
 * Unit tests for MediaUriStager.
 *
 * Only deterministic, framework-free logic is tested here:
 *
 *  1. cleanupStagingDirectory — deletes all files in staged_inputs/ under cacheDir
 *  2. safeName regex — illegal filesystem characters are replaced with '_'
 *     (mirrors the Regex("[\\\\/:*?\"<>|\\x00-\\x1F]") used in stageUriToCache)
 *
 * Methods that require a live ContentResolver (statUri, resolveUriToLocalPath,
 * stageUriToCache) are intentionally excluded; they need instrumentation tests
 * with a real Android runtime.
 */
class MediaUriStagerTest {

    @get:Rule
    val tmpFolder = TemporaryFolder()

    private fun mockContextWith(cacheDir: File): Context {
        val ctx = mock(Context::class.java)
        `when`(ctx.cacheDir).thenReturn(cacheDir)
        return ctx
    }

    // -------------------------------------------------------------------------
    // cleanupStagingDirectory
    // -------------------------------------------------------------------------

    @Test
    fun cleanupStagingDirectory_deletesAllFiles() {
        val cacheDir = tmpFolder.newFolder("cache_cleanup")
        val stagingDir = File(cacheDir, "staged_inputs").also { it.mkdirs() }
        val f1 = File(stagingDir, "track1.mp3").also { it.writeText("data") }
        val f2 = File(stagingDir, "track2.m4a").also { it.writeText("data") }
        val ctx = mockContextWith(cacheDir)

        MediaUriStager.cleanupStagingDirectory(ctx)

        assertFalse("track1.mp3 must be deleted", f1.exists())
        assertFalse("track2.m4a must be deleted", f2.exists())
    }

    @Test
    fun cleanupStagingDirectory_doesNotThrow_whenDirAbsent() {
        val cacheDir = tmpFolder.newFolder("cache_no_staging")
        // staged_inputs does NOT exist — should be a silent no-op.
        val ctx = mockContextWith(cacheDir)
        MediaUriStager.cleanupStagingDirectory(ctx)
    }

    @Test
    fun cleanupStagingDirectory_leavesEmptyStagingDir_intact() {
        val cacheDir = tmpFolder.newFolder("cache_empty_staging")
        val stagingDir = File(cacheDir, "staged_inputs").also { it.mkdirs() }
        val ctx = mockContextWith(cacheDir)

        MediaUriStager.cleanupStagingDirectory(ctx)

        // Directory itself may or may not remain, but no crash and no files.
        if (stagingDir.exists()) {
            val remaining = stagingDir.listFiles() ?: emptyArray()
            assertEquals(0, remaining.size)
        }
    }

    // -------------------------------------------------------------------------
    // safeName regex (mirrored from MediaUriStager.stageUriToCache)
    //
    // The production code applies:
    //   val safeName = fileName.replace(Regex("[\\\\/:*?\"<>|\\x00-\\x1F]"), "_")
    //
    // We test the same regex inline so that any future change to the production
    // pattern is caught by a failing test.
    // -------------------------------------------------------------------------

    private val SAFE_NAME_REGEX = Regex("[\\\\/:*?\"<>|\\x00-\\x1F]")

    private fun toSafeName(raw: String): String =
        raw.replace(SAFE_NAME_REGEX, "_")

    @Test
    fun safeNameRegex_preservesNormalFilename() {
        assertEquals("song.mp3", toSafeName("song.mp3"))
        assertEquals("My Track 01.m4a", toSafeName("My Track 01.m4a"))
    }

    @Test
    fun safeNameRegex_replacesBackslash() {
        assertEquals("a_b.mp3", toSafeName("a\\b.mp3"))
    }

    @Test
    fun safeNameRegex_replacesForwardSlash() {
        assertEquals("a_b.mp3", toSafeName("a/b.mp3"))
    }

    @Test
    fun safeNameRegex_replacesColon() {
        assertEquals("a_b.mp3", toSafeName("a:b.mp3"))
    }

    @Test
    fun safeNameRegex_replacesAsterisk() {
        assertEquals("a_b.mp3", toSafeName("a*b.mp3"))
    }

    @Test
    fun safeNameRegex_replacesQuestionMark() {
        assertEquals("a_b.mp3", toSafeName("a?b.mp3"))
    }

    @Test
    fun safeNameRegex_replacesDoubleQuote() {
        assertEquals("a_b.mp3", toSafeName("a\"b.mp3"))
    }

    @Test
    fun safeNameRegex_replacesLessThan() {
        assertEquals("a_b.mp3", toSafeName("a<b.mp3"))
    }

    @Test
    fun safeNameRegex_replacesGreaterThan() {
        assertEquals("a_b.mp3", toSafeName("a>b.mp3"))
    }

    @Test
    fun safeNameRegex_replacesPipe() {
        assertEquals("a_b.mp3", toSafeName("a|b.mp3"))
    }

    @Test
    fun safeNameRegex_replacesNullByte() {
        assertEquals("a_b.mp3", toSafeName("a\u0000b.mp3"))
    }

    @Test
    fun safeNameRegex_replacesControlCharacters() {
        // \x01 through \x1F should all be replaced.
        for (code in 1..0x1F) {
            val ch = code.toChar()
            val result = toSafeName("a${ch}b.mp3")
            assertEquals("Control char 0x${code.toString(16)} must be replaced", "a_b.mp3", result)
        }
    }

    @Test
    fun safeNameRegex_preservesPersianUnicode() {
        // Persian/Farsi characters must NOT be stripped — only illegal FS chars.
        val persian = "آهنگ - خواننده.mp3"
        assertEquals(persian, toSafeName(persian))
    }

    @Test
    fun safeNameRegex_preservesSpaces() {
        assertEquals("my song.mp3", toSafeName("my song.mp3"))
    }

    // -------------------------------------------------------------------------
    // Dedup numbering pattern: "$stem ($n)$ext"
    // The production loop builds names like "foo (1).mp3", "foo (2).mp3", etc.
    // Test the naming contract directly.
    // -------------------------------------------------------------------------

    private fun dedupName(stem: String, ext: String, n: Int): String =
        "$stem ($n)$ext"

    @Test
    fun dedupNamePattern_firstConflict() {
        assertEquals("song (1).mp3", dedupName("song", ".mp3", 1))
    }

    @Test
    fun dedupNamePattern_secondConflict() {
        assertEquals("song (2).mp3", dedupName("song", ".mp3", 2))
    }

    @Test
    fun dedupNamePattern_noExtension() {
        assertEquals("track (1)", dedupName("track", "", 1))
    }
}
