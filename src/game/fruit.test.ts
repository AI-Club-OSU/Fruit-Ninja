import { describe, expect, it } from "vite-plus/test";

import { Fruit, GRAVITY } from "./fruit.ts";

function makeFruit(overrides: Partial<ConstructorParameters<typeof Fruit>[0]> = {}) {
  return new Fruit({
    id: 1,
    kind: "lime",
    radius: 0.05,
    position: { x: 0.5, y: 1.05 },
    velocity: { x: 0, y: -0.0012 },
    ...overrides,
  });
}

describe("fruit motion", () => {
  it("integrates velocity and gravity over a tick", () => {
    const fruit = makeFruit();

    fruit.update(100);

    expect(fruit.velocity.y).toBeCloseTo(-0.0012 + GRAVITY * 100);
    expect(fruit.position.y).toBeCloseTo(1.05 + fruit.velocity.y * 100);
    expect(fruit.position.x).toBeCloseTo(0.5);
  });

  it("rises, falls back down, and reports itself offscreen", () => {
    const fruit = makeFruit();

    expect(fruit.isOffscreen()).toBe(false);

    for (let elapsed = 0; elapsed < 6000; elapsed += 16) {
      fruit.update(16);
    }

    expect(fruit.velocity.y).toBeGreaterThan(0);
    expect(fruit.isOffscreen()).toBe(true);
  });

  it("is not offscreen while still rising below the floor line", () => {
    const fruit = makeFruit({ position: { x: 0.5, y: 1.1 }, velocity: { x: 0, y: -0.0012 } });

    expect(fruit.isOffscreen()).toBe(false);
  });
});
