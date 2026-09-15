# Contract: Virtualized List View

**Interface**: `VirtualizedTrackList`
**Feature**: `001-mobile-performance-optimization`
**Consumer**: `TrackListView.tsx`

---

## 1. Virtualizer Configuration

```typescript
import { useVirtualizer } from "@tanstack/react-virtual";

interface UseTrackVirtualizerParams {
  /** Total count of filtered/sorted tracks */
  count: number;
  /** Ref to the scrollable div container */
  parentRef: React.RefObject<HTMLDivElement | null>;
  /** Fixed item height estimate */
  estimateSize?: number; // default: 64
  /** Overscan buffer */
  overscan?: number; // default: 6
}
```

## 2. DOM Rendering Structure

The container MUST follow the standard windowed layout pattern:

```tsx
<div ref={parentRef} className="flex-1 overflow-y-auto min-h-0 divide-y ...">
  {/* Phantom sizer div with total virtual height */}
  <div
    style={{
      height: `${virtualizer.getTotalSize()}px`,
      width: "100%",
      position: "relative",
    }}
  >
    {/* Only rendered virtual rows */}
    {virtualizer.getVirtualItems().map((virtualRow) => {
      const track = filteredTracks[virtualRow.index];
      return (
        <div
          key={virtualRow.key}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            transform: `translateY(${virtualRow.start}px)`,
          }}
        >
          <TrackRow track={track} playlist={filteredTracks} />
        </div>
      );
    })}
  </div>
</div>
```

## 3. Behavioral Invariants
- When `filteredTracks.length === 0`, virtualizer is idle and standard empty state renders.
- On filter/search query change, virtualizer automatically resets scroll to 0 (`virtualizer.scrollToIndex(0)`).
- Kinetic touch scrolling momentum is unimpeded.
