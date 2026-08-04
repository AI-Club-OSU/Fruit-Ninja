/**
 * Fruit spawner and lifecycle owner.
 *
 * Responsibility: periodically launch randomized fruit (and the occasional
 * bomb) from below the arena, advance every live entity each tick, and cull
 * ones that leave the screen. Spawn cadence tightens over a run for a difficulty
 * curve. Randomness is injected so tests can drive it deterministically.
 *
 * The slicing owner removes entities from `fruits` when a slash hits them; the
 * `onExpire` hook fires for fruit that fall away unsliced so the score owner can
 * dock a life (bombs that fall away are harmless and skip the hook).
 */

import { FRUIT_KINDS, Fruit, type EntityKind } from "./fruit.ts";

export type FruitSpawnerOptions = Readonly<{
  /** Base delay between launches; each gap is jittered ±25%. */
  spawnIntervalMs?: number;
  /** Floor the difficulty ramp cannot spawn faster than. */
  minSpawnIntervalMs?: number;
  /** How much the interval tightens per elapsed ms of play. */
  rampPerMs?: number;
  /** Probability a given launch is a bomb rather than fruit. */
  bombChance?: number;
  /** Hard cap on simultaneously live entities. */
  maxActiveFruits?: number;
  /** Random source in [0, 1); injectable for deterministic tests. */
  random?: () => number;
  /** Called with a fruit that fell away unsliced (never for bombs). */
  onExpire?: (fruit: Fruit) => void;
}>;

const RADII: Record<EntityKind, number> = {
  apple: 0.055,
  orange: 0.06,
  watermelon: 0.085,
  lemon: 0.05,
  lime: 0.048,
  pineapple: 0.075,
  bomb: 0.06,
};

export class FruitSpawner {
  readonly fruits: Fruit[] = [];

  private readonly spawnIntervalMs: number;
  private readonly minSpawnIntervalMs: number;
  private readonly rampPerMs: number;
  private readonly bombChance: number;
  private readonly maxActiveFruits: number;
  private readonly random: () => number;
  private readonly onExpire: ((fruit: Fruit) => void) | undefined;
  private msUntilNextSpawn: number;
  private elapsedMs = 0;
  private nextId = 1;

  constructor(options: FruitSpawnerOptions = {}) {
    this.spawnIntervalMs = options.spawnIntervalMs ?? 1050;
    // The difficulty floor can never sit above the base interval.
    this.minSpawnIntervalMs = Math.min(options.minSpawnIntervalMs ?? 430, this.spawnIntervalMs);
    this.rampPerMs = options.rampPerMs ?? 0.006;
    this.bombChance = options.bombChance ?? 0.12;
    this.maxActiveFruits = options.maxActiveFruits ?? 7;
    this.random = options.random ?? Math.random;
    this.onExpire = options.onExpire;
    this.msUntilNextSpawn = this.spawnIntervalMs;
  }

  /** Advance the whole population by `dtMs` milliseconds. */
  update(dtMs: number): void {
    this.elapsedMs += dtMs;
    this.msUntilNextSpawn -= dtMs;

    if (this.msUntilNextSpawn <= 0 && this.fruits.length < this.maxActiveFruits) {
      this.fruits.push(this.createEntity());
      this.msUntilNextSpawn = this.currentInterval() * (0.75 + this.random() * 0.5);
    }

    for (const fruit of this.fruits) {
      fruit.update(dtMs);
    }

    for (let index = this.fruits.length - 1; index >= 0; index -= 1) {
      const fruit = this.fruits[index];
      if (fruit?.isOffscreen()) {
        this.fruits.splice(index, 1);
        if (fruit.kind !== "bomb") {
          this.onExpire?.(fruit);
        }
      }
    }
  }

  /** Remove one entity by id (e.g. once it has been sliced). */
  remove(id: number): void {
    const index = this.fruits.findIndex((fruit) => fruit.id === id);
    if (index >= 0) {
      this.fruits.splice(index, 1);
    }
  }

  /** Drop every live entity and restart the spawn timer and difficulty ramp. */
  reset(): void {
    this.fruits.length = 0;
    this.msUntilNextSpawn = this.spawnIntervalMs;
    this.elapsedMs = 0;
  }

  private currentInterval(): number {
    return Math.max(
      this.minSpawnIntervalMs,
      this.spawnIntervalMs - this.elapsedMs * this.rampPerMs,
    );
  }

  private createEntity(): Fruit {
    const isBomb = this.random() < this.bombChance;
    const kind: EntityKind = isBomb
      ? "bomb"
      : (FRUIT_KINDS[Math.floor(this.random() * FRUIT_KINDS.length)] ?? "apple");
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
      spinRate: (this.random() - 0.5) * 0.0024,
      scale: 0.9 + this.random() * 0.3,
    });
  }
}
