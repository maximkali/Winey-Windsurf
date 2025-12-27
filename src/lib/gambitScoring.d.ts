export const GAMBIT_MAX_POINTS: 3;

export type WineForGambit = { wineId: string; price: number | null };

export function getGambitMinMaxSets(wines: WineForGambit[]): {
  hasPrices: boolean;
  cheapestIds: Set<string>;
  mostExpensiveIds: Set<string>;
};

export function scoreGambitPicks(
  picks: { cheapestPickId: string | null; mostExpensivePickId: string | null },
  sets: { cheapestIds: Set<string>; mostExpensiveIds: Set<string> }
): { cheapestPoints: number; mostExpensivePoints: number; totalPoints: number; maxPoints: number };


