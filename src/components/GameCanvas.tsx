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
/** Hide the fingertip marker if no hand has been seen for this long. */
const MARKER_STALE_MS = 250;
/** Consecutive fist frames before a pause fires — filters brief mis-reads. */
const FIST_TRIGGER_FRAMES = 3;
/** Consecutive open-hand frames before the fist can trigger a pause again. */
const FIST_RELEASE_FRAMES = 3;

type GameCanvasProps = Readonly<{
  running: boolean;
  runId: number;
  onScore: (points: number) => void;
  onLifeLost: () => void;
  onPause: () => void;
  onVisionStatus: (status: VisionStatus) => void;
}>;

export default function GameCanvas({
  running,
  runId,
  onScore,
  onLifeLost,
  onPause,
  onVisionStatus,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const markerRef = useRef<HTMLSpanElement>(null);

  // Keep the loop reading the latest values without tearing down on every change.
  const runningRef = useRef(running);
  const onScoreRef = useRef(onScore);
  const onLifeLostRef = useRef(onLifeLost);
  const onPauseRef = useRef(onPause);
  const onVisionStatusRef = useRef(onVisionStatus);
  runningRef.current = running;
  onScoreRef.current = onScore;
  onLifeLostRef.current = onLifeLost;
  onPauseRef.current = onPause;
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
    // Latest fingertip, for driving the preview marker.
    let lastSample = { x: 0.5, y: 0.5, atMs: -Infinity };
    // Debounced fist gesture → pause. `fistLatched` blocks repeat pauses until
    // the hand opens again, so a held fist doesn't immediately re-pause on resume.
    let fistFrames = 0;
    let openFrames = 0;
    let fistLatched = false;

    const source = createMediaPipeCursorSource(video, {
      onStatus: (status) => {
        visionReady = status === "ready";
        onVisionStatusRef.current(status);
      },
    });

    const unsubscribe = source.subscribe((sample) => {
      lastSample = { x: sample.x, y: sample.y, atMs: performance.now() };

      if (sample.fist) {
        fistFrames += 1;
        openFrames = 0;
        if (
          !fistLatched &&
          fistFrames >= FIST_TRIGGER_FRAMES &&
          runningRef.current &&
          visionReady
        ) {
          fistLatched = true;
          onPauseRef.current();
        }
      } else {
        openFrames += 1;
        fistFrames = 0;
        if (openFrames >= FIST_RELEASE_FRAMES) {
          fistLatched = false;
        }
      }

      // A fist isn't a slice: skip cursor updates so a closing hand can't slash.
      if (runningRef.current && visionReady && !sample.fist) {
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

      // Drive the preview marker from the most recent fingertip.
      const marker = markerRef.current;
      if (marker) {
        const fresh = nowMs - lastSample.atMs < MARKER_STALE_MS;
        marker.style.opacity = fresh ? "1" : "0";
        if (fresh) {
          marker.style.left = `${lastSample.x * 100}%`;
          marker.style.top = `${lastSample.y * 100}%`;
        }
      }

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
        <span ref={markerRef} className="cam-marker" />
        <span className="cam-preview-label">You</span>
      </div>
    </>
  );
}
