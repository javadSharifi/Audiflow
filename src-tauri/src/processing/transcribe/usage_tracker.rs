//! App-local transcription usage bookkeeping (NOT an official quota).
//!
//! Google publishes no fixed free-tier number (it varies per project/tier),
//! so this module only tracks what THIS app sent, keyed by calendar day in
//! **Pacific Time** (computed explicitly — never the device timezone), plus
//! the most recently observed real `QuotaFailure` from Google with a
//! discovered-at timestamp (may be stale). The authoritative live source is
//! https://aistudio.google.com/rate-limit (linked from the UI).

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use crate::error::Result;
use crate::processing::transcribe::types::{ObservedQuota, UsageStats};

const FILE_NAME: &str = "transcribe_usage.json";
/// Bound the file: keep this many recent day entries.
const KEEP_DAYS: usize = 45;

#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
struct StoredQuota {
    metric: String,
    value: String,
    discovered_at: u64,
}

#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
struct UsageFile {
    /// "YYYY-MM-DD" (Pacific) -> audio-minutes sent.
    #[serde(default)]
    days: HashMap<String, f64>,
    #[serde(default)]
    last_quota: Option<StoredQuota>,
}

// ---- Pacific-Time day math (std only, no chrono) ---------------------------

fn days_from_civil(y: i64, m: i64, d: i64) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = y.div_euclid(400);
    let yoe = y - era * 400;
    let mp = (m + 9) % 12;
    let doy = (153 * mp + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146097 + doe - 719468
}

fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719468;
    let era = z.div_euclid(146097);
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = (if mp < 10 { mp + 3 } else { mp - 9 }) as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

/// Sunday = 0 … Saturday = 6. 1970-01-01 was a Thursday.
fn weekday_of_days(days: i64) -> i64 {
    (days + 4).rem_euclid(7)
}

fn first_sunday_of_month(year: i64, month: i64) -> i64 {
    let first = days_from_civil(year, month, 1);
    first + (7 - weekday_of_days(first)) % 7
}

/// DST transition instants as UTC unix seconds: spring forward at 2:00 PST
/// (= 10:00 UTC) on March's second Sunday; fall back at 2:00 PDT (= 09:00 UTC)
/// on November's first Sunday.
fn dst_transitions_utc(year: i64) -> (i64, i64) {
    let mar_start = first_sunday_of_month(year, 3) + 7;
    let nov_end = first_sunday_of_month(year, 11);
    (mar_start * 86400 + 10 * 3600, nov_end * 86400 + 9 * 3600)
}

fn is_pacific_dst(unix_secs: i64) -> bool {
    let (year, _, _) = civil_from_days(unix_secs.div_euclid(86400));
    let (start, end) = dst_transitions_utc(year);
    unix_secs >= start && unix_secs < end
}

/// "YYYY-MM-DD" of `unix_secs` in Pacific Time.
fn pacific_date_string(unix_secs: i64) -> String {
    let offset = if is_pacific_dst(unix_secs) {
        -7 * 3600
    } else {
        -8 * 3600
    };
    let (y, m, d) = civil_from_days((unix_secs + offset).div_euclid(86400));
    format!("{y:04}-{m:02}-{d:02}")
}

fn now_unix_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

// ---- persistence ------------------------------------------------------------

fn usage_file_path() -> Option<PathBuf> {
    crate::settings::app_data_dir().map(|d| d.join(FILE_NAME))
}

fn load_from(dir: &Path) -> UsageFile {
    std::fs::read_to_string(dir.join(FILE_NAME))
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

fn save_to(dir: &Path, usage: &UsageFile) -> Result<()> {
    if let Err(e) = std::fs::create_dir_all(dir) {
        return Err(crate::error::AppError::Io(e.to_string()));
    }
    let json = serde_json::to_string_pretty(usage)
        .map_err(|e| crate::error::AppError::Other(e.to_string()))?;
    // Atomic write mirroring settings.rs: crash mid-write never corrupts.
    let tmp = dir.join(format!("{FILE_NAME}.tmp"));
    std::fs::write(&tmp, json).map_err(crate::error::AppError::from)?;
    std::fs::rename(&tmp, dir.join(FILE_NAME)).map_err(|e| {
        let _ = std::fs::remove_file(&tmp);
        crate::error::AppError::from(e)
    })?;
    Ok(())
}

fn prune(usage: &mut UsageFile) {
    if usage.days.len() <= KEEP_DAYS {
        return;
    }
    let mut keys: Vec<_> = usage.days.keys().cloned().collect();
    keys.sort();
    for k in keys.into_iter().take(usage.days.len() - KEEP_DAYS) {
        usage.days.remove(&k);
    }
}

fn record_in(dir: &Path, day: &str, minutes: f64) -> Result<()> {
    if !(minutes.is_finite() && minutes > 0.0) {
        return Ok(());
    }
    let mut usage = load_from(dir);
    *usage.days.entry(day.to_string()).or_insert(0.0) += minutes;
    prune(&mut usage);
    save_to(dir, &usage)
}

fn note_in(dir: &Path, metric: &str, value: &str, discovered_at: u64) -> Result<()> {
    let mut usage = load_from(dir);
    usage.last_quota = Some(StoredQuota {
        metric: metric.to_string(),
        value: value.to_string(),
        discovered_at,
    });
    save_to(dir, &usage)
}

fn stats_in(dir: &Path, day: &str) -> UsageStats {
    let usage = load_from(dir);
    UsageStats {
        sent_minutes_today: usage.days.get(day).copied().unwrap_or(0.0),
        last_observed_quota: usage.last_quota.map(|q| ObservedQuota {
            metric: q.metric,
            value: q.value,
            discovered_at: q.discovered_at,
        }),
    }
}

// ---- public API --------------------------------------------------------------

/// Add `minutes` of sent audio to today's (Pacific) counter.
pub fn record_sent_minutes(minutes: f64) -> Result<()> {
    let Some(path) = usage_file_path() else {
        return Ok(());
    };
    let dir = path.parent().map(Path::to_path_buf).unwrap_or(path);
    let day = pacific_date_string(now_unix_secs() as i64);
    record_in(&dir, &day, minutes)
}

/// Cache a real `QuotaFailure` observed from Google.
pub fn note_quota_failure(metric: &str, value: &str) -> Result<()> {
    let Some(path) = usage_file_path() else {
        return Ok(());
    };
    let dir = path.parent().map(Path::to_path_buf).unwrap_or(path);
    note_in(&dir, metric, value, now_unix_secs())
}

/// Current stats: today's local counter + last observed real limit, if any.
pub fn get_usage_stats() -> UsageStats {
    let Some(path) = usage_file_path() else {
        return UsageStats {
            sent_minutes_today: 0.0,
            last_observed_quota: None,
        };
    };
    let dir = path.parent().map(Path::to_path_buf).unwrap_or(path);
    let day = pacific_date_string(now_unix_secs() as i64);
    stats_in(&dir, &day)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn utc(y: i64, mo: i64, d: i64, h: i64, mi: i64) -> i64 {
        days_from_civil(y, mo, d) * 86400 + h * 3600 + mi * 60
    }

    fn temp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "ac-tx-usage-{tag}-{}-{}",
            std::process::id(),
            now_unix_secs()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn pacific_day_in_summer_pdt() {
        // 2026-09-14 12:00 UTC = 05:00 PDT, same date.
        assert_eq!(pacific_date_string(utc(2026, 9, 14, 12, 0)), "2026-09-14");
    }

    #[test]
    fn pacific_day_lags_utc_near_midnight() {
        // 2026-09-14 06:59 UTC = Sept 13, 23:59 PDT.
        assert_eq!(pacific_date_string(utc(2026, 9, 14, 6, 59)), "2026-09-13");
    }

    #[test]
    fn pacific_day_in_winter_pst() {
        // 2026-01-15 12:00 UTC = 04:00 PST.
        assert_eq!(pacific_date_string(utc(2026, 1, 15, 12, 0)), "2026-01-15");
    }

    #[test]
    fn dst_spring_forward_boundary_2026() {
        // Second Sunday of March 2026 = Mar 8. 10:00 UTC flips PST->PDT.
        assert!(!is_pacific_dst(utc(2026, 3, 8, 9, 59)));
        assert!(is_pacific_dst(utc(2026, 3, 8, 10, 0)));
    }

    #[test]
    fn dst_fall_back_boundary_2026() {
        // First Sunday of Nov 2026 = Nov 1. 09:00 UTC flips PDT->PST.
        assert!(is_pacific_dst(utc(2026, 11, 1, 8, 59)));
        assert!(!is_pacific_dst(utc(2026, 11, 1, 9, 0)));
    }

    #[test]
    fn record_and_stats_round_trip() {
        let dir = temp_dir("roundtrip");
        record_in(&dir, "2026-09-14", 5.5).unwrap();
        record_in(&dir, "2026-09-14", 2.0).unwrap();
        record_in(&dir, "2026-09-13", 10.0).unwrap();
        let stats = stats_in(&dir, "2026-09-14");
        assert!((stats.sent_minutes_today - 7.5).abs() < 1e-9);
        assert!(stats.last_observed_quota.is_none());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn quota_note_round_trip() {
        let dir = temp_dir("quota");
        note_in(&dir, "m", "v", 12345).unwrap();
        let stats = stats_in(&dir, "2026-09-14");
        let q = stats.last_observed_quota.unwrap();
        assert_eq!(
            (q.metric.as_str(), q.value.as_str(), q.discovered_at),
            ("m", "v", 12345)
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn ignores_nonpositive_minutes() {
        let dir = temp_dir("nonpos");
        record_in(&dir, "2026-09-14", 0.0).unwrap();
        record_in(&dir, "2026-09-14", f64::NAN).unwrap();
        assert_eq!(stats_in(&dir, "2026-09-14").sent_minutes_today, 0.0);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
