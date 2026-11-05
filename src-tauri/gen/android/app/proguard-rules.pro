-keep class com.audioconverter.app.MainActivity {
    public static <methods>;
    public <methods>;
    *;
}
-keep class com.audioconverter.app.MainActivity$Companion {
    public <methods>;
    *;
}
-keepclassmembers class com.audioconverter.app.MainActivity {
    public static <methods>;
    *;
}
-keepclassmembers class com.audioconverter.app.MainActivity$Companion {
    public <methods>;
    *;
}
-keep class com.audioconverter.app.LiveSoundBoosterService {
    *;
}
-keep class com.audioconverter.app.LiveSoundBoosterService$Companion {
    *;
}
-keep class com.audioconverter.app.PlaybackService {
    *;
}
-keep class com.audioconverter.app.PlaybackService$Companion {
    *;
}
-keep class com.audioconverter.app.booster.** {
    *;
}
-keepclassmembers class com.audioconverter.app.booster.** {
    *;
}
-keepclasseswithmembers class * {
    native <methods>;
}
