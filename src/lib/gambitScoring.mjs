/**
 * Sommelier's Gambit scoring helpers.
 *
 * Gambit is intentionally NOT modeled as a normal round:
 * - It uses all wines (not the per-round assignment list)
 * - Scoring is asymmetric: +1 cheapest, +2 most expensive (favorites are 0 points)
 * - It is revealed only once the host finishes the game
 */

export const GAMBIT_MAX_POINTS = 3;

/**
 * @param {unknown} n
 * @returns {number | null} integer cents (rounded), or null when missing/invalid
 */
function normalizeToCents(n) {
  if (typeof n === 'number' && Number.isFinite(n)) return Math.round(n * 100);
  return null;
}

/**
 * Given a wine list (with normalized numeric prices), returns the tie-aware cheapest/most-expensive sets.
 *
 * @param {Array<{ wineId: string, price: number | null }>} wines
 * @returns {{ hasPrices: boolean, cheapestIds: Set<string>, mostExpensiveIds: Set<string> }}
 */
export function getGambitMinMaxSets(wines) {
  /** @type {Array<{ id: string, cents: number }>} */
  const pricedOnly = [];

  for (const w of wines ?? []) {
    if (!w || typeof w.wineId !== 'string' || w.wineId.length === 0) continue;
    const cents = normalizeToCents(w.price);
    if (typeof cents === 'number' && Number.isFinite(cents)) pricedOnly.push({ id: w.wineId, cents });
  }

  if (!pricedOnly.length) {
    return { hasPrices: false, cheapestIds: new Set(), mostExpensiveIds: new Set() };
  }

  const minCents = Math.min(...pricedOnly.map((x) => x.cents));
  const maxCents = Math.max(...pricedOnly.map((x) => x.cents));

  const cheapestIds = new Set(pricedOnly.filter((x) => x.cents === minCents).map((x) => x.id));
  const mostExpensiveIds = new Set(pricedOnly.filter((x) => x.cents === maxCents).map((x) => x.id));

  return { hasPrices: true, cheapestIds, mostExpensiveIds };
}

/**
 * @param {{ cheapestPickId: string | null, mostExpensivePickId: string | null }} picks
 * @param {{ cheapestIds: Set<string>, mostExpensiveIds: Set<string> }} sets
 * @returns {{ cheapestPoints: number, mostExpensivePoints: number, totalPoints: number, maxPoints: number }}
 */
export function scoreGambitPicks(picks, sets) {
  const cheapestPickId = picks?.cheapestPickId ?? null;
  const mostExpensivePickId = picks?.mostExpensivePickId ?? null;

  const cheapestPoints = cheapestPickId && sets?.cheapestIds?.has(cheapestPickId) ? 1 : 0;
  const mostExpensivePoints = mostExpensivePickId && sets?.mostExpensiveIds?.has(mostExpensivePickId) ? 2 : 0;
  const totalPoints = cheapestPoints + mostExpensivePoints;

  return { cheapestPoints, mostExpensivePoints, totalPoints, maxPoints: GAMBIT_MAX_POINTS };
}


