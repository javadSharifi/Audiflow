use crate::online_player::types::{TimedLyricLine, TimedLyrics};
use reqwest::Client;
use serde_json::Value;

pub async fn fetch_lyrics(
    client: &Client,
    title: &str,
    artist: &str,
    _duration_secs: Option<u32>,
) -> Result<Option<TimedLyrics>, String> {
    let res = client
        .get("https://lrclib.net/api/get")
        .query(&[("track_name", title), ("artist_name", artist)])
        .header("User-Agent", "Audiflow/1.5.9 (https://github.com/javadSharifi/Audiflow)")
        .send()
        .await
        .map_err(|e| format!("LRCLIB network error: {}", e))?;

    if res.status().as_u16() == 404 {
        return Ok(None);
    }

    if !res.status().is_success() {
        return Err(format!("LRCLIB returned HTTP {}", res.status()));
    }

    let json: Value = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse LRCLIB response: {}", e))?;

    let plain_lyrics = json.get("plainLyrics").and_then(|p| p.as_str()).map(|s| s.to_string());
    let synced_lyrics = json.get("syncedLyrics").and_then(|s| s.as_str());

    let (is_synced, lines) = match synced_lyrics {
        Some(text) if !text.trim().is_empty() => (true, parse_lrc(text)),
        _ => (false, Vec::new()),
    };

    Ok(Some(TimedLyrics {
        track_id: format!("{}:{}", artist, title),
        is_synced,
        lines,
        plain_text: plain_lyrics,
    }))
}

fn parse_lrc(lrc_text: &str) -> Vec<TimedLyricLine> {
    let mut lines = Vec::new();

    for raw_line in lrc_text.lines() {
        let line = raw_line.trim();
        if !line.starts_with('[') {
            continue;
        }

        if let Some(close_bracket) = line.find(']') {
            let time_str = &line[1..close_bracket];
            let lyric_text = line[close_bracket + 1..].trim();

            if let Some(time_ms) = parse_timestamp(time_str) {
                lines.push(TimedLyricLine {
                    time_ms,
                    text: lyric_text.to_string(),
                });
            }
        }
    }

    lines
}

fn parse_timestamp(ts: &str) -> Option<u32> {
    let parts: Vec<&str> = ts.split(':').collect();
    if parts.len() < 2 {
        return None;
    }

    let minutes: u32 = parts[0].parse().ok()?;
    let seconds_parts: Vec<&str> = parts[1].split('.').collect();
    let seconds: u32 = seconds_parts[0].parse().ok()?;
    let millis: u32 = if seconds_parts.len() > 1 {
        let m_str = seconds_parts[1];
        let padded = format!("{:0<3}", m_str);
        padded[..3].parse().unwrap_or(0)
    } else {
        0
    };

    Some(minutes * 60_000 + seconds * 1_000 + millis)
}
