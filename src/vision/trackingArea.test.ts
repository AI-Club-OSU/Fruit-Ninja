import { describe, expect, it } from "vite-plus/test";

import { CAMERA_INSET, mapCameraPointToArena } from "./trackingArea.ts";

describe("camera-to-arena mapping", () => {
  it("keeps the camera center at the arena center", () => {
    expect(mapCameraPointToArena(0.5, 0.5)).toEqual({ x: 0.5, y: 0.5 });
  });

  it("expands the comfortable center of the camera to the full arena", () => {
    const topLeft = mapCameraPointToArena(1 - CAMERA_INSET, CAMERA_INSET);
    const bottomRight = mapCameraPointToArena(CAMERA_INSET, 1 - CAMERA_INSET);

    expect(topLeft.x).toBeCloseTo(0);
    expect(topLeft.y).toBeCloseTo(0);
    expect(bottomRight.x).toBeCloseTo(1);
    expect(bottomRight.y).toBeCloseTo(1);
  });

  it("clamps hands outside the comfortable area to the arena edges", () => {
    expect(mapCameraPointToArena(1, -0.1)).toEqual({ x: 0, y: 0 });
    expect(mapCameraPointToArena(0, 1.1)).toEqual({ x: 1, y: 1 });
  });
});
