export type LeaderboardEntry = { username: string; score: number };

export type RecordResult = { board: LeaderboardEntry[]; isNewBest: boolean };

export function recordScore(
  board: LeaderboardEntry[],
  username: string,
  score: number,
): RecordResult {
  const existing = board.find((e) => e.username === username);
  const isNewBest = !existing || score > existing.score;
  let updated: LeaderboardEntry[];
  if (!existing) {
    updated = [...board, { username, score }];
  } else if (score > existing.score) {
    updated = board.map((e) => (e.username === username ? { username, score } : e));
  } else {
    updated = [...board];
  }
  updated.sort((a, b) => b.score - a.score);
  return { board: updated.slice(0, 10), isNewBest };
}
