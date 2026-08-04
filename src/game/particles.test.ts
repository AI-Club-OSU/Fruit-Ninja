import { describe, expect, it } from "vite-plus/test";

import { ParticleSystem } from "./particles.ts";

describe("particle system", () => {
  it("spawns the requested number of droplets", () => {
    const system = new ParticleSystem();
    system.burst({ x: 0.5, y: 0.5 }, "#ff0000", { count: 10, random: () => 0.5 });

    expect(system.particles).toHaveLength(10);
    for (const particle of system.particles) {
      expect(particle.position).toEqual({ x: 0.5, y: 0.5 });
      expect(particle.color).toBe("#ff0000");
    }
  });

  it("moves droplets and expires them once life runs out", () => {
    const system = new ParticleSystem();
    system.burst({ x: 0.5, y: 0.5 }, "#fff", { count: 4, lifeMs: 100, random: () => 0.5 });

    system.update(50);
    expect(system.particles.length).toBeGreaterThan(0);

    system.update(200);
    expect(system.particles).toHaveLength(0);
  });

  it("applies gravity so droplets accelerate downward", () => {
    const system = new ParticleSystem();
    system.burst({ x: 0.5, y: 0.5 }, "#fff", { count: 1, speed: 0, lifeMs: 1000, random: () => 0 });
    const particle = system.particles[0];
    if (!particle) throw new Error("expected a droplet");

    const startVy = particle.velocity.y;
    system.update(100);
    expect(particle.velocity.y).toBeGreaterThan(startVy);
  });

  it("clears the pool", () => {
    const system = new ParticleSystem();
    system.burst({ x: 0.5, y: 0.5 }, "#fff", { count: 5 });
    system.clear();
    expect(system.particles).toHaveLength(0);
  });
});
