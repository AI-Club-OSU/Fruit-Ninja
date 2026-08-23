export type TrackingPoint = Readonly<{
  x: number;
  y: number;
  capturedAtMs: number;
}>;

export type SwipeMetrics = Readonly<{
  distance: number;
  durationMs: number;
  speed: number;
}>;

/**
 * Deliberately forgiving: at a 30 FPS camera cadence this only requires about
 * 1.2% of the arena between samples. The player should not have to whip their
 * hand around to prove that an intentional movement was a slash.
 */
export const DEFAULT_SLICE_SPEED = 0.00035;

export function measureSwipe(points: readonly TrackingPoint[]): SwipeMetrics | null {
  const start = points[0];
  const end = points.at(-1);

  if (!start || !end || start === end) {
    return null;
  }

  const durationMs = end.capturedAtMs - start.capturedAtMs;

  if (durationMs <= 0) {
    return null;
  }

  const distance = Math.hypot(end.x - start.x, end.y - start.y);

  return {
    distance,
    durationMs,
    speed: distance / durationMs,
  };
}

export function isSliceGesture(
  points: readonly TrackingPoint[],
  minimumSpeed = DEFAULT_SLICE_SPEED,
) {
  const swipe = measureSwipe(points);
  return swipe !== null && swipe.speed >= minimumSpeed;
}
