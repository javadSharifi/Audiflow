package com.audioconverter.app.booster

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.audiofx.AudioEffect
import android.util.Log
import androidx.annotation.Keep

@Keep
class AudioSessionReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "AudioSessionReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (!VolumeBoosterService.isServiceRunning) return
        
        val action = intent.action ?: return
        val sessionId = intent.getIntExtra(AudioEffect.EXTRA_AUDIO_SESSION, -1)
        if (sessionId == -1) return

        when (action) {
            AudioEffect.ACTION_OPEN_AUDIO_EFFECT_CONTROL_SESSION -> {
                Log.i(TAG, "Audio session opened: $sessionId")
                val serviceIntent = Intent(context, VolumeBoosterService::class.java).apply {
                    this.action = VolumeBoosterService.ACTION_ATTACH_SESSION
                    putExtra(VolumeBoosterService.EXTRA_SESSION_ID, sessionId)
                }
                context.startService(serviceIntent)
            }
            AudioEffect.ACTION_CLOSE_AUDIO_EFFECT_CONTROL_SESSION -> {
                Log.i(TAG, "Audio session closed: $sessionId")
                val serviceIntent = Intent(context, VolumeBoosterService::class.java).apply {
                    this.action = VolumeBoosterService.ACTION_DETACH_SESSION
                    putExtra(VolumeBoosterService.EXTRA_SESSION_ID, sessionId)
                }
                context.startService(serviceIntent)
            }
        }
    }
}
