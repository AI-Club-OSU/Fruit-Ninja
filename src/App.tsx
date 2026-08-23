/**
 * Application shell and screen router.
 *
 * Owns the game state machine (menu → playing → paused → game over) via
 * `gameReducer`, and translates the Arena's score/life callbacks into actions.
 * Also tracks the camera/vision status so gameplay can wait behind a "starting
 * camera" screen and surface an error if the webcam is unavailable.
 *
 * `runId` bumps on every start/restart/retry so GameCanvas rebuilds a fresh
 * Arena and camera; pause/resume only flip `running`, so the board is preserved.
 */

import { type ReactNode, useCallback, useEffect, useReducer, useState } from "react";

import GameCanvas from "./components/GameCanvas.tsx";
import Hud from "./components/Hud.tsx";
import { gameReducer, initialGameState } from "./game/gameState.ts";
import type { VisionStatus } from "./vision/contracts.ts";

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);
  const [runId, setRunId] = useState(0);
  const [visionStatus, setVisionStatus] = useState<VisionStatus>("idle");

  // The camera runs only during a live session; game over ends it.
  const active = state.phase === "playing" || state.phase === "paused";
  const running = state.phase === "playing";
  const cameraReady = visionStatus === "ready";
  const cameraStarting =
    state.phase === "playing" &&
    (visionStatus === "idle" ||
      visionStatus === "requesting-camera" ||
      visionStatus === "loading-model");
  const cameraError = state.phase === "playing" && visionStatus === "error";

  const start = useCallback(() => {
    dispatch({ type: "start" });
    setVisionStatus("idle");
    setRunId((id) => id + 1);
  }, []);

  const restart = useCallback(() => {
    dispatch({ type: "restart" });
    setVisionStatus("idle");
    setRunId((id) => id + 1);
  }, []);

  const retryCamera = useCallback(() => {
    setVisionStatus("idle");
    setRunId((id) => id + 1);
  }, []);

  const onScore = useCallback((points: number) => dispatch({ type: "score", points }), []);
  const onLifeLost = useCallback(() => dispatch({ type: "loseLife" }), []);

  // Keyboard shortcuts: space to start/restart, P or Esc to pause/resume.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === " " && (state.phase === "menu" || state.phase === "gameOver")) {
        event.preventDefault();
        if (state.phase === "menu") {
          start();
        } else {
          restart();
        }
      } else if (event.key === "p" || event.key === "Escape") {
        if (state.phase === "playing" && cameraReady) dispatch({ type: "pause" });
        else if (state.phase === "paused") dispatch({ type: "resume" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.phase, cameraReady, start, restart]);

  return (
    <main className="game-shell selection:bg-amber-200 selection:text-zinc-950">
      <div className="arena">
        {active && (
          <GameCanvas
            running={running}
            runId={runId}
            onScore={onScore}
            onLifeLost={onLifeLost}
            onVisionStatus={setVisionStatus}
          />
        )}

        {active && <Hud score={state.score} best={state.best} lives={state.lives} />}

        {running && cameraReady && (
          <>
            <button
              className="pause-button"
              type="button"
              aria-label="Pause"
              onClick={() => dispatch({ type: "pause" })}
            >
              <span />
              <span />
            </button>
            <p className="arena-hint">
              Move naturally — clear hand motion slices · avoid the bombs
            </p>
          </>
        )}

        {state.phase === "menu" && <MenuScreen onStart={start} />}

        {cameraStarting && (
          <CameraStarting status={visionStatus} onCancel={() => dispatch({ type: "toMenu" })} />
        )}

        {cameraError && (
          <Overlay title="Camera unavailable">
            <p className="overlay-message">
              We couldn&rsquo;t reach your webcam. Check that no other app is using it and that the
              browser has camera permission, then try again.
            </p>
            <div className="overlay-actions">
              <button className="primary-action" type="button" onClick={retryCamera}>
                Try again
                <span aria-hidden="true">↻</span>
              </button>
              <button
                className="ghost-action"
                type="button"
                onClick={() => dispatch({ type: "toMenu" })}
              >
                Main menu
              </button>
            </div>
          </Overlay>
        )}

        {state.phase === "paused" && (
          <Overlay title="Paused">
            <div className="overlay-actions">
              <button
                className="primary-action"
                type="button"
                onClick={() => dispatch({ type: "resume" })}
              >
                Continue
              </button>
              <button className="ghost-action" type="button" onClick={restart}>
                Restart
              </button>
              <button
                className="ghost-action"
                type="button"
                onClick={() => dispatch({ type: "toMenu" })}
              >
                Quit
              </button>
            </div>
          </Overlay>
        )}

        {state.phase === "gameOver" && (
          <Overlay title="Game Over">
            <p className="overlay-score">
              <span>Score</span>
              <strong>{state.score.toString().padStart(5, "0")}</strong>
            </p>
            <p className="overlay-best">
              Best this session · {state.best.toString().padStart(5, "0")}
            </p>
            <div className="overlay-actions">
              <button className="primary-action" type="button" onClick={restart}>
                Play again
                <span aria-hidden="true">↗</span>
              </button>
              <button
                className="ghost-action"
                type="button"
                onClick={() => dispatch({ type: "toMenu" })}
              >
                Main menu
              </button>
            </div>
          </Overlay>
        )}
      </div>
    </main>
  );
}

function MenuScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="menu-screen">
      <p className="eyebrow">Computer vision arcade</p>
      <h1 className="game-title">
        Fruit
        <span>Ninja</span>
      </h1>
      <p className="menu-summary">
        Turn your webcam and one fingertip into the blade. Swipe through the fruit as it arcs, chain
        slices for combo bonuses — and whatever you do, don&rsquo;t cut the bombs.
      </p>

      <button className="primary-action primary-action--lg" type="button" onClick={onStart}>
        Start slicing
        <span aria-hidden="true">↗</span>
      </button>

      <p className="menu-note">
        Uses your webcam — your index fingertip controls the blade. Allow camera access when
        prompted; nothing leaves your device.
      </p>
    </div>
  );
}

function CameraStarting({ status, onCancel }: { status: VisionStatus; onCancel: () => void }) {
  const copy =
    status === "loading-model"
      ? { title: "Loading hand tracking", body: "Warming up the model — this only happens once." }
      : {
          title: "Starting camera",
          body: "Allow camera access when your browser asks. Point the webcam at your hand.",
        };

  return (
    <Overlay title={copy.title}>
      <p className="overlay-message">
        <span className="camera-pulse" aria-hidden="true" />
        {copy.body}
      </p>
      <div className="overlay-actions">
        <button className="ghost-action" type="button" onClick={onCancel}>
          Back to menu
        </button>
      </div>
    </Overlay>
  );
}

function Overlay({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overlay" role="dialog" aria-label={title}>
      <div className="overlay-card">
        <h2 className="overlay-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}
