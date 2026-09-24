package com.audiflow.app

import android.content.Context
import android.media.MediaScannerConnection
import android.os.Environment
import android.os.SystemClock
import android.util.Log
import androidx.annotation.Keep
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

/**
 * Result data holder for a media store synchronization cycle.
 */
@Keep
data class MediaScanSyncResult(
  val scannedFilesCount: Int,
  val indexedFilesCount: Int,
  val durationMs: Long,
  val timedOut: Boolean
)

/**
 * MediaScanSynchronizer: Scans user storage directories for new/un-indexed audio files
 * and prompts Android's system MediaScanner to index them into MediaStore.
 */
@Keep
object MediaScanSynchronizer {
  private const val TAG = "MediaScanSynchronizer"
  private const val MAX_DEPTH = 4
  private const val MAX_CANDIDATES = 500
  private const val DEFAULT_TIMEOUT_MS = 2500L

  private val SUPPORTED_AUDIO_EXTENSIONS = setOf(
    "mp3", "m4a", "aac", "flac", "wav", "ogg", "opus"
  )

  /**
   * Check if a given file name or extension represents a supported audio format.
   */
  fun isSupportedAudioFile(file: File): Boolean {
    if (!file.isFile || file.name.startsWith(".")) return false
    val ext = file.extension.lowercase()
    return SUPPORTED_AUDIO_EXTENSIONS.contains(ext)
  }

  /**
   * Collect candidate directory roots to scan for audio files.
   */
  fun getCandidateRoots(context: Context): List<File> {
    val roots = LinkedHashSet<File>()

    // Standard public media directories
    try {
      Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC)?.let {
        if (it.exists() && it.canRead()) roots.add(it)
      }
      Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)?.let {
        if (it.exists() && it.canRead()) roots.add(it)
      }
    } catch (t: Throwable) {
      Log.w(TAG, "Error resolving standard public directories", t)
    }

    // Common standard paths
    for (p in listOf("/storage/emulated/0/Music", "/storage/emulated/0/Download", "/sdcard/Music", "/sdcard/Download")) {
      val f = File(p)
      if (f.exists() && f.canRead()) roots.add(f)
    }

    // External volumes (SD cards, USB OTG drives)
    try {
      val externalDirs = context.getExternalFilesDirs(null)
      for (extDir in externalDirs) {
        if (extDir == null) continue
        // Climb up to the root of the volume (e.g. /storage/XXXX-XXXX)
        var volumeRoot = extDir
        while (volumeRoot.parentFile != null && volumeRoot.parentFile?.name != "storage") {
          volumeRoot = volumeRoot.parentFile ?: break
        }
        if (volumeRoot.exists() && volumeRoot.canRead() && volumeRoot.name != "emulated") {
          // Look for Music or root of OTG volume
          val musicOnVol = File(volumeRoot, "Music")
          if (musicOnVol.exists() && musicOnVol.canRead()) {
            roots.add(musicOnVol)
          } else {
            roots.add(volumeRoot)
          }
        }
      }
    } catch (t: Throwable) {
      Log.w(TAG, "Error resolving external storage volumes", t)
    }

    return roots.toList()
  }

  /**
   * Recursively crawl directories up to MAX_DEPTH and collect candidate audio files.
   */
  fun discoverAudioFiles(roots: List<File>, limit: Int = MAX_CANDIDATES): List<File> {
    val candidates = ArrayList<File>()

    for (root in roots) {
      if (candidates.size >= limit) break
      crawl(root, 0, candidates, limit)
    }

    return candidates
  }

  private fun crawl(dir: File, currentDepth: Int, output: ArrayList<File>, limit: Int) {
    if (currentDepth > MAX_DEPTH || output.size >= limit || !dir.exists() || !dir.canRead()) return

    // Ignore hidden dirs, Android app-private data dirs, and .nomedia folders
    val dirName = dir.name
    if (dirName.startsWith(".") || dirName.equals("Android", ignoreCase = true) || dirName.equals(".trash", ignoreCase = true)) {
      return
    }
    if (File(dir, ".nomedia").exists()) {
      return
    }

    val entries = dir.listFiles() ?: return
    for (entry in entries) {
      if (output.size >= limit) break
      if (entry.isDirectory) {
        crawl(entry, currentDepth + 1, output, limit)
      } else if (isSupportedAudioFile(entry)) {
        output.add(entry)
      }
    }
  }

  /**
   * Synchronize discovered audio files with Android's MediaScanner.
   * Blocks until all files are registered or timeout is reached.
   */
  fun syncStorageDirectories(context: Context, timeoutMs: Long = DEFAULT_TIMEOUT_MS): MediaScanSyncResult {
    val startTime = SystemClock.elapsedRealtime()
    val roots = getCandidateRoots(context)
    val files = discoverAudioFiles(roots)

    if (files.isEmpty()) {
      return MediaScanSyncResult(0, 0, SystemClock.elapsedRealtime() - startTime, false)
    }

    Log.i(TAG, "Syncing ${files.size} candidate audio files with MediaScannerConnection...")
    val paths = files.map { it.absolutePath }.toTypedArray()
    val latch = CountDownLatch(paths.size)
    val indexedCount = AtomicInteger(0)

    try {
      MediaScannerConnection.scanFile(context, paths, null) { path, uri ->
        if (uri != null) {
          indexedCount.incrementAndGet()
        } else {
          Log.w(TAG, "MediaScanner returned null URI for: $path")
        }
        latch.countDown()
      }

      val completedInTime = latch.await(timeoutMs, TimeUnit.MILLISECONDS)
      val elapsed = SystemClock.elapsedRealtime() - startTime
      Log.i(TAG, "MediaScanner sync completed: ${indexedCount.get()}/${paths.size} indexed in ${elapsed}ms (timedOut=${!completedInTime})")

      return MediaScanSyncResult(
        scannedFilesCount = paths.size,
        indexedFilesCount = indexedCount.get(),
        durationMs = elapsed,
        timedOut = !completedInTime
      )
    } catch (e: Throwable) {
      Log.e(TAG, "MediaScanner sync error", e)
      return MediaScanSyncResult(
        scannedFilesCount = paths.size,
        indexedFilesCount = indexedCount.get(),
        durationMs = SystemClock.elapsedRealtime() - startTime,
        timedOut = false
      )
    }
  }
}
