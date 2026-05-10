/**
 * Leaderboard gating helpers.
 *
 * The Sommelier's Gambit is a post-game bonus. Players may submit Gambit picks during the `gambit`
 * phase, but points should NOT appear on the leaderboard until the host closes the game and reveals
 * results (status becomes `finished`).
 */

/**
 * @param {'setup' | 'lobby' | 'in_progress' | 'gambit' | 'finished'} status
 * @returns {boolean}
 */
export function shouldIncludeGambitPoints(status) {
  return status === 'finished';
}


