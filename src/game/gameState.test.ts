import { describe, expect, it } from "vite-plus/test";

import { STARTING_LIVES, gameReducer, initialGameState, type GameState } from "./gameState.ts";

function playing(overrides: Partial<GameState> = {}): GameState {
  return { phase: "playing", score: 0, lives: STARTING_LIVES, best: 0, ...overrides };
}

describe("game state machine", () => {
  it("starts a fresh run from the menu", () => {
    const next = gameReducer(initialGameState, { type: "start" });

    expect(next.phase).toBe("playing");
    expect(next.score).toBe(0);
    expect(next.lives).toBe(STARTING_LIVES);
  });

  it("ignores start unless on the menu", () => {
    const state = playing({ score: 40 });
    expect(gameReducer(state, { type: "start" })).toBe(state);
  });

  it("accrues score only while playing", () => {
    expect(gameReducer(playing(), { type: "score", points: 3 }).score).toBe(3);

    const paused = playing({ phase: "paused", score: 10 });
    expect(gameReducer(paused, { type: "score", points: 3 }).score).toBe(10);
  });

  it("pauses and resumes", () => {
    const paused = gameReducer(playing({ score: 5 }), { type: "pause" });
    expect(paused.phase).toBe("paused");
    expect(paused.score).toBe(5);

    const resumed = gameReducer(paused, { type: "resume" });
    expect(resumed.phase).toBe("playing");
  });

  it("loses lives and ends the game at zero, recording best", () => {
    let state = playing({ lives: 2, score: 120 });

    state = gameReducer(state, { type: "loseLife" });
    expect(state.lives).toBe(1);
    expect(state.phase).toBe("playing");

    state = gameReducer(state, { type: "loseLife" });
    expect(state.lives).toBe(0);
    expect(state.phase).toBe("gameOver");
    expect(state.best).toBe(120);
  });

  it("keeps best across a restart", () => {
    const over = gameReducer(playing({ lives: 1, score: 90 }), { type: "loseLife" });
    expect(over.best).toBe(90);

    const again = gameReducer(over, { type: "restart" });
    expect(again.phase).toBe("playing");
    expect(again.score).toBe(0);
    expect(again.lives).toBe(STARTING_LIVES);
    expect(again.best).toBe(90);
  });

  it("does not overwrite a higher best with a lower score", () => {
    const over = gameReducer(playing({ lives: 1, score: 30, best: 200 }), { type: "loseLife" });
    expect(over.best).toBe(200);
  });

  it("returns to the menu while preserving best", () => {
    const menu = gameReducer(playing({ score: 50, best: 75 }), { type: "toMenu" });
    expect(menu.phase).toBe("menu");
    expect(menu.score).toBe(0);
    expect(menu.best).toBe(75);
  });
});
