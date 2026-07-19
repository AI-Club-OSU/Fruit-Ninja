"""Hand landmark tracking, ported from the browser poseDetector.js reference.

The reference implementation is a lazy-singleton landmarker plus a session object
with a stop(), driven by requestAnimationFrame. This keeps that shape:

    get_landmarker()      <- lazy singleton, built once
    create_hand_session() <- returns a session you drive, with .stop()

Differences forced by the Python runtime are marked FIXME/NOTE inline.
"""

from __future__ import annotations

import time
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional

import cv2
import mediapipe as mp

BaseOptions = mp.tasks.BaseOptions
HandLandmarker = mp.tasks.vision.HandLandmarker
HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

# The JS version passes a URL straight to modelAssetPath. Python's BaseOptions
# only accepts a local file, so the model is fetched once and cached next to
# this file.
MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker"
    "/hand_landmarker/float16/1/hand_landmarker.task"
)
MODEL_PATH = Path(__file__).parent / "hand_landmarker.task"

# Index of the index-finger tip in the 21-point hand topology. This is the
# point that becomes the blade in the game.
INDEX_FINGER_TIP = 8

# Equivalent of POSE_CONNECTIONS from the reference, for the hand topology.
HAND_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 4),          # thumb
    (0, 5), (5, 6), (6, 7), (7, 8),          # index
    (5, 9), (9, 10), (10, 11), (11, 12),     # middle
    (9, 13), (13, 14), (14, 15), (15, 16),   # ring
    (13, 17), (17, 18), (18, 19), (19, 20),  # pinky
    (0, 17),                                 # palm base
]

# BGR, one per tracked hand.
HAND_COLOURS = [
    (0, 255, 120),   # green
    (255, 160, 0),   # blue
]

_landmarker: Optional[HandLandmarker] = None


def _ensure_model() -> Path:
    """Download the .task model on first run."""
    if not MODEL_PATH.exists():
        print(f"downloading hand model -> {MODEL_PATH.name}")
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
    return MODEL_PATH


def get_landmarker() -> HandLandmarker:
    """Lazy singleton, mirroring getLandmarker() in the reference."""
    global _landmarker
    if _landmarker is None:
        _landmarker = HandLandmarker.create_from_options(
            HandLandmarkerOptions(
                # NOTE: the reference uses delegate 'GPU'. The Python build has
                # no GPU delegate on Windows, so this stays on CPU.
                base_options=BaseOptions(model_asset_path=str(_ensure_model())),
                running_mode=VisionRunningMode.VIDEO,
                num_hands=2,
            )
        )
    return _landmarker


@dataclass
class Fingertip:
    """Normalized 0..1 coords plus a capture time, matching TrackingPoint in
    src/game/swipe.ts so this can feed the existing gesture math.

    handedness lets callers keep a separate swipe history per hand, which
    matters because two blades need two independent point trails.
    """

    x: float
    y: float
    captured_at_ms: int
    handedness: str  # "left" | "right" | "unknown"


def _handedness_of(result, index: int) -> str:
    """MediaPipe labels handedness assuming a mirrored (selfie) image, which is
    what run() feeds it, so the labels come back already correct for the user."""
    try:
        return result.handedness[index][0].category_name.lower()
    except (AttributeError, IndexError):
        return "unknown"


def to_fingertips(result, timestamp_ms: int) -> list[Fingertip]:
    """Translate a raw MediaPipe result into plain points, one per hand.

    Keeping this here means nothing downstream has to know about MediaPipe
    objects, same as the vision boundary the frontend uses.
    """
    tips = []
    for i, hand in enumerate(result.hand_landmarks):
        tip = hand[INDEX_FINGER_TIP]
        tips.append(
            Fingertip(
                x=tip.x,
                y=tip.y,
                captured_at_ms=timestamp_ms,
                handedness=_handedness_of(result, i),
            )
        )
    return tips


class HandSession:
    """Equivalent of createPoseSession(). Call run() to drive it, stop() to end."""

    def __init__(self, on_frame: Callable, camera_index: int = 0, preview: bool = True):
        self.on_frame = on_frame
        self.camera_index = camera_index
        self.preview = preview
        self._running = False
        self._last_timestamp = -1

        # FIXME(from test.py): the old script hardcoded VideoCapture(1) because
        # index 0 was an iPhone via Continuity Camera on the author's Mac. On
        # Windows the webcam is index 0, and CAP_DSHOW avoids a ~2s open delay.
        self.cap = cv2.VideoCapture(camera_index, cv2.CAP_DSHOW)

    def run(self) -> None:
        if not self.cap.isOpened():
            raise RuntimeError(
                f"could not open camera {self.camera_index}. "
                "Try a different index, or check that no other app holds the webcam."
            )

        landmarker = get_landmarker()
        self._running = True
        start = time.perf_counter()

        while self._running and self.cap.isOpened():
            ok, frame = self.cap.read()
            if not ok:
                break

            # Mirror the frame so moving right on screen matches moving right
            # in real life.
            frame = cv2.flip(frame, 1)

            # detect_for_video requires strictly increasing integer ms. The JS
            # version leans on performance.now(); this is the equivalent.
            ts = int((time.perf_counter() - start) * 1000)
            if ts <= self._last_timestamp:
                ts = self._last_timestamp + 1
            self._last_timestamp = ts

            mp_image = mp.Image(
                image_format=mp.ImageFormat.SRGB,
                data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB),
            )

            # VIDEO mode is synchronous and returns the result directly, unlike
            # the LIVE_STREAM callback style in test.py. Ordering is guaranteed,
            # which the swipe math depends on.
            result = landmarker.detect_for_video(mp_image, ts)

            if result.hand_landmarks:
                self.on_frame(result, ts)

            if self.preview:
                self._draw(frame, result)
                cv2.imshow("hand tracking (q to quit)", frame)
                # Unlike test.py, this gives the window a chance to repaint and
                # provides an actual exit.
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break

        self.stop()

    def _draw(self, frame, result) -> None:
        if not result.hand_landmarks:
            return
        h, w = frame.shape[:2]
        for hand_index, hand in enumerate(result.hand_landmarks):
            # Distinct colour per hand so two blades stay readable on screen.
            skeleton = HAND_COLOURS[hand_index % len(HAND_COLOURS)]
            pts = [(int(p.x * w), int(p.y * h)) for p in hand]

            for a, b in HAND_CONNECTIONS:
                cv2.line(frame, pts[a], pts[b], skeleton, 2)
            for i, pt in enumerate(pts):
                colour = (0, 90, 255) if i == INDEX_FINGER_TIP else (255, 255, 255)
                cv2.circle(frame, pt, 6 if i == INDEX_FINGER_TIP else 3, colour, -1)

            label = _handedness_of(result, hand_index)
            cv2.putText(
                frame, label, pts[0], cv2.FONT_HERSHEY_SIMPLEX, 0.6, skeleton, 2
            )

    def stop(self) -> None:
        self._running = False
        if self.cap.isOpened():
            self.cap.release()
        if self.preview:
            cv2.destroyAllWindows()


def create_hand_session(on_frame, camera_index: int = 0, preview: bool = True) -> HandSession:
    return HandSession(on_frame, camera_index=camera_index, preview=preview)


if __name__ == "__main__":

    def on_frame(result, ts):
        for tip in to_fingertips(result, ts):
            print(f"{ts:>7}ms  {tip.handedness:>5}  x={tip.x:.3f}  y={tip.y:.3f}")

    session = create_hand_session(on_frame)
    try:
        session.run()
    except KeyboardInterrupt:
        session.stop()
