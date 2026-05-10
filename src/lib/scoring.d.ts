export type WineForScoring = { wineId: string; price: number | null };

/**
 * Builds, for each position index (0-based), the set of wineIds that are acceptable at that position,
 * accounting for tied prices (wines with equal price are interchangeable).
 */
export function buildAcceptableByPosition(wines: WineForScoring[]): Array<Set<string>>;

/**
 * Scores a submitted ranking against tie-aware acceptable-by-position sets.
 */
export function scoreRanking(acceptableByPosition: Array<Set<string>>, submitted: string[]): number;


