import { describe, expect, it } from "vite-plus/test";

import { Arena, POINTS_PER_FRUIT } from "./arena.ts";
import type { TrackingPoint } from "./swipe.ts";

/** A short horizontal slash centered on `(x, y)`. */
function slashThrough(x: number, y: number): TrackingPoint[] {
  return [
    { x: x - 0.15, y, capturedAtMs: 0 },
    { x: x + 0.15, y, capturedAtMs: 16 },
  ];
}

describe("arena slicing", () => {
  it("banks points, splits into halves, and sprays juice when a fruit is cut", () => {
    let scored = 0;
    const arena = new Arena({
      random: () => 0.5,
      onScore: (points) => (scored += points),
      spawner: { spawnIntervalMs: 5, minSpawnIntervalMs: 5, bombChance: 0 },
    });

    arena.update(6);
    const fruit = arena.scene.fruits[0];
    if (!fruit) throw new Error("expected a spawned fruit");

    arena.slice(slashThrough(fruit.position.x, fruit.position.y), 1);

    expect(scored).toBe(POINTS_PER_FRUIT);
    expect(arena.scene.fruits).toHaveLength(0);
    expect(arena.scene.halves).toHaveLength(2);
    expect(arena.scene.particles.length).toBeGreaterThan(0);
    expect(arena.scene.popups.length).toBeGreaterThan(0);
  });

  it("costs a life and scores nothing when a bomb is sliced", () => {
    let scored = 0;
    let lives = 0;
    const arena = new Arena({
      random: () => 0.5,
      onScore: (points) => (scored += points),
      onLifeLost: () => (lives += 1),
      spawner: { spawnIntervalMs: 5, minSpawnIntervalMs: 5, bombChance: 1 },
    });

    arena.update(6);
    const bomb = arena.scene.fruits[0];
    if (!bomb) throw new Error("expected a spawned bomb");
    expect(bomb.kind).toBe("bomb");

    arena.slice(slashThrough(bomb.position.x, bomb.position.y), 1);

    expect(scored).toBe(0);
    expect(lives).toBe(1);
    expect(arena.scene.halves).toHaveLength(0);
    expect(arena.scene.shake).toBeGreaterThan(0);
  });

  it("pays a combo bonus for slicing several fruit at once", () => {
    let scored = 0;
    const arena = new Arena({
      random: () => 0.5,
      onScore: (points) => (scored += points),
      spawner: { spawnIntervalMs: 5, minSpawnIntervalMs: 5, bombChance: 0, maxActiveFruits: 5 },
    });

    // Spawn two fruit (both at x = 0.5 with this deterministic random).
    arena.update(6);
    arena.update(6);
    expect(arena.scene.fruits.length).toBeGreaterThanOrEqual(2);

    // A tall vertical slash down the center catches both.
    const trail: TrackingPoint[] = [
      { x: 0.5, y: 0, capturedAtMs: 0 },
      { x: 0.5, y: 1.2, capturedAtMs: 16 },
    ];
    arena.slice(trail, 1);

    // 2 fruit × 10 + combo bonus (2 × 10) = 40.
    expect(scored).toBe(4 * POINTS_PER_FRUIT);
  });

  it("costs a life when a fruit falls away unsliced", () => {
    let lives = 0;
    const arena = new Arena({
      random: () => 0.5,
      onLifeLost: () => (lives += 1),
      spawner: { spawnIntervalMs: 5, minSpawnIntervalMs: 5, bombChance: 0, maxActiveFruits: 1 },
    });

    for (let elapsed = 0; elapsed < 8000 && lives === 0; elapsed += 16) {
      arena.update(16);
    }

    expect(lives).toBeGreaterThanOrEqual(1);
  });
});
