/**
 * Fruit entity for the arena.
 *
 * Responsibility: hold one fruit's identity and motion state, and advance it
 * over time. Positions, velocities, and radii use normalized arena units
 * (0..1 on both axes, y pointing down, per-millisecond velocities) so the
 * logic is resolution-independent and testable without a browser.
 *
 * Extension points:
 * - TODO(slicing): add a sliced state (whole → halves) here; the renderer
 *   switches artwork based on it.
 * - TODO(physics): GRAVITY and the integration in update() are intentionally
 *   naive first-draft values for the physics owner to replace.
 * - TODO(bombs): a hazard can reuse this class with a new kind, or extend it.
 */

export const FRUIT_KINDS = ["lime", "orange", "watermelon"] as const;

export type FruitKind = (typeof FRUIT_KINDS)[number];

export type Vector2 = { x: number; y: number };

/** Downward pull in arena units per ms². */
export const GRAVITY = 0.0000012;

export type FruitInit = Readonly<{
  id: number;
  kind: FruitKind;
  position: Vector2;
  velocity: Vector2;
  radius: number;
  spinRate?: number;
}>;

export class Fruit {
  readonly id: number;
  readonly kind: FruitKind;
  /** Radius as a fraction of arena height. */
  readonly radius: number;
  readonly position: Vector2;
  readonly velocity: Vector2;
  /** Current rotation in radians; purely visual. */
  rotation = 0;
  /** Rotation speed in radians per ms. */
  readonly spinRate: number;

  constructor(init: FruitInit) {
    this.id = init.id;
    this.kind = init.kind;
    this.radius = init.radius;
    this.position = { ...init.position };
    this.velocity = { ...init.velocity };
    this.spinRate = init.spinRate ?? 0;
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
