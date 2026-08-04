import { describe, expect, it } from "vite-plus/test";

import { Fruit } from "./fruit.ts";
import { distancePointToSegment, sliceFruits } from "./slicing.ts";
import type { TrackingPoint } from "./swipe.ts";

function fruitAt(x: number, y: number, radius = 0.06): Fruit {
  return new Fruit({ id: 1, kind: "apple", radius, position: { x, y }, velocity: { x: 0, y: 0 } });
}

function trail(...points: readonly [number, number][]): TrackingPoint[] {
  return points.map(([x, y], index) => ({ x, y, capturedAtMs: index * 16 }));
}

describe("distancePointToSegment", () => {
  it("measures perpendicular distance to the segment interior", () => {
    const d = distancePointToSegment({ x: 0.5, y: 0.5 }, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(d).toBeCloseTo(0.5);
  });

  it("clamps to the nearest endpoint past the ends", () => {
    const d = distancePointToSegment({ x: 2, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(d).toBeCloseTo(1);
  });
});

describe("sliceFruits", () => {
  it("returns a fruit the trail passes through", () => {
    const fruit = fruitAt(0.5, 0.5);
    const hits = sliceFruits(trail([0.2, 0.5], [0.8, 0.5]), [fruit], 1);
    expect(hits).toEqual([fruit]);
  });

  it("misses fruit the trail stays clear of", () => {
    const fruit = fruitAt(0.5, 0.9);
    const hits = sliceFruits(trail([0.2, 0.2], [0.8, 0.2]), [fruit], 1);
    expect(hits).toHaveLength(0);
  });

  it("needs at least two points to cut", () => {
    expect(sliceFruits(trail([0.5, 0.5]), [fruitAt(0.5, 0.5)], 1)).toHaveLength(0);
  });

  it("accounts for aspect ratio when scaling x", () => {
    // On a wide arena, a small horizontal gap in normalized-x is physically
    // large, so a trail just left of the fruit should NOT connect.
    const fruit = fruitAt(0.5, 0.5, 0.05);
    const near = trail([0.3, 0.5], [0.4, 0.5]);
    expect(sliceFruits(near, [fruit], 3)).toHaveLength(0);
    // ...but a trail through the center still cuts.
    expect(sliceFruits(trail([0.4, 0.5], [0.6, 0.5]), [fruit], 3)).toEqual([fruit]);
  });

  it("reports every fruit along the slash for combos", () => {
    const a = fruitAt(0.3, 0.5);
    const b = fruitAt(0.7, 0.5);
    const hits = sliceFruits(trail([0.1, 0.5], [0.9, 0.5]), [a, b], 1);
    expect(hits).toHaveLength(2);
  });
});
