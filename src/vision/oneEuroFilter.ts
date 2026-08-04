/**
 * One Euro filter for smoothing noisy tracked-pointer input.
 *
 * Hand-landmark positions jitter frame to frame, which both makes the blade
 * marker shaky and injects fake speed into the slash detector. A plain moving
 * average would fix the jitter but add lag that dulls fast swipes — the worst
 * trade for a slicing game.
 *
 * The One Euro filter (Casiez, Roussel & Vogel, 2012) is adaptive: it smooths
 * hard when the finger is slow (killing jitter at rest) and barely filters when
 * the finger is fast (keeping swipes crisp). `beta` controls how aggressively it
 * backs off during fast motion; `minCutoff` sets the smoothing floor at rest.
 * Both are exposed for tuning against a real webcam.
 *
 * Pure math in normalized units — no DOM — so it is unit-tested directly.
 */

function smoothingFactor(dtSeconds: number, cutoffHz: number): number {
  const r = 2 * Math.PI * cutoffHz * dtSeconds;
  return r / (r + 1);
}

class ScalarOneEuro {
  private readonly minCutoff: number;
  private readonly beta: number;
  private readonly dCutoff: number;
  private xPrev = 0;
  private dxPrev = 0;
  private tPrevMs = 0;
  private hasPrev = false;

  constructor(minCutoff: number, beta: number, dCutoff: number) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  filter(value: number, timestampMs: number): number {
    if (!this.hasPrev) {
      this.hasPrev = true;
      this.xPrev = value;
      this.dxPrev = 0;
      this.tPrevMs = timestampMs;
      return value;
    }

    const dtMs = timestampMs - this.tPrevMs;
    if (dtMs <= 0) {
      // Out-of-order or duplicate timestamp: hold the last estimate.
      return this.xPrev;
    }

    const dtSeconds = dtMs / 1000;
    const dx = (value - this.xPrev) / dtSeconds;
    const aD = smoothingFactor(dtSeconds, this.dCutoff);
    const dxHat = aD * dx + (1 - aD) * this.dxPrev;

    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = smoothingFactor(dtSeconds, cutoff);
    const xHat = a * value + (1 - a) * this.xPrev;

    this.xPrev = xHat;
    this.dxPrev = dxHat;
    this.tPrevMs = timestampMs;
    return xHat;
  }

  reset(): void {
    this.hasPrev = false;
  }
}

export type OneEuroOptions = Readonly<{
  /** Smoothing floor in Hz when the finger is still. Lower = smoother/laggier. */
  minCutoff?: number;
  /** How fast the filter opens up during motion. Higher = more responsive. */
  beta?: number;
  /** Cutoff for the internal speed estimate; rarely needs changing. */
  dCutoff?: number;
}>;

/** Defaults tuned to lean responsive, so fast swipes stay sharp. */
export const DEFAULT_ONE_EURO: Required<OneEuroOptions> = {
  minCutoff: 1.0,
  beta: 0.6,
  dCutoff: 1.0,
};

/** Filters a 2D point, smoothing x and y independently on a shared clock. */
export class Point2DFilter {
  private readonly fx: ScalarOneEuro;
  private readonly fy: ScalarOneEuro;

  constructor(options: OneEuroOptions = {}) {
    const minCutoff = options.minCutoff ?? DEFAULT_ONE_EURO.minCutoff;
    const beta = options.beta ?? DEFAULT_ONE_EURO.beta;
    const dCutoff = options.dCutoff ?? DEFAULT_ONE_EURO.dCutoff;
    this.fx = new ScalarOneEuro(minCutoff, beta, dCutoff);
    this.fy = new ScalarOneEuro(minCutoff, beta, dCutoff);
  }

  filter(x: number, y: number, timestampMs: number): { x: number; y: number } {
    return { x: this.fx.filter(x, timestampMs), y: this.fy.filter(y, timestampMs) };
  }

  reset(): void {
    this.fx.reset();
    this.fy.reset();
  }
}
