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

export const DEFAULT_SLICE_SPEED = 0.0015;

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
