/**
 * Generic cursor input boundary between the game and any tracking hardware.
 *
 * Responsibility: define the sample shape and subscription contract the game
 * consumes, plus a pointer-based implementation for the prototype. The game
 * never learns whether samples came from a mouse, a touch screen, or a
 * MediaPipe hand — the CV team swaps in their own CursorSource later without
 * touching game code.
 */

import { FilesetResolver, ObjectDetector } from "@mediapipe/tasks-vision";

import type { VisionStatus } from "./contracts.ts";
import { type OneEuroOptions, Point2DFilter } from "./oneEuroFilter.ts";
import { mapCameraPointToArena } from "./trackingArea.ts";

const OBJECT_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";

let detectorPromise: Promise<ObjectDetector> | null = null;

function getObjectDetector(): Promise<ObjectDetector> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      try {
        const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
        return await ObjectDetector.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: OBJECT_MODEL_URL, delegate: "CPU" },
          runningMode: "VIDEO",
          maxResults: 5,
          scoreThreshold: 0.4,
        });
      } catch (error) {
        detectorPromise = null;
        throw error;
      }
    })();
  }

  return detectorPromise;
}

function isTennisRacket(name: string): boolean {
  return name.toLowerCase().includes("tennis");
}

type PixelBox = { originX: number; originY: number; width: number; height: number };

/**
 * Draws (or clears) a gold bounding box on the preview canvas overlay.
 * Accounts for the CSS `object-fit: cover` scaling and the horizontal mirror
 * applied to the video element so the box lines up with what the player sees.
 */
function drawPreviewBox(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  box: PixelBox | null,
): void {
  const w = canvas.offsetWidth;
  const h = canvas.offsetHeight;
  if (w === 0 || h === 0 || video.videoWidth === 0 || video.videoHeight === 0) return;

  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);

  if (!box) return;

  // Replicate object-fit: cover — scale uniformly so video fills the canvas.
  const scale = Math.max(w / video.videoWidth, h / video.videoHeight);
  const offsetX = (w - video.videoWidth * scale) / 2;
  const offsetY = (h - video.videoHeight * scale) / 2;

  // Mirror X to match the CSS scaleX(-1) on the video element.
  const mirroredOriginX = video.videoWidth - box.originX - box.width;

  const rx = mirroredOriginX * scale + offsetX;
  const ry = box.originY * scale + offsetY;
  const rw = box.width * scale;
  const rh = box.height * scale;

  ctx.strokeStyle = "#ffb43f";
  ctx.lineWidth = 2;
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 4;
  ctx.strokeRect(rx, ry, rw, rh);
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
  /** One Euro smoothing params; omit to use tuned defaults. */
  smoothing?: OneEuroOptions;
  /**
   * Canvas overlaid on the camera preview. When provided, the source draws the
   * tennis racket bounding box here each frame (clearing when nothing is found).
   */
  previewCanvas?: HTMLCanvasElement | null;
}>;

/**
 * MediaPipe-backed cursor source: the racket centre becomes the blade.
 *
 * Converts:  Camera → Video → ObjectDetector → CursorSample
 *
 * Camera coordinates are mirrored and expanded so comfortable racket movement
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
        const objectDetector = await getObjectDetector();
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
            const results = objectDetector.detectForVideo(video, nowMs);
            const racket = results.detections.find((d) =>
              d.categories.some((c) => isTennisRacket(c.categoryName)),
            );

            const box = racket?.boundingBox ?? null;

            if (options.previewCanvas) {
              drawPreviewBox(options.previewCanvas, video, box);
            }

            if (box) {
              const { originX, originY, width, height } = box;
              // Bounding box is in pixels; normalize to 0-1 using video dimensions.
              const normX = (originX + width / 2) / video.videoWidth;
              const normY = (originY + height / 2) / video.videoHeight;
              const mapped = mapCameraPointToArena(normX, normY);
              const smoothed = smoother.filter(mapped.x, mapped.y, nowMs);
              const score = racket?.categories[0]?.score ?? 1;
              listener({
                x: smoothed.x,
                y: smoothed.y,
                timestampMs: nowMs,
                confidence: score,
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
