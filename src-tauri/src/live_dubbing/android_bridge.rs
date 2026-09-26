/// Native JNI bridge forwarding Android PCM chunks and ducking commands.
/// Adheres to Constitution Principle VIII (strictly <= 300 lines).

#[cfg(target_os = "android")]
use jni::objects::{JClass, JByteArray};
#[cfg(target_os = "android")]
use jni::sys::{jint, jboolean, jfloat};
#[cfg(target_os = "android")]
use jni::JNIEnv;

/// Global handler for receiving PCM chunks from Android AudioPlaybackCapture.
pub type AudioChunkCallback = Box<dyn Fn(&[u8]) + Send + Sync>;

#[cfg(target_os = "android")]
#[no_mangle]
pub extern "system" fn Java_com_audiflow_app_AudioBridge_nativePushAudioChunk(
    mut env: JNIEnv,
    _class: JClass,
    data: JByteArray,
    len: jint,
) {
    if len <= 0 {
        return;
    }
    let length = len as usize;
    let mut buf = vec![0u8; length];
    if env.get_byte_array_region(&data, 0, bytemuck_cast(&mut buf)).is_ok() {
        crate::log_info!("Android JNI received {} bytes audio chunk", length);
    }
}

#[cfg(target_os = "android")]
#[no_mangle]
pub extern "system" fn Java_com_audiflow_app_AudioBridge_nativeTriggerDucking(
    _env: JNIEnv,
    _class: JClass,
    should_duck: jboolean,
    attenuation_factor: jfloat,
) {
    crate::log_info!(
        "Android JNI ducking triggered: duck={}, factor={}",
        should_duck != 0,
        attenuation_factor
    );
}

#[cfg(target_os = "android")]
#[no_mangle]
pub extern "system" fn Java_com_alad_bridge_AudioBridge_nativePushAudioChunk(
    env: JNIEnv,
    class: JClass,
    data: JByteArray,
    len: jint,
) {
    Java_com_audiflow_app_AudioBridge_nativePushAudioChunk(env, class, data, len);
}

#[cfg(target_os = "android")]
#[no_mangle]
pub extern "system" fn Java_com_alad_bridge_AudioBridge_nativeTriggerDucking(
    env: JNIEnv,
    class: JClass,
    should_duck: jboolean,
    attenuation_factor: jfloat,
) {
    Java_com_audiflow_app_AudioBridge_nativeTriggerDucking(env, class, should_duck, attenuation_factor);
}

#[cfg(target_os = "android")]
fn bytemuck_cast(buf: &mut [u8]) -> &mut [i8] {
    // Safety: i8 and u8 have identical layout and alignment
    unsafe { std::slice::from_raw_parts_mut(buf.as_mut_ptr() as *mut i8, buf.len()) }
}
