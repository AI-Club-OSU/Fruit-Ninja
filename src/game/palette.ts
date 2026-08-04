/**
 * Fruit color data — the single source of truth for what each kind looks like.
 *
 * These are data constants, not drawing code: the renderer reads them to paint
 * bodies/flesh/leaves, and the arena reads `juice` to tint slice particles. A
 * juicy-arcade palette, deliberately multicolor so no single hue dominates.
 */

import type { FruitKind } from "./fruit.ts";

export type FruitColors = Readonly<{
  /** Outer skin, lit side of the radial gradient. */
  body: string;
  /** Outer skin, shaded side. */
  shade: string;
  /** Inner flesh revealed on the cut face. */
  flesh: string;
  /** Thin ring just inside the skin on a cut face. */
  rind: string;
  /** Leaf / stem accent. */
  leaf: string;
  /** Juice spray color. */
  juice: string;
  /** Seed / speck color, or null for kinds without visible seeds. */
  seed: string | null;
}>;

export const FRUIT_COLORS: Record<FruitKind, FruitColors> = {
  apple: {
    body: "#e63946",
    shade: "#9d1f2b",
    flesh: "#fff4e2",
    rind: "#f7b7a3",
    leaf: "#6ab04c",
    juice: "#ff5a6a",
    seed: "#5a3a1a",
  },
  orange: {
    body: "#ff9f1c",
    shade: "#d97400",
    flesh: "#ffcf87",
    rind: "#ffb765",
    leaf: "#6ab04c",
    juice: "#ffb43f",
    seed: null,
  },
  watermelon: {
    body: "#2ecc71",
    shade: "#16793f",
    flesh: "#ff4d6d",
    rind: "#a7e8bd",
    leaf: "#6ab04c",
    juice: "#ff5d7a",
    seed: "#2a1a12",
  },
  lemon: {
    body: "#ffd93d",
    shade: "#d9ab00",
    flesh: "#fff6b0",
    rind: "#fff0c2",
    leaf: "#6ab04c",
    juice: "#ffe066",
    seed: null,
  },
  lime: {
    body: "#a8e05f",
    shade: "#6aa62c",
    flesh: "#e9f8c8",
    rind: "#d3f0a0",
    leaf: "#6ab04c",
    juice: "#c6f68d",
    seed: null,
  },
  pineapple: {
    body: "#f4c430",
    shade: "#bf8c00",
    flesh: "#ffe89a",
    rind: "#ffd873",
    leaf: "#6ab04c",
    juice: "#ffd447",
    seed: "#8a6a12",
  },
};

export const BOMB_COLORS = {
  body: "#2c2c33",
  shade: "#050507",
  highlight: "#5b5b66",
  fuse: "#7a4a20",
  spark: "#ffd447",
} as const;
