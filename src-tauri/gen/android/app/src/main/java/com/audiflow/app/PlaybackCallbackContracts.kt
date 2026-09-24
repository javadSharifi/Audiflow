package com.audiflow.app

import androidx.annotation.Keep

/**
 * Interface contract defining playback session lifecycle events.
 */
@Keep
interface PlaybackSessionCallback {
    fun onSessionActive(sessionId: Int)
    fun onSessionReleased(sessionId: Int)
}

/**
 * Interface contract defining audio focus change events.
 */
@Keep
interface AudioFocusChangeObserver {
    fun onAudioFocusChanged(focusChange: Int)
}
