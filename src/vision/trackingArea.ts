/**
 * Camera-to-arena coordinate mapping.
 *
 * MediaPipe reports the full camera frame, but asking a player to reach the
 * literal edges of that frame makes the arena feel cramped and position
 * sensitive. Expand the comfortable center 76% of the image to the whole game
 * surface, then clamp positions that go beyond it.
 */

export const CAMERA_INSET = 0.15;

function expandCoordinate(value: number): number {
  const expanded = (value - CAMERA_INSET) / (1 - CAMERA_INSET * 2);
  return Math.max(0, Math.min(1, expanded));
}

export function mapCameraPointToArena(cameraX: number, cameraY: number): { x: number; y: number } {
  return {
    // Mirror horizontally so the blade follows the player's screen-space hand.
    x: expandCoordinate(1 - cameraX),
    y: expandCoordinate(cameraY),
  };
}
