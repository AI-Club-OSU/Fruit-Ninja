/**
 * Juice particle system for slice feedback.
 *
 * Responsibility: own a pool of short-lived droplets, spawn bursts at a slice
 * point, and advance them under gravity while they fade. Pure state + math in
 * arena units (0..1); the renderer reads `particles` and draws them. No DOM.
 */

import { GRAVITY, type Vector2 } from "./fruit.ts";

export type Particle = {
  position: Vector2;
  velocity: Vector2;
  /** CSS color string for this droplet. */
  color: string;
  /** Radius as a fraction of arena height. */
  radius: number;
  /** Remaining life in ms. */
  lifeMs: number;
  /** Life it was born with, so the renderer can fade on the ratio. */
  maxLifeMs: number;
};

export type BurstOptions = Readonly<{
  count?: number;
  /** Base outward speed in arena units per ms. */
  speed?: number;
  /** Life span in ms; each droplet is jittered around it. */
  lifeMs?: number;
  /** Droplet radius as a fraction of arena height. */
  radius?: number;
  /** Random source in [0, 1); injectable for deterministic tests. */
  random?: () => number;
}>;

export class ParticleSystem {
  readonly particles: Particle[] = [];

  /** Spray droplets of `color` outward from `origin`. */
  burst(origin: Vector2, color: string, options: BurstOptions = {}): void {
    const count = options.count ?? 14;
    const baseSpeed = options.speed ?? 0.0009;
    const lifeMs = options.lifeMs ?? 520;
    const radius = options.radius ?? 0.012;
    const random = options.random ?? Math.random;

    for (let index = 0; index < count; index += 1) {
      const angle = random() * Math.PI * 2;
      const speed = baseSpeed * (0.35 + random() * 0.9);
      this.particles.push({
        position: { ...origin },
        velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        color,
        radius: radius * (0.5 + random()),
        lifeMs: lifeMs * (0.7 + random() * 0.6),
        maxLifeMs: lifeMs,
      });
    }
  }

  /** Advance every droplet and drop the dead ones. */
  update(dtMs: number): void {
    for (const particle of this.particles) {
      particle.velocity.y += GRAVITY * dtMs;
      particle.position.x += particle.velocity.x * dtMs;
      particle.position.y += particle.velocity.y * dtMs;
      particle.lifeMs -= dtMs;
    }

    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      if ((this.particles[index]?.lifeMs ?? 0) <= 0) {
        this.particles.splice(index, 1);
      }
    }
  }

  clear(): void {
    this.particles.length = 0;
  }
}
