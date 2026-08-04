/**
 * Top-level game state machine: which screen is showing plus the run's score
 * and lives.
 *
 * Responsibility: own the deterministic transitions between menu → playing →
 * paused → game over → restart, and the score/lives bookkeeping that drives the
 * HUD. This is pure data + a reducer with no React or DOM coupling, so it is
 * unit-testable and the App component stays a thin dispatcher.
 *
 * The arena (fruit, particles, slicing) is a separate concern; it reports
 * "fruit sliced" / "life lost" outcomes which the App translates into the
 * `score` / `loseLife` actions here.
 */

export type GamePhase = "menu" | "playing" | "paused" | "gameOver";

/** Lives a fresh run starts with. */
export const STARTING_LIVES = 3;

export type GameState = Readonly<{
  phase: GamePhase;
  score: number;
  lives: number;
  /** Best score seen this session; survives restarts, resets with the tab. */
  best: number;
}>;

export type GameAction =
  | { type: "start" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "score"; points: number }
  | { type: "loseLife" }
  | { type: "restart" }
  | { type: "toMenu" };

export const initialGameState: GameState = {
  phase: "menu",
  score: 0,
  lives: STARTING_LIVES,
  best: 0,
};

/** A clean run at full lives and zero score, preserving `best`. */
function freshRun(best: number): GameState {
  return { phase: "playing", score: 0, lives: STARTING_LIVES, best };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "start":
      return state.phase === "menu" ? freshRun(state.best) : state;

    case "pause":
      return state.phase === "playing" ? { ...state, phase: "paused" } : state;

    case "resume":
      return state.phase === "paused" ? { ...state, phase: "playing" } : state;

    case "score":
      // Points only accrue during live play, so stray slashes on a paused or
      // finished board never move the score.
      if (state.phase !== "playing") {
        return state;
      }
      return { ...state, score: state.score + action.points };

    case "loseLife": {
      if (state.phase !== "playing") {
        return state;
      }
      const lives = Math.max(0, state.lives - 1);
      if (lives === 0) {
        return { ...state, lives, phase: "gameOver", best: Math.max(state.best, state.score) };
      }
      return { ...state, lives };
    }

    case "restart":
      // Reachable from game over (play again) or a pause menu (give up + retry).
      return freshRun(state.best);

    case "toMenu":
      return { ...initialGameState, best: state.best };

    default:
      return state;
  }
}
