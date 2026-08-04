import { describe, expect, it } from "vite-plus/test";

import { Point2DFilter } from "./oneEuroFilter.ts";

/** Sample variance of a series. */
function variance(values: readonly number[]): number {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
}

describe("Point2DFilter (One Euro)", () => {
  it("passes the first sample through unchanged", () => {
    const filter = new Point2DFilter();
    expect(filter.filter(0.3, 0.7, 0)).toEqual({ x: 0.3, y: 0.7 });
  });

  it("converges to a held value", () => {
    const filter = new Point2DFilter();
    filter.filter(0.2, 0.2, 0);
    let last = { x: 0, y: 0 };
    for (let t = 16; t <= 1600; t += 16) {
      last = filter.filter(0.8, 0.8, t);
    }
    expect(last.x).toBeCloseTo(0.8, 2);
    expect(last.y).toBeCloseTo(0.8, 2);
  });

  it("reduces jitter around a constant signal", () => {
    const filter = new Point2DFilter();
    const noisy: number[] = [];
    const smoothed: number[] = [];

    filter.filter(0.5, 0.5, 0);
    for (let i = 1; i <= 60; i += 1) {
      const raw = 0.5 + (i % 2 === 0 ? 0.08 : -0.08); // ±0.08 jitter
      noisy.push(raw);
      smoothed.push(filter.filter(raw, 0.5, i * 16).x);
    }

    // The filtered signal should be markedly steadier than the raw one.
    expect(variance(smoothed)).toBeLessThan(variance(noisy) * 0.5);
  });

  it("stays more responsive to fast motion with a higher beta", () => {
    const slow = new Point2DFilter({ minCutoff: 1.0, beta: 0.0 });
    const fast = new Point2DFilter({ minCutoff: 1.0, beta: 2.0 });

    // Seed both at 0, then jump to 1 — a fast move.
    slow.filter(0, 0, 0);
    fast.filter(0, 0, 0);
    const slowOut = slow.filter(1, 0, 16).x;
    const fastOut = fast.filter(1, 0, 16).x;

    // The high-beta filter opens up during motion and tracks the jump closer.
    expect(fastOut).toBeGreaterThan(slowOut);
  });

  it("holds its estimate on non-increasing timestamps", () => {
    const filter = new Point2DFilter();
    filter.filter(0.4, 0.4, 100);
    const held = filter.filter(0.9, 0.9, 100); // same timestamp
    expect(held.x).toBeCloseTo(0.4);
    expect(held.y).toBeCloseTo(0.4);
  });
});
