/**
 * Canvas drawing for the arena.
 *
 * Responsibility: translate normalized game state (fruit, sliced halves, juice
 * particles, score popups, blade trail) into pixels each frame. Pure draw
 * functions with no game logic, timers, or DOM ownership — the caller owns the
 * canvas, the frame loop, and the screen-shake transform.
 *
 * Fruit are vector art drawn in code (body gradient + kind-specific detailing +
 * highlight + contact shadow), so no image assets are needed. Colors come from
 * the shared palette in `src/game/palette.ts`.
 */

import type { Fruit, FruitHalf, FruitKind } from "../game/fruit.ts";
import { BOMB_COLORS, FRUIT_COLORS } from "../game/palette.ts";
import type { Particle } from "../game/particles.ts";
import type { ScorePopup } from "../game/arena.ts";
import type { TrackingPoint } from "../game/swipe.ts";

/** Warm gold glow behind the blade trail. */
const BLADE_GLOW = "#ffd447";

export type FrameScene = Readonly<{
  fruits: readonly Fruit[];
  halves: readonly FruitHalf[];
  particles: readonly Particle[];
  popups: readonly ScorePopup[];
  trail: readonly TrackingPoint[];
  flash: number;
  nowMs: number;
}>;

/** Draw one full frame. `width`/`height` are CSS pixels; caller has scaled for DPR. */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scene: FrameScene,
): void {
  ctx.clearRect(0, 0, width, height);

  for (const fruit of scene.fruits) {
    if (fruit.kind === "bomb") {
      drawBomb(ctx, fruit, width, height, scene.nowMs);
    } else {
      drawFruit(ctx, fruit, width, height);
    }
  }

  for (const half of scene.halves) {
    drawHalf(ctx, half, width, height);
  }

  drawParticles(ctx, scene.particles, width, height);
  drawTrail(ctx, scene.trail, width, height, scene.nowMs);
  drawPopups(ctx, scene.popups, width, height);

  if (scene.flash > 0) {
    ctx.fillStyle = `rgb(255 245 230 / ${Math.round(scene.flash * 45)}%)`;
    ctx.fillRect(0, 0, width, height);
  }
}

/** Motion stretch: fruit elongate slightly along their velocity. */
function velocityStretch(fruit: Fruit): { angle: number; stretch: number; squash: number } {
  const speed = Math.hypot(fruit.velocity.x, fruit.velocity.y);
  const amount = Math.min(0.32, speed * 170);
  return {
    angle: Math.atan2(fruit.velocity.y, fruit.velocity.x),
    stretch: 1 + amount,
    squash: 1 - amount * 0.55,
  };
}

/** Soft contact shadow that sells the fruit as a 3D object. */
function drawContactShadow(ctx: CanvasRenderingContext2D, radius: number): void {
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = "#000";
  ctx.filter = "blur(6px)";
  ctx.beginPath();
  ctx.ellipse(radius * 0.16, radius * 0.24, radius * 0.98, radius * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Glossy top-left highlight applied to any round body. */
function drawGloss(ctx: CanvasRenderingContext2D, radius: number): void {
  ctx.beginPath();
  ctx.ellipse(-radius * 0.38, -radius * 0.42, radius * 0.26, radius * 0.14, -0.6, 0, Math.PI * 2);
  ctx.fillStyle = "rgb(255 255 255 / 55%)";
  ctx.fill();
}

function drawFruit(
  ctx: CanvasRenderingContext2D,
  fruit: Fruit,
  width: number,
  height: number,
): void {
  const x = fruit.position.x * width;
  const y = fruit.position.y * height;
  const radius = fruit.radius * height;
  const colors = FRUIT_COLORS[fruit.kind as FruitKind];
  const { angle, stretch, squash } = velocityStretch(fruit);

  ctx.save();
  ctx.translate(x, y);

  drawContactShadow(ctx, radius);

  // Directional motion squash in world space, then spin for the detailing.
  ctx.rotate(angle);
  ctx.scale(stretch, squash);
  ctx.rotate(-angle);
  ctx.rotate(fruit.rotation);

  const body = ctx.createRadialGradient(-radius * 0.35, -radius * 0.4, radius * 0.15, 0, 0, radius);
  body.addColorStop(0, colors.body);
  body.addColorStop(1, colors.shade);

  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();

  drawFruitDetail(ctx, fruit.kind as FruitKind, radius, colors);

  // Rim light on the shaded side + top-left gloss.
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.97, Math.PI * 0.15, Math.PI * 0.75);
  ctx.strokeStyle = "rgb(255 255 255 / 22%)";
  ctx.lineWidth = radius * 0.08;
  ctx.stroke();

  drawGloss(ctx, radius);

  ctx.restore();
}

/** Kind-specific surface texture, drawn in the fruit's local (rotated) frame. */
function drawFruitDetail(
  ctx: CanvasRenderingContext2D,
  kind: FruitKind,
  radius: number,
  colors: (typeof FRUIT_COLORS)[FruitKind],
): void {
  switch (kind) {
    case "watermelon": {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.strokeStyle = "rgb(20 70 35 / 55%)";
      ctx.lineWidth = radius * 0.14;
      for (const offset of [-0.62, -0.2, 0.2, 0.62]) {
        ctx.beginPath();
        ctx.moveTo(offset * radius, -radius);
        ctx.lineTo(offset * radius, radius);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case "pineapple": {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.strokeStyle = "rgb(150 110 20 / 45%)";
      ctx.lineWidth = radius * 0.05;
      for (let d = -2; d <= 2; d += 1) {
        ctx.beginPath();
        ctx.moveTo(-radius, d * radius * 0.42 - radius);
        ctx.lineTo(radius, d * radius * 0.42);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-radius, d * radius * 0.42 + radius);
        ctx.lineTo(radius, d * radius * 0.42);
        ctx.stroke();
      }
      ctx.restore();
      drawLeaf(ctx, radius, colors.leaf);
      break;
    }
    case "orange": {
      // Navel dimple.
      ctx.beginPath();
      ctx.arc(radius * 0.05, radius * 0.05, radius * 0.1, 0, Math.PI * 2);
      ctx.fillStyle = "rgb(150 80 0 / 35%)";
      ctx.fill();
      break;
    }
    case "apple": {
      // Short stem + leaf at the top.
      ctx.strokeStyle = "#5a3a1a";
      ctx.lineWidth = radius * 0.08;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, -radius * 0.9);
      ctx.lineTo(radius * 0.04, -radius * 1.12);
      ctx.stroke();
      drawLeaf(ctx, radius, colors.leaf);
      break;
    }
    case "lemon":
    case "lime": {
      // Bright pole highlight for a waxy citrus look.
      ctx.beginPath();
      ctx.ellipse(0, -radius * 0.2, radius * 0.5, radius * 0.7, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgb(255 255 255 / 10%)";
      ctx.fill();
      break;
    }
  }
}

function drawLeaf(ctx: CanvasRenderingContext2D, radius: number, leaf: string): void {
  ctx.save();
  ctx.translate(radius * 0.18, -radius * 1.02);
  ctx.rotate(-0.5);
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * 0.34, radius * 0.15, 0, 0, Math.PI * 2);
  ctx.fillStyle = leaf;
  ctx.fill();
  ctx.restore();
}

function drawBomb(
  ctx: CanvasRenderingContext2D,
  bomb: Fruit,
  width: number,
  height: number,
  nowMs: number,
): void {
  const x = bomb.position.x * width;
  const y = bomb.position.y * height;
  const radius = bomb.radius * height;

  ctx.save();
  ctx.translate(x, y);
  drawContactShadow(ctx, radius);
  ctx.rotate(bomb.rotation);

  const body = ctx.createRadialGradient(-radius * 0.35, -radius * 0.4, radius * 0.1, 0, 0, radius);
  body.addColorStop(0, BOMB_COLORS.highlight);
  body.addColorStop(0.5, BOMB_COLORS.body);
  body.addColorStop(1, BOMB_COLORS.shade);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();

  // Danger ring so a bomb never reads as fruit.
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.82, 0, Math.PI * 2);
  ctx.strokeStyle = "rgb(230 57 70 / 65%)";
  ctx.lineWidth = radius * 0.09;
  ctx.stroke();

  // Cap + fuse.
  ctx.fillStyle = "#3a3a42";
  ctx.fillRect(-radius * 0.24, -radius * 1.15, radius * 0.48, radius * 0.3);
  ctx.strokeStyle = BOMB_COLORS.fuse;
  ctx.lineWidth = radius * 0.1;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, -radius * 1.1);
  ctx.quadraticCurveTo(radius * 0.4, -radius * 1.5, radius * 0.15, -radius * 1.7);
  ctx.stroke();

  // Flickering spark.
  const flicker = 0.6 + 0.4 * Math.sin(nowMs / 45);
  ctx.beginPath();
  ctx.arc(radius * 0.15, -radius * 1.7, radius * 0.16 * flicker, 0, Math.PI * 2);
  ctx.fillStyle = BOMB_COLORS.spark;
  ctx.shadowColor = BOMB_COLORS.spark;
  ctx.shadowBlur = 14;
  ctx.fill();

  ctx.restore();
}

/** One sliced half: skin arc on the outside, flesh face on the cut. */
function drawHalf(
  ctx: CanvasRenderingContext2D,
  half: FruitHalf,
  width: number,
  height: number,
): void {
  const x = half.position.x * width;
  const y = half.position.y * height;
  const radius = half.radius * height;
  const colors = FRUIT_COLORS[half.kind];

  ctx.save();
  ctx.translate(x, y);
  drawContactShadow(ctx, radius);
  // Orient so the cut runs along local x, then pick the requested side.
  ctx.rotate(half.rotation + half.sliceAngle);
  // Nudge the piece off the cut line so the two halves read as separated.
  ctx.translate(0, half.side * radius * 0.06);

  ctx.beginPath();
  ctx.rect(-radius * 1.2, half.side < 0 ? -radius * 1.2 : 0, radius * 2.4, radius * 1.2);
  ctx.clip();

  // Skin.
  const body = ctx.createRadialGradient(-radius * 0.35, -radius * 0.4, radius * 0.15, 0, 0, radius);
  body.addColorStop(0, colors.body);
  body.addColorStop(1, colors.shade);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();

  // Flesh core (leaves a thin rind ring of skin around it).
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.8, 0, Math.PI * 2);
  ctx.fillStyle = colors.flesh;
  ctx.fill();

  // Rind ring accent just inside the skin.
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.8, 0, Math.PI * 2);
  ctx.strokeStyle = colors.rind;
  ctx.lineWidth = radius * 0.09;
  ctx.stroke();

  // Seeds for kinds that have them.
  if (colors.seed) {
    ctx.fillStyle = colors.seed;
    for (const s of [-0.4, 0, 0.4]) {
      ctx.beginPath();
      ctx.ellipse(
        s * radius * 0.6,
        half.side * radius * 0.3,
        radius * 0.06,
        radius * 0.1,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  // Bright line along the fresh cut.
  ctx.beginPath();
  ctx.moveTo(-radius, 0);
  ctx.lineTo(radius, 0);
  ctx.strokeStyle = "rgb(255 255 255 / 45%)";
  ctx.lineWidth = radius * 0.05;
  ctx.stroke();

  ctx.restore();
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: readonly Particle[],
  width: number,
  height: number,
): void {
  for (const particle of particles) {
    const alpha = Math.max(0, Math.min(1, particle.lifeMs / particle.maxLifeMs));
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(
      particle.position.x * width,
      particle.position.y * height,
      particle.radius * height,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = particle.color;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Blade trail: a warm glowing polyline that fades and thins toward older points. */
function drawTrail(
  ctx: CanvasRenderingContext2D,
  trail: readonly TrackingPoint[],
  width: number,
  height: number,
  nowMs: number,
): void {
  if (trail.length < 2) {
    return;
  }

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = BLADE_GLOW;
  ctx.shadowBlur = 18;

  for (let index = 1; index < trail.length; index += 1) {
    const from = trail[index - 1];
    const to = trail[index];
    if (!from || !to) {
      continue;
    }

    const age = Math.min(1, Math.max(0, (nowMs - to.capturedAtMs) / 180));
    const strength = 1 - age;
    ctx.strokeStyle = `rgb(255 247 234 / ${Math.round(strength * 92)}%)`;
    ctx.lineWidth = 2 + strength * 9;
    ctx.beginPath();
    ctx.moveTo(from.x * width, from.y * height);
    ctx.lineTo(to.x * width, to.y * height);
    ctx.stroke();
  }

  ctx.restore();
}

const POPUP_TONES: Record<ScorePopup["tone"], string> = {
  score: "#fff2c4",
  combo: "#ff9f1c",
  bomb: "#ff5a6a",
};

function drawPopups(
  ctx: CanvasRenderingContext2D,
  popups: readonly ScorePopup[],
  width: number,
  height: number,
): void {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const popup of popups) {
    const progress = Math.min(1, popup.ageMs / popup.lifeMs);
    const rise = progress * 0.07;
    const alpha = 1 - progress * progress;
    const size = popup.tone === "score" ? 0.05 : 0.062;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = POPUP_TONES[popup.tone];
    ctx.font = `900 ${size * height}px Impact, Haettenschweiler, sans-serif`;
    ctx.shadowColor = "rgb(0 0 0 / 55%)";
    ctx.shadowBlur = 8;
    ctx.fillText(popup.text, popup.x * width, (popup.y - rise) * height);
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}
