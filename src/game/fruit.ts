/**
 * Fruit entities and their sliced debris for the arena.
 *
 * Responsibility: hold one entity's identity and motion state, and advance it
 * over time. Positions, velocities, and radii use normalized arena units
 * (0..1 on both axes, y pointing down, per-millisecond velocities) so the
 * logic is resolution-independent and testable without a browser.
 *
 * `Fruit` covers both sliceable fruit and the bomb hazard (`kind === "bomb"`);
 * `FruitHalf` is the two-piece debris a fruit becomes when sliced. The renderer
 * switches artwork off `kind` and off the half's cut angle.
 *
 * TODO(physics): GRAVITY and the naive Euler integration are first-draft values
 * for a physics owner to refine.
 */

/** Sliceable fruit kinds, each with its own silhouette and flesh in the renderer. */
export const FRUIT_KINDS = ["apple", "orange", "watermelon", "lemon", "lime", "pineapple"] as const;

export type FruitKind = (typeof FRUIT_KINDS)[number];

/** Everything the spawner can launch: fruit plus the bomb hazard. */
export type EntityKind = FruitKind | "bomb";

export type Vector2 = { x: number; y: number };

/** Downward pull in arena units per ms². */
export const GRAVITY = 0.0000012;

export function isBomb(kind: EntityKind): kind is "bomb" {
  return kind === "bomb";
}

export type FruitInit = Readonly<{
  id: number;
  kind: EntityKind;
  position: Vector2;
  velocity: Vector2;
  radius: number;
  spinRate?: number;
  /** Extra per-fruit visual size jitter (1 = nominal); purely cosmetic. */
  scale?: number;
}>;

export class Fruit {
  readonly id: number;
  readonly kind: EntityKind;
  /** Radius as a fraction of arena height. */
  readonly radius: number;
  readonly position: Vector2;
  readonly velocity: Vector2;
  /** Current rotation in radians; purely visual. */
  rotation = 0;
  /** Rotation speed in radians per ms. */
  readonly spinRate: number;
  /** Cosmetic size multiplier used by the renderer for squash/stretch baselines. */
  readonly scale: number;

  constructor(init: FruitInit) {
    this.id = init.id;
    this.kind = init.kind;
    this.radius = init.radius;
    this.position = { ...init.position };
    this.velocity = { ...init.velocity };
    this.spinRate = init.spinRate ?? 0;
    this.scale = init.scale ?? 1;
  }

  /** Advance motion by `dtMs` milliseconds. */
  update(dtMs: number): void {
    this.velocity.y += GRAVITY * dtMs;
    this.position.x += this.velocity.x * dtMs;
    this.position.y += this.velocity.y * dtMs;
    this.rotation += this.spinRate * dtMs;
  }

  /** True once the fruit has fallen back below the arena or drifted off a side. */
  isOffscreen(): boolean {
    const fellBelow = this.position.y - this.radius > 1 && this.velocity.y > 0;
    const driftedOut = this.position.x < -0.25 || this.position.x > 1.25;
    return fellBelow || driftedOut;
  }
}

export type FruitHalfInit = Readonly<{
  kind: FruitKind;
  /** -1 for the piece that flies left, +1 for the piece that flies right. */
  side: -1 | 1;
  position: Vector2;
  velocity: Vector2;
  radius: number;
  rotation: number;
  spinRate: number;
  /** Angle of the cut in radians, so the renderer orients the flat flesh face. */
  sliceAngle: number;
}>;

/**
 * One half of a sliced fruit: a semicircle that keeps falling under gravity
 * while it spins away from the cut. Lives until it clears the arena.
 */
export class FruitHalf {
  readonly kind: FruitKind;
  readonly side: -1 | 1;
  readonly radius: number;
  readonly position: Vector2;
  readonly velocity: Vector2;
  readonly sliceAngle: number;
  rotation: number;
  readonly spinRate: number;

  constructor(init: FruitHalfInit) {
    this.kind = init.kind;
    this.side = init.side;
    this.radius = init.radius;
    this.position = { ...init.position };
    this.velocity = { ...init.velocity };
    this.rotation = init.rotation;
    this.spinRate = init.spinRate;
    this.sliceAngle = init.sliceAngle;
  }

  update(dtMs: number): void {
    this.velocity.y += GRAVITY * dtMs;
    this.position.x += this.velocity.x * dtMs;
    this.position.y += this.velocity.y * dtMs;
    this.rotation += this.spinRate * dtMs;
  }

  isOffscreen(): boolean {
    return this.position.y - this.radius > 1.2 || this.position.x < -0.4 || this.position.x > 1.4;
  }
}
