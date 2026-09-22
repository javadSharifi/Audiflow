/**
 * Contract: Track Artwork Component
 * Feature: 014-nowplaying-gestures-artwork
 */

import type React from "react";
import type { AudioTrackInfo } from "../../../src/types";

export interface TrackCoverProps {
  /** The track whose artwork or placeholder should be rendered. */
  track: Partial<AudioTrackInfo> & {
    id?: string | null;
    uri?: string | null;
    path?: string | null;
    title?: string | null;
    name?: string;
    artist?: string | null;
    coverUrl?: string | null;
  };
  className?: string;
  size?: "sm" | "md" | "lg" | "full";
  /** Optional custom priority or animation hooks. */
  animateTransition?: boolean;
}

export type TrackCoverComponent = React.FC<TrackCoverProps>;
