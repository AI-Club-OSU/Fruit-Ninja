import { describe, expect, it } from "vite-plus/test";

import { isSliceGesture, measureSwipe, type TrackingPoint } from "./swipe.ts";

describe("swipe measurement", () => {
  it("measures normalized distance and speed", () => {
    const points: TrackingPoint[] = [
      { x: 0.1, y: 0.2, capturedAtMs: 100 },
      { x: 0.4, y: 0.6, capturedAtMs: 200 },
    ];

    expect(measureSwipe(points)).toEqual({
      distance: 0.5,
      durationMs: 100,
      speed: 0.005,
    });
  });

  it("rejects samples without forward-moving time", () => {
    expect(
      measureSwipe([
        { x: 0, y: 0, capturedAtMs: 100 },
        { x: 1, y: 1, capturedAtMs: 100 },
      ]),
    ).toBeNull();
  });

  it("classifies a swipe against a configurable speed threshold", () => {
    const points: TrackingPoint[] = [
      { x: 0, y: 0, capturedAtMs: 0 },
      { x: 0.5, y: 0, capturedAtMs: 100 },
    ];

    expect(isSliceGesture(points, 0.004)).toBe(true);
    expect(isSliceGesture(points, 0.006)).toBe(false);
  });
});
