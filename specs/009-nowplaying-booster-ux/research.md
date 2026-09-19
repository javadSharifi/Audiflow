# Research & Architecture Decisions: Track Booster UI/UX & Safe Speaker Protection

**Feature**: `009-nowplaying-booster-ux`
**Date**: 2026-09-19

## Technical Research & Decisions

### Decision 1: Decoupling Speaker Protection from Hardware Media Volume (AudioManager)

- **Decision**: The "Speaker Protection" (`محافظت از اسپیکر`) user action will strictly reset the application's software boost gain (`volumeGainPercent`) to `100%` (0 mB nominal gain) and will **never** alter, mute, or downscale the Android device's hardware `STREAM_MUSIC` volume. In `AudioStreamManager.kt`, `applyReduceHurt` will reset `BoostEngine.setGainMb(0)` without calling `setStreamVolume`.
- **Rationale**:
  - Previously, `NowPlayingView.tsx` invoked `androidApplyReduceHurt()`, which executed `safeTarget = Math.max(1, Math.round(current * 0.3f))` and called `setStreamVolume`. This abruptly cut the user's phone hardware volume by 70%, causing the music to become nearly inaudible.
  - The phone's hardware volume stream belongs to the user and physical volume rockers. The booster's job is solely to control the software digital amplifier / `LoudnessEnhancer`.
  - Setting boost percent to 100% immediately neutralizes all amplifier gain, removing any digital clipping or speaker strain without disturbing hardware volume settings.
- **Alternatives Considered**:
  - Prompting the user before lowering phone volume: Rejected because the user does not want the phone volume lowered at all.
  - Retaining a minor volume attenuation: Rejected because the user explicitly stated: "کاری به صدای گوشی نباید داشته باش" (have nothing to do with the phone's volume).

---

### Decision 2: Modular Component Extraction (`TrackBoosterSheet.tsx`)

- **Decision**: Extract the inline sound booster popup from `src/components/music-player/NowPlayingView.tsx` into a new, dedicated component: `src/components/music-player/TrackBoosterSheet.tsx`.
- **Rationale**:
  - `NowPlayingView.tsx` currently stands at 798 lines, directly violating Section VIII of the project constitution (file size ceiling: ≤ 300 lines).
  - Extracting the booster bottom sheet reduces `NowPlayingView.tsx` by ~90 lines and keeps `TrackBoosterSheet.tsx` around ~180 lines, ensuring both files move toward or stay under the ceiling.
  - Isolates testing: `TrackBoosterSheet.test.tsx` can test preset selections, slider drags, speaker protection clicks, and animations independently.
- **Alternatives Considered**:
  - Keeping it inline inside `NowPlayingView.tsx`: Rejected due to severe file bloat and violation of the Single Responsibility Principle.
  - Merging with `BoosterView.tsx`: Rejected because `BoosterView.tsx` is a full-page tab with a 270° rotary dial, whereas this is an in-player quick-access bottom sheet designed for active playback.

---

### Decision 3: Audition-Friendly Interaction Model (No Auto-Dismiss)

- **Decision**: Tapping preset chips (`100%`, `150%`, `200%`, `300%`, `400%`) updates `useMusicPlayerStore` state immediately and keeps the sheet open so the listener can audition the difference and fine-tune. The sheet is closed only when the user explicitly taps the close button, taps the backdrop, or swipes down.
- **Rationale**:
  - In the previous implementation, tapping any preset immediately fired `setBoosterOpen(false)`, closing the modal and forcing the user to re-open it if the level was not right.
  - Audio auditioning requires hearing immediate real-time feedback while retaining control.
- **Alternatives Considered**:
  - Auto-closing with 2-second timeout: Rejected because unexpected dismissals frustrate users.

---

### Decision 4: Tactile UI/UX Design System for Track Booster

- **Decision**:
  - Bottom sheet design with blur backdrop (`backdrop-blur-md bg-black/60`), top rounded corners (`rounded-t-3xl`), and drag handle.
  - Header displays a glowing Flame icon, title, a prominent "محافظت از اسپیکر" button (when boost > 100%), and a close button.
  - Dynamic visual tier tokens:
    - **100% (Normal)**: Emerald accent (`#10b981`), clean badge, neutral glow.
    - **101% - 175% (Moderate)**: Amber accent (`#f59e0b`), warm glow.
    - **176% - 250% (High)**: Orange accent (`#f97316`), vibrant glow.
    - **251% - 400% (Extreme)**: Rose/Red accent (`#ef4444`), pulsing glow, safety advisory banner.
  - Ergonomic layout: 5 large tactile preset chips with smooth active shadows, plus a styled range slider with track progress fill and graduation markers.
- **Rationale**:
  - Follows modern mobile audio UI principles (Apple Music / Emil Kowalski design guidelines).
  - Provides instant, legible feedback of the current acoustic power tier.
