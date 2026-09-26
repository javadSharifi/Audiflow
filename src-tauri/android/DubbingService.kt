package com.audiflow.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.annotation.Keep
import androidx.core.app.NotificationCompat

/**
 * DubbingService: Foreground service for system audio capture and dynamic ducking.
 * Adheres to Constitution Principle VIII (strictly <= 300 lines).
 */
@Keep
class DubbingService : Service() {

    private var audioManager: AudioManager? = null
    private var focusRequest: AudioFocusRequest? = null
    private var isDuckingActive = false

    companion object {
        private const val TAG = "DubbingService"
        const val CHANNEL_ID = "audiflow_dubbing_channel"
        const val NOTIFICATION_ID = 2001
        const val ACTION_START = "com.audiflow.app.dubbing.START"
        const val ACTION_STOP = "com.audiflow.app.dubbing.STOP"
        const val ACTION_TOGGLE_PAUSE = "com.audiflow.app.dubbing.TOGGLE_PAUSE"

        var isRunning = false
            private set
    }

    override fun onCreate() {
        super.onCreate()
        audioManager = getSystemService(Context.AUDIO_SERVICE) as? AudioManager
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopDubbing()
                stopSelf()
            }
            ACTION_TOGGLE_PAUSE -> {
                // Pause / resume logic
            }
            else -> {
                startForeground(NOTIFICATION_ID, buildNotification("Live Audio Dubbing Active"))
                isRunning = true
            }
        }
        return START_NOT_STICKY
    }

    fun requestAudioDucking(duck: Boolean) {
        val am = audioManager ?: return
        if (duck && !isDuckingActive) {
            val audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANT)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build()

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                focusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                    .setAudioAttributes(audioAttributes)
                    .setAcceptsDelayedFocusGain(true)
                    .setOnAudioFocusChangeListener { }
                    .build()
                am.requestAudioFocus(focusRequest!!)
            } else {
                @Suppress("DEPRECATION")
                am.requestAudioFocus(
                    { },
                    AudioManager.STREAM_MUSIC,
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
                )
            }
            isDuckingActive = true
            Log.d(TAG, "Dynamic audio ducking engaged")
        } else if (!duck && isDuckingActive) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                focusRequest?.let { am.abandonAudioFocusRequest(it) }
            } else {
                @Suppress("DEPRECATION")
                am.abandonAudioFocus { }
            }
            isDuckingActive = false
            Log.d(TAG, "Dynamic audio ducking released")
        }
    }

    private fun stopDubbing() {
        requestAudioDucking(false)
        isRunning = false
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Audiflow Live Dubbing",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Active background audio dubbing session"
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(statusText: String): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Audiflow Live Dubbing")
            .setContentText(statusText)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    override fun onDestroy() {
        stopDubbing()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
