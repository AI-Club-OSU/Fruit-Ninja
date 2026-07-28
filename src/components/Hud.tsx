/**
 * In-arena heads-up display: score and remaining lives.
 *
 * Purely presentational — values arrive as props so the future score/state
 * owner can wire real data without touching this component.
 *
 * TODO(score): both values are placeholders until the score system lands.
 */

type HudProps = Readonly<{
  score: number;
  lives: number;
}>;

const MAX_LIVES = 3;

export default function Hud({ score, lives }: HudProps) {
  return (
    <div className="hud">
      <p className="hud-stat">
        <span className="hud-label">Score</span>
        <span className="hud-value">{score.toString().padStart(4, "0")}</span>
      </p>

      <p className="hud-stat hud-stat--end" aria-label={`${lives} of ${MAX_LIVES} lives remaining`}>
        <span className="hud-label">Lives</span>
        <span className="hud-lives" aria-hidden="true">
          {Array.from({ length: MAX_LIVES }, (_, index) => (
            <span key={index} className={index < lives ? "hud-life" : "hud-life hud-life--lost"}>
              ♥
            </span>
          ))}
        </span>
      </p>
    </div>
  );
}
