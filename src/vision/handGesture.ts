/**
 * Hand-gesture classification at the vision boundary.
 *
 * Turns raw MediaPipe hand landmarks into the coarse, game-meaningful signals
 * the rest of the app understands (currently: "is the hand a closed fist?").
 * Keeping this here honours the architecture rule that game logic never touches
 * landmark objects directly — the cursor source translates landmarks into
 * semantic gestures before they cross into gameplay.
 *
 * Pure and framework-free so it can be unit-tested without a camera.
 */

/** A single 2D hand landmark in normalized image space (0..1). */
export type Landmark = Readonly<{ x: number; y: number }>;

/** MediaPipe hand landmark indices used for curl detection. */
const WRIST = 0;
// [tip, pip] pairs for the four non-thumb fingers.
const FINGERS: readonly (readonly [number, number])[] = [
  [8, 6], // index
  [12, 10], // middle
  [16, 14], // ring
  [20, 18], // pinky
];

/** How many of the four fingers must be curled to count the hand as a fist. */
const FIST_CURLED_THRESHOLD = 3;

function distanceSquared(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/**
 * True when the hand reads as a closed fist.
 *
 * For each finger we compare how far the tip sits from the wrist against how
 * far the middle (PIP) joint sits from the wrist: an extended finger reaches
 * past its knuckle, a curled one folds back inside it. Using distance-to-wrist
 * ratios keeps the test independent of hand size, position, and rotation.
 */
export function isFist(landmarks: readonly Landmark[] | undefined): boolean {
  if (!landmarks || landmarks.length < 21) {
    return false;
  }

  const wrist = landmarks[WRIST];
  if (!wrist) {
    return false;
  }

  let curled = 0;
  for (const [tipIndex, pipIndex] of FINGERS) {
    const tip = landmarks[tipIndex];
    const pip = landmarks[pipIndex];
    if (!tip || !pip) {
      continue;
    }
    if (distanceSquared(tip, wrist) < distanceSquared(pip, wrist)) {
      curled += 1;
    }
  }

  return curled >= FIST_CURLED_THRESHOLD;
}
