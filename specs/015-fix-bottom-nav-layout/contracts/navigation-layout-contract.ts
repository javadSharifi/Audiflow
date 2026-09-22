/**
 * Layout Contracts & Types for Bottom Navigation & MiniPlayer Coordination
 * Feature: 015-fix-bottom-nav-layout
 */

import type { PlayerTab } from "../../../src/components/music-player/MusicPlayerNav";
import type { TranslationKey } from "../../../src/i18n";

export interface NavigationTabDefinition {
  id: PlayerTab | "converter";
  labelKey: TranslationKey;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

export interface NavigationDockGeometry {
  baselineOffsetCss: string; // e.g. "calc(0.75rem + env(safe-area-inset-bottom, 0px))"
  heightPx: number; // 64
  verticalGapPx: number; // 8
  miniPlayerBottomCss: string; // e.g. "calc(5.25rem + env(safe-area-inset-bottom, 0px))"
}

export interface NavigationTabStyleProps {
  isActive: boolean;
  activeTool: "player" | "converter";
  label: string;
}

export interface ViewportConstraintCheck {
  viewportWidthPx: number;
  availableWidthPx: number;
  totalDockWidthPx: number;
  hasOverflow: boolean;
  minTouchTargetMet: boolean;
}
