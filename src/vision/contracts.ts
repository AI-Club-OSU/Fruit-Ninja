import type { TrackingPoint } from "../game/swipe.ts";

export type VisionStatus = "idle" | "requesting-camera" | "loading-model" | "ready" | "error";

export type HandFrame = Readonly<{
  fingertip: TrackingPoint;
  handedness: "left" | "right" | "unknown";
  confidence: number;
}>;

export type HandFrameListener = (frame: HandFrame) => void;

export interface HandTracker {
  readonly status: VisionStatus;
  start(video: HTMLVideoElement): Promise<void>;
  subscribe(listener: HandFrameListener): () => void;
  stop(): void;
}
