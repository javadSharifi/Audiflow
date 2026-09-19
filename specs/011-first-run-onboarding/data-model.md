# Data Model: First-Run Onboarding

**Feature**: `011-first-run-onboarding` | **Date**: 2026-09-19

No new backend entities. All state reuses existing stores; this document defines the contract the UI implements.

## Entity 1: Onboarding completion record

- **Fields**: `completed: boolean` (whether the start page was confirmed or globally skipped).
- **Storage**: existing `ac:first-run-done` localStorage flag (`"1"` = complete). Unchanged key, unchanged helpers.
- **Validation**: written only via confirm or global skip; never written by section-level interaction or permission grant/deny.
- **State transitions**: `absent → complete` (confirm/skip, or silent grandfathering on upgrade with prior-use evidence). No transition back except app-data clear / reinstall (flag storage wiped by the platform).

## Entity 2: User preferences (chosen in onboarding)

| Field | Values | Storage | Applied via |
|-------|--------|---------|-------------|
| Language | `fa` \| `en` | app settings + `ac:ui-prefs` boot cache | existing language switch path (RTL/LTR follows) |
| Theme | `light` \| `dark` \| `system` | app settings + `ac:ui-prefs` boot cache | existing theme path (single writer: `useTheme`) |
| High-performance mode | on \| off | `ac:reduced-blur` (`"1"`/`"0"`) | existing reduced-blur path |

- **Validation**: language must be `fa`/`en`, theme one of the three modes; anything else falls back to safe defaults (Persian, system-follow, platform default performance).
- **Safe defaults on skip**: Persian, system-follow theme, performance mode on for constrained/mobile devices and off otherwise (existing platform default reused).

## Entity 3: Permission grant state (per platform)

- **Values**: `granted` | `denied` | `permanentlyDenied` | `skipped` | `notRequired`.
- **Storage**: not persisted by onboarding itself; the platform/OS remains the source of truth, re-checked via the existing permission-status flow. `skipped` is transient for the session.
- **Rule**: no permission state blocks onboarding completion or later app use; `permanentlyDenied` routes the user to OS settings instead of a dead-end retry.

## Entity 4: App settings (simplified)

- **Removed**: theme control, auto-open-output-folder control (rows deleted from the Settings dialog).
- **Forced**: auto-open-output-folder coerced to `false` on settings load, with the correction persisted when a stored `true` is found (one-time self-healing migration).
- **Retained**: language, performance mode, concurrency, and all other existing rows with unchanged read/change/save behavior.
- **Later theme control**: top-bar quick toggle only (unchanged component, unchanged behavior).

## Relationships

- Completion record gates visibility of the whole onboarding page; preferences are independent of it once written (Settings dialog keeps editing the retained subset).
- Permission state gates library content availability only; it never gates onboarding completion.
- Theme value `system` additionally follows OS brightness changes at runtime with no further onboarding involvement.
