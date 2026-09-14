package com.audioconverter.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.annotation.Keep
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

/**
 * BoostVolumeService: Background persistence and WakeLock keeper for BoostEngine.
 *
 * Implements the multi-Android version compatibility pattern verified from production boosters:
 * 1. API 34+ (Android 14/15) compliance: 3-argument startForeground with FOREGROUND_SERVICE_TYPE_SPECIAL_USE.
 * 2. Legacy fallback: standard startForeground on Android 13 and below.
 * 3. PARTIAL_WAKE_LOCK management: keeps the audio effect pipeline alive when the screen turns off.
 * 4. Automatic lifecycle: starts only when boost > 0, stops cleanly and releases resources when boost == 0.
 */
@Keep
class BoostVolumeService : Service() {

  private var wakeLock: PowerManager.WakeLock? = null

  override fun onCreate() {
    super.onCreate()
    Log.i(TAG, "BoostVolumeService onCreate")
    createNotificationChannel()
    acquireWakeLock()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent != null && intent.action == ACTION_STOP_BOOST) {
      Log.i(TAG, "ACTION_STOP_BOOST received; stopping booster service")
      BoostEngine.setGainMb(0)
      stopForegroundCompat()
      stopSelf()
      return START_NOT_STICKY
    }

    val gainMb = intent?.getIntExtra(EXTRA_GAIN_MB, BoostEngine.getTargetGainMb()) ?: BoostEngine.getTargetGainMb()
    if (gainMb <= 0) {
      stopForegroundCompat()
      stopSelf()
      return START_NOT_STICKY
    }

    val notification = buildNotification(gainMb)
    startForegroundCompat(notification)
    return START_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onTaskRemoved(rootIntent: Intent?) {
    super.onTaskRemoved(rootIntent)
    // If boost is active, maintain foreground service so background audio remains boosted
    if (BoostEngine.getTargetGainMb() <= 0) {
      stopForegroundCompat()
      stopSelf()
    }
  }

  override fun onDestroy() {
    Log.i(TAG, "BoostVolumeService onDestroy")
    releaseWakeLock()
    stopForegroundCompat()
    super.onDestroy()
  }

  private fun acquireWakeLock() {
    if (wakeLock == null) {
      try {
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
          PowerManager.PARTIAL_WAKE_LOCK,
          "audioconverter:BoostVolumeService"
        ).apply {
          setReferenceCounted(false)
          acquire(6 * 60 * 60 * 1000L) // 6 hours safety timeout
        }
        Log.d(TAG, "Acquired PARTIAL_WAKE_LOCK")
      } catch (t: Throwable) {
        Log.w(TAG, "Could not acquire PARTIAL_WAKE_LOCK", t)
      }
    }
  }

  private fun releaseWakeLock() {
    try {
      wakeLock?.let {
        if (it.isHeld) {
          it.release()
          Log.d(TAG, "Released PARTIAL_WAKE_LOCK")
        }
      }
    } catch (t: Throwable) {
      Log.w(TAG, "Error releasing PARTIAL_WAKE_LOCK", t)
    } finally {
      wakeLock = null
    }
  }

  private fun startForegroundCompat(notification: Notification) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        // Android 14+ (API 34) requires explicit foreground service type
        startForeground(
          NOTIFICATION_ID,
          notification,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
        )
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
    } catch (t: Throwable) {
      Log.w(TAG, "startForegroundCompat failed, attempting notification post fallback", t)
      try {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIFICATION_ID, notification)
      } catch (_: Throwable) {}
    }
  }

  private fun stopForegroundCompat() {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        stopForeground(STOP_FOREGROUND_REMOVE)
      } else {
        @Suppress("DEPRECATION")
        stopForeground(true)
      }
    } catch (t: Throwable) {
      Log.w(TAG, "stopForegroundCompat error", t)
    }
  }

  private fun buildNotification(gainMb: Int): Notification {
    val percent = 100 + Math.round((gainMb.toFloat() / BoostEngine.MAX_GAIN_MB) * 300f)

    val openAppIntent = Intent(this, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val openAppPendingIntent = PendingIntent.getActivity(
      this,
      0,
      openAppIntent,
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT else PendingIntent.FLAG_UPDATE_CURRENT
    )

    val stopIntent = Intent(this, BoostVolumeService::class.java).apply {
      action = ACTION_STOP_BOOST
    }
    val stopPendingIntent = PendingIntent.getService(
      this,
      1,
      stopIntent,
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT else PendingIntent.FLAG_UPDATE_CURRENT
    )

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("تقویت صدای بلندگو")
      .setContentText("میزان افزایش صدا: $percent%")
      .setSmallIcon(R.drawable.ic_notification)
      .setOngoing(true)
      .setContentIntent(openAppPendingIntent)
      .addAction(0, "خاموش کردن", stopPendingIntent)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .build()
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    try {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "تقویت‌کننده صدا",
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        description = "نمایش وضعیت تقویت صدا در پس‌زمینه"
        setShowBadge(false)
      }
      val nm = getSystemService(NotificationManager::class.java)
      nm.createNotificationChannel(channel)
    } catch (t: Throwable) {
      Log.w(TAG, "createNotificationChannel error", t)
    }
  }

  companion object {
    private const val TAG = "BoostVolumeService"
    const val NOTIFICATION_ID = 23555 // Verified from production booster reference
    const val CHANNEL_ID = "boost_volume_channel"
    const val ACTION_STOP_BOOST = "com.audioconverter.app.ACTION_STOP_BOOST"
    const val ACTION_UPDATE_GAIN = "com.audioconverter.app.ACTION_UPDATE_GAIN"
    const val EXTRA_GAIN_MB = "extra_gain_mb"

    fun start(context: Context, gainMb: Int) {
      try {
        val intent = Intent(context, BoostVolumeService::class.java).apply {
          action = ACTION_UPDATE_GAIN
          putExtra(EXTRA_GAIN_MB, gainMb)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          ContextCompat.startForegroundService(context, intent)
        } else {
          context.startService(intent)
        }
      } catch (t: Throwable) {
        Log.w(TAG, "Could not start BoostVolumeService", t)
      }
    }

    fun stop(context: Context) {
      try {
        val intent = Intent(context, BoostVolumeService::class.java)
        context.stopService(intent)
      } catch (t: Throwable) {
        Log.w(TAG, "Could not stop BoostVolumeService", t)
      }
    }
  }
}
