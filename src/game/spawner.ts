/**
 * Fruit spawner and lifecycle owner.
 *
 * Responsibility: periodically launch randomized fruit from below the arena,
 * advance every live fruit each tick, and cull fruit that leave the screen.
 * Randomness is injected so tests can drive it deterministically.
 *
 * Extension points:
 * - TODO(slicing): the slicing owner removes fruit from `fruits` (or flips
 *   them to a sliced state) when a slash trail hits them.
 * - TODO(score): a "fruit fell unsliced" hook can be added where culling
 *   happens, to deduct lives.
 * - TODO(waves): spawn cadence and velocity ranges are flat constants for
 *   now; difficulty curves belong here.
 */

import { FRUIT_KINDS, Fruit, type FruitKind } from "./fruit.ts";

export type FruitSpawnerOptions = Readonly<{
  /** Base delay between launches; each gap is jittered ±25%. */
  spawnIntervalMs?: number;
  /** Hard cap on simultaneously live fruit. */
  maxActiveFruits?: number;
  /** Random source in [0, 1); injectable for deterministic tests. */
  random?: () => number;
}>;

const RADII: Record<FruitKind, number> = {
  lime: 0.05,
  orange: 0.06,
  watermelon: 0.08,
};

export class FruitSpawner {
  readonly fruits: Fruit[] = [];

  private readonly spawnIntervalMs: number;
  private readonly maxActiveFruits: number;
  private readonly random: () => number;
  private msUntilNextSpawn: number;
  private nextId = 1;

  constructor(options: FruitSpawnerOptions = {}) {
    this.spawnIntervalMs = options.spawnIntervalMs ?? 1100;
    this.maxActiveFruits = options.maxActiveFruits ?? 6;
    this.random = options.random ?? Math.random;
    this.msUntilNextSpawn = this.spawnIntervalMs;
  }

  /** Advance the whole fruit population by `dtMs` milliseconds. */
  update(dtMs: number): void {
    this.msUntilNextSpawn -= dtMs;

    if (this.msUntilNextSpawn <= 0 && this.fruits.length < this.maxActiveFruits) {
      this.fruits.push(this.createFruit());
      this.msUntilNextSpawn = this.spawnIntervalMs * (0.75 + this.random() * 0.5);
    }

    for (const fruit of this.fruits) {
      fruit.update(dtMs);
    }

    for (let index = this.fruits.length - 1; index >= 0; index -= 1) {
      if (this.fruits[index]?.isOffscreen()) {
        this.fruits.splice(index, 1);
      }
    }
  }

  /** Drop every live fruit and restart the spawn timer. */
  reset(): void {
    this.fruits.length = 0;
    this.msUntilNextSpawn = this.spawnIntervalMs;
  }

  private createFruit(): Fruit {
    const kind = FRUIT_KINDS[Math.floor(this.random() * FRUIT_KINDS.length)] ?? "lime";
    const x = 0.15 + this.random() * 0.7;

    return new Fruit({
      id: this.nextId++,
      kind,
      radius: RADII[kind],
      position: { x, y: 1 + RADII[kind] },
      // Launch upward, drifting gently toward the horizontal center so arcs
      // stay on screen.
      velocity: {
        x: (0.5 - x) * 0.0004 + (this.random() - 0.5) * 0.0002,
        y: -(0.0011 + this.random() * 0.0004),
      },
      spinRate: (this.random() - 0.5) * 0.002,
    });
  }
}
