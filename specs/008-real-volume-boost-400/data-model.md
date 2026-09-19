# Data Model: Real 400% Volume Boost & Perceived Loudness

**Feature**: `008-real-volume-boost-400` | **Date**: 2026-09-19

This document formalizes the runtime state, transformation models, and validation constraints across frontend, Rust DSP, and Android native audio engines.

## 1. Boost Level (Runtime State)

| Field | Type | Domain | Description |
|---|---|---|---|
| `volumeGainPercent` | `number` (integer) | `0..400` (step 5) | User-facing percentage in `useMusicPlayerStore` and `useFileBoosterStore`. |
| `isHighBoostUnlocked` | `boolean` | `true \| false` | True if user has confirmed the >200% safety warning dialog in the current session. |
| `targetGainMb` | `number` (integer) | `0..8000` | Android `LoudnessEnhancer` target gain in millibels. Derived via `boosterMbForPercent(p)`. |
| `displayDb` | `string` | `"-∞" \| "+0.0 dB" .. "+80.0 dB"` | Formatted string for UI badges (`(targetGainMb / 100).toFixed(1) dB`). |

### State Transitions
```text
[0..100%] (Standard Volume)
   │
   ▼ (User drags slider/dial > 200%)
[Safety Gate Check] ──(Not unlocked)──► [Prompt High-Boost Modal]
   │ (Confirmed)
   ▼
[201..400%] (High Boost Active) ──► Apply 8000 mB scale to native engine
```

---

## 2. DSP Filtergraph Model (Offline Processing)

| Parameter | Type | Domain | Description |
|---|---|---|---|
| `preset` | `BoosterPreset` | `Manual` | Manual preset enum in `presets.rs`. |
| `manual_gain_percent` | `Option<f64>` | `0.0..400.0` | Boost percent passed to `build_preset_filter_chain`. |
| `boost_ratio` | `f64` | `0.0..1.0` | `(pct - 100.0) / 300.0` for `pct > 100.0`. |
| `dynaudnorm_m` | `f64` | `1.0..10.0` | Maximum gain factor parameter `m` in `dynaudnorm`. |
| `limiter` | `&str` | Constant | Terminal `alimiter=limit=0.95:attack=5:release=50:asc=1`. |

### Filterstring Resolution
- `pct <= 100.0`: `format!("volume={:.3}", pct / 100.0)`
- `pct > 100.0`: `format!("dynaudnorm=f=150:g=15:m={:.1}:r=0.9,{}", max_gain, DEFAULT_LIMITER)`

---

## 3. IPC Payloads (Existing Commands)

No new IPC commands required. The mapping utilizes existing type-safe contracts:
- `androidPlayerSetVolume(volume: f64)`: Controls 0.0–1.0 stream volume.
- `androidPlayerSetBoosterGainMb(gain_mb: i32)`: Controls 0–8000 mB native enhancer gain.
