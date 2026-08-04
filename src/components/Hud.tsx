/**
 * In-arena heads-up display: score, best, and remaining lives.
 *
 * Purely presentational — values arrive as props from the game state machine
 * so this component never owns game data.
 */

import { STARTING_LIVES } from "../game/gameState.ts";

type HudProps = Readonly<{
  score: number;
  best: number;
  lives: number;
}>;

export default function Hud({ score, best, lives }: HudProps) {
  return (
    <div className="hud">
      <div className="hud-scores">
        <p className="hud-stat">
          <span className="hud-label">Score</span>
          <span className="hud-value">{score.toString().padStart(5, "0")}</span>
        </p>
        <p className="hud-stat hud-stat--best">
          <span className="hud-label">Best</span>
          <span className="hud-best">{best.toString().padStart(5, "0")}</span>
        </p>
      </div>

      <p
        className="hud-stat hud-stat--end"
        aria-label={`${lives} of ${STARTING_LIVES} lives remaining`}
      >
        <span className="hud-label">Lives</span>
        <span className="hud-lives" aria-hidden="true">
          {Array.from({ length: STARTING_LIVES }, (_, index) => (
            <span key={index} className={index < lives ? "hud-pip" : "hud-pip hud-pip--lost"} />
          ))}
        </span>
      </p>
    </div>
  );
}
