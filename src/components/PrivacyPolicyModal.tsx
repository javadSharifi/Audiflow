import { createPortal } from "react-dom";
import { ArrowLeft, ShieldCheck, X } from "lucide-react";
import { type Lang } from "../i18n";

interface Section {
  heading: string;
  body: string;
}

const POLICY: Record<Lang, { title: string; updated: string; intro: string; sections: Section[] }> = {
  en: {
    title: "Privacy Policy",
    updated: "Last updated: November 2026",
    intro:
      "Audiflow processes audio on your device. There is no account, no sign-up and no analytics or tracking SDK.",
    sections: [
      {
        heading: "Audio files",
        body: "Files you open are read and written locally with FFmpeg running inside the app. Your audio never leaves the device and is not uploaded to any server.",
      },
      {
        heading: "Data stored on the device",
        body: "Settings, the music-library index, cached artwork and waveform caches are kept in the app's private storage. Removing the app deletes them.",
      },
      {
        heading: "Network access",
        body: "The app only makes two optional requests: a lyric lookup that sends the artist name, track title and duration to lrclib.net, and an update check against the public GitHub Releases API. Both are skipped when offline. Android builds skip the update check entirely.",
      },
      {
        heading: "Permissions",
        body: "Media read access is used only to list and open your audio/video files. Notification permission shows playback controls. The ringtone permission is requested only when you choose to set a track as your ringtone. Nothing is shared with third parties.",
      },
      {
        heading: "Children",
        body: "The app is not directed at children and collects no personal information from anyone.",
      },
      {
        heading: "Open-source components",
        body: "Audiflow includes FFmpeg (LGPL-2.1-or-later, built without GPL components), AndroidX Media3 (Apache-2.0), Tauri (MIT/Apache-2.0) and React (MIT). Full license texts and the FFmpeg source offer ship in the project's THIRD_PARTY_LICENSES file.",
      },
      {
        heading: "Contact",
        body: "Questions about this policy can be sent to the developer through the store listing's support contact.",
      },
    ],
  },
  fa: {
    title: "سیاست حریم خصوصی",
    updated: "آخرین به‌روزرسانی: آبان ۱۴۰۵",
    intro:
      "آدیوفلو فایل‌های صوتی را روی دستگاه خودتان پردازش می‌کند. حساب کاربری، ثبت‌نام، ابزار تحلیلی و ردیاب تبلیغاتی وجود ندارد.",
    sections: [
      {
        heading: "فایل‌های صوتی",
        body: "فایل‌هایی که باز می‌کنید به‌صورت محلی و با FFmpeg داخل خود برنامه خوانده و نوشته می‌شوند. صدای شما از دستگاه خارج نمی‌شود و به هیچ سروری ارسال نمی‌گردد.",
      },
      {
        heading: "داده‌های ذخیره‌شده روی دستگاه",
        body: "تنظیمات، فهرست کتابخانه موسیقی، کاورهای کش‌شده و کش شکل موج در حافظه خصوصی برنامه نگهداری می‌شوند. با حذف برنامه این داده‌ها هم پاک می‌شوند.",
      },
      {
        heading: "دسترسی به شبکه",
        body: "برنامه فقط دو درخواست اختیاری دارد: جست‌وجوی متن آهنگ که نام خواننده، عنوان و مدت را به lrclib.net می‌فرستد، و بررسی به‌روزرسانی از API عمومی گیت‌هاب. در حالت آفلاین هیچ‌کدام انجام نمی‌شود. نسخه اندروید بررسی به‌روزرسانی را انجام نمی‌دهد.",
      },
      {
        heading: "دسترسی‌ها",
        body: "دسترسی خواندن رسانه فقط برای فهرست‌کردن و بازکردن فایل‌های صوتی و ویدیویی استفاده می‌شود. دسترسی اعلان برای نمایش کنترل پخش است. دسترسی تنظیم آهنگ زنگ فقط زمانی درخواست می‌شود که خودتان آهنگی را به‌عنوان زنگ انتخاب کنید. هیچ داده‌ای با شخص ثالث به اشتراک گذاشته نمی‌شود.",
      },
      {
        heading: "کودکان",
        body: "این برنامه مخاطب کودک ندارد و هیچ اطلاعات شخصی از هیچ کاربری جمع‌آوری نمی‌کند.",
      },
      {
        heading: "کتابخانه‌های متن‌باز",
        body: "آدیوفلو شامل FFmpeg (LGPL-2.1-or-later، بدون اجزای GPL)، AndroidX Media3 (Apache-2.0)، Tauri (MIT/Apache-2.0) و React (MIT) است. متن کامل مجوزها و تعهد ارائه سورس FFmpeg در فایل THIRD_PARTY_LICENSES پروژه موجود است.",
      },
      {
        heading: "تماس",
        body: "پرسش‌ها درباره این سیاست را می‌توانید از طریق اطلاعات تماس پشتیبانی در صفحه فروشگاه ارسال کنید.",
      },
    ],
  },
};

interface PrivacyPolicyModalProps {
  lang: Lang;
  onClose: () => void;
}

export function PrivacyPolicyModal({ lang, onClose }: PrivacyPolicyModalProps): React.JSX.Element {
  const policy = POLICY[lang];

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={policy.title}
        onClick={(e) => e.stopPropagation()}
        className="glass-panel flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-center gap-2.5 border-b border-black/[0.05] p-4 dark:border-white/[0.05]">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
            <ShieldCheck className="h-4 w-4" strokeWidth={2.4} />
          </div>
          <h2 className="flex-1 text-sm font-bold text-zinc-900 dark:text-zinc-100">{policy.title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={lang === "fa" ? "بستن" : "Close"}
            className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-400 hover:bg-black/5 hover:text-zinc-700 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          <p className="mb-1 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500">{policy.updated}</p>
          <p className="mb-4">{policy.intro}</p>
          {policy.sections.map((s) => (
            <section key={s.heading} className="mb-3.5">
              <h3 className="mb-1 text-xs font-bold text-zinc-800 dark:text-zinc-100">{s.heading}</h3>
              <p className="text-xs leading-6">{s.body}</p>
            </section>
          ))}
        </div>

        <div className="border-t border-black/[0.05] p-4 dark:border-white/[0.05]">
          <button
            type="button"
            onClick={onClose}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-orange-500/25 active:scale-95"
          >
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            {lang === "fa" ? "بازگشت" : "Back"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
