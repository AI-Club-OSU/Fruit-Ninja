import { expect, test } from "vite-plus/test";

import { isFist, type Landmark } from "./handGesture.ts";

/**
 * Build a 21-landmark hand where every non-thumb finger is either extended
 * (tip reaches above the wrist) or curled (tip folds back below its knuckle).
 * The wrist sits at the bottom; smaller y is "up" toward the fingertips.
 */
function makeHand(extended: boolean): Landmark[] {
  const landmarks: Landmark[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }));
  landmarks[0] = { x: 0.5, y: 0.9 }; // wrist, low on screen

  const tips = [8, 12, 16, 20];
  const pips = [6, 10, 14, 18];
  for (let i = 0; i < tips.length; i += 1) {
    const pipIndex = pips[i]!;
    const tipIndex = tips[i]!;
    landmarks[pipIndex] = { x: 0.5, y: 0.55 }; // knuckle, mid-hand
    // Extended: tip is farther from the wrist than the knuckle (higher up).
    // Curled: tip folds back, closer to the wrist than the knuckle.
    landmarks[tipIndex] = { x: 0.5, y: extended ? 0.3 : 0.7 };
  }
  return landmarks;
}

test("an open hand is not a fist", () => {
  expect(isFist(makeHand(true))).toBe(false);
});

test("a closed hand is a fist", () => {
  expect(isFist(makeHand(false))).toBe(true);
});

test("one stray extended finger still counts as a fist", () => {
  const hand = makeHand(false);
  hand[8] = { x: 0.5, y: 0.2 }; // index finger flicks out
  expect(isFist(hand)).toBe(true);
});

test("two extended fingers is not a fist", () => {
  const hand = makeHand(false);
  hand[8] = { x: 0.5, y: 0.2 };
  hand[12] = { x: 0.5, y: 0.2 };
  expect(isFist(hand)).toBe(false);
});

test("missing or short landmark arrays are not a fist", () => {
  expect(isFist(undefined)).toBe(false);
  expect(isFist([])).toBe(false);
  expect(isFist([{ x: 0.5, y: 0.5 }])).toBe(false);
});
