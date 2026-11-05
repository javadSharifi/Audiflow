package com.audioconverter.app.booster

import android.media.audiofx.AudioEffect
import android.media.audiofx.DynamicsProcessing
import android.media.audiofx.LoudnessEnhancer
import android.os.Build
import android.util.Log
import androidx.annotation.Keep
import java.util.concurrent.ConcurrentHashMap

@Keep
enum class BoosterEngine { LOUDNESS_ENHANCER, DYNAMICS_PROCESSING, NONE }

@Keep
data class BoosterStatusData(
    val enabled: Boolean,
    val level: Int,
    val engine: String,
    val controlLost: Boolean
)

@Keep
class AudioBoostManager {
    companion object {
        private const val TAG = "AudioBoostManager"
        private const val MAX_GAIN_DB = 15.0f
        private const val EFFECT_PRIORITY = Int.MAX_VALUE / 2
    }

    private var engineType = BoosterEngine.NONE
    private var globalEffect: AudioEffect? = null
    private val sessionEffects = ConcurrentHashMap<Int, AudioEffect>()
    private var currentLevel: Int = 0
    private var controlLost: Boolean = false

    private val controlStatusChangeListener = AudioEffect.OnControlStatusChangeListener { effect, controlGranted ->
        if (effect == globalEffect && !controlGranted) {
            Log.w(TAG, "OS revoked control of global audio effect")
            controlLost = true
        }
    }

    fun initializeGlobal(): Boolean {
        controlLost = false
        val effect = createEffect(0)
        if (effect != null) {
            globalEffect = effect
            effect.setControlStatusListener(controlStatusChangeListener)
            effect.enabled = true
            return true
        }
        return false
    }

    fun attachSession(sessionId: Int) {
        if (sessionEffects.containsKey(sessionId)) return
        val effect = createEffect(sessionId)
        if (effect != null) {
            effect.enabled = true
            sessionEffects[sessionId] = effect
            applyGainToEffect(effect, currentLevel)
        }
    }

    fun detachSession(sessionId: Int) {
        sessionEffects.remove(sessionId)?.let { effect ->
            try {
                effect.release()
            } catch (t: Throwable) {
                Log.w(TAG, "Error releasing session effect for session $sessionId", t)
            }
        }
    }

    private fun createEffect(sessionId: Int): AudioEffect? {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            try {
                val configBuilder = DynamicsProcessing.Config.Builder(
                    DynamicsProcessing.VARIANT_FAVOR_FREQUENCY_RESOLUTION,
                    2, // channels
                    true, 1, // preEq: inUse=true, bandCount=1
                    false, 0, // mbc
                    false, 0, // postEq
                    true // limiter
                )

                val dpConfig = configBuilder.build()
                for (ch in 0 until 2) {
                    val eq = DynamicsProcessing.Eq(true, true, 1)
                    eq.setBand(0, DynamicsProcessing.EqBand(true, 100.0f, -15.0f))
                    dpConfig.setPreEqByChannelIndex(ch, eq)
                    
                    val lim = DynamicsProcessing.Limiter(true, true, 0, 0f, 10.0f, 5.0f, 50.0f, 10.0f)
                    dpConfig.setLimiterByChannelIndex(ch, lim)
                }
                
                val effect = DynamicsProcessing(EFFECT_PRIORITY, sessionId, dpConfig)
                engineType = BoosterEngine.DYNAMICS_PROCESSING
                Log.i(TAG, "Created DynamicsProcessing for session $sessionId")
                return effect
            } catch (t: Throwable) {
                Log.w(TAG, "DynamicsProcessing creation failed, falling back to LoudnessEnhancer", t)
            }
        }
        
        try {
            val effect = LoudnessEnhancer(sessionId)
            engineType = BoosterEngine.LOUDNESS_ENHANCER
            Log.i(TAG, "Created LoudnessEnhancer for session $sessionId")
            return effect
        } catch (t: Throwable) {
            Log.e(TAG, "Failed to create LoudnessEnhancer for session $sessionId", t)
        }
        return null
    }

    fun applyGain(percentage: Int) {
        currentLevel = percentage.coerceIn(0, 100)
        globalEffect?.let { applyGainToEffect(it, currentLevel) }
        for (effect in sessionEffects.values) {
            applyGainToEffect(effect, currentLevel)
        }
    }

    private fun applyGainToEffect(effect: AudioEffect, percentage: Int) {
        val gainDb = (percentage / 100.0f) * MAX_GAIN_DB
        try {
            when (effect) {
                is DynamicsProcessing -> {
                    effect.setInputGainAllChannelsTo(gainDb)
                }
                is LoudnessEnhancer -> {
                    effect.setTargetGain((gainDb * 100).toInt())
                }
            }
        } catch (t: Throwable) {
            Log.w(TAG, "Error applying gain to effect", t)
        }
    }

    fun releaseAll() {
        globalEffect?.let {
            try {
                it.setControlStatusListener(null)
                it.release()
            } catch (t: Throwable) {
                Log.w(TAG, "Error releasing global effect", t)
            }
            globalEffect = null
        }
        
        val sessions = sessionEffects.keys.toList()
        for (sessionId in sessions) {
            detachSession(sessionId)
        }
        sessionEffects.clear()
        engineType = BoosterEngine.NONE
    }

    fun getStatus(): BoosterStatusData {
        val typeStr = when (engineType) {
            BoosterEngine.LOUDNESS_ENHANCER -> "loudnessEnhancer"
            BoosterEngine.DYNAMICS_PROCESSING -> "dynamicsProcessing"
            BoosterEngine.NONE -> "none"
        }
        return BoosterStatusData(
            enabled = globalEffect != null || sessionEffects.isNotEmpty(),
            level = currentLevel,
            engine = typeStr,
            controlLost = controlLost
        )
    }
}
