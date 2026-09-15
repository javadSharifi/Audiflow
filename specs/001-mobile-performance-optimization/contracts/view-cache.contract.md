# Contract: Keep-Alive View Container (Two-Level)

**Interface**: `TabKeepAlive` + `TopLevelKeepAlive`
**Feature**: `001-mobile-performance-optimization`
**Consumer**: `MusicPlayerView.tsx` (inner), `App.tsx:360-379` (top-level)

---

## 1. Container Interface

```typescript
export interface KeepAlivePaneProps {
  active: boolean;
  children: React.ReactNode;
  lazy?: boolean; // true=defer first mount (inner tabs), false=eager (top-level)
}
```

## 2. Rendering Behavior

```tsx
// Inner (MusicPlayerView.tsx:54): lazy=true (default)
<KeepAlivePane active={activeTab === "songs"}><SongsView/></KeepAlivePane>
// Top-level (App.tsx:360): lazy={false} — BOTH mounted eagerly
<KeepAlivePane active={isConverter} lazy={false}><ConverterStack/></KeepAlivePane>
<KeepAlivePane active={!isConverter} lazy={false}><MusicPlayerView/></KeepAlivePane>
```

## 3. Structural Invariants
- Inner: Each tab view (`SongsView`, `LikedView`, `BoosterView`, `AlbumsView`) in dedicated `KeepAlivePane` with `lazy=true`.
- Top-level: Converter stack (`DropZone/FileList/OptionsPanel/JobsPanel`) AND `MusicPlayerView` each in `KeepAlivePane lazy={false}` inside `<main>` — switching `activeTool` toggles `display:none`, never unmounts.
- Component unmount does NOT occur during ANY switch (inner or top-level).
- React hooks/effects inside child views do not re-run on switch, preserving scroll state, filters, and scan state.
- Scroll preservation: inner virtualizer `scrollElement` + outer `<main>` retain `scrollTop` naturally.
