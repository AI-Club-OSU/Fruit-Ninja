import { describe, expect, it } from "vite-plus/test";

import { SlashDetector, type SlashEvent } from "./slashDetector.ts";

describe("slash detector", () => {
  it("ignores slow cursor movement", () => {
    const slashes: SlashEvent[] = [];
    const detector = new SlashDetector({ onSlash: (slash) => slashes.push(slash) });

    for (let step = 0; step < 10; step += 1) {
      detector.updateCursor(0.5 + step * 0.001, 0.5, step * 16);
    }

    expect(slashes).toHaveLength(0);
  });

  it("fires once for a fast swipe, then respects the cooldown", () => {
    const slashes: SlashEvent[] = [];
    const detector = new SlashDetector({
      cooldownMs: 250,
      onSlash: (slash) => slashes.push(slash),
    });

    // A fast horizontal swipe: 0.4 arena widths in ~64 ms.
    for (let step = 0; step < 5; step += 1) {
      detector.updateCursor(0.2 + step * 0.1, 0.5, step * 16);
    }

    expect(slashes).toHaveLength(1);
    expect(slashes[0]?.metrics.speed).toBeGreaterThan(0.0015);
    expect(slashes[0]?.points.length).toBeGreaterThan(1);

    // Still swiping fast immediately afterwards — cooldown suppresses it.
    for (let step = 5; step < 10; step += 1) {
      detector.updateCursor(0.7 - (step - 5) * 0.1, 0.5, step * 16);
    }
    expect(slashes).toHaveLength(1);

    // After the cooldown a new fast swipe fires again.
    for (let step = 0; step < 5; step += 1) {
      detector.updateCursor(0.2 + step * 0.1, 0.5, 400 + step * 16);
    }
    expect(slashes).toHaveLength(2);
  });

  it("expires trail points outside the rolling window", () => {
    const detector = new SlashDetector({ windowMs: 120 });

    detector.updateCursor(0.1, 0.5, 0);
    detector.updateCursor(0.11, 0.5, 50);
    expect(detector.trail).toHaveLength(2);

    detector.expire(200);

    expect(detector.trail).toHaveLength(0);
  });

  it("reset clears history and cooldown state", () => {
    const slashes: SlashEvent[] = [];
    const detector = new SlashDetector({ onSlash: (slash) => slashes.push(slash) });

    for (let step = 0; step < 5; step += 1) {
      detector.updateCursor(0.2 + step * 0.1, 0.5, step * 16);
    }
    expect(slashes).toHaveLength(1);

    detector.reset();
    expect(detector.trail).toHaveLength(0);

    for (let step = 0; step < 5; step += 1) {
      detector.updateCursor(0.2 + step * 0.1, 0.5, 100 + step * 16);
    }
    expect(slashes).toHaveLength(2);
  });
});
