use std::path::Path;

use super::analyze::VolumeAnalysis;
use super::presets::{build_preset_filter_chain, BoosterPreset};
use crate::processing::pipeline::encoder_args;
use crate::types::{AudioFormat, TrimSpec};

/// Audio encoding and post-processing parameters for boosted export.
#[derive(Debug, Clone, Copy)]
pub struct BoostAudioParams<'a> {
    pub format: &'a AudioFormat,
    pub bitrate_kbps: Option<u32>,
    pub sample_rate_hz: Option<u32>,
    pub channels: Option<u16>,
    pub trim: Option<&'a TrimSpec>,
    pub analysis: Option<&'a VolumeAnalysis>,
}

/// Build conversion arguments for exporting a boosted audio file.
pub fn build_boost_args(
    source: &Path,
    output: &Path,
    preset: BoosterPreset,
    manual_gain_percent: Option<f64>,
    params: BoostAudioParams<'_>,
) -> Vec<String> {
    let mut args: Vec<String> = vec![
        "-hide_banner".into(),
        "-nostdin".into(),
        "-y".into(),
        "-loglevel".into(),
        "error".into(),
        "-progress".into(),
        "pipe:1".into(),
        "-nostats".into(),
    ];

    if let Some(start) = params.trim.and_then(|t| t.start_time_secs) {
        args.extend(["-ss".to_string(), format!("{start:.3}")]);
    }

    args.extend(["-i".to_string(), source.to_string_lossy().into_owned()]);

    if let Some(to) = params.trim.and_then(|t| t.effective_to()) {
        args.extend(["-to".to_string(), format!("{to:.3}")]);
    }

    // Audio filter chain for Sound Booster
    let filter_chain = build_preset_filter_chain(preset, manual_gain_percent, params.analysis);
    args.extend(["-af".to_string(), filter_chain]);

    // Map audio only and drop video
    args.extend([
        "-vn".to_string(),
        "-map_metadata".to_string(),
        "0".to_string(),
    ]);

    // Audio codec arguments
    let mut codec = encoder_args(params.format, params.bitrate_kbps);
    let sample_rate = if *params.format == AudioFormat::Opus {
        match params.sample_rate_hz {
            Some(sr) if matches!(sr, 8000 | 12000 | 16000 | 24000 | 48000) => Some(sr),
            _ => Some(48000),
        }
    } else {
        params.sample_rate_hz
    };

    if let Some(sr) = sample_rate {
        codec.extend(["-ar".to_string(), sr.to_string()]);
    }
    if let Some(ch) = params.channels {
        codec.extend(["-ac".to_string(), ch.to_string()]);
    }

    args.extend(codec);
    args.push(output.to_string_lossy().into_owned());
    args
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_boost_args_includes_filters_and_limiter() {
        let src = Path::new("/test/input.mp4");
        let out = Path::new("/test/output.mp3");
        let args = build_boost_args(
            src,
            out,
            BoosterPreset::Smart,
            None,
            BoostAudioParams {
                format: &AudioFormat::Mp3,
                bitrate_kbps: Some(320),
                sample_rate_hz: Some(44100),
                channels: Some(2),
                trim: None,
                analysis: None,
            },
        );

        let cmd = args.join(" ");
        assert!(cmd.contains("-af dynaudnorm="));
        assert!(cmd.contains("alimiter="));
        assert!(cmd.contains("libmp3lame"));
        assert!(cmd.contains("-b:a 320k"));
        assert!(cmd.contains("-vn"));
    }
}
