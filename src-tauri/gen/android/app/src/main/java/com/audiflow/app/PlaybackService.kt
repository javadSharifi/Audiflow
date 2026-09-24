package com.audiflow.app

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.annotation.Keep
import androidx.annotation.OptIn
import androidx.core.content.ContextCompat
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionResult
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import org.json.JSONArray
import org.json.JSONObject

/**
 * Android Jetpack Media3 PlaybackService for high-fidelity, system-integrated
 * background audio playback, Lock Screen controls, Media Notifications,
 * Bluetooth headsets, and Audio Focus handling.
 */
@Keep
class PlaybackService : MediaSessionService() {

  private var mediaSession: MediaSession? = null
  private var player: ExoPlayer? = null
  private var currentAudioSessionId: Int = 0

  interface PlaybackEventListener {
    fun onPlaybackStateChanged(stateJson: String)
    fun onTrackTransition(trackJson: String)
    fun onIsPlayingChanged(isPlaying: Boolean)
  }

  override fun onCreate() {
    super.onCreate()
    instance = this
    Log.i(TAG, "Creating PlaybackService with Jetpack Media3")

    try {
      setMediaNotificationProvider(PlaybackNotificationHelper.CloseableNotificationProvider(this))
    } catch (t: Throwable) {
      Log.w(TAG, "Could not set custom notification provider", t)
    }
    PlaybackNotificationHelper.createNotificationChannel(this)
    startForegroundWithPlaceholder()

    try {
      val audioAttributes = AudioAttributes.Builder()
        .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
        .setUsage(C.USAGE_MEDIA)
        .build()

      player = ExoPlayer.Builder(this)
        .setAudioAttributes(audioAttributes, /* handleAudioFocus = */ true)
        .setHandleAudioBecomingNoisy(true)
        .setWakeMode(C.WAKE_MODE_LOCAL)
        .build()

      player?.addListener(object : Player.Listener {
        override fun onIsPlayingChanged(isPlaying: Boolean) {
          Log.d(TAG, "onIsPlayingChanged: $isPlaying")
          eventListener?.onIsPlayingChanged(isPlaying)
          broadcastStateUpdate()
        }

        override fun onPlaybackStateChanged(playbackState: Int) {
          Log.d(TAG, "onPlaybackStateChanged: $playbackState")
          broadcastStateUpdate()
        }

        override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
          Log.d(TAG, "onMediaItemTransition: ${mediaItem?.mediaId}, reason: $reason")
          lastErrorCode = null
          lastErrorMessage = null
          val trackJson = MediaItemBuilder.mediaItemToTrackJson(mediaItem)
          eventListener?.onTrackTransition(trackJson)
          broadcastStateUpdate()
        }

        override fun onPlayerError(error: PlaybackException) {
          Log.e(TAG, "Player error: ${error.errorCodeName} - ${error.message}", error)
          lastErrorCode = error.errorCodeName ?: "PLAYBACK_ERROR"
          lastErrorMessage = error.message
          broadcastStateUpdate()
        }

        override fun onAudioSessionIdChanged(audioSessionId: Int) {
          try {
            if (currentAudioSessionId > 0 && currentAudioSessionId != audioSessionId) {
              BoostEngine.detachSession(currentAudioSessionId)
            }
            currentAudioSessionId = audioSessionId
            if (audioSessionId > 0) {
              BoostEngine.attachSession(audioSessionId)
            }
          } catch (t: Throwable) {
            Log.w(TAG, "BoostEngine attach failed for session $audioSessionId", t)
          }
        }
      })

      val sessionActivityPendingIntent = PlaybackNotificationHelper.contentPendingIntent(this)
      val builder = MediaSession.Builder(this, player!!)
        .setSessionActivity(sessionActivityPendingIntent)
        .setCallback(SessionCallback())

      val session = builder.build()
      mediaSession = session
      addSession(session)
      try {
        session.setCustomLayout(listOf(PlaybackNotificationHelper.buildCloseButton(this)))
      } catch (t: Throwable) {
        Log.w(TAG, "Could not set custom Close layout", t)
      }
      Log.i(TAG, "MediaSession created successfully")
      drainPendingPlay()
    } catch (t: Throwable) {
      Log.e(TAG, "Failed to initialize MediaSessionService", t)
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == PlaybackNotificationHelper.ACTION_CLOSE) {
      Log.i(TAG, "ACTION_CLOSE received; stopping playback and dismissing notification")
      try {
        closeAndDismissNotification("action-close")
      } catch (t: Throwable) {
        Log.e(TAG, "ACTION_CLOSE handling failed", t)
      }
      return android.app.Service.START_NOT_STICKY
    }
    return try {
      super.onStartCommand(intent, flags, startId)
    } catch (t: Throwable) {
      Log.e(TAG, "onStartCommand failed", t)
      android.app.Service.START_NOT_STICKY
    }
  }

  @OptIn(UnstableApi::class)
  override fun onUpdateNotification(session: MediaSession, startInForegroundRequired: Boolean) {
    try {
      super.onUpdateNotification(session, startInForegroundRequired)
    } catch (t: Throwable) {
      Log.e(TAG, "onUpdateNotification failed", t)
    }
  }

  override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? {
    return try {
      mediaSession
    } catch (t: Throwable) {
      Log.e(TAG, "onGetSession failed", t)
      null
    }
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    try {
      val pl = player
      if (pl == null || !pl.playWhenReady || pl.mediaItemCount == 0) {
        try {
          stopSelf()
        } catch (t: Throwable) {
          Log.w(TAG, "stopSelf failed in onTaskRemoved", t)
        }
      } else {
        Log.i(TAG, "onTaskRemoved: continuing background playback")
      }
    } catch (t: Throwable) {
      Log.e(TAG, "onTaskRemoved failed", t)
    }
    try {
      super.onTaskRemoved(rootIntent)
    } catch (t: Throwable) {
      Log.e(TAG, "super.onTaskRemoved failed", t)
    }
  }

  override fun onDestroy() {
    Log.i(TAG, "Destroying PlaybackService")
    try {
      (getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager)
        .cancel(PlaybackNotificationHelper.NOTIFICATION_ID)
    } catch (_: Throwable) {}
    try {
      if (instance === this) {
        instance = null
      }
    } catch (_: Throwable) {}
    try {
      mediaSession?.run {
        try {
          if (isSessionAdded(this)) {
            removeSession(this)
          }
        } catch (t: Throwable) {
          Log.w(TAG, "removeSession failed in onDestroy", t)
        }
        try {
          player.release()
        } catch (t: Throwable) {
          Log.w(TAG, "player.release failed in onDestroy", t)
        }
        try {
          release()
        } catch (t: Throwable) {
          Log.w(TAG, "session.release failed in onDestroy", t)
        }
        mediaSession = null
      }
    } catch (t: Throwable) {
      Log.e(TAG, "mediaSession release failed in onDestroy", t)
    }
    player = null
    pendingPlay = null
    if (currentAudioSessionId > 0) {
      try {
        BoostEngine.detachSession(currentAudioSessionId)
      } catch (_: Throwable) {}
      currentAudioSessionId = 0
    }
    try {
      super.onDestroy()
    } catch (t: Throwable) {
      Log.e(TAG, "super.onDestroy failed", t)
    }
  }

  private fun broadcastStateUpdate() {
    val state = getCurrentStateJson()
    lastKnownStateJson = state
    try {
      eventListener?.onPlaybackStateChanged(state)
    } catch (t: Throwable) {
      Log.w(TAG, "eventListener onPlaybackStateChanged failed", t)
    }
  }

  private fun snapshotStateLocked(): String {
    val player = player ?: return "{}"
    return try {
      val currentItem = player.currentMediaItem
      val currentTrackJson = if (currentItem != null) {
        JSONObject(MediaItemBuilder.mediaItemToTrackJson(currentItem))
      } else {
        JSONObject.NULL
      }

      val json = JSONObject().apply {
        put("isPlaying", player.isPlaying)
        put("currentTimeMs", player.currentPosition.coerceAtLeast(0L))
        val dur = player.duration
        put("durationMs", if (dur != C.TIME_UNSET) dur.coerceAtLeast(0L) else 0L)
        put("currentIndex", player.currentMediaItemIndex)
        put("repeatMode", when (player.repeatMode) {
          Player.REPEAT_MODE_ONE -> "one"
          Player.REPEAT_MODE_ALL -> "all"
          else -> "off"
        })
        put("shuffleMode", player.shuffleModeEnabled)
        put("playbackRate", player.playbackParameters.speed)
        put("volume", player.volume)
        put("playbackState", player.playbackState)
        val errCode = lastErrorCode
        val errMsg = lastErrorMessage
        if (errCode != null) {
          put("errorCode", errCode)
          put("errorMessage", errMsg ?: JSONObject.NULL)
        }
        put("currentTrack", currentTrackJson)
      }
      val rendered = json.toString()
      lastKnownStateJson = rendered
      rendered
    } catch (t: Throwable) {
      Log.e(TAG, "snapshotStateLocked error", t)
      lastKnownStateJson ?: "{}"
    }
  }

  private fun drainPendingPlay() {
    val pending = pendingPlay ?: return
    pendingPlay = null
    Log.i(TAG, "Draining queued cold-start play request (index=${pending.startIndex})")
    try {
      mainHandler.post {
        try {
          instance?.let { service ->
            val player = service.player
            if (player == null) {
              Log.w(TAG, "Player still null while draining pending play")
              return@post
            }
            lastErrorCode = null
            lastErrorMessage = null
            val mediaItems = ArrayList<MediaItem>()
            if (!pending.playlistJson.isNullOrBlank()) {
              val arr = JSONArray(pending.playlistJson)
              for (i in 0 until arr.length()) {
                mediaItems.add(MediaItemBuilder.buildMediaItem(arr.getJSONObject(i), service))
              }
            }
            if (mediaItems.isEmpty() && pending.trackJson.isNotBlank()) {
              mediaItems.add(MediaItemBuilder.buildMediaItem(JSONObject(pending.trackJson), service))
            }
            if (mediaItems.isEmpty()) return@post
            val safeIndex = pending.startIndex.coerceIn(0, mediaItems.size - 1)
            player.setMediaItems(mediaItems, safeIndex, 0L)
            player.prepare()
            player.play()
          }
        } catch (t: Throwable) {
          Log.e(TAG, "Drain pending play failed", t)
        }
      }
    } catch (t: Throwable) {
      Log.e(TAG, "Could not schedule pending play drain", t)
    }
  }

  private fun startForegroundWithPlaceholder() {
    val notification = PlaybackNotificationHelper.buildPlaceholderNotification(this) ?: return
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(
          PlaybackNotificationHelper.NOTIFICATION_ID,
          notification,
          android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
        )
      } else {
        startForeground(PlaybackNotificationHelper.NOTIFICATION_ID, notification)
      }
      Log.d(TAG, "Early foreground promotion posted")
      try {
        mainHandler.postDelayed({
          try {
            val p = player
            if (p == null || p.mediaItemCount == 0) {
              Log.i(TAG, "Placeholder watchdog: no playback started, releasing")
              closeAndDismissNotification("placeholder-watchdog")
            }
          } catch (t: Throwable) {
            Log.w(TAG, "Placeholder watchdog failed", t)
          }
        }, PlaybackNotificationHelper.PLACEHOLDER_WATCHDOG_MS)
      } catch (t: Throwable) {
        Log.w(TAG, "Could not schedule placeholder watchdog", t)
      }
    } catch (t: Throwable) {
      Log.w(TAG, "Early startForeground blocked, using fallback notification", t)
      try {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
        nm.notify(PlaybackNotificationHelper.NOTIFICATION_ID, notification)
      } catch (_: Throwable) {}
    }
  }

  private fun closeAndDismissNotification(reason: String) {
    Log.i(TAG, "Closing player and dismissing notification ($reason)")
    try {
      player?.stop()
    } catch (t: Throwable) {
      Log.w(TAG, "player.stop failed during close", t)
    }
    try {
      player?.clearMediaItems()
    } catch (t: Throwable) {
      Log.w(TAG, "player.clearMediaItems failed during close", t)
    }
    try {
      lastErrorCode = null
      lastErrorMessage = null
    } catch (_: Throwable) {}
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        stopForeground(STOP_FOREGROUND_REMOVE)
      } else {
        @Suppress("DEPRECATION")
        stopForeground(true)
      }
    } catch (t: Throwable) {
      Log.w(TAG, "stopForeground failed during close", t)
    }
    try {
      (getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager)
        .cancel(PlaybackNotificationHelper.NOTIFICATION_ID)
    } catch (t: Throwable) {
      Log.w(TAG, "notification cancel failed during close", t)
    }
    try {
      broadcastStateUpdate()
    } catch (t: Throwable) {
      Log.w(TAG, "broadcastStateUpdate failed during close", t)
    }
    try {
      stopSelf()
    } catch (t: Throwable) {
      Log.w(TAG, "stopSelf failed during close", t)
    }
  }

  private inner class SessionCallback : MediaSession.Callback {
    override fun onConnect(
      session: MediaSession,
      controller: MediaSession.ControllerInfo
    ): MediaSession.ConnectionResult {
      return try {
        val withClose = MediaSession.ConnectionResult.DEFAULT_SESSION_COMMANDS
          .buildUpon()
          .add(SessionCommand(PlaybackNotificationHelper.CUSTOM_CMD_CLOSE, Bundle.EMPTY))
          .build()
        MediaSession.ConnectionResult.accept(
          withClose,
          MediaSession.ConnectionResult.DEFAULT_PLAYER_COMMANDS
        )
      } catch (t: Throwable) {
        Log.w(TAG, "onConnect custom command failed", t)
        super.onConnect(session, controller)
      }
    }

    override fun onCustomCommand(
      session: MediaSession,
      controller: MediaSession.ControllerInfo,
      customCommand: SessionCommand,
      extras: Bundle
    ): ListenableFuture<SessionResult> {
      return try {
        if (customCommand.customAction == PlaybackNotificationHelper.CUSTOM_CMD_CLOSE) {
          Log.i(TAG, "Custom CLOSE command received; dismissing player")
          try {
            closeAndDismissNotification("custom-command")
          } catch (t: Throwable) {
            Log.e(TAG, "Custom CLOSE handling failed", t)
          }
          Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
        } else {
          super.onCustomCommand(session, controller, customCommand, extras)
        }
      } catch (t: Throwable) {
        Log.e(TAG, "onCustomCommand failed", t)
        Futures.immediateFuture(SessionResult(SessionResult.RESULT_ERROR_UNKNOWN))
      }
    }
  }

  @Keep
  companion object {
    private const val TAG = "PlaybackService"

    @Volatile
    var instance: PlaybackService? = null

    @Volatile
    var eventListener: PlaybackEventListener? = null

    private val mainHandler = Handler(Looper.getMainLooper())

    private data class PendingPlay(
      val trackJson: String,
      val playlistJson: String?,
      val startIndex: Int
    )

    @Volatile
    private var pendingPlay: PendingPlay? = null

    @Volatile
    private var lastErrorCode: String? = null

    @Volatile
    private var lastErrorMessage: String? = null

    @Volatile
    private var lastKnownStateJson: String? = null

    private fun idleStateJson(): String = JSONObject().apply {
      put("isPlaying", false)
      put("currentTimeMs", 0)
      put("durationMs", 0)
      put("currentIndex", -1)
      put("currentTrack", JSONObject.NULL)
    }.toString()

    private fun ensureServiceStarted(context: Context) {
      if (instance == null) {
        try {
          val intent = Intent(context, PlaybackService::class.java)
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ContextCompat.startForegroundService(context, intent)
          } else {
            context.startService(intent)
          }
        } catch (t: Throwable) {
          Log.w(TAG, "Could not start PlaybackService", t)
        }
      }
    }

    @JvmStatic
    fun playTrack(context: Context, trackJson: String, playlistJson: String?, startIndex: Int): String {
      ensureServiceStarted(context)
      if (instance == null) {
        pendingPlay = PendingPlay(trackJson, playlistJson, startIndex)
        Log.i(TAG, "Service not ready; queued play request (index=$startIndex)")
        return "PENDING"
      }
      return runOnService { service ->
        val player = service.player ?: return@runOnService "PLAYER_NULL"
        try {
          lastErrorCode = null
          lastErrorMessage = null
          val mediaItems = ArrayList<MediaItem>()

          if (!playlistJson.isNullOrBlank()) {
            val arr = JSONArray(playlistJson)
            for (i in 0 until arr.length()) {
              val itemObj = arr.getJSONObject(i)
              mediaItems.add(MediaItemBuilder.buildMediaItem(itemObj, service))
            }
          }

          if (mediaItems.isEmpty() && trackJson.isNotBlank()) {
            val trackObj = JSONObject(trackJson)
            mediaItems.add(MediaItemBuilder.buildMediaItem(trackObj, service))
          }

          if (mediaItems.isEmpty()) {
            return@runOnService "NO_TRACKS"
          }

          val safeIndex = startIndex.coerceIn(0, mediaItems.size - 1)
          player.setMediaItems(mediaItems, safeIndex, 0L)
          player.prepare()
          player.play()
          "OK"
        } catch (e: Throwable) {
          Log.e(TAG, "playTrack error", e)
          e.message ?: "UNKNOWN_ERROR"
        }
      }
    }

    @JvmStatic
    fun pause(context: Context): String {
      return runOnService { service ->
        service.player?.pause()
        "OK"
      }
    }

    @JvmStatic
    fun resume(context: Context): String {
      return runOnService { service ->
        service.player?.play()
        "OK"
      }
    }

    @JvmStatic
    fun seekTo(context: Context, positionMs: Long): String {
      return runOnService { service ->
        service.player?.seekTo(positionMs)
        "OK"
      }
    }

    @JvmStatic
    fun next(context: Context): String {
      return runOnService { service ->
        service.player?.seekToNextMediaItem()
        "OK"
      }
    }

    @JvmStatic
    fun previous(context: Context): String {
      return runOnService { service ->
        service.player?.seekToPreviousMediaItem()
        "OK"
      }
    }

    @JvmStatic
    fun setRepeatMode(context: Context, mode: String): String {
      return runOnService { service ->
        val player = service.player ?: return@runOnService "PLAYER_NULL"
        when (mode.lowercase()) {
          "one", "track" -> player.repeatMode = Player.REPEAT_MODE_ONE
          "all", "playlist" -> player.repeatMode = Player.REPEAT_MODE_ALL
          else -> player.repeatMode = Player.REPEAT_MODE_OFF
        }
        "OK"
      }
    }

    @JvmStatic
    fun setShuffleMode(context: Context, enabled: Boolean): String {
      return runOnService { service ->
        service.player?.shuffleModeEnabled = enabled
        "OK"
      }
    }

    @JvmStatic
    fun setPlaybackSpeed(context: Context, speed: Float): String {
      return runOnService { service ->
        service.player?.setPlaybackSpeed(speed.coerceIn(0.25f, 4.0f))
        "OK"
      }
    }

    @JvmStatic
    fun setVolume(context: Context, volume: Float): String {
      return runOnService { service ->
        service.player?.volume = volume.coerceIn(0f, 1f)
        "OK"
      }
    }

    @JvmStatic
    fun setBoosterGain(context: Context, gainDb: Float): String {
      return try {
        BoostEngine.setGainDb(gainDb)
        "OK"
      } catch (t: Throwable) {
        Log.e(TAG, "setBoosterGain failed", t)
        t.message ?: "ERROR"
      }
    }

    @JvmStatic
    fun setBoosterGainMb(context: Context, gainMb: Int): String {
      return try {
        BoostEngine.setGainMb(gainMb)
        "OK"
      } catch (t: Throwable) {
        Log.e(TAG, "setBoosterGainMb failed", t)
        t.message ?: "ERROR"
      }
    }

    @JvmStatic
    fun stop(context: Context): String {
      return runOnService { service ->
        service.closeAndDismissNotification("stop")
        "OK"
      }
    }

    @JvmStatic
    fun getCurrentStateJson(): String {
      val service = instance ?: return lastKnownStateJson ?: idleStateJson()
      if (Looper.myLooper() == Looper.getMainLooper()) {
        return try {
          service.snapshotStateLocked()
        } catch (t: Throwable) {
          Log.e(TAG, "snapshotStateLocked error", t)
          lastKnownStateJson ?: "{}"
        }
      }
      var result: String? = null
      val latch = java.util.concurrent.CountDownLatch(1)
      try {
        mainHandler.post {
          try {
            result = service.snapshotStateLocked()
          } catch (t: Throwable) {
            Log.w(TAG, "snapshot on main looper failed", t)
          } finally {
            latch.countDown()
          }
        }
      } catch (t: Throwable) {
        Log.w(TAG, "getCurrentStateJson post failed", t)
        return lastKnownStateJson ?: "{}"
      }
      return try {
        if (latch.await(2, java.util.concurrent.TimeUnit.SECONDS)) {
          result ?: (lastKnownStateJson ?: "{}")
        } else {
          Log.w(TAG, "getCurrentStateJson timed out waiting for main looper")
          lastKnownStateJson ?: "{}"
        }
      } catch (ie: InterruptedException) {
        Thread.currentThread().interrupt()
        lastKnownStateJson ?: "{}"
      }
    }

    private fun runOnService(action: (PlaybackService) -> String): String {
      val service = instance
      if (service == null) {
        Log.w(TAG, "PlaybackService instance is null for control action")
        return "SERVICE_NOT_READY"
      }
      return try {
        if (Looper.myLooper() == Looper.getMainLooper()) {
          action(service)
        } else {
          var result = "OK"
          var failure: Throwable? = null
          val latch = java.util.concurrent.CountDownLatch(1)
          mainHandler.post {
            try {
              result = action(service)
            } catch (t: Throwable) {
              failure = t
              Log.e(TAG, "Error running action on main looper", t)
            } finally {
              latch.countDown()
            }
          }
          try {
            if (!latch.await(4, java.util.concurrent.TimeUnit.SECONDS)) {
              Log.w(TAG, "runOnService timed out waiting for main looper")
              return "TIMEOUT"
            }
          } catch (ie: InterruptedException) {
            Thread.currentThread().interrupt()
            return "INTERRUPTED"
          }
          failure?.let { throw it }
          result
        }
      } catch (t: Throwable) {
        Log.e(TAG, "runOnService exception", t)
        t.message ?: "ERROR"
      }
    }
  }
}
