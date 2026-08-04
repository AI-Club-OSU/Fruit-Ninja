/**
 * Arena orchestrator: the gameplay owner that ties fruit, slicing, debris, and
 * juice together and reports outcomes to whoever owns the score.
 *
 * Responsibility: advance the spawner, particles, and sliced halves each frame;
 * resolve a slash against live fruit (splitting fruit into halves, spraying
 * juice, banking points and combos, detonating bombs); and surface a read-only
 * scene the renderer draws. Score and life changes leave through the injected
 * `onScore` / `onLifeLost` callbacks so this stays independent of React and of
 * the top-level state machine.
 *
 * Everything here is normalized arena units (0..1) and injectable randomness, so
 * the slicing/scoring rules are unit-testable without a canvas.
 */

import { Fruit, FruitHalf, type FruitKind } from "./fruit.ts";
import { FRUIT_COLORS } from "./palette.ts";
import { ParticleSystem } from "./particles.ts";
import { sliceFruits } from "./slicing.ts";
import { FruitSpawner, type FruitSpawnerOptions } from "./spawner.ts";
import { type TrackingPoint } from "./swipe.ts";

/** Points a single fruit is worth before combo bonuses. */
export const POINTS_PER_FRUIT = 10;

export type PopupTone = "score" | "combo" | "bomb";

export type ScorePopup = {
  x: number;
  y: number;
  text: string;
  tone: PopupTone;
  ageMs: number;
  readonly lifeMs: number;
};

export type ArenaScene = Readonly<{
  fruits: readonly Fruit[];
  halves: readonly FruitHalf[];
  particles: ParticleSystem["particles"];
  popups: readonly ScorePopup[];
  /** 0..1 screen-shake intensity for the renderer to offset by. */
  shake: number;
  /** 0..1 full-screen flash intensity (bomb detonation). */
  flash: number;
}>;

export type ArenaOptions = Readonly<{
  random?: () => number;
  onScore?: (points: number) => void;
  onLifeLost?: () => void;
  spawner?: FruitSpawnerOptions;
}>;

const POPUP_LIFE_MS = 750;
const SHAKE_DECAY_PER_MS = 0.004;
const FLASH_DECAY_PER_MS = 0.006;

export class Arena {
  private readonly spawner: FruitSpawner;
  private readonly particles = new ParticleSystem();
  private readonly halves: FruitHalf[] = [];
  private readonly popups: ScorePopup[] = [];
  private readonly random: () => number;
  private readonly onScore: ((points: number) => void) | undefined;
  private readonly onLifeLost: (() => void) | undefined;
  private shake = 0;
  private flash = 0;

  constructor(options: ArenaOptions = {}) {
    this.random = options.random ?? Math.random;
    this.onScore = options.onScore;
    this.onLifeLost = options.onLifeLost;
    this.spawner = new FruitSpawner({
      random: this.random,
      ...options.spawner,
      // A fruit that falls away unsliced costs a life (classic-mode rule).
      onExpire: () => this.loseLife(),
    });
  }

  /** Advance every simulation the arena owns by `dtMs` milliseconds. */
  update(dtMs: number): void {
    this.spawner.update(dtMs);
    this.particles.update(dtMs);

    for (const half of this.halves) {
      half.update(dtMs);
    }
    for (let index = this.halves.length - 1; index >= 0; index -= 1) {
      if (this.halves[index]?.isOffscreen()) {
        this.halves.splice(index, 1);
      }
    }

    for (const popup of this.popups) {
      popup.ageMs += dtMs;
    }
    for (let index = this.popups.length - 1; index >= 0; index -= 1) {
      if ((this.popups[index]?.ageMs ?? 0) >= (this.popups[index]?.lifeMs ?? 0)) {
        this.popups.splice(index, 1);
      }
    }

    this.shake = Math.max(0, this.shake - SHAKE_DECAY_PER_MS * dtMs);
    this.flash = Math.max(0, this.flash - FLASH_DECAY_PER_MS * dtMs);
  }

  /**
   * Resolve a slash against live fruit. `trail` is the blade path in arena
   * units; `aspect` is arena width/height for isotropic hit-testing.
   */
  slice(trail: readonly TrackingPoint[], aspect: number): void {
    const hits = sliceFruits(trail, this.spawner.fruits, aspect);
    if (hits.length === 0) {
      return;
    }

    const sliceAngle = trailAngle(trail);
    let fruitCount = 0;

    for (const entity of hits) {
      this.spawner.remove(entity.id);

      if (entity.kind === "bomb") {
        this.detonate(entity);
        continue;
      }

      fruitCount += 1;
      this.splitFruit(entity, sliceAngle);
      this.addPopup(entity.position.x, entity.position.y, `+${POINTS_PER_FRUIT}`, "score");
    }

    if (fruitCount === 0) {
      return;
    }

    // Combo bonus: slicing several fruit in one slash pays a flat bonus each.
    const comboBonus = fruitCount >= 2 ? fruitCount * POINTS_PER_FRUIT : 0;
    if (comboBonus > 0) {
      const center = averagePosition(hits);
      this.addPopup(center.x, center.y - 0.06, `COMBO x${fruitCount}`, "combo");
    }

    this.onScore?.(fruitCount * POINTS_PER_FRUIT + comboBonus);
  }

  /** Read-only view for the renderer. */
  get scene(): ArenaScene {
    return {
      fruits: this.spawner.fruits,
      halves: this.halves,
      particles: this.particles.particles,
      popups: this.popups,
      shake: this.shake,
      flash: this.flash,
    };
  }

  /** Clear all live state for a fresh run. */
  reset(): void {
    this.spawner.reset();
    this.particles.clear();
    this.halves.length = 0;
    this.popups.length = 0;
    this.shake = 0;
    this.flash = 0;
  }

  private splitFruit(fruit: Fruit, sliceAngle: number): void {
    const kind = fruit.kind as FruitKind;
    // Push halves apart along the cut normal.
    const normal = sliceAngle + Math.PI / 2;
    const push = 0.0006 + this.random() * 0.0003;

    for (const side of [-1, 1] as const) {
      this.halves.push(
        new FruitHalf({
          kind,
          side,
          position: { ...fruit.position },
          velocity: {
            x: fruit.velocity.x + Math.cos(normal) * push * side,
            y: fruit.velocity.y * 0.6 + Math.sin(normal) * push * side - 0.0002,
          },
          radius: fruit.radius,
          rotation: fruit.rotation,
          spinRate: fruit.spinRate + side * (0.001 + this.random() * 0.001),
          sliceAngle,
        }),
      );
    }

    this.particles.burst(fruit.position, FRUIT_COLORS[kind].juice, {
      count: 16,
      random: this.random,
    });
  }

  private detonate(bomb: Fruit): void {
    this.particles.burst(bomb.position, "#3a3a42", {
      count: 22,
      speed: 0.0012,
      random: this.random,
    });
    this.particles.burst(bomb.position, "#ffb43f", {
      count: 12,
      speed: 0.0016,
      lifeMs: 400,
      random: this.random,
    });
    this.addPopup(bomb.position.x, bomb.position.y, "BOMB!", "bomb");
    this.shake = 1;
    this.flash = 0.8;
    this.loseLife();
  }

  private loseLife(): void {
    this.onLifeLost?.();
  }

  private addPopup(x: number, y: number, text: string, tone: PopupTone): void {
    this.popups.push({ x, y, text, tone, ageMs: 0, lifeMs: POPUP_LIFE_MS });
  }
}

/** Overall direction of the slash, first point to last, in radians. */
function trailAngle(trail: readonly TrackingPoint[]): number {
  const start = trail[0];
  const end = trail.at(-1);
  if (!start || !end) {
    return 0;
  }
  return Math.atan2(end.y - start.y, end.x - start.x);
}

function averagePosition(fruits: readonly Fruit[]): { x: number; y: number } {
  const sum = fruits.reduce(
    (acc, fruit) => ({ x: acc.x + fruit.position.x, y: acc.y + fruit.position.y }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / fruits.length, y: sum.y / fruits.length };
}
