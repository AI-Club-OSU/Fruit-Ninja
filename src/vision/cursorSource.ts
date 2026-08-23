/**
 * Generic cursor input boundary between the game and any tracking hardware.
 *
 * Responsibility: define the sample shape and subscription contract the game
 * consumes, plus a pointer-based implementation for the prototype. The game
 * never learns whether samples came from a mouse, a touch screen, or a
 * MediaPipe hand — the CV team swaps in their own CursorSource later without
 * touching game code.
 */

import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

import type { VisionStatus } from "./contracts.ts";
import { type OneEuroOptions, Point2DFilter } from "./oneEuroFilter.ts";
import { mapCameraPointToArena } from "./trackingArea.ts";

const HAND_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";

let handPromise: Promise<HandLandmarker> | null = null;

const INDEX_FINGER_TIP = 8;

function getHandLandmarker(): Promise<HandLandmarker> {
  if (!handPromise) {
    handPromise = (async () => {
      try {
        const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
        return await HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: "CPU" },
          runningMode: "VIDEO",
          numHands: 1,
          minHandDetectionConfidence: 0.25,
          minHandPresenceConfidence: 0.25,
          minTrackingConfidence: 0.25,
        });
      } catch (error) {
        // Clear the cache so a later retry can attempt the load again instead
        // of resolving the same rejected promise forever.
        handPromise = null;
        throw error;
      }
    })();
  }

  return handPromise;
}

export type CursorSample = Readonly<{
  /** Horizontal position in arena units, 0 (left) to 1 (right). */
  x: number;

  /** Vertical position in arena units, 0 (top) to 1 (bottom). */
  y: number;

  timestampMs: number;

  /** Detection confidence, 0..1. */
  confidence: number;
}>;

export type CursorListener = (sample: CursorSample) => void;

export interface CursorSource {
  /** Start receiving samples; returns an unsubscribe function. */
  subscribe(listener: CursorListener): () => void;
}

/**
 * Prototype input: mouse/touch/pen movement.
 */
export function createPointerCursorSource(element: HTMLElement): CursorSource {
  return {
    subscribe(listener) {
      const handlePointerMove = (event: globalThis.PointerEvent) => {
        const bounds = element.getBoundingClientRect();

        if (bounds.width === 0 || bounds.height === 0) {
          return;
        }

        listener({
          x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
          y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
          timestampMs: event.timeStamp,
          confidence: 1,
        });
      };

      element.addEventListener("pointermove", handlePointerMove);

      return () => {
        element.removeEventListener("pointermove", handlePointerMove);
      };
    },
  };
}

export type MediaPipeCursorOptions = Readonly<{
  /** Called as the pipeline moves through camera → model → ready / error. */
  onStatus?: (status: VisionStatus) => void;
  /** One Euro smoothing params for the fingertip; omit to use tuned defaults. */
  smoothing?: OneEuroOptions;
}>;

/**
 * MediaPipe-backed cursor source: the index fingertip becomes the blade.
 *
 * Converts:  Camera → Video → HandLandmarker → CursorSample
 *
 * Camera coordinates are mirrored and expanded so comfortable hand movement
 * reaches the full arena without requiring the player to touch the frame edges.
 * `onStatus` lets the UI show "allow camera" / "loading" / error states and gate
 * gameplay until tracking is live. The stream is fully released on unsubscribe,
 * so the camera stops when the session ends.
 */
export function createMediaPipeCursorSource(
  video: HTMLVideoElement,
  options: MediaPipeCursorOptions = {},
): CursorSource {
  const setStatus = (status: VisionStatus) => options.onStatus?.(status);

  return {
    subscribe(listener) {
      let animationFrameId = 0;
      let active = true;
      let stream: MediaStream | null = null;
      // MediaPipe's VIDEO mode requires strictly increasing timestamps.
      let lastTimestampMs = -1;
      const smoother = new Point2DFilter(options.smoothing);

      const start = async () => {
        setStatus("requesting-camera");
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 960 },
            height: { ideal: 540 },
            frameRate: { ideal: 30 },
          },
          audio: false,
        });

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        video.srcObject = stream;
        await video.play();

        setStatus("loading-model");
        const handLandmarker = await getHandLandmarker();
        if (!active) {
          return;
        }
        setStatus("ready");

        const handleFrame = () => {
          if (!active) {
            return;
          }

          const nowMs = performance.now();
          if (video.readyState >= 2 && nowMs > lastTimestampMs) {
            lastTimestampMs = nowMs;
            const results = handLandmarker.detectForVideo(video, nowMs);
            const landmarks = results.landmarks[0];
            const fingertip = landmarks?.[INDEX_FINGER_TIP];

            if (fingertip) {
              const mapped = mapCameraPointToArena(fingertip.x, fingertip.y);
              const smoothed = smoother.filter(mapped.x, mapped.y, nowMs);
              listener({
                x: smoothed.x,
                y: smoothed.y,
                timestampMs: nowMs,
                confidence: 1,
              });
            }
          }

          animationFrameId = requestAnimationFrame(handleFrame);
        };

        animationFrameId = requestAnimationFrame(handleFrame);
      };

      void start().catch((error) => {
        console.error("Failed to start MediaPipe cursor source:", error);
        setStatus("error");
      });

      return () => {
        active = false;
        cancelAnimationFrame(animationFrameId);
        stream?.getTracks().forEach((track) => track.stop());
        video.srcObject = null;
      };
    },
  };
}
