/**
 * Tie-aware scoring utilities.
 *
 * Rule:
 * - Wines are ranked by price (highest -> lowest).
 * - If multiple wines share the same price, any ordering among them is equally correct.
 * - A player earns 1 point for each position where their submitted wine is in the acceptable set
 *   for that position (based on price ties).
 */

/**
 * @param {unknown} n
 * @returns {number}
 */
function normalizePrice(n) {
  return typeof n === 'number' && Number.isFinite(n) ? n : -Infinity;
}

/**
 * Builds, for each position index (0-based), the set of wineIds that are acceptable at that position.
 *
 * Example:
 * - Prices: A=30, B=20, C=20, D=10
 * - Acceptable sets:
 *   - pos0: {A}
 *   - pos1: {B,C}
 *   - pos2: {B,C}
 *   - pos3: {D}
 *
 * @param {Array<{ wineId: string, price: number | null }>} wines
 * @returns {Array<Set<string>>}
 */
export function buildAcceptableByPosition(wines) {
  const ordered = [...(wines ?? [])]
    .filter((w) => w && typeof w.wineId === 'string' && w.wineId.length > 0)
    .sort((a, b) => {
      const ap = normalizePrice(a.price);
      const bp = normalizePrice(b.price);
      if (bp !== ap) return bp - ap; // most expensive -> least expensive
      // Stable tie-breaker for determinism; does NOT affect correctness because we group ties.
      return a.wineId.localeCompare(b.wineId);
    });

  /** @type {Array<Set<string>>} */
  const acceptableByPosition = new Array(ordered.length);

  for (let i = 0; i < ordered.length; ) {
    const price = normalizePrice(ordered[i].price);
    const groupIds = [];
    let j = i;
    for (; j < ordered.length; j += 1) {
      if (normalizePrice(ordered[j].price) !== price) break;
      groupIds.push(ordered[j].wineId);
    }

    const set = new Set(groupIds);
    for (let k = i; k < j; k += 1) acceptableByPosition[k] = set;
    i = j;
  }

  return acceptableByPosition;
}

/**
 * Scores a submitted ranking against tie-aware acceptable-by-position sets.
 *
 * @param {Array<Set<string>>} acceptableByPosition
 * @param {string[]} submitted
 * @returns {number}
 */
export function scoreRanking(acceptableByPosition, submitted) {
  const len = Math.min(acceptableByPosition?.length ?? 0, submitted?.length ?? 0);
  let points = 0;
  const used = new Set();

  for (let i = 0; i < len; i += 1) {
    const id = submitted[i];
    if (typeof id !== 'string' || id.length === 0) continue;
    if (used.has(id)) continue;
    const acceptable = acceptableByPosition[i];
    if (acceptable && acceptable.has(id)) {
      points += 1;
      used.add(id);
    }
  }

  return points;
}


