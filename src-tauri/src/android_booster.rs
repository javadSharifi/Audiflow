//! Volume Booster JNI bridge — calls VolumeBoosterService methods
//! on MainActivity's companion via the cached class reference.
//!
//! Uses LoudnessEnhancer / DynamicsProcessing AudioEffect APIs
//! (session-0 global attachment), distinct from the LiveSoundBooster
//! which uses AudioPlaybackCapture + MediaProjection.

use crate::types::{BoosterStatus, BoosterEngine};

#[cfg(target_os = "android")]
pub fn start_booster_via_jni(level: i32) -> Result<BoosterStatus, String> {
    crate::android_fs::with_jni_env(|env| {
        let cls = crate::android_fs::main_activity_class(env)?;
        env.call_static_method(&cls, "startVolumeBooster", "(I)V", &[jni::objects::JValue::Int(level)])
            .map_err(|e| format!("Failed to call startVolumeBooster: {e}"))?;
        if env.exception_check().unwrap_or(false) {
            let _ = env.exception_describe();
            let _ = env.exception_clear();
            return Err("JNI exception in startVolumeBooster".to_string());
        }
        Ok(())
    })?;
    get_booster_status_via_jni()
}

#[cfg(target_os = "android")]
pub fn stop_booster_via_jni() -> Result<(), String> {
    crate::android_fs::with_jni_env(|env| {
        let cls = crate::android_fs::main_activity_class(env)?;
        env.call_static_method(&cls, "stopVolumeBooster", "()V", &[])
            .map_err(|e| format!("Failed to call stopVolumeBooster: {e}"))?;
        if env.exception_check().unwrap_or(false) {
            let _ = env.exception_describe();
            let _ = env.exception_clear();
            return Err("JNI exception in stopVolumeBooster".to_string());
        }
        Ok(())
    })
}

#[cfg(target_os = "android")]
pub fn set_booster_level_via_jni(level: i32) -> Result<BoosterStatus, String> {
    crate::android_fs::with_jni_env(|env| {
        let cls = crate::android_fs::main_activity_class(env)?;
        env.call_static_method(&cls, "setBoostLevel", "(I)V", &[jni::objects::JValue::Int(level)])
            .map_err(|e| format!("Failed to call setBoostLevel: {e}"))?;
        if env.exception_check().unwrap_or(false) {
            let _ = env.exception_describe();
            let _ = env.exception_clear();
            return Err("JNI exception in setBoostLevel".to_string());
        }
        Ok(())
    })?;
    get_booster_status_via_jni()
}

#[cfg(target_os = "android")]
pub fn get_booster_status_via_jni() -> Result<BoosterStatus, String> {
    let json_str = crate::android_fs::with_jni_env(|env| {
        let cls = crate::android_fs::main_activity_class(env)?;
        let j_val = match env.call_static_method(&cls, "getBoosterStatus", "()Ljava/lang/String;", &[]) {
            Ok(v) => v,
            Err(e) => {
                if env.exception_check().unwrap_or(false) {
                    let _ = env.exception_describe();
                    let _ = env.exception_clear();
                }
                return Err(format!("Failed to call getBoosterStatus: {e}"));
            }
        };
        let j_obj = j_val.l().map_err(|e| format!("Expected object: {e}"))?;
        if j_obj.as_raw().is_null() {
            return Ok(String::new());
        }
        let j_str = jni::objects::JString::from(j_obj);
        let s: String = env
            .get_string(&j_str)
            .map_err(|e| format!("Failed to extract Rust string: {e}"))?
            .into();
        Ok(s)
    })?;
    
    if json_str.is_empty() {
        return Ok(BoosterStatus { enabled: false, level: 0, engine: BoosterEngine::None });
    }
    
    serde_json::from_str(&json_str).map_err(|e| format!("Failed to parse BoosterStatus JSON: {e}"))
}

#[cfg(not(target_os = "android"))]
pub fn start_booster_via_jni(_level: i32) -> Result<BoosterStatus, String> {
    Ok(BoosterStatus { enabled: false, level: 0, engine: BoosterEngine::None })
}

#[cfg(not(target_os = "android"))]
pub fn stop_booster_via_jni() -> Result<(), String> {
    Ok(())
}

#[cfg(not(target_os = "android"))]
pub fn set_booster_level_via_jni(_level: i32) -> Result<BoosterStatus, String> {
    Ok(BoosterStatus { enabled: false, level: 0, engine: BoosterEngine::None })
}

#[cfg(not(target_os = "android"))]
pub fn get_booster_status_via_jni() -> Result<BoosterStatus, String> {
    Ok(BoosterStatus { enabled: false, level: 0, engine: BoosterEngine::None })
}
