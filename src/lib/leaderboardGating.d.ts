export type GameStatus = 'setup' | 'lobby' | 'in_progress' | 'gambit' | 'finished';

/**
 * True iff Gambit bonus points should be included in leaderboard totals/deltas.
 */
export function shouldIncludeGambitPoints(status: GameStatus): boolean;


