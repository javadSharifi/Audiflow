# مخفی‌سازی قابلیت «تبدیل صوت به متن» (Transcribe)

این مستند تغییراتی را ثبت می‌کند که در آن فیچر «رونویسی / تبدیل صوت به متن» (Gemini
Transcribe) به‌صورت موقت از اپلیکیشن مخفی شد تا در رابط کاربری نمایش داده نشود و در
خروجی بیلد فرانت‌اند هم نیاید. قرارداد این بود که **کد حذف نشود** و در آینده بتوان با یک
`git revert` ساده دوباره فعالش کرد.

> وضعیت: **مخفی** — قابلیت هنوز کامل نوشته‌شده و در ریپو موجود است، فقط در دسترس نیست.

---

## چه چیزی مخفی شد (و کجا)

| فایل | تغییر |
|------|-------|
| `src/components/ToolSwitcher.tsx` | تب «رونویسی/Transcribe» از هر دو حالت (دسکتاپ و موبایل) حذف شد؛ فقط «Converter» و «Music Player» باقی ماندند. import آیکون `Mic` هم برداشته شد. |
| `src/App.tsx` | import و رندر `TranscribePage` حذف شد؛ `activeTool === "transcribe"` دیگر هیچ شاخه‌ای ندارد. |
| `src/types/index.ts` | نوع `AppTool` فقط `"converter" \| "player"` است. |
| `src/stores/slices/settingsSlice.ts` | مقدار قبلی `"transcribe"` در localStorage دیگر معتبر نیست و خودکار به `"converter"` برمی‌گردد (جلوگیری از صفحه‌ی سفید). |

نتیجه: حدود **۲۴ کیلوبایت** از باندل JS کم شد (۵۴۳KB ← ۵۱۹KB) و هیچ کدی از این فیچر در
خروجی فرانت‌اند نیست.

---

## چه چیزهایی سر جایشان باقی ماندند (دست‌نخورده)

- کل سورس فیچر: `src/features/transcribe/` (صفحه، کامپوننت‌ها، هوک، store و تست‌ها)
- کلیدهای i18n در `src/i18n/en.ts` و `src/i18n/fa.ts` (بی‌استفاده ولی بی‌ضرر)
- رپرهای IPC و تایپ‌های تولیدشده: `src/utils/tauri.ts` و `src/types/generated.ts`
- کل بخش بک‌اند Rust:
  - `src-tauri/src/secrets.rs` (ذخیره‌ی کلید در keychain)
  - `src-tauri/src/transcribe_queue.rs`
  - `src-tauri/src/processing/transcribe/` (کلاینت Gemini، طبقه‌بندی خطا، preprocess، usage tracker و…)
  - ۱۰ کامند IPC رجیسترشده در `commands` و `lib.rs`
  - فیلد `transcribe` در تنظیمات

> توجه: بک‌اند Rust همچنان کامپایل می‌شود ولی چون هیچ تماس‌گیری در فرانت‌اند ندارد،
> عملاً کد مرده در باینری است (~۰.۵MB). برای حذف کامل آن باید `lib.rs` / `mod.rs` و
> رجیستر کامندها را هم دست‌کاری کرد که معکوس‌سازی آن پیچیده‌تر است؛ توصیه‌شده انجام نشود.

---

## یک باگ مهم که حین کار پیدا و درست شد (راهنمای عیب‌یابی آینده)

خطای «هنوز کلید ذخیره نشده» (MissingKey) وقتی رخ می‌داد که گوگل با خطای **401** پاسخ می‌داد.

- ریشه‌یابی: `MissingKey` فقط باید برای حالتی استفاده شود که keychain خالی است
  (مسیر `secrets.rs::require_gemini_api_key`). درخواست‌های ما همیشه هدر
  `x-goog-api-key` را می‌فرستند، پس 401 یعنی گوگل **کلیدِ ارائه‌شده را قبول نکرده**،
  نه اینکه کلیدی وجود ندارد.
- اصلاح: در `src-tauri/src/processing/transcribe/error_classify.rs` حالت **401 → InvalidKey**
  شد (قبلاً MissingKey بود). تست مربوطه و تست `status_mapping_matrix` در
  `gemini_client.rs` هم‌اهنگ شدند.
- لاگ تشخیصی: هر خطای HTTP گوگل حالا در ترمینال `tauri dev` به این شکل لاگ می‌شود:
  `gemini http <status> -> <kind>; body: <300 کاراکتر>` (تابع `truncate_for_log`).
  اگر کاربر دوباره خطا گرفت، همین خط لاگ تشخیص دقیق می‌دهد.

---

## چطور دوباره فعالش کنیم

ساده‌ترین راه — بازگرداندن کامل تغییرات این مخفی‌سازی:

```bash
git checkout src/components/ToolSwitcher.tsx src/App.tsx src/types/index.ts src/stores/slices/settingsSlice.ts
```

(اگر این مخفی‌سازی هنوز کامیت نشده، به‌جای دو خط بالا فقط فایل‌های مربوطه را از کار
برگردانید، یا اگر کامیت شده با `git revert <commit>` revert کنید.)

بعد از آن:

- تب Transcribe در `ToolSwitcher` و رندر `TranscribePage` در `App.tsx` برمی‌گردند.
- اجرای تست‌ها: `pnpm test` (فایل `src/features/transcribe/stores/__tests__/useTranscribeStore.test.ts` هم دوباره اجرا می‌شود).
- بیلد: `pnpm build`.

> اگر در آینده خواستید بک‌اند Rust هم از بیلد حذف شود (کاهش سایز باینری)، باید ماژول‌ها را
> پشت یک `cargo feature` مثل `transcribe` قرار دهید یا از `lib.rs`/`mod.rs` حذف کنید — قبل
> از آن با نگهدارنده‌ی پروژه هماهنگ کنید چون `export_types` و `generated.ts` به این کامندها وابسته‌اند.

---

## خلاصه‌ی وضعیت کنونی

- [x] فیچر در UI مخفی است
- [x] در باندل فرانت‌اند نیست (درخت‌تکان خورده / tree-shaken)
- [x] سورس و بک‌اند دست‌نخورده باقی ماند (قابل فعال‌سازی مجدد)
- [ ] بک‌اند Rust هنوز در باینری کامپایل می‌شود (غیرفعال، کد مرده)