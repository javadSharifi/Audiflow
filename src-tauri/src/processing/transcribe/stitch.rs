//! Chunk transcript stitching + transcript export rendering.
//!
//! Chunking mirrors the `split.rs` remapping idea: chunk boundaries are
//! computed on the post-preprocess timeline, and each chunk's word offsets
//! (relative to its own chunk start) are shifted by that chunk's start before
//! merging into one [`TranscriptionResult`].
//!
//! Fast-mode rescaling happens here, before stitching: every returned offset
//! is divided by the speed factor (1.5x), per spec, so SRT/VTT/UI all consume
//! original-timeline seconds.

use crate::error::{AppError, Result};
use crate::processing::transcribe::types::{TranscriptionResult, WordInfo};

/// One chunk's transcript plus its start on the post-preprocess timeline.
#[derive(Debug, Clone)]
pub struct ChunkTranscript {
    pub result: TranscriptionResult,
    pub start_secs: f64,
}

/// Merge chunk transcripts into one result.
///
/// `speed_factor` is 1.0 normally, 1.5 in fast mode: each word lands at
/// `(chunk_start + word_offset) / speed_factor`. Texts join with a newline,
/// `language_detected` is the first non-empty value.
pub fn stitch_chunks(chunks: &[ChunkTranscript], speed_factor: f64) -> TranscriptionResult {
    let speed = if speed_factor > 0.0 {
        speed_factor
    } else {
        1.0
    };
    let mut words: Vec<WordInfo> = Vec::new();
    let mut texts: Vec<String> = Vec::new();
    let mut language_detected: Option<String> = None;
    for chunk in chunks {
        let t = chunk.result.full_text.trim();
        if !t.is_empty() {
            texts.push(t.to_string());
        }
        if language_detected.is_none() {
            language_detected = chunk.result.language_detected.clone();
        }
        for w in &chunk.result.words {
            words.push(WordInfo {
                text: w.text.clone(),
                speaker: w.speaker.clone(),
                start_offset: (chunk.start_secs + w.start_offset) / speed,
                end_offset: (chunk.start_secs + w.end_offset) / speed,
            });
        }
    }
    // Chunks are appended in order, so words are already sorted; enforce it
    // defensively (stable) in case of float edge cases.
    words.sort_by(|a, b| {
        a.start_offset
            .partial_cmp(&b.start_offset)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    TranscriptionResult {
        full_text: texts.join("\n"),
        words,
        language_detected,
    }
}

// ---- export rendering -------------------------------------------------------

/// Export container selected in the UI. SRT/VTT require word timestamps.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TranscriptFormat {
    Txt,
    Srt,
    Vtt,
}

impl TranscriptFormat {
    pub fn parse(s: &str) -> Result<Self> {
        match s.to_lowercase().as_str() {
            "txt" => Ok(TranscriptFormat::Txt),
            "srt" => Ok(TranscriptFormat::Srt),
            "vtt" => Ok(TranscriptFormat::Vtt),
            other => Err(AppError::InvalidInput(format!(
                "Unknown transcript format: {other}"
            ))),
        }
    }

    pub fn extension(self) -> &'static str {
        match self {
            TranscriptFormat::Txt => "txt",
            TranscriptFormat::Srt => "srt",
            TranscriptFormat::Vtt => "vtt",
        }
    }
}

fn fmt_srt(t: f64) -> String {
    let total_ms = (t.max(0.0) * 1000.0).round() as u64;
    format!(
        "{:02}:{:02}:{:02},{:03}",
        total_ms / 3_600_000,
        (total_ms / 60_000) % 60,
        (total_ms / 1000) % 60,
        total_ms % 1000
    )
}

/// Group words into cues: break on speaker change, silence gaps > 2s, or 8
/// words per cue (readable line length).
fn group_cues(words: &[WordInfo]) -> Vec<&[WordInfo]> {
    const MAX_WORDS: usize = 8;
    const MAX_GAP: f64 = 2.0;
    let mut cues: Vec<&[WordInfo]> = Vec::new();
    let mut start = 0usize;
    for i in 1..=words.len() {
        let brk = i == words.len()
            || words[i].speaker != words[i - 1].speaker
            || words[i].start_offset - words[i - 1].end_offset > MAX_GAP
            || i - start >= MAX_WORDS;
        if brk {
            cues.push(&words[start..i]);
            start = i;
        }
    }
    cues
}

fn require_words(result: &TranscriptionResult, format: &str) -> Result<()> {
    if result.words.is_empty() {
        return Err(AppError::InvalidInput(format!(
            "{format} export needs word timestamps — re-run with timestamps enabled"
        )));
    }
    Ok(())
}

/// Render a finished result to txt/srt/vtt text (atomic write happens in the
/// export command via `naming.rs`, not here).
pub fn render_transcript(result: &TranscriptionResult, format: TranscriptFormat) -> Result<String> {
    match format {
        TranscriptFormat::Txt => Ok(format!("{}\n", result.full_text.trim())),
        TranscriptFormat::Srt => {
            require_words(result, "SRT")?;
            let mut out = String::new();
            for (i, cue) in group_cues(&result.words).iter().enumerate() {
                let text: Vec<_> = cue.iter().map(|w| w.text.as_str()).collect();
                out.push_str(&format!(
                    "{}\n{} --> {}\n{}\n\n",
                    i + 1,
                    fmt_srt(cue.first().map(|w| w.start_offset).unwrap_or(0.0)),
                    fmt_srt(cue.last().map(|w| w.end_offset).unwrap_or(0.0)),
                    text.join(" ")
                ));
            }
            Ok(out)
        }
        TranscriptFormat::Vtt => {
            require_words(result, "VTT")?;
            let mut out = String::from("WEBVTT\n\n");
            for cue in group_cues(&result.words) {
                let text: Vec<_> = cue.iter().map(|w| w.text.as_str()).collect();
                out.push_str(&format!(
                    "{} --> {}\n{}\n\n",
                    fmt_srt(cue.first().map(|w| w.start_offset).unwrap_or(0.0)).replace(',', "."),
                    fmt_srt(cue.last().map(|w| w.end_offset).unwrap_or(0.0)).replace(',', "."),
                    text.join(" ")
                ));
            }
            Ok(out)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn word(text: &str, start: f64, end: f64, speaker: Option<&str>) -> WordInfo {
        WordInfo {
            text: text.to_string(),
            speaker: speaker.map(|s| s.to_string()),
            start_offset: start,
            end_offset: end,
        }
    }

    fn chunk(text: &str, words: Vec<WordInfo>, start: f64) -> ChunkTranscript {
        ChunkTranscript {
            result: TranscriptionResult {
                full_text: text.to_string(),
                words,
                language_detected: None,
            },
            start_secs: start,
        }
    }

    #[test]
    fn offsets_shift_by_chunk_start() {
        let stitched = stitch_chunks(
            &[
                chunk("one", vec![word("one", 0.1, 0.5, None)], 0.0),
                chunk("two", vec![word("two", 0.2, 0.6, None)], 100.0),
            ],
            1.0,
        );
        assert_eq!(stitched.full_text, "one\ntwo");
        assert!((stitched.words[1].start_offset - 100.2).abs() < 1e-9);
        assert!((stitched.words[1].end_offset - 100.6).abs() < 1e-9);
    }

    #[test]
    fn fast_mode_divides_by_speed() {
        let stitched = stitch_chunks(&[chunk("x", vec![word("x", 1.5, 3.0, None)], 0.0)], 1.5);
        assert!((stitched.words[0].start_offset - 1.0).abs() < 1e-9);
        assert!((stitched.words[0].end_offset - 2.0).abs() < 1e-9);
    }

    #[test]
    fn language_first_wins() {
        let mut a = chunk("a", vec![], 0.0);
        a.result.language_detected = Some("fa-IR".to_string());
        let b = chunk("b", vec![], 10.0);
        assert_eq!(
            stitch_chunks(&[b, a], 1.0).language_detected.as_deref(),
            Some("fa-IR")
        );
    }

    fn ts_result() -> TranscriptionResult {
        TranscriptionResult {
            full_text: "hello world".to_string(),
            words: vec![
                word("hello", 61.5, 62.0, Some("spk_1")),
                word("world", 62.1, 62.8, Some("spk_1")),
            ],
            language_detected: None,
        }
    }

    #[test]
    fn srt_numbering_and_timestamps() {
        let srt = render_transcript(&ts_result(), TranscriptFormat::Srt).unwrap();
        assert!(srt.starts_with("1\n00:01:01,500 --> 00:01:02,800\nhello world\n"));
    }

    #[test]
    fn vtt_header_and_dots() {
        let vtt = render_transcript(&ts_result(), TranscriptFormat::Vtt).unwrap();
        assert!(vtt.starts_with("WEBVTT\n\n"));
        assert!(vtt.contains("00:01:01.500 --> 00:01:02.800"));
    }

    #[test]
    fn cue_breaks_on_speaker_change() {
        let mut r = ts_result();
        r.words.push(word("you", 63.0, 63.5, Some("spk_2")));
        let srt = render_transcript(&r, TranscriptFormat::Srt).unwrap();
        assert!(srt.contains("\n2\n"), "{srt}");
    }

    #[test]
    fn subtitled_export_requires_words() {
        let plain = TranscriptionResult {
            full_text: "hi".to_string(),
            words: vec![],
            language_detected: None,
        };
        assert!(render_transcript(&plain, TranscriptFormat::Srt).is_err());
        assert!(render_transcript(&plain, TranscriptFormat::Txt).is_ok());
    }

    #[test]
    fn format_parse() {
        assert_eq!(
            TranscriptFormat::parse("srt").unwrap(),
            TranscriptFormat::Srt
        );
        assert!(TranscriptFormat::parse("pdf").is_err());
    }
}
