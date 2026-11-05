package com.audioconverter.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.MediaMetadata
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.annotation.Keep
import org.json.JSONObject

/**
 * Music player background playback.
 *
 * Audio itself keeps playing inside the WebView (so crossfade / EQ keep
 * working); this service only (1) holds a mediaPlayback foreground slot so
 * the process isn't killed, (2) publishes a MediaSession + media-style
 * notification, and (3) forwards control presses back to JS as
 * `ac:media-action` events via MainActivity.
 */
@Keep
class PlaybackService : Service() {

    companion object {
        private const val TAG = "PlaybackService"
        private const val NOTIFICATION_ID = 3101
        private const val CHANNEL_ID = "music_playback_channel"

        const val ACTION_UPDATE = "com.audioconverter.app.action.PLAYBACK_UPDATE"
        const val ACTION_STOP = "com.audioconverter.app.action.PLAYBACK_STOP"
        const val ACTION_MEDIA = "com.audioconverter.app.action.PLAYBACK_MEDIA"
        const val EXTRA_STATE = "extra_state"
        const val EXTRA_MEDIA = "extra_media"

        /** True while playing: MainActivity keeps the WebView resumed in background. */
        @Volatile
        var keepWebViewAlive = false
            private set
    }

    private var session: MediaSession? = null
    private var isForeground = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "Music playback", NotificationManager.IMPORTANCE_LOW)
                .apply { setShowBadge(false) }
            (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(channel)
        }
        session = MediaSession(this, "AudioConverterPlayer").apply {
            setCallback(object : MediaSession.Callback() {
                override fun onPlay() = MainActivity.dispatchMediaAction("play", 0.0)
                override fun onPause() = MainActivity.dispatchMediaAction("pause", 0.0)
                override fun onStop() = MainActivity.dispatchMediaAction("pause", 0.0)
                override fun onSkipToNext() = MainActivity.dispatchMediaAction("next", 0.0)
                override fun onSkipToPrevious() = MainActivity.dispatchMediaAction("prev", 0.0)
                override fun onSeekTo(pos: Long) = MainActivity.dispatchMediaAction("seek", pos / 1000.0)
            })
            isActive = true
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        try {
            when (intent?.action) {
                ACTION_UPDATE -> intent.getStringExtra(EXTRA_STATE)?.let { update(JSONObject(it)) }
                ACTION_MEDIA -> intent.getStringExtra(EXTRA_MEDIA)?.let { MainActivity.dispatchMediaAction(it, 0.0) }
                ACTION_STOP -> stopPlayback()
            }
        } catch (t: Throwable) {
            Log.e(TAG, "onStartCommand failed", t)
        }
        // Player state lives in the WebView; a system-restarted service would be empty.
        return START_NOT_STICKY
    }

    private fun update(s: JSONObject) {
        val title = s.optString("title")
        val artist = s.optString("artist")
        val playing = s.optBoolean("playing")
        val positionMs = (s.optDouble("positionSecs", 0.0) * 1000).toLong()
        val durationMs = (s.optDouble("durationSecs", 0.0) * 1000).toLong()
        val rate = s.optDouble("rate", 1.0).toFloat()

        session?.setMetadata(
            MediaMetadata.Builder()
                .putString(MediaMetadata.METADATA_KEY_TITLE, title)
                .putString(MediaMetadata.METADATA_KEY_ARTIST, artist)
                .putString(MediaMetadata.METADATA_KEY_ALBUM, s.optString("album"))
                .putLong(MediaMetadata.METADATA_KEY_DURATION, durationMs)
                .build()
        )
        session?.setPlaybackState(
            PlaybackState.Builder()
                .setActions(
                    PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PAUSE or
                        PlaybackState.ACTION_PLAY_PAUSE or PlaybackState.ACTION_SKIP_TO_NEXT or
                        PlaybackState.ACTION_SKIP_TO_PREVIOUS or PlaybackState.ACTION_SEEK_TO or
                        PlaybackState.ACTION_STOP
                )
                .setState(
                    if (playing) PlaybackState.STATE_PLAYING else PlaybackState.STATE_PAUSED,
                    positionMs,
                    if (playing) rate else 0f
                )
                .build()
        )

        val notification = buildNotification(title, artist, playing)
        keepWebViewAlive = playing
        if (playing) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
            isForeground = true
        } else {
            // Paused: drop the foreground slot but keep a swipe-dismissable notification.
            if (isForeground) {
                stopForeground(STOP_FOREGROUND_DETACH)
                isForeground = false
            }
            (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(NOTIFICATION_ID, notification)
        }
    }

    private fun mediaAction(icon: Int, label: String, media: String, req: Int): Notification.Action {
        val pi = PendingIntent.getService(
            this, req,
            Intent(this, PlaybackService::class.java).setAction(ACTION_MEDIA).putExtra(EXTRA_MEDIA, media),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return Notification.Action.Builder(android.graphics.drawable.Icon.createWithResource(this, icon), label, pi).build()
    }

    private fun buildNotification(title: String, artist: String, playing: Boolean): Notification {
        val openApp = PendingIntent.getActivity(
            this, 0, packageManager.getLaunchIntentForPackage(packageName),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION") Notification.Builder(this)
        }
        return builder
            .setContentTitle(title.ifEmpty { "Audio Converter" })
            .setContentText(artist)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentIntent(openApp)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setOngoing(playing)
            .addAction(mediaAction(android.R.drawable.ic_media_previous, "Previous", "prev", 1))
            .addAction(
                if (playing) mediaAction(android.R.drawable.ic_media_pause, "Pause", "pause", 2)
                else mediaAction(android.R.drawable.ic_media_play, "Play", "play", 3)
            )
            .addAction(mediaAction(android.R.drawable.ic_media_next, "Next", "next", 4))
            .setStyle(
                Notification.MediaStyle()
                    .setMediaSession(session?.sessionToken)
                    .setShowActionsInCompactView(0, 1, 2)
            )
            .build()
    }

    private fun stopPlayback() {
        keepWebViewAlive = false
        stopForeground(STOP_FOREGROUND_REMOVE)
        isForeground = false
        stopSelf()
    }

    override fun onDestroy() {
        keepWebViewAlive = false
        session?.release()
        session = null
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(NOTIFICATION_ID)
        super.onDestroy()
    }
}
