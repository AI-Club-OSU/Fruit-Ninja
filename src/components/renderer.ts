/**
 * Canvas drawing for the arena.
 *
 * Responsibility: translate normalized game state (fruit, slash trail) into
 * pixels each frame. Pure draw functions with no game logic, timers, or DOM
 * ownership — the caller owns the canvas and the frame loop.
 *
 * TODO(assets): fruit are vector placeholders drawn in code. Swap drawFruit's
 * body for sprite images (whole + sliced halves) once art lands.
 * TODO(particles): juice splashes on slice belong in a new draw pass here.
 */

import type { Fruit, FruitKind } from "../game/fruit.ts";
import type { TrackingPoint } from "../game/swipe.ts";

type FruitPalette = Readonly<{ body: string; shade: string; leaf: string }>;

const PALETTES: Record<FruitKind, FruitPalette> = {
  lime: { body: "#bfe83f", shade: "#7ea326", leaf: "#8cb63a" },
  orange: { body: "#ff8a35", shade: "#c05a12", leaf: "#8cb63a" },
  watermelon: { body: "#62c95e", shade: "#2c7a3c", leaf: "#8cb63a" },
};

export type FrameScene = Readonly<{
  fruits: readonly Fruit[];
  trail: readonly TrackingPoint[];
  nowMs: number;
}>;

/** Draw one full frame. `width`/`height` are CSS pixels; the caller has already scaled for DPR. */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scene: FrameScene,
): void {
  ctx.clearRect(0, 0, width, height);

  for (const fruit of scene.fruits) {
    drawFruit(ctx, fruit, width, height);
  }

  drawTrail(ctx, scene.trail, width, height, scene.nowMs);
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
  const palette = PALETTES[fruit.kind];

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(fruit.rotation);

  const body = ctx.createRadialGradient(-radius * 0.35, -radius * 0.35, radius * 0.2, 0, 0, radius);
  body.addColorStop(0, palette.body);
  body.addColorStop(1, palette.shade);

  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();

  if (fruit.kind === "watermelon") {
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = "rgb(30 87 43 / 45%)";
    ctx.lineWidth = radius * 0.22;
    for (const offset of [-0.5, 0, 0.5]) {
      ctx.beginPath();
      ctx.moveTo(offset * radius, -radius);
      ctx.lineTo(offset * radius, radius);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.beginPath();
  ctx.ellipse(-radius * 0.4, -radius * 0.45, radius * 0.22, radius * 0.12, -0.6, 0, Math.PI * 2);
  ctx.fillStyle = "rgb(255 255 255 / 45%)";
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(radius * 0.1, -radius * 1.05, radius * 0.3, radius * 0.14, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = palette.leaf;
  ctx.fill();

  ctx.restore();
}

/** Blade trail: a glowing polyline that fades and thins toward older points. */
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
  ctx.shadowColor = "rgb(201 255 74 / 80%)";
  ctx.shadowBlur = 14;

  for (let index = 1; index < trail.length; index += 1) {
    const from = trail[index - 1];
    const to = trail[index];

    if (!from || !to) {
      continue;
    }

    const age = Math.min(1, Math.max(0, (nowMs - to.capturedAtMs) / 160));
    ctx.strokeStyle = `rgb(243 246 237 / ${Math.round((1 - age) * 90)}%)`;
    ctx.lineWidth = 2 + (1 - age) * 4;
    ctx.beginPath();
    ctx.moveTo(from.x * width, from.y * height);
    ctx.lineTo(to.x * width, to.y * height);
    ctx.stroke();
  }

  ctx.restore();
}
