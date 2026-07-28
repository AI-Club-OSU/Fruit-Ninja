/**
 * Application shell: landing copy, session control, and the game arena.
 *
 * Owns only the "is a session running" flag for now.
 * TODO(state machine): replace the boolean with idle/playing/paused/game-over
 * states once the game-state owner lands.
 */

import { useState } from "react";

import GameCanvas from "./components/GameCanvas.tsx";
import Hud from "./components/Hud.tsx";

export default function App() {
  const [isRunning, setIsRunning] = useState(false);

  return (
    <main className="app-shell selection:bg-lime-300 selection:text-zinc-950">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Fruit Ninja home">
          <span className="brand-mark" aria-hidden="true" />
          <span>FN / 001</span>
        </a>

        <p className="build-status">
          <span className="status-light" aria-hidden="true" />
          Arena online
        </p>
      </header>

      <section className="hero" id="top" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">Computer vision arcade</p>
          <h1 id="hero-title">
            Fruit
            <span>Ninja</span>
          </h1>
          <p className="hero-summary">
            Turn a webcam and one fingertip into the blade. Fruit is live in the arena — swipe fast
            to register a slash.
          </p>

          <div className="hero-action">
            <button
              className="primary-action"
              type="button"
              aria-pressed={isRunning}
              onClick={() => setIsRunning((running) => !running)}
            >
              {isRunning ? "End session" : "Start slicing"}
              <span aria-hidden="true">↗</span>
            </button>
            <p>Pointer input for now. Camera stays off until the MediaPipe adapter lands.</p>
          </div>
        </div>

        <div className="game-arena">
          {/* TODO(score): wire real score/lives once those systems exist. */}
          <Hud score={0} lives={3} />

          <div className="stage-grid" aria-hidden="true" />

          <GameCanvas running={isRunning} />

          <p className="stage-instruction">
            {isRunning ? "Swipe through the fruit" : "Start a session to spawn fruit"}
          </p>
        </div>
      </section>

      <footer className="system-rail" aria-label="Project foundation status">
        <p>
          <span>01</span>
          Canvas arena live
        </p>
        <p>
          <span>02</span>
          Slash detection armed
        </p>
        <p>
          <span>03</span>
          MediaPipe adapter pending
        </p>
      </footer>
    </main>
  );
}
