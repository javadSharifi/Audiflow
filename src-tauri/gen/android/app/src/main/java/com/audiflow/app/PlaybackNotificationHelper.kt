package com.audiflow.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.annotation.Keep
import androidx.annotation.OptIn
import androidx.core.app.NotificationCompat
import androidx.media3.common.util.UnstableApi
import androidx.media3.session.CommandButton
import androidx.media3.session.MediaNotification
import androidx.media3.session.MediaSession
import androidx.media3.session.SessionCommand
import com.google.common.collect.ImmutableList
import java.util.Locale

/**
 * PlaybackNotificationHelper: Manages notification channels, placeholder notifications,
 * and custom media notification providers for PlaybackService.
 */
@Keep
object PlaybackNotificationHelper {
  private const val TAG = "PlaybackNotification"
  const val NOTIFICATION_ID = 1001
  const val CHANNEL_ID = "RhythmMediaPlayback"
  const val ACTION_CLOSE = "com.audiflow.app.ACTION_CLOSE_PLAYER"
  const val ACTION_CLOSE_REQUEST_CODE = 9001
  const val CUSTOM_CMD_CLOSE = "com.audiflow.app.CLOSE"
  const val PLACEHOLDER_WATCHDOG_MS = 8000L

  /**
   * Label for the notification Close button.
   */
  fun closeLabel(context: Context): String {
    return try {
      context.getString(R.string.player_notification_close)
    } catch (_: Throwable) {
      if (Locale.getDefault().language == "fa") "بستن" else "Close"
    }
  }

  fun closePendingIntent(context: Context): PendingIntent {
    val closeIntent = Intent(context, PlaybackService::class.java).apply {
      action = ACTION_CLOSE
    }
    val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    } else {
      PendingIntent.FLAG_UPDATE_CURRENT
    }
    return PendingIntent.getService(context, ACTION_CLOSE_REQUEST_CODE, closeIntent, flags)
  }

  fun contentPendingIntent(context: Context): PendingIntent {
    val openIntent = Intent(context, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    } else {
      PendingIntent.FLAG_UPDATE_CURRENT
    }
    return PendingIntent.getActivity(context, 0, openIntent, flags)
  }

  fun buildCloseButton(context: Context): CommandButton {
    return CommandButton.Builder()
      .setDisplayName(closeLabel(context))
      .setSessionCommand(SessionCommand(CUSTOM_CMD_CLOSE, Bundle.EMPTY))
      .setIconResId(android.R.drawable.ic_menu_close_clear_cancel)
      .build()
  }

  fun createNotificationChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    try {
      val channel = NotificationChannel(
        CHANNEL_ID,
        context.getString(R.string.media3_notification_channel_name),
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        description = context.getString(R.string.media3_notification_channel_description)
        setShowBadge(false)
      }
      val nm = context.getSystemService(NotificationManager::class.java)
      nm.createNotificationChannel(channel)
    } catch (t: Throwable) {
      Log.w(TAG, "createNotificationChannel failed", t)
    }
  }

  fun buildPlaceholderNotification(context: Context): Notification? {
    return try {
      NotificationCompat.Builder(context, CHANNEL_ID)
        .setContentTitle(context.getString(R.string.app_name))
        .setContentText(context.getString(R.string.service_starting))
        .setSmallIcon(R.drawable.ic_notification)
        .setOngoing(true)
        .setCategory(NotificationCompat.CATEGORY_SERVICE)
        .setContentIntent(contentPendingIntent(context))
        .addAction(
          android.R.drawable.ic_menu_close_clear_cancel,
          closeLabel(context),
          closePendingIntent(context)
        )
        .build()
    } catch (t: Throwable) {
      Log.w(TAG, "Placeholder notification build failed", t)
      null
    }
  }

  /**
   * Media3 notification provider with an appended Close action for legacy notification shade.
   */
  open class CloseableNotificationProvider(
    private val context: Context
  ) : androidx.media3.session.DefaultMediaNotificationProvider(context) {
    init {
      setSmallIcon(R.drawable.ic_notification)
    }

    @OptIn(UnstableApi::class)
    override fun addNotificationActions(
      mediaSession: MediaSession,
      mediaButtons: ImmutableList<CommandButton>,
      builder: NotificationCompat.Builder,
      actionFactory: MediaNotification.ActionFactory
    ): IntArray {
      val shown = super.addNotificationActions(mediaSession, mediaButtons, builder, actionFactory)
      try {
        val alreadyShown = try {
          mediaButtons.any { it.sessionCommand?.customAction == CUSTOM_CMD_CLOSE }
        } catch (_: Throwable) {
          false
        }
        if (!alreadyShown) {
          builder.addAction(
            android.R.drawable.ic_menu_close_clear_cancel,
            closeLabel(context),
            closePendingIntent(context)
          )
        }
      } catch (t: Throwable) {
        Log.w(TAG, "Could not add Close action to media notification", t)
      }
      return shown
    }
  }
}
