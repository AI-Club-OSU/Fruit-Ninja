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

import { type ReactNode, useCallback, useEffect, useReducer, useRef, useState } from "react";

import GameCanvas from "./components/GameCanvas.tsx";
import Hud from "./components/Hud.tsx";
import { gameReducer, initialGameState } from "./game/gameState.ts";
import { type LeaderboardEntry, recordScore } from "./game/leaderboard.ts";
import type { VisionStatus } from "./vision/contracts.ts";

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);
  const [runId, setRunId] = useState(0);
  const [visionStatus, setVisionStatus] = useState<VisionStatus>("idle");
  const [username, setUsername] = useState("");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isNewBest, setIsNewBest] = useState(false);

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

  // Save score and refresh leaderboard when a run ends.
  const usernameRef = useRef(username);
  usernameRef.current = username;
  useEffect(() => {
    if (state.phase !== "gameOver") return;
    const name = usernameRef.current.trim();
    if (name) {
      const { board, isNewBest: newBest } = recordScore(leaderboard, name, state.score);
      setLeaderboard(board);
      setIsNewBest(newBest);
    } else {
      setIsNewBest(false);
    }
    // Intentionally omit state.score — it won't change while phase is gameOver.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  // Keyboard shortcuts: space to start/restart, P or Esc to pause/resume.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === " " && (state.phase === "menu" || state.phase === "gameOver")) {
        event.preventDefault();
        if (state.phase === "menu") {
          if (username.trim()) start();
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
  }, [state.phase, cameraReady, start, restart, username]);

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

        {state.phase === "menu" && (
          <MenuScreen
            username={username}
            onUsernameChange={setUsername}
            onStart={start}
            leaderboard={leaderboard}
          />
        )}

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
          <Overlay title="Game Over" wide>
            <p className="overlay-score">
              <span>Score</span>
              <strong>{state.score.toString().padStart(5, "0")}</strong>
            </p>
            {isNewBest && username.trim() && (
              <p className="overlay-new-best">New personal best!</p>
            )}
            <LeaderboardTable entries={leaderboard} currentUsername={username.trim()} />
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

function MenuScreen({
  username,
  onUsernameChange,
  onStart,
  leaderboard,
}: {
  username: string;
  onUsernameChange: (v: string) => void;
  onStart: () => void;
  leaderboard: LeaderboardEntry[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    if (username.trim()) onStart();
  };

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

      <form className="username-group" onSubmit={handleSubmit}>
        <label className="username-label" htmlFor="username-input">
          Your name
        </label>
        <input
          id="username-input"
          ref={inputRef}
          className="username-input"
          type="text"
          placeholder="Enter name…"
          maxLength={20}
          autoComplete="off"
          autoFocus
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
        />
      </form>

      <button
        className="primary-action primary-action--lg"
        type="button"
        disabled={!username.trim()}
        onClick={() => { if (username.trim()) onStart(); }}
      >
        Start slicing
        <span aria-hidden="true">↗</span>
      </button>

      {leaderboard.length > 0 && (
        <div className="menu-leaderboard">
          <p className="menu-leaderboard-title">Leaderboard</p>
          <LeaderboardTable entries={leaderboard} currentUsername={username.trim()} />
        </div>
      )}

      <p className="menu-note">
        Uses your webcam — your index fingertip controls the blade. Allow camera access when
        prompted; nothing leaves your device.
      </p>
    </div>
  );
}

function LeaderboardTable({
  entries,
  currentUsername,
}: {
  entries: LeaderboardEntry[];
  currentUsername: string;
}) {
  if (entries.length === 0) return null;
  return (
    <table className="leaderboard" aria-label="Leaderboard">
      <thead>
        <tr>
          <th className="leaderboard-rank">#</th>
          <th className="leaderboard-name">Player</th>
          <th className="leaderboard-score">Score</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry, i) => {
          const isCurrent =
            currentUsername && entry.username.toLowerCase() === currentUsername.toLowerCase();
          return (
            <tr key={entry.username} className={isCurrent ? "leaderboard-row--current" : ""}>
              <td className="leaderboard-rank">{i === 0 ? "★" : `${i + 1}`}</td>
              <td className="leaderboard-name">{entry.username}</td>
              <td className="leaderboard-score">{entry.score.toString().padStart(5, "0")}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
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

function Overlay({
  title,
  wide,
  children,
}: {
  title: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="overlay" role="dialog" aria-label={title}>
      <div className={wide ? "overlay-card overlay-card--wide" : "overlay-card"}>
        <h2 className="overlay-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}
