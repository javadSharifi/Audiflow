package com.audioconverter.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioManager
import android.media.audiofx.AudioEffect
import android.os.Build
import android.util.Log
import androidx.annotation.Keep

/**
 * AudioSessionReceiver: Intercepts system-wide media audio sessions.
 *
 * External media players (Spotify, YouTube, SoundCloud, system music players)
 * broadcast ACTION_OPEN_AUDIO_EFFECT_CONTROL_SESSION when playback begins and
 * ACTION_CLOSE_AUDIO_EFFECT_CONTROL_SESSION when finished.
 *
 * This receiver captures those session IDs and dynamically binds BoostEngine's
 * LoudnessEnhancer pipeline to them, achieving zero-latency dual-routing boost.
 */
@Keep
class AudioSessionReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context?, intent: Intent?) {
    if (intent == null) return
    val action = intent.action ?: return

    val sessionId = intent.getIntExtra(AudioEffect.EXTRA_AUDIO_SESSION, -1)
    val pkgName = intent.getStringExtra(AudioEffect.EXTRA_PACKAGE_NAME) ?: "unknown"

    // Reject invalid audio session IDs
    if (sessionId <= 0 || sessionId == AudioManager.ERROR) {
      return
    }

    when (action) {
      AudioEffect.ACTION_OPEN_AUDIO_EFFECT_CONTROL_SESSION -> {
        Log.i(TAG, "OPEN_AUDIO_EFFECT_CONTROL_SESSION: pkg=$pkgName, session=$sessionId")
        BoostEngine.attachSession(sessionId)
      }
      AudioEffect.ACTION_CLOSE_AUDIO_EFFECT_CONTROL_SESSION -> {
        Log.i(TAG, "CLOSE_AUDIO_EFFECT_CONTROL_SESSION: pkg=$pkgName, session=$sessionId")
        BoostEngine.detachSession(sessionId)
      }
    }
  }

  companion object {
    private const val TAG = "AudioSessionReceiver"

    @Volatile
    private var registeredReceiver: AudioSessionReceiver? = null

    @Synchronized
    fun register(context: Context) {
      if (registeredReceiver != null) return
      try {
        val receiver = AudioSessionReceiver()
        val filter = IntentFilter().apply {
          addAction(AudioEffect.ACTION_OPEN_AUDIO_EFFECT_CONTROL_SESSION)
          addAction(AudioEffect.ACTION_CLOSE_AUDIO_EFFECT_CONTROL_SESSION)
        }

        // Must be RECEIVER_EXPORTED on API 33+ / 34+ so 3rd party media players can send session intents
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          context.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
        } else {
          context.registerReceiver(receiver, filter)
        }
        registeredReceiver = receiver
        Log.i(TAG, "AudioSessionReceiver registered dynamically")
      } catch (t: Throwable) {
        Log.w(TAG, "Could not register AudioSessionReceiver dynamically", t)
      }
    }

    @Synchronized
    fun unregister(context: Context) {
      val receiver = registeredReceiver ?: return
      try {
        context.unregisterReceiver(receiver)
        Log.i(TAG, "AudioSessionReceiver unregistered")
      } catch (t: Throwable) {
        Log.w(TAG, "Error unregistering AudioSessionReceiver", t)
      } finally {
        registeredReceiver = null
      }
    }
  }
}
