package com.audioconverter.app.booster

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.annotation.Keep
import androidx.core.app.NotificationCompat
import com.audioconverter.app.MainActivity

@Keep
class VolumeBoosterService : Service() {

    companion object {
        private const val TAG = "VolumeBoosterService"
        private const val NOTIFICATION_ID = 3001
        private const val CHANNEL_ID = "volume_booster_channel"

        const val ACTION_START = "com.audioconverter.app.action.START_VOLUME_BOOST"
        const val ACTION_STOP = "com.audioconverter.app.action.STOP_VOLUME_BOOST"
        const val ACTION_SET_LEVEL = "com.audioconverter.app.action.SET_VOLUME_BOOST_LEVEL"
        const val ACTION_ATTACH_SESSION = "com.audioconverter.app.action.ATTACH_SESSION"
        const val ACTION_DETACH_SESSION = "com.audioconverter.app.action.DETACH_SESSION"
        
        const val EXTRA_LEVEL = "extra_level"
        const val EXTRA_SESSION_ID = "extra_session_id"

        @Volatile
        var isServiceRunning = false
            private set

        @Volatile
        var currentLevel = 0
            private set
            
        @Volatile
        var currentEngine = "none"
            private set
    }

    private var boostManager: AudioBoostManager? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                val level = intent.getIntExtra(EXTRA_LEVEL, currentLevel)
                startBooster(level)
            }
            ACTION_STOP -> {
                stopBooster()
            }
            ACTION_SET_LEVEL -> {
                val level = intent.getIntExtra(EXTRA_LEVEL, currentLevel)
                updateLevel(level)
            }
            ACTION_ATTACH_SESSION -> {
                val sessionId = intent.getIntExtra(EXTRA_SESSION_ID, -1)
                if (sessionId != -1) {
                    boostManager?.attachSession(sessionId)
                }
            }
            ACTION_DETACH_SESSION -> {
                val sessionId = intent.getIntExtra(EXTRA_SESSION_ID, -1)
                if (sessionId != -1) {
                    boostManager?.detachSession(sessionId)
                }
            }
        }
        return START_STICKY
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "Volume Booster"
            val importance = NotificationManager.IMPORTANCE_LOW
            val channel = NotificationChannel(CHANNEL_ID, name, importance).apply {
                setShowBadge(false)
            }
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(level: Int, dbGain: Float): android.app.Notification {
        val stopIntent = Intent(this, VolumeBoosterService::class.java).apply {
            action = ACTION_STOP
        }
        val stopPendingIntent = PendingIntent.getService(
            this, 0, stopIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val openAppIntent = packageManager.getLaunchIntentForPackage(packageName)
        val openPendingIntent = PendingIntent.getActivity(
            this, 0, openAppIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        
        val dbStr = String.format("%.1f", dbGain)

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("🔊 Volume Booster Active (+$dbStr dB)")
            .setContentText("Volume boost is running at $level%")
            .setSmallIcon(android.R.drawable.ic_lock_silent_mode_off)
            .setContentIntent(openPendingIntent)
            .addAction(android.R.drawable.ic_delete, "Stop / توقف", stopPendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun startBooster(level: Int) {
        currentLevel = level.coerceIn(0, 100)
        val dbGain = (currentLevel / 100.0f) * 15.0f

        val notification = buildNotification(currentLevel, dbGain)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        if (boostManager == null) {
            boostManager = AudioBoostManager()
        }
        
        boostManager?.initializeGlobal()
        boostManager?.applyGain(currentLevel)
        
        val status = boostManager?.getStatus()
        currentEngine = status?.engine ?: "none"
        
        isServiceRunning = true
        MainActivity.notifyVolumeBoosterState(true, currentLevel, currentEngine)
        Log.i(TAG, "Volume Booster started")
    }
    
    private fun updateLevel(level: Int) {
        currentLevel = level.coerceIn(0, 100)
        boostManager?.applyGain(currentLevel)
        
        val dbGain = (currentLevel / 100.0f) * 15.0f
        if (isServiceRunning) {
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.notify(NOTIFICATION_ID, buildNotification(currentLevel, dbGain))
            
            MainActivity.notifyVolumeBoosterState(true, currentLevel, currentEngine)
        }
    }

    private fun stopBooster() {
        val wasRunning = isServiceRunning
        isServiceRunning = false
        
        boostManager?.releaseAll()
        boostManager = null
        currentEngine = "none"

        if (wasRunning) {
            MainActivity.notifyVolumeBoosterState(false, currentLevel, currentEngine)
        }

        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
        Log.i(TAG, "Volume Booster stopped")
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        boostManager?.releaseAll()
    }

    override fun onDestroy() {
        boostManager?.releaseAll()
        super.onDestroy()
    }
}
