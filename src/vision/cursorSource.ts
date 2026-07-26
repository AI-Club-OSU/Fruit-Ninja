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

const HAND_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";

let handPromise: Promise<HandLandmarker> | null = null;

const INDEX_FINGER_TIP = 8;

function getHandLandmarker(): Promise<HandLandmarker> {
  if (!handPromise) {
    handPromise = FilesetResolver.forVisionTasks(WASM_BASE).then((fileset) =>
      HandLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: HAND_MODEL_URL,
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numHands: 1,
      }),
    );
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

/**
 * MediaPipe-backed cursor source.
 *
 * Converts:
 * Camera → Video → HandLandmarker → CursorSample
 */
export function createMediaPipeCursorSource(video: HTMLVideoElement): CursorSource {
  return {
    subscribe(listener) {
      let animationFrameId = 0;
      let active = true;
      let stream: MediaStream | null = null;

      const start = async () => {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

        video.srcObject = stream;

        await video.play();

        const handLandmarker = await getHandLandmarker();

        const handleFrame = (timestampMs: number) => {
          if (!active) {
            return;
          }

          const results = handLandmarker.detectForVideo(video, timestampMs);

          const landmarks = results.landmarks[0];

          if (landmarks) {
            const fingertip = landmarks[INDEX_FINGER_TIP];
            if (fingertip == undefined) {
              return;
            }
            listener({
              x: 1-fingertip.x,
              y: fingertip.y,
              timestampMs,
              confidence: 1,
            });
          }

          animationFrameId = requestAnimationFrame(handleFrame);
        };

        animationFrameId = requestAnimationFrame(handleFrame);
      };

      void start().catch((error) => {
        console.error("Failed to start MediaPipe cursor source:", error);
      });
      return () => {
        active = false;

        cancelAnimationFrame(animationFrameId);

        stream?.getTracks().forEach((track) => {
          track.stop();
        });

        video.srcObject = null;
      };
    },
  };
}
