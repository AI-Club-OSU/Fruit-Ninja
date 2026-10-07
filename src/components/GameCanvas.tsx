/**
 * The live game surface: owns the <canvas>, the hidden-until-ready camera feed,
 * the requestAnimationFrame loop, and the wiring between hand tracking, the
 * Arena, and the renderer.
 *
 * Input is the webcam: cursor samples flow MediaPipe → SlashDetector →
 * Arena.slice. The component never reads the raw landmark stream directly — the
 * source is a swappable CursorSource — so the deterministic game logic stays
 * unaware that a hand (rather than a mouse) drives the blade.
 *
 * State lifecycle:
 * - Mounting (a live session) starts the camera; unmounting stops it, so the
 *   camera only runs during play, per the explicit-action rule in AGENTS.md.
 * - `running` gates whether the sim advances, so pause freezes the board.
 * - Gameplay only advances once vision is `ready`, so fruit never falls while
 *   the player is still granting camera access or the model is loading.
 * - `runId` changes only on start/restart, forcing a fresh Arena + camera.
 */

import { useEffect, useRef } from "react";

import { Arena } from "../game/arena.ts";
import { SlashDetector } from "../game/slashDetector.ts";
import type { VisionStatus } from "../vision/contracts.ts";
import { createMediaPipeCursorSource } from "../vision/cursorSource.ts";
import { drawFrame } from "./renderer.ts";

/** Cap per-frame delta so a background tab doesn't teleport fruit on return. */
const MAX_FRAME_MS = 48;
/** Peak screen-shake offset in CSS pixels at full intensity. */
const SHAKE_PIXELS = 16;

type GameCanvasProps = Readonly<{
  running: boolean;
  runId: number;
  onScore: (points: number) => void;
  onLifeLost: () => void;
  onVisionStatus: (status: VisionStatus) => void;
}>;

export default function GameCanvas({
  running,
  runId,
  onScore,
  onLifeLost,
  onVisionStatus,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Keep the loop reading the latest values without tearing down on every change.
  const runningRef = useRef(running);
  const onScoreRef = useRef(onScore);
  const onLifeLostRef = useRef(onLifeLost);
  const onVisionStatusRef = useRef(onVisionStatus);
  runningRef.current = running;
  onScoreRef.current = onScore;
  onLifeLostRef.current = onLifeLost;
  onVisionStatusRef.current = onVisionStatus;

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas?.getContext("2d");

    if (!canvas || !ctx || !video) {
      return;
    }

    const arena = new Arena({
      onScore: (points) => onScoreRef.current(points),
      onLifeLost: () => onLifeLostRef.current(),
    });
    const detector = new SlashDetector({
      onSlash: (slash) => {
        const aspect = canvas.clientHeight === 0 ? 1 : canvas.clientWidth / canvas.clientHeight;
        arena.slice(slash.points, aspect);
      },
    });

    let visionReady = false;

    const source = createMediaPipeCursorSource(video, {
      onStatus: (status) => {
        visionReady = status === "ready";
        onVisionStatusRef.current(status);
      },

    });

    const unsubscribe = source.subscribe((sample) => {
      if (runningRef.current && visionReady) {
        detector.updateCursor(sample.x, sample.y, sample.timestampMs);
      }
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

      const live = runningRef.current && visionReady;
      if (live) {
        arena.update(dtMs);
        detector.expire(nowMs);
      }

      const scene = arena.scene;
      const shakeX = (Math.random() - 0.5) * scene.shake * SHAKE_PIXELS;
      const shakeY = (Math.random() - 0.5) * scene.shake * SHAKE_PIXELS;
      ctx.setTransform(dpr, 0, 0, dpr, shakeX * dpr, shakeY * dpr);

      drawFrame(ctx, width, height, {
        fruits: scene.fruits,
        halves: scene.halves,
        particles: scene.particles,
        popups: scene.popups,
        trail: live ? detector.trail : [],
        flash: scene.flash,
        nowMs,
      });


      frameId = requestAnimationFrame(renderLoop);
    };

    frameId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(frameId);
      unsubscribe();
      onVisionStatusRef.current("idle");
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [runId]);

  return (
    <>
      <canvas ref={canvasRef} className="game-canvas" />
      <div className="cam-preview">
        <video ref={videoRef} className="cam-video" playsInline muted />

        <span className="cam-preview-label">You</span>
      </div>
    </>
  );
}
