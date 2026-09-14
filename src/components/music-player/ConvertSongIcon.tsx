interface ConvertSongIconProps {
  className?: string;
  strokeWidth?: number;
}

/**
 * ConvertSongIcon — icon-only affordance for "convert this song".
 * Waveform on top (audio) + double swap arrows below (format conversion).
 * Stroke-based (lucide-compatible): inherits text color via currentColor.
 */
export function ConvertSongIcon({ className = "h-4 w-4", strokeWidth = 2 }: ConvertSongIconProps): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {/* audio waveform */}
      <path d="M4 9v2.5" />
      <path d="M8 6v8.5" />
      <path d="M12 8v4.5" />
      <path d="M16 4.5v11" />
      <path d="M20 8.5v3.5" />
      {/* swap arrows = conversion */}
      <path d="M3.5 19.5h8" />
      <path d="m9.5 17.5 2 2-2 2" />
      <path d="M20.5 16.5h-8" />
      <path d="m14.5 14.5-2 2 2 2" />
    </svg>
  );
}
