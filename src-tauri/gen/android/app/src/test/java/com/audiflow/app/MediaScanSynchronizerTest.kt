package com.audiflow.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

/**
 * Unit tests for MediaScanSynchronizer.
 */
class MediaScanSynchronizerTest {

    @get:Rule
    val tempFolder = TemporaryFolder()

    @Test
    fun isSupportedAudioFile_recognizedExtensions() {
        val mp3 = tempFolder.newFile("song.mp3")
        val m4a = tempFolder.newFile("track.m4a")
        val aac = tempFolder.newFile("audio.aac")
        val flac = tempFolder.newFile("music.flac")
        val wav = tempFolder.newFile("sound.wav")
        val ogg = tempFolder.newFile("tune.ogg")
        val opus = tempFolder.newFile("recording.opus")

        assertTrue(MediaScanSynchronizer.isSupportedAudioFile(mp3))
        assertTrue(MediaScanSynchronizer.isSupportedAudioFile(m4a))
        assertTrue(MediaScanSynchronizer.isSupportedAudioFile(aac))
        assertTrue(MediaScanSynchronizer.isSupportedAudioFile(flac))
        assertTrue(MediaScanSynchronizer.isSupportedAudioFile(wav))
        assertTrue(MediaScanSynchronizer.isSupportedAudioFile(ogg))
        assertTrue(MediaScanSynchronizer.isSupportedAudioFile(opus))
    }

    @Test
    fun isSupportedAudioFile_caseInsensitive() {
        val upperMp3 = tempFolder.newFile("UPPER.MP3")
        val mixedFlac = tempFolder.newFile("Mixed.FlAc")

        assertTrue(MediaScanSynchronizer.isSupportedAudioFile(upperMp3))
        assertTrue(MediaScanSynchronizer.isSupportedAudioFile(mixedFlac))
    }

    @Test
    fun isSupportedAudioFile_rejectsHiddenAndNonAudio() {
        val hiddenMp3 = tempFolder.newFile(".hidden.mp3")
        val textFile = tempFolder.newFile("notes.txt")
        val imageFile = tempFolder.newFile("cover.jpg")
        val videoFile = tempFolder.newFile("video.mp4")

        assertFalse(MediaScanSynchronizer.isSupportedAudioFile(hiddenMp3))
        assertFalse(MediaScanSynchronizer.isSupportedAudioFile(textFile))
        assertFalse(MediaScanSynchronizer.isSupportedAudioFile(imageFile))
        assertFalse(MediaScanSynchronizer.isSupportedAudioFile(videoFile))
    }

    @Test
    fun discoverAudioFiles_traversesAndFiltersCorrectly() {
        val root = tempFolder.newFolder("MusicRoot")
        val subDir = File(root, "Album1").apply { mkdir() }
        val nomediaDir = File(root, "IgnoredAlbum").apply { mkdir() }
        File(nomediaDir, ".nomedia").createNewFile()
        val androidDir = File(root, "Android").apply { mkdir() }

        val track1 = File(root, "track1.mp3").apply { createNewFile() }
        val track2 = File(subDir, "track2.flac").apply { createNewFile() }
        File(nomediaDir, "ignored.mp3").apply { createNewFile() }
        File(androidDir, "app_data.mp3").apply { createNewFile() }

        val discovered = MediaScanSynchronizer.discoverAudioFiles(listOf(root))
        assertEquals(2, discovered.size)
        assertTrue(discovered.contains(track1))
        assertTrue(discovered.contains(track2))
    }
}
