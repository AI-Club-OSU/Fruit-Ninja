import { useState, type PointerEvent } from "react";

const targets = [
  { name: "lime", className: "target target--lime" },
  { name: "orange", className: "target target--orange" },
  { name: "watermelon", className: "target target--melon" },
] as const;

function updateBladePosition(event: PointerEvent<HTMLDivElement>) {
  const bounds = event.currentTarget.getBoundingClientRect();
  const x = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left));
  const y = Math.max(0, Math.min(bounds.height, event.clientY - bounds.top));

  event.currentTarget.style.setProperty("--blade-x", `${x}px`);
  event.currentTarget.style.setProperty("--blade-y", `${y}px`);
}

export default function App() {
  const [isArmed, setIsArmed] = useState(false);

  return (
    <main className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Fruit Ninja home">
          <span className="brand-mark" aria-hidden="true" />
          <span>FN / 001</span>
        </a>

        <p className="build-status">
          <span className="status-light" aria-hidden="true" />
          Foundation online
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
            Turn a webcam and one fingertip into the blade. The arena is ready for hand tracking,
            physics, and fruit.
          </p>

          <div className="hero-action">
            <button
              className="primary-action"
              type="button"
              aria-pressed={isArmed}
              onClick={() => setIsArmed((armed) => !armed)}
            >
              {isArmed ? "Pause training stage" : "Arm training stage"}
              <span aria-hidden="true">↗</span>
            </button>
            <p>Camera remains off until the MediaPipe adapter lands.</p>
          </div>
        </div>

        <div
          className={`training-stage${isArmed ? " training-stage--armed" : ""}`}
          onPointerMove={updateBladePosition}
        >
          <div className="stage-topline">
            <span>{isArmed ? "Pointer tracking active" : "Training stage idle"}</span>
            <span>60 FPS target</span>
          </div>

          <div className="stage-grid" aria-hidden="true" />
          <div className="stage-orbit stage-orbit--outer" aria-hidden="true" />
          <div className="stage-orbit stage-orbit--inner" aria-hidden="true" />

          {targets.map((target) => (
            <span className={target.className} key={target.name} aria-hidden="true">
              <span className="target-leaf" />
            </span>
          ))}

          <div className="blade-trail" aria-hidden="true" />
          <div className="blade-point" aria-hidden="true" />

          <p className="stage-instruction">
            {isArmed ? "Move your pointer through the targets" : "Arm the stage to test input"}
          </p>
        </div>
      </section>

      <footer className="system-rail" aria-label="Project foundation status">
        <p>
          <span>01</span>
          React + TypeScript
        </p>
        <p>
          <span>02</span>
          MediaPipe Tasks Vision
        </p>
        <p>
          <span>03</span>
          Gesture math isolated
        </p>
      </footer>
    </main>
  );
}
