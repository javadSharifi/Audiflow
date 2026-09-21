package com.audiflow.app

import android.content.Context
import android.content.SharedPreferences
import android.media.AudioManager
import android.media.audiofx.LoudnessEnhancer
import android.util.Log
import androidx.annotation.Keep
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean

/**
 * BoostEngine: High-performance, system-wide loudness enhancement engine for Android.
 *
 * Implements the full reverse-engineered architecture from com.cool.volume.sound.booster v5.4.3 (C1282dj):
 * 1. Global Session 0 (AudioFlinger mix output) for direct hardware mix boost.
 * 2. Multi-Session Range Sweep (C1282dj.a algorithm): Generates audio session IDs to determine
 *    the system allocation step, then scans ~100 consecutive session IDs (from cur-45*step to cur+55*step).
 *    This hooks into System UI tracks (volume click/beep, keyboard sounds, lock sounds) and
 *    3rd-party media apps (Spotify, YouTube, Instagram, etc.).
 * 3. Dynamic AudioSessionReceiver tracking for apps that broadcast audio sessions.
 * 4. SharedPreferences persistence: restores booster gain on application start.
 * 5. Background Foreground Service + WakeLock persistence to prevent OEM killing.
 */
@Keep
object BoostEngine {
  private const val TAG = "BoostEngine"
  private const val PREFS_NAME = "sound_booster_prefs"
  private const val KEY_GAIN_MB = "target_gain_mb"

  // Reference app specification: up to 8000 mB (+80 dB nominal effect gain)
  const val MAX_GAIN_MB = 8000
  const val MIN_GAIN_MB = 0

  // Session 0 effect: Global output mix
  @Volatile
  private var globalEnhancer: LoudnessEnhancer? = null

  // Per-session enhancers: Map of sessionId -> LoudnessEnhancer
  private val sessionEnhancers = ConcurrentHashMap<Int, LoudnessEnhancer>()

  // Last requested gain (in millibels)
  @Volatile
  private var targetGainMb: Int = 0

  // Dedup guard: last successfully applied gain (in millibels)
  @Volatile
  private var lastAppliedGainMb: Int = -1

  private val isScanning = AtomicBoolean(false)
  private var prefs: SharedPreferences? = null

  /**
   * Initialize BoostEngine on application / activity startup.
   * Loads saved gain, initializes global enhancer, and runs the session sweep in background.
   */
  fun init(context: Context) {
    try {
      val appCtx = context.applicationContext
      if (prefs == null) {
        prefs = appCtx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      }
      val savedGain = prefs?.getInt(KEY_GAIN_MB, 0) ?: 0
      Log.i(TAG, "BoostEngine initialized with saved gain: $savedGain mB")

      // Initialize global session 0
      applyGlobalGain(savedGain)

      if (savedGain > 0) {
        targetGainMb = savedGain
        try {
          BoostVolumeService.start(appCtx, savedGain)
        } catch (_: Throwable) {}
      }

      // Run initial multi-session sweep in background thread (exact C1282dj startup behavior)
      scanAndAttachSessions(appCtx)
    } catch (t: Throwable) {
      Log.w(TAG, "BoostEngine init error", t)
    }
  }

  /**
   * Multi-Session Range Sweep Algorithm (Reverse-Engineered from C1282dj.a):
   * Probes AudioManager for the current session ID sequence, determines the allocation step,
   * and creates LoudnessEnhancer instances on all active sessions around the current range.
   * This is how the reference app boosts System UI button clicks and external media.
   */
  fun scanAndAttachSessions(context: Context) {
    if (isScanning.getAndSet(true)) return

    Thread {
      try {
        val am = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
        if (am == null) {
          isScanning.set(false)
          return@Thread
        }

        val s1 = am.generateAudioSessionId()
        val s2 = am.generateAudioSessionId()
        var step = s2 - s1
        if (step < 1) step = 1

        val cur = s2
        // Reference app: 45 steps backwards, 55 steps forwards (total 100 sessions)
        val start = cur - (45 * step)
        val end = start + (100 * step)
        val currentGain = targetGainMb

        var attachedCount = 0
        var sess = start
        while (sess <= end) {
          if (sess > 0 && !sessionEnhancers.containsKey(sess)) {
            try {
              val enhancer = LoudnessEnhancer(sess)
              if (currentGain > 0) {
                enhancer.enabled = true
                enhancer.setTargetGain(currentGain)
              }
              sessionEnhancers[sess] = enhancer
              attachedCount++
            } catch (_: Throwable) {
              // Session inactive or restricted by OS — safe to skip
            }
          }
          sess += step
        }

        Log.i(TAG, "Session sweep complete: attached $attachedCount new sessions (total tracked: ${sessionEnhancers.size}, cur=$cur, step=$step)")
      } catch (t: Throwable) {
        Log.w(TAG, "Session sweep failed", t)
      } finally {
        isScanning.set(false)
      }
    }.start()
  }

  /**
   * Set target boost in millibels (0..8000 mB).
   * Safe to call from any thread at any time.
   */
  @Synchronized
  fun setGainMb(gainMb: Int) {
    val clamped = gainMb.coerceIn(MIN_GAIN_MB, MAX_GAIN_MB)
    targetGainMb = clamped

    // Save to SharedPreferences for startup persistence
    try {
      prefs?.edit()?.putInt(KEY_GAIN_MB, clamped)?.apply()
    } catch (_: Throwable) {}

    val g = globalEnhancer
    val needsReAssert = g != null && clamped > 0 && !g.enabled
    if (lastAppliedGainMb == clamped && !needsReAssert) {
      return
    }
    lastAppliedGainMb = clamped

    // 1. Apply to Global Enhancer (Session 0)
    applyGlobalGain(clamped)

    // 2. Apply to all tracked audio sessions (ExoPlayer + system UI + external players)
    val iterator = sessionEnhancers.entries.iterator()
    while (iterator.hasNext()) {
      val entry = iterator.next()
      val sessionId = entry.key
      val enhancer = entry.value
      try {
        if (clamped > 0) {
          if (!enhancer.enabled) {
            enhancer.enabled = true
          }
          enhancer.setTargetGain(clamped)
        } else {
          enhancer.setTargetGain(0)
          if (enhancer.enabled) {
            enhancer.enabled = false
          }
        }
      } catch (t: Throwable) {
        Log.w(TAG, "Error applying gain to session $sessionId, releasing", t)
        try {
          enhancer.release()
        } catch (_: Throwable) {}
        iterator.remove()
      }
    }

    // If boost is active and we have few tracked sessions, sweep again to catch any new sessions
    val ctx = MainActivity.appContext
    if (clamped > 0 && ctx != null && sessionEnhancers.size < 5) {
      scanAndAttachSessions(ctx)
    }

    // 3. Manage Background Persistence (Foreground Service & WakeLock)
    try {
      if (ctx != null) {
        if (clamped > 0) {
          BoostVolumeService.start(ctx, clamped)
        } else {
          BoostVolumeService.stop(ctx)
        }
      }
    } catch (t: Throwable) {
      Log.w(TAG, "Failed to update BoostVolumeService", t)
    }

    Log.i(TAG, "setGainMb: applied $clamped mB to Session 0 and ${sessionEnhancers.size} active sessions")
  }

  private fun applyGlobalGain(gainMb: Int) {
    try {
      var g = globalEnhancer
      if (g == null) {
        g = LoudnessEnhancer(0)
        globalEnhancer = g
      }

      if (gainMb > 0) {
        if (!g.enabled) {
          g.enabled = true
        }
        g.setTargetGain(gainMb)
      } else {
        g.setTargetGain(0)
        if (g.enabled) {
          g.enabled = false
        }
      }
    } catch (t: Throwable) {
      Log.w(TAG, "Global LoudnessEnhancer(0) error, releasing for re-init on next call", t)
      try {
        globalEnhancer?.release()
      } catch (_: Throwable) {}
      globalEnhancer = null
    }
  }

  /**
   * Set target boost in dB (1 dB = 100 mB).
   */
  fun setGainDb(gainDb: Float) {
    val mb = Math.round(gainDb * 100f)
    setGainMb(mb)
  }

  /**
   * Set target boost from a UI percentage (e.g. 0% to 400%).
   */
  fun setGainFromPercent(percent: Float) {
    if (percent <= 100f) {
      setGainMb(0)
    } else {
      val fraction = (percent - 100f).coerceIn(0f, 300f) / 300f
      val mb = Math.round(fraction * MAX_GAIN_MB)
      setGainMb(mb)
    }
  }

  fun getTargetGainMb(): Int = targetGainMb

  /**
   * Re-assert booster state on volume key changes or app resume.
   * Catches newly spawned audio tracks like system UI volume feedback beeps.
   */
  fun reAssert() {
    val gain = targetGainMb
    if (gain <= 0) return

    val g = globalEnhancer
    if (g != null && !g.enabled) {
      try {
        g.enabled = true
        g.setTargetGain(gain)
      } catch (_: Throwable) {}
    }

    val ctx = MainActivity.appContext
    if (ctx != null) {
      scanAndAttachSessions(ctx)
    }
  }

  /**
   * Attach an individual audio session (e.g. from ExoPlayer onAudioSessionIdChanged or AudioEffect broadcast).
   */
  @Synchronized
  fun attachSession(sessionId: Int) {
    if (sessionId <= 0 || sessionId == AudioManager.ERROR) return

    val existing = sessionEnhancers[sessionId]
    if (existing != null) {
      try {
        if (targetGainMb > 0) {
          if (!existing.enabled) existing.enabled = true
          existing.setTargetGain(targetGainMb)
        }
        return
      } catch (t: Throwable) {
        Log.w(TAG, "Failed to re-assert existing session $sessionId", t)
        try { existing.release() } catch (_: Throwable) {}
        sessionEnhancers.remove(sessionId)
      }
    }

    try {
      val enhancer = LoudnessEnhancer(sessionId)
      if (targetGainMb > 0) {
        enhancer.enabled = true
        enhancer.setTargetGain(targetGainMb)
      } else {
        enhancer.enabled = false
      }
      sessionEnhancers[sessionId] = enhancer
      Log.i(TAG, "Successfully attached LoudnessEnhancer to session $sessionId (gain=$targetGainMb mB)")
    } catch (t: Throwable) {
      Log.w(TAG, "Could not attach LoudnessEnhancer to session $sessionId", t)
    }
  }

  /**
   * Detach an audio session when no longer active.
   */
  @Synchronized
  fun detachSession(sessionId: Int) {
    val enhancer = sessionEnhancers.remove(sessionId) ?: return
    try {
      enhancer.release()
    } catch (_: Throwable) {}
    Log.i(TAG, "Detached session $sessionId")
  }

  /**
   * Teardown and release all audio effect instances.
   */
  @Synchronized
  fun releaseAll() {
    for ((_, enhancer) in sessionEnhancers) {
      try { enhancer.release() } catch (_: Throwable) {}
    }
    sessionEnhancers.clear()

    try {
      globalEnhancer?.release()
    } catch (_: Throwable) {}
    globalEnhancer = null

    try {
      val ctx = MainActivity.appContext
      if (ctx != null) {
        BoostVolumeService.stop(ctx)
      }
    } catch (_: Throwable) {}

    lastAppliedGainMb = -1
    Log.i(TAG, "BoostEngine released all audio effects")
  }
}
