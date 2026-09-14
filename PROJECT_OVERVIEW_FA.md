# Audio Converter — سند جامع فنی محصول (CTO Overview)

> **مخاطب:** CTO، معمار ارشد فنی، سرمایه‌گذار فنی
> **نسخه محصول:** 1.4.1
> **آخرین به‌روزرسانی:** سپتامبر 2026
> **وضعیت:** Production-ready — دسکتاپ + اندروید

---

## 1. محصول چیست؟

**Audio Converter** یک اپلیکیشن کراس‌پلتفرم (دسکتاپ + موبایل) برای تبدیل ویدیو/صوت به فایل صوتی بهینه‌شده است، با دو قابلیت متمایزکننده:

1. **استودیو تبدیل (Converter Studio):** تبدیل بچ فایل‌ها به MP3 / WAV / AAC / M4A / FLAC / Opus با تریم waveform، حذف سکوت، تکه‌تکه کردن (Split) و صف پردازش.
2. **تقویت‌کننده صدا (Sound Booster):**
   - **File Booster:** تقویت loudness فایل (پریست‌های هوشمند/موسیقی/صدا/باس/اکستریم + حالت دستی) در همان پاس تبدیل.
   - **Live Booster (فقط اندروید):** تقویت بلادرنگ صدای در حال پخش سیستم (یوتیوب، اسپاتیفای، تلگرام و...) بدون دسترسی به میکروفون.

**وعده کلیدی محصول:** کاربر نهایی به هیچ وابستگی خارجی نیاز ندارد — نه FFmpeg سیستمی، نه Node، نه Python. همه‌چیز باندل شده است.

**پلتفرم‌های پشتیبانی‌شده:**

| پلتفرم | معماری | خروجی نصب |
|---|---|---|
| macOS | aarch64 + x86_64 | `.dmg` + `.app` |
| Windows | x86_64 | `.exe` (NSIS setup) |
| Linux | x86_64 | `.deb` + `.AppImage` |
| Android | arm64-v8a (aarch64) | `.apk` امضاشده |

---

## 2. تکنولوژی‌ها و چرا این انتخاب‌ها

### 2.1. استک کلی

| لایه | تکنولوژی | نسخه | دلیل انتخاب |
|---|---|---|---|
| شل اپلیکیشن | **Tauri 2** | 2.9.x | باینری سبک (~10MB به‌جای ~150MB الکترون)، امنیت IPC، پشتیبانی دسکتاپ + اندروید از یک کدبیس |
| فرانت‌اند | **React 19 + TypeScript 5.9** | 19.2 / 5.9 | اکوسیستم بالغ، کامپوننت‌محوری |
| استایل | **Tailwind CSS v4** (via Vite plugin) | 4.1 | سرعت توسعه UI، تم روشن/تیره |
| state فرانت | **Zustand 5** | 5.0 | سبک، بدون boilerplate ریداکس؛ sliceهای جدا برای فایل/جاب/ستینگ/UI |
| بیلد فرانت | **Vite 7** | 7.1 | dev سریع، HMR روی اندروید |
| بک‌اند | **Rust (edition 2021)** | 1.77+ | مدیریت امن پردازش‌ها، JNI اندروید، بدون GC pause در پایپ‌لاین صوتی |
| موتور مدیا | **FFmpeg + FFprobe 8.1.2 (LGPL)** باندل‌شده | 8.1.2 | استاندارد صنعت؛ بیلد مینیمال static فقط با libmp3lame + libopus (بدون کامپوننت GPL مثل x264/x265) |
| تایپ‌سینک Rust↔TS | **Specta + tauri-specta** | 2.0 rc | تولید خودکار `src/types/generated.ts`؛ هر تغییر struct راست بلافاصله در TS خطا می‌دهد |
| آیکون | **lucide-react** | 1.38 | آیکون وکتوری یکدست |
| تست فرانت | **Vitest + Testing Library + jsdom** | 3.2 | یونیت‌تست سریع |
| تست بک‌اند | **cargo test + E2E اختصاصی** | — | 62 یونیت‌تست راست + 9 تست E2E با فایل واقعی |

### 2.2. اندروید نیتیو

| تکنولوژی | کاربرد |
|---|---|
| Kotlin `MainActivity` (subclass `TauriActivity`) | بریج JNI، Document Picker، MediaStore، permissionها |
| Rust `jni 0.21` (`android_fs.rs`) | stage کردن `content://` URIها، publish خروجی به MediaStore |
| `AudioPlaybackCapture` (API 29+) | کپچر دیجیتال صدای داخلی بدون میکروفون (Live Booster) |
| `AudioTrack` (LOW_LATENCY, PCM16, 44.1kHz) + Foreground Service | پخش تقویت‌شده بلادرنگ با نوتیفیکیشن دائمی + دکمه Stop |
| Scoped Storage + `MediaStore.Audio` | خروجی استاندارد در `Music/AudioConverter` |

---

## 3. معماری سطح بالا

```
React 19 + Zustand (UI)
    │  Tauri IPC (invoke: probe/start_conversion/... + events: job-event/queue-idle)
    ▼
Rust Core (QueueManager → Pipeline → FFmpeg runner → bundled ffmpeg/ffprobe)
    │  Android: JNI → Kotlin MainActivity → ContentResolver / MediaStore
    │  Android Live: AudioPlaybackCapture → DSP loop → AudioTrack
```

### 3.1. ماژول‌های بک‌اند Rust (`src-tauri/src/`)

| ماژول | مسئولیت |
|---|---|
| `commands/mod.rs` | همه endpointهای IPC: `probe_files`, `waveform_peaks`, `start_conversion`, `cancel_job/cancel_all_jobs`, `clear_finished`, `get_queue`, `disk_free`, `get_settings/save_settings`, `stat/resolve_media_paths`, permissionها، `generate_ab_preview`, `start/stop_live_boost` |
| `queue/mod.rs` | `QueueManager`: صف FIFO، thread pool با concurrency قابل‌تنظیم (پیش‌فرض 1)، `CancelToken` برای هر جاب، emit رویداد `job-event` |
| `processing/pipeline.rs` | ارکستراسیون 5 مرحله‌ای: Probe → Silence Detect → Split Planning → Path Gen → Pre-flight دیسک → Encode |
| `processing/silence.rs` | پارس خروجی `silencedetect` به بازه‌ها، محاسبه complement (قسمت‌های نگه‌داشتنی) |
| `processing/split.rs` | ریاضی Split: پنجره‌ها روی تایم‌لاین پسا-سکوت + نگاشت برگشتی به تایم‌استمپ اصلی |
| `processing/naming.rs` | sanitize یونیکد، `unique_path` ضد-overwrite با `(1),(2)`، staging اتمیک `.part` → rename |
| `processing/sound_booster/` | `presets.rs` (6 پریست + limiter)، `analyze.rs` (`volumedetect`)، `boost.rs` (کامپایلر آرگومان)، `preview.rs` (پریویو A/B + sweeper)، `pipeline.rs` (اکسپورت بوست‌شده) |
| `ffmpeg/probe.rs` | `ffprobe -print_format json`؛ اعتبارسنجی بر اساس استریم واقعی نه پسوند فایل؛ خطای `NoAudioTrack` برای ویدیوی بی‌صدا |
| `ffmpeg/waveform.rs` | دیکد به PCM mono 16kHz و باکت‌بندی min/max در بازه `[-1,1]` برای canvas |
| `ffmpeg/run.rs` | اجرای `Command` بدون shell، pump همزمان stdout/stderr (جلوگیری از deadlock)، کپچر 80 خط آخر stderr، kill فوری با CancelToken |
| `ffmpeg/progress.rs` | پارس `-progress pipe:1` (`out_time_us`, `speed`, `progress=end`) — بدون regex شکننده روی stderr انسانی |
| `ffmpeg/locate.rs` | ترتیب کشف باینری: `TAURI_ANDROID_NATIVE_LIB_DIR` → env → کنار executable → دایرکتوری dev |
| `disk.rs` | فضای آزاد (`statvfs` در یونیکس / `GetDiskFreeSpaceExW` در ویندوز) + تخمین حجم خروجی؛ pre-flight قبل از encode |
| `settings.rs` | `settings.json` در app-data OS با clamp/validation |
| `android_fs.rs` | بریج JNI با مدیریت امن exception (`exception_check/describe/clear`) |
| `error.rs` | `AppError` متمرکز: Io, FFmpeg, NoAudioTrack, CorruptedFile, InsufficientDiskSpace, Cancelled, ... با سریالایز کاربرفهم + جزئیات تکنیکال |
| `logger.rs` | لاگ به `<app_data>/logs/app.log` + stderr |

### 3.2. فرانت‌اند (`src/`)

| بخش | فایل‌ها | مسئولیت |
|---|---|---|
| Entry | `main.tsx`, `App.tsx`, `index.css` | mount، چیدمان Header/DropZone/FileList/Options/Jobs/Toasts، لیسنر درگ‌دراپ نیتیو |
| State | `stores/useAppStore.ts` + slices (`fileSlice`, `jobSlice`, `settingsSlice`, `uiSlice`) | ترکیب domain sliceها؛ ایزولاسیون کامل بوستر از کانورتر |
| Sound Booster | `features/sound-booster/` — `FileBoosterPage`, `PresetSelector`, `GainSlider`, `ABPreview`, `LiveBoosterPage`, `LiveBoosterToggle`, `ConsentExplainerSheet`, stores `useFileBoosterStore/useLiveBoosterStore`, hooks `useFileBooster/useLiveBooster` | دامنه ایزوله بوستر فایل + زنده |
| کامپوننت کانورتر | `DropZone`, `FileList`, `TrimEditor` (canvas + audition)، `OptionsPanel`, `JobsPanel`, `HeaderBar`, `Toasts`, `BottomNavigation/NavigationTabs` | فلو اصلی تبدیل |
| Utils | `utils/tauri.ts` (رپر تایپ‌شده IPC)، `utils/dialog.ts` (فیلتر پسوند مدیا)، `utils/estimate.ts` (تخمین حجم)، `utils/format.ts` (فرمت زمان/بایت + پارس `60` و `1:00:00`)، `utils/platform.ts` | زیرساخت فرانت |
| i18n | `i18n/en.ts`, `i18n/fa.ts`, `i18n/index.ts` | انگلیسی + فارسی کامل، RTL/LTR خودکار |

---

## 4. ویژگی‌ها (Feature Inventory کامل)

### 4.1. ورود فایل (Ingestion)

- درگ‌دراپ نیتیو OS + دیالوگ فایل دسکتاپ؛ Document Picker / MediaStore در اندروید.
- پشتیبانی MP4/MKV/AVI/MOV/WEBM/FLV/WMV + هرچه FFmpeg بتواند demux کند.
- اعتبارسنجی با **probe واقعی** نه پسوند؛ رد ویدیوی بدون ترک صوتی با خطای شفاف.
- پشتیبانی کامل **یونیکد/فارسی** در مسیرها end-to-end (بدون shell interpolation — همه‌چیز `Command` با آرایه + guard `--`).
- اندروید: URIهای `content://` یک‌بار در کش app stage می‌شوند (dedupe در session).

### 4.2. تریم waveform تعاملی

- رندر canvas از min/max peakها (دیکد 16kHz mono، تا 5 دقیقه).
- هندل‌های draggable، ورودی دستی timecode (`0:00.0`)، پخش انتخاب‌شده (audition via `asset://`)، quick-cut (حذف 10 ثانیه اول/آخر).
- منطق seek صحیح: `-ss` قبل از `-i` (fast seek) و `-to` بعد از `-i` با rebase (`end-start`).

### 4.3. فرمت‌ها و کیفیت

- خروجی: **MP3, WAV, AAC, M4A, FLAC, Opus**.
- تنظیمات متناسب فرمت: bitrate برای lossy، sample-rate/channel برای همه.
- پریست‌ها: Low / Medium / High / Very High / Custom با لیست صریح bitrate + بج تخمین حجم و درصد اختلاف با سورس.
- نکته‌های سازگاری: Opus نرخ نامعتبر را به 48kHz می‌برد (اجبار انکدر)؛ WAV همیشه 16-bit PCM.

### 4.4. تکه‌تکه کردن (Split)

- ورودی انعطاف‌پذیر: دقیقه (`60`) یا ساعت (`1:00:00`).
- آخرین قطعه remainder را می‌برد؛ سورس کوتاه‌تر از یک قطعه → تک خروجی.
- **نکته معماری مهم:** اسپلیت همیشه روی **تایم‌لاین پسا-حذف-سکوت** محاسبه و بعد به تایم‌استمپ اصلی نگاشت می‌شود — مرزها همان‌جایی می‌افتند که کاربر انتظار دارد.

### 4.5. حذف سکوت (Silence Removal)

- اسکن `silencedetect` + برش قطعی segment/concat.
- پریست threshold از ‎-20 تا ‎-45 dB + مقدار دستی؛ پریست حداقل مدت سکوت.
- تک‌پاس: استخراج + حذف سکوت + اسپلیت + انکد در **یک invocation** با یک `filter_complex` — حداکثر یک انکد lossy (کیفیت حفظ می‌شود).

### 4.6. صف و اجرای بچ

- وضعیت هر فایل: Waiting / Processing / Completed / Failed / Cancelled + پروگرس‌بار تکی و کلی.
- Concurrency قابل‌تنظیم (پیش‌فرض 1).
- پروگرس واقعی FFmpeg (`-progress pipe:1`) + نمایش سرعت (مثل `12.3x`).
- Cancel واقعی: kill پروسس + حذف `.part` ناقص.
- Pre-flight فضای دیسک با تخمین حجم خروجی؛ خطای `InsufficientDiskSpace` قبل از شروع.
- خطاهای کاربرفهم + expander «جزئیات فنی» (stderr خام).

### 4.7. File Sound Booster (تقویت فایل)

| پریست | زنجیره فیلتر | کاربرد |
|---|---|---|
| `smart` | `dynaudnorm=f=150:g=15:p=0.95:m=10:r=0.9` + `alimiter` | یکدست‌سازی ویدیو یوتیوب، ویس، سخنرانی |
| `music` | `volume={headroom}dB` (گین امن از `volumedetect`) + `alimiter` | تقویت موزیک با حفظ بالانس دینامیکی |
| `voice` | `highpass=f=80,dynaudnorm=f=100:g=21...` + `alimiter` | حذف rumble + leveling گفتار (پادکست/تماس) |
| `bass` | `equalizer=f=60:g=6,dynaudnorm=...` + `alimiter` | بوست 60Hz + کمپرس کنترل‌شده |
| `extreme` | `volume=12dB` + `alimiter` | سورس‌های خیلی کم‌صدا |
| `manual` | `volume={ratio}` از `20log10` (صفر تا 2.0x / صفر تا 200٪) + `alimiter` | اسلایدر دستی |

- **همه پریست‌ها به `alimiter` ختم می‌شوند** (محافظت True Peak در ‎-0.5 dBFS) — کلیپ دیجیتال غیرممکن.
- **بهینه‌سازی مهم:** آنالیز `volumedetect` فقط برای پریست `music` اجرا می‌شود؛ بقیه 15–40 ثانیه CPU روی فایل‌های بزرگ ذخیره می‌کنند.
- **پریویو A/B:** پنجره 10–15 ثانیه‌ای (25٪ duration یا شروع تریم)، ترانسکد به WAV خام 44.1kHz استریو برای پخش فوری، دو فایل `orig/boost` + waveform نرمال 40 باکتی برای مقایسه چشمی؛ sweeper خودکار با TTL پنج دقیقه (جلوگیری از leak).
- ایزولاسیون صف: `boostJobId` کپچر و فیلتر سخت‌گیرانه روی `job-event` تا ایونت‌های بچ معمولی store بوستر را آلوده نکنند.

### 4.8. Live Sound Booster (تقویت زنده — اندروید)

- کپچر **دیجیتال داخلی** با `AudioPlaybackCapture` (اندروید 10+): سورس‌های `USAGE_MEDIA/GAME/UNKNOWN`.
- **صفر دسترسی میکروفون** — مزیت حریم خصوصی و کیفیتی (بدون نویز محیط/دیستورشن). `USAGE_VOICE_COMMUNICATION` طبق پالیسی اندروید مستثنی و صادقانه در UI گفته شده.
- جلوگیری از فیدبک: `.excludeUid(myUid)` تا خروجی خود app دوباره کپچر نشود.
- موتور DSP بلادرنگ: گین 1.0x تا 4.0x + **لیمیتر soft-knee پیوسته C¹** (زانو 0.75، فرمول `tanh` — بدون پرش/وزوز):
  `|x|≤0.75 → x`، وگرنه `sgn·(0.75+0.25·tanh((|x|-0.75)/0.25))`.
- Foreground Service با نوتیفیکیشن دائمی + اکشن Stop؛ رندر `AudioTrack` کم‌تأخیر PCM16.
- UI: دایل پاور سخت‌افزاری (SVG وکتوری — نه یونیکد `⏻` که در وب‌ویو اندروید باکس خالی می‌شد)، اسلایدر multiplier، مودال رضایت MediaProjection، Bottom Navigation شیشه‌ای با نشانگر زنده، سینک state نیتیو↔وب (`ac:live-boost-state` + resync روی focus).
- محدودیت پلتفرمی: اگر app در بک‌گراند kill شود تبدیل می‌میرد (بهبود آینده: foreground service با نوتیف پروگرس).

### 4.9. خروجی و پلتفرم اندروید

- خروجی داخلی در کش app سپس publish به `Music/AudioConverter` در MediaStore (الزام Scoped Storage در API 29–36).
- پوشه خروجی custom در اندروید غیرفعال (با توضیح)؛ در دسکتاپ: `same_as_source` / `custom_folder` / `per_source_folder`.
- atomic staging: خروجی در `.tmp`/`.part` ساخته و فقط با exit-code صفر rename می‌شود؛ رزولوشن collision با `(1),(2)`.

### 4.10. تجربه کاربری، تم، زبان

- تم Light / Dark / System + انگلیسی/فارسی کامل با RTL خودکار.
- دیزاین مینیمال high-contrast؛ Bottom Nav موبایل‌فرست با blur و glow.
- ستینگ‌ها (concurrency، زبان، تم، auto-open پوشه خروجی) در app-data OS persist می‌شوند.
- Toastهای non-blocking با auto-dismiss شش ثانیه‌ای.

---

## 5. امنیت، کیفیت، پرفورمنس

| اصل | پیاده‌سازی |
|---|---|
| بدون shell injection | همه فراخوانی‌ها `std::process::Command` با آرایه + `--` قبل از خروجی |
| تک انکد lossy | کل گراف در یک `filter_complex`؛ بدون فایل واسط lossy |
| atomicity | `.part` + rename + `unique_path` (هرگز overwrite) |
| lifecycle | CancelToken برای هر پروسس؛ kill + cleanup روی cancel و `RunEvent::Exit`؛ pump دو-threadه ضد-deadlock |
| NaN-safety | گارد `is_finite` قبل از `clamp` در آنالیز volume |
| JNI safety | متدهای Kotlin با `@Keep` + قاعده ProGuard؛ چک/clear اکسپشن JNI در هر کال |
| LGPL compliance | فقط بیلد LGPL + libmp3lame/libopus؛ بدون x264/x265؛ مصرف صرفاً via CLI جدا (no linking) |
| پرفورمنس | bypass آنالیز غیرضروری؛ پروگرس pipe (نه poll)؛ waveform باکت‌شده؛ TTL sweeper پریویو |

---

## 6. بیلد، انتشار، تست

### 6.1. توسعه

```bash
pnpm install
pnpm fetch:ffmpeg     # بیلد macOS یا دانلود Win/Linux + اندروید
pnpm tauri dev        # دسکتاپ
bash scripts/dev-android.sh          # اندروید با HMR (پیش‌نیاز: emulator یا adb device)
bash scripts/run-android-emulator.sh # بالا آوردن emulator
```

پیش‌نیاز بیلد FFmpeg محلی (فقط بیلددهنده): Node ≥20، pnpm ≥9، Rust stable، `pkg-config/lame/opus` (Homebrew در مک).

### 6.2. انتشار

```bash
pnpm fetch:ffmpeg
pnpm tauri build
bash scripts/build-android-local.sh  # APK امضاشده + verify libffmpeg/libffprobe
```

| اسکریپت | نقش |
|---|---|
| `fetch-ffmpeg.mjs` | تهیه باینری per-platform |
| `build-ffmpeg-minimal.sh` | بیلد static مینیمال FFmpeg 8.1.2 + LAME 3.100 + Opus 1.6.1 |
| `patch-android-project.sh` | تزریق permission، ProGuard، کپی `MainActivity.kt`، بسته‌بندی `jniLibs/arm64-v8a` |
| `gen-icons.py` | تولید آیکون PNG/ICO/ICNS + mipmap اندروید |

- بیلد Windows/Linux در CI (`.github/workflows/release.yml`) چون هر installer روی OS خودش باید ساخته شود؛ هر job اول `fetch:ffmpeg` می‌زند.
- خروجی‌ها: `src-tauri/target/release/bundle/` و `src-tauri/gen/android/.../apk/`.

### 6.3. تست و کیفیت

```bash
pnpm test            # Vitest فرانت (28 تست: storeها، PresetSelector، estimate، format، FileList)
pnpm test:rust       # 62 یونیت‌تست راست (naming، split math، silence parsing، booster presets، settings)
cargo test --manifest-path src-tauri/Cargo.toml --test e2e  # 9 تست E2E واقعی
pnpm build           # tsc --noEmit + vite build
pnpm generate:types / check:types  # سینک Specta
```

E2E با FFmpeg باندل‌شده فایل tone–silence–tone می‌سازد و duration خروجی را assert می‌کند: تبدیل مستقیم، split+remainder، کوتاه‌شدن با silence-removal، ترتیب split-after-silence، فایل فارسی، فایل بی‌صدا، cancel.

---

## 7. قراردادهای IPC (خلاصه برای CTO)

**Commands (فرانت → بک):** `probe_files`, `stat_media_paths`, `resolve_media_paths`, `has/request_media_permissions`, `open_app_settings`, `waveform_peaks`, `start_conversion`, `cancel_job`, `cancel_all_jobs`, `clear_finished`, `get_queue`, `disk_free`, `get_settings/save_settings`, `generate_ab_preview`, `start/stop_live_boost`.

**Events (بک → فرانت):** `job-event` (هر transition + درصد/سرعت)، `queue-idle` (auto-open پوشه خروجی).

---

## 8. لایسنس‌های third-party

- FFmpeg 8.1.2 — **LGPL v2.1+** (باینری باندل‌شده؛ سورس در ffmpeg.org؛ بیلد macOS/Linux از سورس رسمی، بیلد Windows آرشیو BtbN lgpl).
- libmp3lame — LGPL v2+؛ libopus — BSD-3؛ Tauri و crateهای Rust — MIT/Apache-2.0؛ React/Vite/Tailwind/Zustand/Vitest — MIT.

---

## 9. محدودیت‌های شناخته‌شده و نقشه راه

| وضعیت | شرح |
|---|---|
| امضا نشده | SmartScreen ویندوز (نیاز Authenticode)؛ Gatekeeper مک (right-click → Open در اجرای اول) |
| Opus/WAV quirks | Opus نرخ نامعتبر → 48kHz؛ WAV همیشه 16-bit PCM |
| اندروید | بدون پوشه custom (MediaStore)؛ stage یک‌باره SAF در کش؛ مرگ کانورژن با kill app (آینده: foreground service با نوتیف پروگرس) |
| Live Booster | فقط اندروید 10+؛ بدون `VOICE_COMMUNICATION` (محدودیت اندروید)؛ گین سقف 4.0x |
| آینده پیشنهادی | code signing در CI، foreground service کانورژن، پریست‌های بیشتر،波形 زوم‌پذیر، تاریخچه جاب‌ها |

---

## 10. چرا این معماری جواب می‌دهد (جمع‌بندی CTO)

1. **یک کدبیس، چهار پلتفرم** با هزینه نگهداری پایین (Tauri + Rust + JNI حداقلی).
2. **کیفیت صوتی تضمین‌شده ریاضی:** تک‌پاس + limiter هم در فایل و هم در لایو.
3. **حریم خصوصی به‌عنوان مزیت رقابتی:** Live Booster بدون میکروفون.
4. **قرارداد تایپ‌سالم Rust↔TS** با Specta — شکست سریع در کامپایل به‌جای باگ ران‌تایم.
5. **امنیت پیش‌فرض:** بدون shell، atomic write، cleanup قطعی، LGPL-clean.
6. **قابل اتکا:** 62+9+28 تست + E2E با فایل واقعی + verify باینری در بیلد اندروید.

*این سند از روی `README.md`، `AGENT_HANDOFF.md`، `SOUND_BOOSTER_ARCHITECTURE.md`، `Cargo.toml`، `package.json` و ساختار `src/`/`src-tauri/` گردآوری شده و تصویر کامل محصول برای تصمیم‌گیری فنی است.*
