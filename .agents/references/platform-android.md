# Reference — platform-android

Domain: Android Kotlin + generated project + icons. Part of `PROJECT_GRAPH.md` domain-split map.

## Files

| File | Summary |
| ---- | ------- |
| `src-tauri/android/AppPermissionManager.kt` | Android runtime media, video, and notification permission checks and requests. |
| `src-tauri/android/ArtworkManager.kt` | Android embedded cover art extraction and disk cache (`cacheDir/artworks/`). |
| `src-tauri/android/AudioSessionReceiver.kt` | Android Kotlin source (external player boost audio effect control session receiver). |
| `src-tauri/android/AudioStreamManager.kt` | Android hardware AudioManager facade for STREAM_MUSIC manipulation and Reduce Hurt protection. |
| `src-tauri/android/BoostEngine.kt` | Android LoudnessEnhancer and equalizer engine for hardware sound boosting. |
| `src-tauri/android/BoostVolumeService.kt` | Background Audio Booster Service with WakeLock. |
| `src-tauri/android/MainActivity.kt` | Android Tauri Activity orchestration, webview configuration, back-press handling, and JNI bridge. |
| `src-tauri/android/MediaItemBuilder.kt` | Android Media3 MediaItem builder from track JSON and track JSON serialization. |
| `src-tauri/android/MediaStoreManager.kt` | Android MediaStore queries, output publishing (`Music/Audiflow`), and track deletion. |
| `src-tauri/android/MediaUriStager.kt` | Android content:// and file:// URI lazy staging and metadata inspection (`statUri`). |
| `src-tauri/android/PlaybackNotificationHelper.kt` | Media3 notification channels, placeholder notifications, and closeable notification providers. |
| `src-tauri/android/PlaybackService.kt` | Android Jetpack Media3 foreground playback service for background audio and lock screen controls. |
| `src-tauri/android/RingtoneHelper.kt` | Android system ringtone assignment and WRITE_SETTINGS handling. |
| `src-tauri/android/ShareHelper.kt` | Android audio track sharing via FileProvider and system chooser sheet. |
| `src-tauri/gen/android/.editorconfig` | Generated Tauri Android project file (do not hand-edit; patched via `patch-android-project.sh`). |
| `src-tauri/gen/android/.gitignore` | Generated Tauri Android project file (do not hand-edit; patched via `patch-android-project.sh`). |
| `src-tauri/gen/android/app/.gitignore` | Generated Tauri Android project file (do not hand-edit; patched via `patch-android-project.sh`). |
| `src-tauri/gen/android/app/build.gradle.kts` | Generated Tauri Android project file (do not hand-edit; patched via `patch-android-project.sh`). |
| `src-tauri/gen/android/app/proguard-rules.pro` | Generated Tauri Android project file (do not hand-edit; patched via `patch-android-project.sh`). |
| `src-tauri/gen/android/app/src/main/AndroidManifest.xml` | Generated Tauri Android project file (do not hand-edit; patched via `patch-android-project.sh`). |
| `src-tauri/gen/**/java/** (duplicates of src-tauri/android/*)` | Byte-identical copies of `src-tauri/android/*.kt`; edit the source side only. |
| `src-tauri/gen/android/app/src/main/res/drawable-nodpi/default_artwork.png` | Generated Tauri Android project file (do not hand-edit; patched via `patch-android-project.sh`). |
| `src-tauri/gen/android/app/src/main/res/drawable/ic_notification.xml` | Generated Tauri Android project file (do not hand-edit; patched via `patch-android-project.sh`). |
| `src-tauri/gen/android/app/src/main/res/layout/activity_main.xml` | Generated Tauri Android project file (do not hand-edit; patched via `patch-android-project.sh`). |
| `src-tauri/gen/**/res/mipmap-* (generated launcher icons)` | Generated launcher densities (do not edit). |
| `src-tauri/gen/android/app/src/main/res/values-fa/strings.xml` | Generated Tauri Android project file (do not hand-edit; patched via `patch-android-project.sh`). |
| `src-tauri/gen/android/app/src/main/res/values-night/themes.xml` | Generated Tauri Android project file (do not hand-edit; patched via `patch-android-project.sh`). |
| `src-tauri/gen/android/app/src/main/res/values/colors.xml` | Generated Tauri Android project file (do not hand-edit; patched via `patch-android-project.sh`). |
| `src-tauri/gen/android/app/src/main/res/values/ic_launcher_background.xml` | Generated Tauri Android project file (do not hand-edit; patched via `patch-android-project.sh`). |
| `src-tauri/gen/android/app/src/main/res/values/strings.xml` | Generated Tauri Android project file (do not hand-edit; patched via `patch-android-project.sh`). |
| `src-tauri/gen/android/app/src/main/res/values/themes.xml` | Generated Tauri Android project file (do not hand-edit; patched via `patch-android-project.sh`). |
| `src-tauri/gen/android/app/src/main/res/xml/file_paths.xml` | Generated Tauri Android project file (do not hand-edit; patched via `patch-android-project.sh`). |
| `src-tauri/gen/android/build.gradle.kts` | Generated Tauri Android project file (do not hand-edit; patched via `patch-android-project.sh`). |
| `src-tauri/gen/android/buildSrc/build.gradle.kts` | Generated Tauri Android project file (do not hand-edit; patched via `patch-android-project.sh`). |
| `src-tauri/gen/android/buildSrc/src/main/java/com/audiflow/app/kotlin/BuildTask.kt` | Generated Tauri Android project file (do not hand-edit; patched via `patch-android-project.sh`). |
| `src-tauri/gen/android/buildSrc/src/main/java/com/audiflow/app/kotlin/RustPlugin.kt` | Generated Tauri Android project file (do not hand-edit; patched via `patch-android-project.sh`). |
| `src-tauri/gen/android/gradle.properties` | Generated Tauri Android project file (do not hand-edit; patched via `patch-android-project.sh`). |
| `src-tauri/gen/**/gradle/wrapper/*` | Gradle wrapper binaries (do not edit). |
| `src-tauri/gen/android/gradlew` | Generated Tauri Android project file (do not hand-edit; patched via `patch-android-project.sh`). |
| `src-tauri/gen/android/gradlew.bat` | Generated Tauri Android project file (do not hand-edit; patched via `patch-android-project.sh`). |
| `src-tauri/gen/android/settings.gradle` | Generated Tauri Android project file (do not hand-edit; patched via `patch-android-project.sh`). |
| `src-tauri/gen/schemas/* (generated snapshots)` | Generated Tauri schema snapshots (do not edit). |
| `src-tauri/icons/** (desktop + iconset)` | Desktop icon set via `gen-icons.py` (do not edit). |
| `src-tauri/icons/{android,ios}/**` | Mobile icon variants (generated, do not edit). |

## Android unit tests (Phase 6)

Test command: `./gradlew :app:testArmDebugUnitTest -x rustBuildArmDebug` (run from `src-tauri/gen/android/`)

| File | Tests | Coverage |
| ---- | ----- | -------- |
| `src-tauri/gen/android/app/src/test/java/com/audiflow/app/ArtworkManagerTest.kt` | 8 | `artworkCacheFileFor` naming/idempotency/blank-guard/dir-creation, `deleteArtworkCache` |
| `src-tauri/gen/android/app/src/test/java/com/audiflow/app/MediaStoreManagerTest.kt` | 11 | `mimeFor` all 7 extensions + case-insensitivity + unknown fallback (via reflection) |
| `src-tauri/gen/android/app/src/test/java/com/audiflow/app/MediaUriStagerTest.kt` | 20 | `cleanupStagingDirectory`, `safeName` regex (all illegal chars, Persian Unicode, spaces), dedup naming pattern |
| `src-tauri/gen/android/app/src/test/java/com/audiflow/app/MediaItemBuilderTest.kt` | 12 | `safeCoverUrl` android.resource stripping, URI fallback `file://` prepend, mediaId blank-fallback |

**Deps added to `build.gradle.kts`:** `testImplementation("org.mockito:mockito-core:5.11.0")` + `testOptions { unitTests { isReturnDefaultValues = true } }`.

**Not covered by unit tests (require instrumentation):** `statUri`, `resolveUriToLocalPath`, `stageUriToCache`, `publishOutputs`, `queryMediaStoreMusic`, `deleteAudioTrack`, `buildMediaItem`, `mediaItemToTrackJson` — all depend on live ContentResolver or Media3 framework.
