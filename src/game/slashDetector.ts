/**
 * Slash gesture detection over a stream of cursor samples.
 *
 * Responsibility: keep a short rolling window of cursor positions, classify
 * each new movement segment using the existing gesture math in swipe.ts, and
 * notify a listener for every fast segment. Also exposes the recent trail so
 * the renderer can draw the blade.
 *
 * This module never touches the DOM or MediaPipe — cursor samples arrive via
 * updateCursor() from whatever input source the app wires up.
 *
 * Extension points:
 * - TODO(slicing): the slicing owner subscribes via `onSlash` and hit-tests
 *   `SlashEvent.points` against live fruit. No collision logic lives here.
 * - TODO(combo): consecutive slash timing for combos can be derived from
 *   `SlashEvent.metrics` timestamps by the score owner.
 */

import {
  DEFAULT_SLICE_SPEED,
  isSliceGesture,
  measureSwipe,
  type SwipeMetrics,
  type TrackingPoint,
} from "./swipe.ts";

export type SlashEvent = Readonly<{
  /** Snapshot of the cursor points that formed the slash, oldest first. */
  points: readonly TrackingPoint[];
  metrics: SwipeMetrics;
}>;

export type SlashListener = (slash: SlashEvent) => void;

export type SlashDetectorOptions = Readonly<{
  /** Speed threshold in arena units per ms; defaults to the shared slice speed. */
  minimumSpeed?: number;
  /** How much cursor history to keep and evaluate, in ms. */
  windowMs?: number;
  onSlash?: SlashListener;
}>;

export class SlashDetector {
  private readonly minimumSpeed: number;
  private readonly windowMs: number;
  private readonly onSlash: SlashListener | undefined;
  private readonly points: TrackingPoint[] = [];

  constructor(options: SlashDetectorOptions = {}) {
    this.minimumSpeed = options.minimumSpeed ?? DEFAULT_SLICE_SPEED;
    this.windowMs = options.windowMs ?? 120;
    this.onSlash = options.onSlash;
  }

  /** Recent cursor points, oldest first — for rendering the blade trail. */
  get trail(): readonly TrackingPoint[] {
    return this.points;
  }

  /**
   * Feed one cursor sample in arena units (0..1). Fires the slash listener for
   * every new segment that exceeds the speed threshold. Reporting the whole
   * active motion instead of only its first fast moment is important: a blade
   * can become fast before it reaches a fruit, and collision detection still
   * needs to receive the segment that actually crosses the fruit.
   */
  updateCursor(x: number, y: number, timestampMs: number): void {
    this.points.push({ x, y, capturedAtMs: timestampMs });
    this.expire(timestampMs);

    const latestSegment = this.points.slice(-2);

    if (!isSliceGesture(latestSegment, this.minimumSpeed)) {
      return;
    }

    const metrics = measureSwipe(latestSegment);

    if (!metrics) {
      return;
    }

    this.onSlash?.({ points: latestSegment, metrics });
  }

  /** Drop points older than the window; call each frame so idle trails fade. */
  expire(nowMs: number): void {
    while (this.points.length > 0 && nowMs - (this.points[0]?.capturedAtMs ?? 0) > this.windowMs) {
      this.points.shift();
    }
  }

  /** Clear all history, e.g. when a session stops. */
  reset(): void {
    this.points.length = 0;
  }
}
