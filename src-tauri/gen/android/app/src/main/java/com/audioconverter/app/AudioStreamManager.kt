package com.audioconverter.app

import android.content.Context
import android.media.AudioManager
import android.util.Log
import androidx.annotation.Keep

/**
 * AudioStreamManager: Hardware AudioManager facade for STREAM_MUSIC manipulation.
 *
 * Implements stream volume co-management verified from production sound boosters:
 * 1. Read & write hardware media volume (STREAM_MUSIC).
 * 2. Query system max volume steps.
 * 3. Reduce Hurt protection: safe volume scaling at high boost levels to prevent
 *    severe digital clipping and hardware speaker damage.
 */
@Keep
object AudioStreamManager {
  private const val TAG = "AudioStreamManager"

  private fun getAudioManager(context: Context): AudioManager? {
    return try {
      context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
    } catch (t: Throwable) {
      Log.w(TAG, "Failed to obtain AudioManager", t)
      null
    }
  }

  /**
   * Returns current hardware media volume step (0..maxVolume).
   */
  fun getStreamVolume(context: Context): Int {
    return try {
      val am = getAudioManager(context) ?: return 0
      am.getStreamVolume(AudioManager.STREAM_MUSIC)
    } catch (t: Throwable) {
      Log.w(TAG, "getStreamVolume failed", t)
      0
    }
  }

  /**
   * Returns maximum hardware media volume step for this device (typically 15 or 25).
   */
  fun getStreamMaxVolume(context: Context): Int {
    return try {
      val am = getAudioManager(context) ?: return 15
      am.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
    } catch (t: Throwable) {
      Log.w(TAG, "getStreamMaxVolume failed", t)
      15
    }
  }

  /**
   * Sets hardware media volume step directly.
   * @param volume step in range 0..maxVolume
   * @param showUi if true, displays the OEM volume slider overlay on screen
   */
  fun setStreamVolume(context: Context, volume: Int, showUi: Boolean = false): String {
    return try {
      val am = getAudioManager(context) ?: return "AUDIO_MANAGER_NULL"
      val max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
      val clamped = volume.coerceIn(0, max)
      val flags = if (showUi) AudioManager.FLAG_SHOW_UI else 0
      am.setStreamVolume(AudioManager.STREAM_MUSIC, clamped, flags)
      "OK"
    } catch (t: Throwable) {
      Log.e(TAG, "setStreamVolume failed", t)
      t.message ?: "ERROR"
    }
  }

  /**
   * Returns hardware volume as a 0.0..1.0 fraction.
   */
  fun getStreamVolumeFraction(context: Context): Float {
    val max = getStreamMaxVolume(context)
    if (max <= 0) return 1f
    return getStreamVolume(context).toFloat() / max.toFloat()
  }

  /**
   * Sets hardware volume from a 0.0..1.0 fraction.
   */
  fun setStreamVolumeFraction(context: Context, fraction: Float, showUi: Boolean = false): String {
    val max = getStreamMaxVolume(context)
    val targetStep = Math.round(fraction.coerceIn(0f, 1f) * max)
    return setStreamVolume(context, targetStep, showUi)
  }

  /**
   * "Reduce Hurt" safety flow:
   * Safely resets boost gain to safe baseline (0 mB = 100%) without altering
   * the operating system's hardware media stream volume (STREAM_MUSIC).
   */
  fun applyReduceHurt(context: Context): String {
    return try {
      // Reset boost gain to safe baseline (0 mB = 100%)
      BoostEngine.setGainMb(0)
      Log.i(TAG, "Reduce hurt safety protection applied (boost gain reset to 0 mB, hardware stream volume preserved)")
      "OK"
    } catch (t: Throwable) {
      Log.e(TAG, "applyReduceHurt failed", t)
      t.message ?: "ERROR"
    }
  }
}
