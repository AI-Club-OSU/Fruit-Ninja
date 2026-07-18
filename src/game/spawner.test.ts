import { describe, expect, it } from "vite-plus/test";

import { Fruit } from "./fruit.ts";
import { FruitSpawner } from "./spawner.ts";

describe("fruit spawner", () => {
  it("spawns a fruit once the interval elapses", () => {
    const spawner = new FruitSpawner({ spawnIntervalMs: 1000, random: () => 0.5 });

    spawner.update(999);
    expect(spawner.fruits).toHaveLength(0);

    spawner.update(2);
    expect(spawner.fruits).toHaveLength(1);
    expect(spawner.fruits[0]?.position.y).toBeGreaterThan(1);
    expect(spawner.fruits[0]?.velocity.y).toBeLessThan(0);
  });

  it("respects the active fruit cap", () => {
    const spawner = new FruitSpawner({
      spawnIntervalMs: 10,
      maxActiveFruits: 2,
      random: () => 0.5,
    });

    for (let tick = 0; tick < 20; tick += 1) {
      spawner.update(10);
    }

    expect(spawner.fruits).toHaveLength(2);
  });

  it("culls fruit that have left the screen", () => {
    const spawner = new FruitSpawner({ spawnIntervalMs: 100_000, random: () => 0.5 });
    spawner.fruits.push(
      new Fruit({
        id: 99,
        kind: "orange",
        radius: 0.06,
        position: { x: 0.5, y: 1.5 },
        velocity: { x: 0, y: 0.001 },
      }),
    );

    spawner.update(16);

    expect(spawner.fruits).toHaveLength(0);
  });

  it("clears everything on reset", () => {
    const spawner = new FruitSpawner({ spawnIntervalMs: 100, random: () => 0.5 });
    spawner.update(150);
    expect(spawner.fruits.length).toBeGreaterThan(0);

    spawner.reset();

    expect(spawner.fruits).toHaveLength(0);
  });
});
