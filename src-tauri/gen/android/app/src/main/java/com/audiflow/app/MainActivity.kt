package com.audiflow.app

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.system.Os
import android.util.Log
import android.view.KeyEvent
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.annotation.Keep
import java.io.File

@Keep
class MainActivity : TauriActivity() {
  private external fun initNativePaths(nativeLibDir: String, cacheDir: String)

  private var nativePathsInitialized = false
  private var nativeInitAttempts = 0

  private fun initNativePathsSafe() {
    if (nativePathsInitialized) return
    if (nativeInitAttempts >= MAX_NATIVE_INIT_ATTEMPTS) {
      Log.w(TAG, "Giving up on initNativePaths after $nativeInitAttempts attempts")
      return
    }
    nativeInitAttempts++
    try {
      initNativePaths(applicationInfo.nativeLibraryDir, cacheDir.absolutePath)
      nativePathsInitialized = true
    } catch (t: Throwable) {
      Log.w(TAG, "initNativePaths JNI call failed; scheduling retry", t)
      android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(
        { initNativePathsSafe() },
        RETRY_DELAY_MS
      )
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    instance = this
    appContext = applicationContext
    try {
      val nativeDir = applicationInfo.nativeLibraryDir
      val cDir = cacheDir.absolutePath
      val fDir = filesDir.absolutePath
      Log.i(TAG, "Initializing native paths -> nativeLibDir: $nativeDir, cacheDir: $cDir, filesDir: $fDir")

      Os.setenv("TAURI_ANDROID_NATIVE_LIB_DIR", nativeDir, true)
      Os.setenv("TAURI_ANDROID_CACHE_DIR", cDir, true)
      Os.setenv("TAURI_ANDROID_FILES_DIR", fDir, true)

      if (!sessionCleanupDone) {
        cleanupStagingDirectory(this)
        sessionCleanupDone = true
      }

      initNativePathsSafe()
      handleIncomingIntent(intent)
    } catch (e: Throwable) {
      Log.e(TAG, "Failed to initialize MainActivity", e)
    }
    super.onCreate(savedInstanceState)
    try {
      AudioSessionReceiver.register(applicationContext)
    } catch (_: Throwable) {}
    try {
      BoostEngine.init(applicationContext)
    } catch (_: Throwable) {}
    try {
      configureWebViewSettings()
    } catch (_: Throwable) {}
    try {
      PlaybackService.eventListener = object : PlaybackService.PlaybackEventListener {
        override fun onPlaybackStateChanged(stateJson: String) {
          dispatchPlayerState(stateJson)
        }
        override fun onTrackTransition(trackJson: String) {}
        override fun onIsPlayingChanged(isPlaying: Boolean) {}
      }
    } catch (_: Throwable) {}

    try {
      onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
        override fun handleOnBackPressed() {
          dispatchBackToWebView()
        }
      })
    } catch (_: Throwable) {}
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    handleIncomingIntent(intent)
  }

  private fun dispatchBackToWebView() {
    try {
      val decor = window?.decorView ?: return
      decor.post {
        try {
          val webView = findWebView(decor)
          if (webView != null) {
            webView.evaluateJavascript(
              "window.dispatchEvent(new CustomEvent('ac:android-back'));",
              null
            )
          }
        } catch (t: Throwable) {
          Log.w(TAG, "Failed to dispatch ac:android-back to WebView", t)
        }
      }
    } catch (t: Throwable) {
      Log.w(TAG, "dispatchBackToWebView failed", t)
    }
  }

  @Deprecated("Use OnBackPressedDispatcher callback instead")
  @Suppress("DEPRECATION")
  override fun onBackPressed() {
    try {
      dispatchBackToWebView()
    } catch (_: Throwable) {
      super.onBackPressed()
    }
  }

  private fun handleIncomingIntent(intent: Intent?) {
    if (intent == null) return
    val action = intent.action ?: return
    val uris = mutableListOf<String>()

    if (Intent.ACTION_VIEW == action) {
      intent.data?.let { uri ->
        tryGrantUriPermission(uri, intent)
        uris.add(uri.toString())
      }
    } else if (Intent.ACTION_SEND == action) {
      val uri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
      } else {
        @Suppress("DEPRECATION")
        intent.getParcelableExtra(Intent.EXTRA_STREAM)
      } ?: intent.data

      uri?.let {
        tryGrantUriPermission(it, intent)
        uris.add(it.toString())
      }
    } else if (Intent.ACTION_SEND_MULTIPLE == action) {
      val list = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java)
      } else {
        @Suppress("DEPRECATION")
        intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM)
      }
      list?.forEach { uri ->
        if (uri != null) {
          tryGrantUriPermission(uri, intent)
          uris.add(uri.toString())
        }
      }
    }

    if (uris.isNotEmpty()) {
      Log.i(TAG, "Received incoming open/share URIs: $uris")
      lastSharedUri = uris.first()
      synchronized(pendingOpenedUris) {
        pendingOpenedUris.addAll(uris)
      }
      notifyUrisToFrontend(uris)
    }
  }

  private fun tryGrantUriPermission(uri: Uri, intent: Intent) {
    if (android.content.ContentResolver.SCHEME_CONTENT == uri.scheme) {
      try {
        val flags = intent.flags and (Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        if (flags != 0) {
          contentResolver.takePersistableUriPermission(uri, flags and Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
      } catch (_: SecurityException) {
      } catch (_: Throwable) {}
    }
  }

  private fun notifyUrisToFrontend(uris: List<String>) {
    val json = org.json.JSONArray(uris).toString()
    val decor = window?.decorView ?: return
    decor.post {
      try {
        val webView = findWebView(decor)
        if (webView != null) {
          val quoted = org.json.JSONObject.quote(json)
          val js = "window.dispatchEvent(new CustomEvent('ac:open-files', { detail: { paths: JSON.parse($quoted) } }));"
          webView.evaluateJavascript(js, null)
          Log.i(TAG, "Dispatched ac:open-files to WebView: $json")
        }
      } catch (t: Throwable) {
        Log.w(TAG, "Failed to dispatch ac:open-files to WebView", t)
      }
    }
  }

  override fun onResume() {
    super.onResume()
    instance = this
    initNativePathsSafe()
    try {
      configureWebViewSettings()
    } catch (_: Throwable) {}
    try {
      BoostEngine.reAssert()
    } catch (_: Throwable) {}
  }

  override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
    if (keyCode == KeyEvent.KEYCODE_VOLUME_UP || keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
      try {
        BoostEngine.reAssert()
      } catch (_: Throwable) {}
    }
    return super.onKeyDown(keyCode, event)
  }

  private fun configureWebViewSettings() {
    val decor = window?.decorView ?: return
    decor.post {
      try {
        val webView = findWebView(decor)
        webView?.settings?.apply {
          setSupportZoom(false)
          builtInZoomControls = false
          displayZoomControls = false
          textZoom = 100
          mediaPlaybackRequiresUserGesture = false
          allowFileAccess = true
          allowContentAccess = true
          domStorageEnabled = true
          databaseEnabled = true
        }
        Log.i(TAG, "Configured WebView settings: mediaPlaybackRequiresUserGesture = false, zoom disabled")
      } catch (t: Throwable) {
        Log.w(TAG, "configureWebViewSettings failed", t)
      }
    }
  }

  internal fun findWebView(view: android.view.View): android.webkit.WebView? {
    if (view is android.webkit.WebView) return view
    if (view is android.view.ViewGroup) {
      for (i in 0 until view.childCount) {
        val child = findWebView(view.getChildAt(i))
        if (child != null) return child
      }
    }
    return null
  }

  override fun onDestroy() {
    try {
      AudioSessionReceiver.unregister(applicationContext)
    } catch (_: Throwable) {}
    if (instance === this) {
      instance = null
    }
    super.onDestroy()
  }

  override fun onRequestPermissionsResult(
    requestCode: Int,
    permissions: Array<out String>,
    grantResults: IntArray
  ) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    if (requestCode != AppPermissionManager.AUDIO_PERMISSION_REQ_CODE &&
        requestCode != AppPermissionManager.VIDEO_PERMISSION_REQ_CODE &&
        requestCode != AppPermissionManager.PERMISSION_REQ_CODE) return

    if (grantResults.isEmpty()) {
      Log.w(TAG, "Permission request was cancelled/interrupted (code $requestCode)")
      return
    }

    val denied = permissions.filterIndexed { i, _ ->
      grantResults[i] != android.content.pm.PackageManager.PERMISSION_GRANTED
    }
    if (denied.isEmpty()) {
      Log.i(TAG, "Permissions granted for requestCode $requestCode")
    } else {
      Log.w(TAG, "Permissions denied for requestCode $requestCode: $denied")
      if (requestCode == AppPermissionManager.VIDEO_PERMISSION_REQ_CODE) {
        toastMain(R.string.permission_denied_hint)
      }
    }
  }

  fun checkAndRequestAudioPermission(): Boolean {
    return AppPermissionManager.requestAudioPermission(this)
  }

  fun checkAndRequestVideoPermission(): Boolean {
    return AppPermissionManager.requestVideoPermission(this)
  }

  fun checkAndRequestMediaPermissions(): Boolean {
    return checkAndRequestAudioPermission()
  }

  @Keep
  companion object {
    private const val TAG = "Audiflow"
    @Volatile
    var lastSharedUri: String? = null

    val pendingOpenedUris: MutableList<String> = java.util.Collections.synchronizedList(mutableListOf())

    @JvmStatic
    @Keep
    fun drainPendingOpenedUris(): String {
      synchronized(pendingOpenedUris) {
        val json = org.json.JSONArray(pendingOpenedUris).toString()
        pendingOpenedUris.clear()
        return json
      }
    }

    init {
      try {
        System.loadLibrary("audiflow")
        Log.i("Audiflow", "Loaded audiflow library in companion init")
      } catch (t: Throwable) {
        Log.w("Audiflow", "Could not eagerly load audiflow library", t)
      }
    }

    var instance: MainActivity? = null
    private var sessionCleanupDone = false
    private const val RETRY_DELAY_MS = 300L
    private const val MAX_NATIVE_INIT_ATTEMPTS = 20

    var appContext: Context? = null

    private fun toastMain(resId: Int) {
      val ctx = appContext ?: instance?.applicationContext ?: return
      android.os.Handler(android.os.Looper.getMainLooper()).post {
        try {
          Toast.makeText(ctx, ctx.getString(resId), Toast.LENGTH_LONG).show()
        } catch (t: Throwable) {
          Log.w(TAG, "Toast failed", t)
        }
      }
    }

    @JvmStatic
    fun hasMediaPermissions(): Boolean {
      val ctx = appContext ?: instance?.applicationContext ?: return true
      return AppPermissionManager.hasMediaPermissions(ctx)
    }

    @JvmStatic
    fun requestMediaPermissions() {
      val act = instance ?: return
      android.os.Handler(android.os.Looper.getMainLooper()).post {
        act.checkAndRequestAudioPermission()
      }
    }

    @JvmStatic
    fun requestAudioPermissions() {
      val act = instance ?: return
      android.os.Handler(android.os.Looper.getMainLooper()).post {
        act.checkAndRequestAudioPermission()
      }
    }

    @JvmStatic
    fun requestVideoPermissions() {
      val act = instance ?: return
      android.os.Handler(android.os.Looper.getMainLooper()).post {
        act.checkAndRequestVideoPermission()
      }
    }

    @JvmStatic
    fun checkVideoPermission(): String {
      val context = appContext ?: instance?.applicationContext ?: return "granted"
      return AppPermissionManager.checkVideoPermission(context)
    }

    @JvmStatic
    fun hasVideoPermissions(): Boolean {
      val ctx = appContext ?: instance?.applicationContext ?: return true
      return AppPermissionManager.hasVideoPermissions(ctx)
    }

    @JvmStatic
    fun openAppSettings() {
      val ctx = appContext ?: instance?.applicationContext ?: return
      AppPermissionManager.openAppSettings(ctx)
    }

    @JvmStatic
    fun exitApp() {
      try {
        val act = instance
        if (act != null) {
          android.os.Handler(android.os.Looper.getMainLooper()).post {
            try {
              act.finish()
            } catch (t: Throwable) {
              Log.w(TAG, "exitApp finish failed", t)
            }
          }
        }
      } catch (t: Throwable) {
        Log.w(TAG, "exitApp failed", t)
      }
    }

    @JvmStatic
    fun statUri(joined: String): String {
      val context = appContext ?: instance?.applicationContext ?: return ""
      return MediaUriStager.statUri(context, joined) {
        toastMain(R.string.permission_denied_hint)
      }
    }

    @JvmStatic
    fun cleanupStagingDirectory(context: Context) {
      MediaUriStager.cleanupStagingDirectory(context)
    }

    @JvmStatic
    fun publishOutputs(joined: String): String {
      val context = appContext ?: instance?.applicationContext ?: return joined
      return MediaStoreManager.publishOutputs(context, joined)
    }

    fun artworkCacheFileFor(cacheKey: String): File? {
      val context = appContext ?: instance?.applicationContext ?: return null
      return ArtworkManager.artworkCacheFileFor(context, cacheKey)
    }

    @JvmStatic
    fun getEmbeddedArtwork(audioRef: String): String {
      val context = appContext ?: instance?.applicationContext ?: return ""
      return ArtworkManager.getEmbeddedArtwork(context, audioRef)
    }

    @JvmStatic
    fun areNotificationsEnabled(): Boolean {
      val context = appContext ?: instance?.applicationContext ?: return true
      return AppPermissionManager.areNotificationsEnabled(context)
    }

    @JvmStatic
    fun checkMusicPermission(): String {
      val context = appContext ?: instance?.applicationContext ?: return "granted"
      return AppPermissionManager.checkMusicPermission(context)
    }

    @JvmStatic
    fun queryMediaStoreMusic(): String {
      val context = appContext ?: instance?.applicationContext ?: return "[]"
      return MediaStoreManager.queryMediaStoreMusic(context)
    }

    @JvmStatic
    fun resolveUriToLocalPath(uriString: String): String {
      val context = appContext ?: instance?.applicationContext ?: return uriString
      return MediaUriStager.resolveUriToLocalPath(context, uriString) {
        toastMain(R.string.permission_denied_hint)
      }
    }

    @JvmStatic
    fun deleteAudioTrack(uriString: String): String {
      val context = appContext ?: instance?.applicationContext ?: return "Context unavailable"
      return MediaStoreManager.deleteAudioTrack(context, uriString)
    }

    @JvmStatic
    fun setAsRingtone(uriString: String): String {
      val context = appContext ?: instance?.applicationContext ?: return "Context unavailable"
      return RingtoneHelper.setAsRingtone(context, uriString)
    }

    @JvmStatic
    fun shareAudioTrack(jsonArgs: String): String {
      val context = appContext ?: instance?.applicationContext ?: return "Context unavailable"
      return ShareHelper.shareAudioTrack(context, jsonArgs)
    }

    @JvmStatic
    fun shareAudioTrack(uriString: String, title: String, mimeType: String): String {
      val context = appContext ?: instance?.applicationContext ?: return "Context unavailable"
      return ShareHelper.shareAudioTrack(context, uriString, title, mimeType)
    }

    // --- Jetpack Media3 Playback Bridge Methods ---

    @JvmStatic
    fun nativePlayerPlay(trackJson: String, playlistJson: String, startIndex: Int): String {
      val ctx = appContext ?: instance?.applicationContext ?: return "CONTEXT_NULL"
      return PlaybackService.playTrack(ctx, trackJson, playlistJson, startIndex)
    }

    @JvmStatic
    fun nativePlayerPause(): String {
      val ctx = appContext ?: instance?.applicationContext ?: return "CONTEXT_NULL"
      return PlaybackService.pause(ctx)
    }

    @JvmStatic
    fun nativePlayerResume(): String {
      val ctx = appContext ?: instance?.applicationContext ?: return "CONTEXT_NULL"
      return PlaybackService.resume(ctx)
    }

    @JvmStatic
    fun nativePlayerSeekTo(positionMs: Long): String {
      val ctx = appContext ?: instance?.applicationContext ?: return "CONTEXT_NULL"
      return PlaybackService.seekTo(ctx, positionMs)
    }

    @JvmStatic
    fun nativePlayerNext(): String {
      val ctx = appContext ?: instance?.applicationContext ?: return "CONTEXT_NULL"
      return PlaybackService.next(ctx)
    }

    @JvmStatic
    fun nativePlayerPrevious(): String {
      val ctx = appContext ?: instance?.applicationContext ?: return "CONTEXT_NULL"
      return PlaybackService.previous(ctx)
    }

    @JvmStatic
    fun nativePlayerSetRepeatMode(mode: String): String {
      val ctx = appContext ?: instance?.applicationContext ?: return "CONTEXT_NULL"
      return PlaybackService.setRepeatMode(ctx, mode)
    }

    @JvmStatic
    fun nativePlayerSetShuffleMode(enabled: Boolean): String {
      val ctx = appContext ?: instance?.applicationContext ?: return "CONTEXT_NULL"
      return PlaybackService.setShuffleMode(ctx, enabled)
    }

    @JvmStatic
    fun nativePlayerSetSpeed(speed: Float): String {
      val ctx = appContext ?: instance?.applicationContext ?: return "CONTEXT_NULL"
      return PlaybackService.setPlaybackSpeed(ctx, speed)
    }

    @JvmStatic
    fun nativePlayerSetVolume(volume: Float): String {
      val ctx = appContext ?: instance?.applicationContext ?: return "CONTEXT_NULL"
      return PlaybackService.setVolume(ctx, volume)
    }

    @JvmStatic
    fun nativePlayerSetBoosterGain(gainDb: Float): String {
      return try {
        BoostEngine.setGainDb(gainDb)
        "OK"
      } catch (t: Throwable) {
        Log.e(TAG, "nativePlayerSetBoosterGain failed", t)
        t.message ?: "ERROR"
      }
    }

    @JvmStatic
    fun nativePlayerSetBoosterGainMb(gainMb: Int): String {
      return try {
        BoostEngine.setGainMb(gainMb)
        "OK"
      } catch (t: Throwable) {
        Log.e(TAG, "nativePlayerSetBoosterGainMb failed", t)
        t.message ?: "ERROR"
      }
    }

    @JvmStatic
    fun nativePlayerGetBoosterGainMb(): Int {
      return BoostEngine.getTargetGainMb()
    }

    @JvmStatic
    fun nativeGetStreamVolume(): Int {
      val ctx = appContext ?: instance?.applicationContext ?: return 0
      return AudioStreamManager.getStreamVolume(ctx)
    }

    @JvmStatic
    fun nativeGetStreamMaxVolume(): Int {
      val ctx = appContext ?: instance?.applicationContext ?: return 15
      return AudioStreamManager.getStreamMaxVolume(ctx)
    }

    @JvmStatic
    fun nativeSetStreamVolume(volume: Int, showUi: Boolean): String {
      val ctx = appContext ?: instance?.applicationContext ?: return "CONTEXT_NULL"
      return AudioStreamManager.setStreamVolume(ctx, volume, showUi)
    }

    @JvmStatic
    fun nativeApplyReduceHurt(): String {
      val ctx = appContext ?: instance?.applicationContext ?: return "CONTEXT_NULL"
      return AudioStreamManager.applyReduceHurt(ctx)
    }

    @JvmStatic
    fun nativePlayerStop(): String {
      val ctx = appContext ?: instance?.applicationContext ?: return "CONTEXT_NULL"
      return PlaybackService.stop(ctx)
    }

    @JvmStatic
    fun nativePlayerGetState(): String {
      return PlaybackService.getCurrentStateJson()
    }

    @JvmStatic
    fun dispatchPlayerState(stateJson: String) {
      if (stateJson.isBlank()) return
      try {
        val act = instance ?: return
        try {
          if (act.isFinishing || act.isDestroyed) return
        } catch (_: Throwable) {}
        val decor = try {
          act.window?.decorView
        } catch (_: Throwable) {
          null
        } ?: return
        decor.post {
          try {
            val webView = act.findWebView(act.window?.decorView ?: return@post)
            if (webView != null) {
              val quoted = org.json.JSONObject.quote(stateJson)
              val js =
                "window.dispatchEvent(new CustomEvent('ac:player-state', { detail: JSON.parse($quoted) }));"
              webView.evaluateJavascript(js, null)
            }
          } catch (t: Throwable) {
            Log.w(TAG, "dispatchPlayerState to WebView failed", t)
          }
        }
      } catch (t: Throwable) {
        Log.w(TAG, "dispatchPlayerState failed", t)
      }
    }
  }
}
