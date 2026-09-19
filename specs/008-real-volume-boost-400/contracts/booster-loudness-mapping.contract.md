# Contract: Booster Loudness Mapping (Aggressive 8000 mB)

**Feature**: `008-real-volume-boost-400` | **Date**: 2026-09-19

This contract defines the exact numerical mapping and invocation order between UI percentage, Android native IPC, and FFmpeg filterchains.

## 1. Android Call Order & Mapping

When user sets boost to `p` percent ($p \in [0, 400]$):

### Path A: $p \le 100$
1. Call `api.androidPlayerSetBoosterGainMb(0)`
2. Call `api.androidPlayerSetVolume(p / 100)`

### Path B: $p > 100$
1. Call `api.androidPlayerSetVolume(1.0)`
2. Call `api.androidPlayerSetBoosterGainMb(gainMb)` where:
   $$\text{gainMb} = \text{round}\left(\frac{p - 100}{300} \times 8000\right)$$

### Reference Calibration Table

| UI Percent | Stream Volume | targetGainMb | Nominal dB Hint | Perceived Loudness |
|---|---|---|---|---|
| **0%** | 0.00 | 0 mB | `-∞ dB` | Muted |
| **50%** | 0.50 | 0 mB | `-6.0 dB` | Half Volume |
| **100%** | 1.00 | 0 mB | `0.0 dB` | Normal Max Volume |
| **150%** | 1.00 | 1333 mB | `+13.3 dB` | Distinctly Louder |
| **200%** | 1.00 | 2667 mB | `+26.7 dB` | Strong Boost |
| **250%** | 1.00 | 4000 mB | `+40.0 dB` | High Boost (Warning confirmed) |
| **300%** | 1.00 | 5333 mB | `+53.3 dB` | Extreme Boost |
| **350%** | 1.00 | 6667 mB | `+66.7 dB` | Ultra Boost |
| **400%** | 1.00 | 8000 mB | `+80.0 dB` | Competitor Max Volume |

---

## 2. Offline FFmpeg Filter Chain Contract

In `src-tauri/src/processing/sound_booster/presets.rs`:

```rust
BoosterPreset::Manual => {
    let pct = manual_gain_percent.unwrap_or(100.0).clamp(0.0, 400.0);
    if pct <= 100.0 {
        let multiplier = pct / 100.0;
        format!("volume={multiplier:.3}")
    } else {
        let fraction = (pct - 100.0) / 300.0;
        let max_gain = 1.0 + fraction * 9.0;
        format!("dynaudnorm=f=150:g=15:m={max_gain:.1}:r=0.9,{DEFAULT_LIMITER}")
    }
}
```

- Mandatory invariant: Every chain for `pct > 100.0` ends in `DEFAULT_LIMITER` (`alimiter=limit=0.95:attack=5:release=50:asc=1`).
