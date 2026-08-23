/**
 * Slash-vs-fruit collision, kept pure and testable.
 *
 * The slash trail and fruit both live in normalized arena units, but the x and
 * y axes are not the same physical size — the arena is wider than it is tall,
 * and a fruit's radius is a fraction of *height*. So we scale x by the aspect
 * ratio (width / height) before measuring distances, making the space isotropic
 * so a "within radius" test is a true circle in pixels.
 */

import type { Fruit, Vector2 } from "./fruit.ts";
import type { TrackingPoint } from "./swipe.ts";

/** Extra blade reach for imperfect fingertip tracking, in arena-height units. */
export const FRUIT_SLICE_ASSIST = 0.04;
/** Bombs stay precise so generous fruit assistance does not add cheap penalties. */
export const BOMB_SLICE_ASSIST = 0.008;

/** Distance from point `p` to the segment `a`→`b`, all in the same units. */
export function distancePointToSegment(p: Vector2, a: Vector2, b: Vector2): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSquared = abx * abx + aby * aby;

  if (lengthSquared === 0) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }

  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lengthSquared;
  t = Math.max(0, Math.min(1, t));

  const closestX = a.x + t * abx;
  const closestY = a.y + t * aby;
  return Math.hypot(p.x - closestX, p.y - closestY);
}

/**
 * Which fruit the slash trail cuts through this frame.
 *
 * @param trail slash points in arena units, oldest first
 * @param fruits live fruit to test
 * @param aspect arena width / height, used to make the space isotropic
 * @returns entities that at least one trail segment passes close enough to cut
 */
export function sliceFruits(
  trail: readonly TrackingPoint[],
  fruits: readonly Fruit[],
  aspect: number,
): Fruit[] {
  if (trail.length < 2) {
    return [];
  }

  const scaleX = (point: Vector2): Vector2 => ({ x: point.x * aspect, y: point.y });
  const hits: Fruit[] = [];

  for (const fruit of fruits) {
    const center = scaleX(fruit.position);
    const assist = fruit.kind === "bomb" ? BOMB_SLICE_ASSIST : FRUIT_SLICE_ASSIST;
    const hitRadius = fruit.radius + assist;
    let cut = false;

    for (let index = 1; index < trail.length && !cut; index += 1) {
      const from = trail[index - 1];
      const to = trail[index];
      if (!from || !to) {
        continue;
      }
      if (distancePointToSegment(center, scaleX(from), scaleX(to)) <= hitRadius) {
        cut = true;
      }
    }

    if (cut) {
      hits.push(fruit);
    }
  }

  return hits;
}
