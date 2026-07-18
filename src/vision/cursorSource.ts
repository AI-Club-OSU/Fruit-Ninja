/**
 * Generic cursor input boundary between the game and any tracking hardware.
 *
 * Responsibility: define the sample shape and subscription contract the game
 * consumes, plus a pointer-based implementation for the prototype. The game
 * never learns whether samples came from a mouse, a touch screen, or a
 * MediaPipe hand — the CV team swaps in their own CursorSource later without
 * touching game code.
 *
 * TODO(vision): the hand-tracking owner implements a MediaPipe-backed
 * CursorSource that translates whichever landmark the team picks (fingertip,
 * bounding-box center, …) into these normalized samples. See contracts.ts
 * for the camera/model lifecycle contract.
 */

export type CursorSample = Readonly<{
  /** Horizontal position in arena units, 0 (left) to 1 (right). */
  x: number;
  /** Vertical position in arena units, 0 (top) to 1 (bottom). */
  y: number;
  timestampMs: number;
  /** Detection confidence, 0..1. Pointer input is always 1. */
  confidence: number;
}>;

export type CursorListener = (sample: CursorSample) => void;

export interface CursorSource {
  /** Start receiving samples; returns an unsubscribe function. */
  subscribe(listener: CursorListener): () => void;
}

/**
 * Prototype input: mouse/touch/pen movement over `element`, normalized to the
 * element's bounds. Stands in for hand tracking during UI development.
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
      return () => element.removeEventListener("pointermove", handlePointerMove);
    },
  };
}
