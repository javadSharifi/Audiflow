# Data Model: Converter Modal & Trim Editor Fixes

## Entities & Interfaces

### 1. `InputFile` (Existing Store Entity)
Represents a queued media file within the audio converter (`src/types/index.ts`).
```typescript
interface InputFile {
  path: string;
  name: string;
  sizeBytes: number;
  durationSecs: number;
  formatName: string;
  hasAudio: boolean;
  kind?: "audio" | "video";
  error?: string;
  trimStartSecs?: number | null;
  trimEndSecs?: number | null;
  boostEnabled?: boolean;
  boostPreset?: BoostPreset;
  boostManualGainPercent?: number;
}
```
*No schema changes required.*

### 2. `TrimPreviewRange` (Internal Transient State)
Active audition tracking inside `TrimEditor.tsx`:
```typescript
interface TrimPreviewRange {
  from: number;
  to: number;
  active: boolean;
}
```
- `previewStartRef: React.MutableRefObject<number | null>`: Recorded start position of snippet playback. Used to discard false termination triggers during async seeking.
- `previewEndRef: React.MutableRefObject<number | null>`: Recorded cut point where playback must pause.

### 3. `MobileEditModalProps`
Props passed to the bottom sheet modal in `FileList.tsx`:
```typescript
interface MobileEditModalProps {
  file: InputFile;
  mode: "trim" | "boost";
  onClose: () => void;
}
```

## State Transitions

### Playback State Machine
```text
[IDLE]
  │
  ├─ User taps "First 5s" ──► [SEEKING: from=start, to=min(start+5, end)]
  ├─ User taps "Last 5s"  ──► [SEEKING: from=max(end-5, start), to=end]
  └─ User taps "Play"     ──► [SEEKING: from=start, to=end]
                                │
                                ▼
                           [AUDITIONING]
                                │
                                ├─ currentTime >= targetEnd ──► [PAUSED / IDLE]
                                ├─ User taps Pause / Seek   ──► [IDLE]
                                └─ Audio 'ended' event      ──► [IDLE]
```
