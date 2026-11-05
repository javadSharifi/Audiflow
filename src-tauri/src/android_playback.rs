//! Music player → Android PlaybackService bridge (foreground service +
//! MediaSession notification). JSON goes to `MainActivity.updatePlayback`;
//! an empty string stops the service. No-op on other platforms.

#[cfg(target_os = "android")]
pub fn update_playback_via_jni(state_json: &str) -> Result<(), String> {
    crate::android_fs::with_jni_env(|env| {
        let cls = crate::android_fs::main_activity_class(env)?;
        let arg = env
            .new_string(state_json)
            .map_err(|e| format!("Failed to create Java string: {e}"))?;
        let res = env.call_static_method(
            &cls,
            "updatePlayback",
            "(Ljava/lang/String;)V",
            &[jni::objects::JValue::Object(&arg)],
        );
        if env.exception_check().unwrap_or(false) {
            let _ = env.exception_describe();
            let _ = env.exception_clear();
            return Err("JNI exception in updatePlayback".to_string());
        }
        res.map(|_| ()).map_err(|e| format!("Failed to call updatePlayback: {e}"))
    })
}

#[cfg(not(target_os = "android"))]
pub fn update_playback_via_jni(_state_json: &str) -> Result<(), String> {
    Ok(())
}
