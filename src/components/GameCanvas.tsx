/**
 * The live game surface: owns the <canvas>, the requestAnimationFrame loop,
 * and the wiring between input, game logic, and rendering.
 *
 * Per frame: advance the spawner, expire stale trail points, draw everything.
 * Cursor samples flow CursorSource → SlashDetector; the component never reads
 * pointer events directly, so swapping in the MediaPipe source is a one-line
 * change where the source is created.
 *
 * TODO(state machine): when the game-state owner arrives, lift spawner and
 * detector ownership into their Game orchestrator and make this component a
 * dumb renderer of its state.
 */

import { useEffect, useRef } from "react";

import { FruitSpawner } from "../game/spawner.ts";
import { SlashDetector, type SlashEvent } from "../game/slashDetector.ts";
import { createPointerCursorSource } from "../vision/cursorSource.ts";
import { drawFrame } from "./renderer.ts";

/** Cap per-frame delta so a background tab doesn't teleport fruit on return. */
const MAX_FRAME_MS = 48;

type GameCanvasProps = Readonly<{
  running: boolean;
}>;

function handleSlash(slash: SlashEvent): void {
  // TODO(slicing): hand slash.points to the collision owner here.
  console.log("Slash detected", slash.metrics);
}

export default function GameCanvas({ running }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if (!canvas || !ctx || !running) {
      return;
    }

    const spawner = new FruitSpawner();
    const detector = new SlashDetector({ onSlash: handleSlash });
    const unsubscribe = createPointerCursorSource(canvas).subscribe((sample) => {
      detector.updateCursor(sample.x, sample.y, sample.timestampMs);
    });

    let frameId = 0;
    let lastFrameMs = performance.now();

    const renderLoop = (nowMs: number) => {
      const dtMs = Math.min(nowMs - lastFrameMs, MAX_FRAME_MS);
      lastFrameMs = nowMs;

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const dpr = window.devicePixelRatio || 1;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      spawner.update(dtMs);
      detector.expire(nowMs);
      drawFrame(ctx, width, height, { fruits: spawner.fruits, trail: detector.trail, nowMs });

      frameId = requestAnimationFrame(renderLoop);
    };

    frameId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(frameId);
      unsubscribe();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [running]);

  return <canvas ref={canvasRef} className="game-canvas" aria-label="Fruit arena" />;
}
