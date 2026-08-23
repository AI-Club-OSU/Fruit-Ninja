import { describe, expect, it } from "vite-plus/test";

import { Fruit } from "./fruit.ts";
import { SlashDetector, type SlashEvent } from "./slashDetector.ts";
import { sliceFruits } from "./slicing.ts";

describe("slash detector", () => {
  it("ignores slow cursor movement", () => {
    const slashes: SlashEvent[] = [];
    const detector = new SlashDetector({ onSlash: (slash) => slashes.push(slash) });

    for (let step = 0; step < 10; step += 1) {
      detector.updateCursor(0.5 + step * 0.001, 0.5, step * 16);
    }

    expect(slashes).toHaveLength(0);
  });

  it("reports every fast segment so collision detection receives the full swipe", () => {
    const slashes: SlashEvent[] = [];
    const detector = new SlashDetector({ onSlash: (slash) => slashes.push(slash) });

    // A fast horizontal swipe: 0.4 arena widths in ~64 ms.
    for (let step = 0; step < 5; step += 1) {
      detector.updateCursor(0.2 + step * 0.1, 0.5, step * 16);
    }

    expect(slashes).toHaveLength(4);
    expect(slashes.every((slash) => slash.metrics.speed > 0.0015)).toBe(true);
    expect(slashes.map((slash) => slash.points.map(({ x }) => Number(x.toFixed(1))))).toEqual([
      [0.2, 0.3],
      [0.3, 0.4],
      [0.4, 0.5],
      [0.5, 0.6],
    ]);
  });

  it("does not lose the fruit-crossing segment after a slash starts", () => {
    const fruit = new Fruit({
      id: 1,
      kind: "apple",
      radius: 0.03,
      position: { x: 0.45, y: 0.5 },
      velocity: { x: 0, y: 0 },
    });
    const hits = new Set<Fruit>();
    const detector = new SlashDetector({
      onSlash: (slash) => {
        for (const hit of sliceFruits(slash.points, [fruit], 1)) {
          hits.add(hit);
        }
      },
    });

    detector.updateCursor(0.1, 0.5, 0);
    detector.updateCursor(0.2, 0.5, 16); // Slash starts before the fruit.
    detector.updateCursor(0.3, 0.5, 32);
    detector.updateCursor(0.4, 0.5, 48);
    detector.updateCursor(0.5, 0.5, 64); // Later segment crosses the fruit.

    expect([...hits]).toEqual([fruit]);
  });

  it("expires trail points outside the rolling window", () => {
    const detector = new SlashDetector({ windowMs: 120 });

    detector.updateCursor(0.1, 0.5, 0);
    detector.updateCursor(0.11, 0.5, 50);
    expect(detector.trail).toHaveLength(2);

    detector.expire(200);

    expect(detector.trail).toHaveLength(0);
  });

  it("bridges a brief tracking dropout instead of losing the sweep", () => {
    const slashes: SlashEvent[] = [];
    const detector = new SlashDetector({ onSlash: (slash) => slashes.push(slash) });

    detector.updateCursor(0.2, 0.5, 0);
    detector.updateCursor(0.5, 0.5, 200);

    expect(slashes).toHaveLength(1);
    expect(slashes[0]?.points.map(({ x }) => x)).toEqual([0.2, 0.5]);
  });

  it("reset clears history without suppressing the next slash", () => {
    const slashes: SlashEvent[] = [];
    const detector = new SlashDetector({ onSlash: (slash) => slashes.push(slash) });

    for (let step = 0; step < 5; step += 1) {
      detector.updateCursor(0.2 + step * 0.1, 0.5, step * 16);
    }
    expect(slashes).toHaveLength(4);

    detector.reset();
    expect(detector.trail).toHaveLength(0);

    for (let step = 0; step < 5; step += 1) {
      detector.updateCursor(0.2 + step * 0.1, 0.5, 100 + step * 16);
    }
    expect(slashes).toHaveLength(8);
  });
});
