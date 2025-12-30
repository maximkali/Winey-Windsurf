export type WineySetup = {
  players: number;
  bottles: number;
  rounds: number;
  bottlesPerRound: number;
  bottleEqPerPerson: number;
  ozPerPersonPerBottle: number;
};

// Allowed setup constraints:
// - players: 6..24
// - rounds: 2..5
// - bottlesPerRound: 3..4
// - bottles = rounds * bottlesPerRound (evenly split across rounds)
// - bottleEqPerPerson = bottles / players must be in [0.25, 1.0]
//
// Note: `ozPerPersonPerBottle` values match the previously shipped rounding style
// (notably: 16 players uses 1.58).
export const wineySetups: WineySetup[] = [
  // players: 6 (ozPerPersonPerBottle: 4.23)
  { players: 6, bottles: 6, rounds: 2, bottlesPerRound: 3, bottleEqPerPerson: 1.0, ozPerPersonPerBottle: 4.23 },

  // players: 7 (ozPerPersonPerBottle: 3.62)
  { players: 7, bottles: 6, rounds: 2, bottlesPerRound: 3, bottleEqPerPerson: 0.86, ozPerPersonPerBottle: 3.62 },

  // players: 8 (ozPerPersonPerBottle: 3.17)
  { players: 8, bottles: 6, rounds: 2, bottlesPerRound: 3, bottleEqPerPerson: 0.75, ozPerPersonPerBottle: 3.17 },
  { players: 8, bottles: 8, rounds: 2, bottlesPerRound: 4, bottleEqPerPerson: 1.0, ozPerPersonPerBottle: 3.17 },

  // players: 9 (ozPerPersonPerBottle: 2.82)
  { players: 9, bottles: 6, rounds: 2, bottlesPerRound: 3, bottleEqPerPerson: 0.67, ozPerPersonPerBottle: 2.82 },
  { players: 9, bottles: 8, rounds: 2, bottlesPerRound: 4, bottleEqPerPerson: 0.89, ozPerPersonPerBottle: 2.82 },
  { players: 9, bottles: 9, rounds: 3, bottlesPerRound: 3, bottleEqPerPerson: 1.0, ozPerPersonPerBottle: 2.82 },

  // players: 10 (ozPerPersonPerBottle: 2.54)
  { players: 10, bottles: 6, rounds: 2, bottlesPerRound: 3, bottleEqPerPerson: 0.6, ozPerPersonPerBottle: 2.54 },
  { players: 10, bottles: 8, rounds: 2, bottlesPerRound: 4, bottleEqPerPerson: 0.8, ozPerPersonPerBottle: 2.54 },
  { players: 10, bottles: 9, rounds: 3, bottlesPerRound: 3, bottleEqPerPerson: 0.9, ozPerPersonPerBottle: 2.54 },

  // players: 11 (ozPerPersonPerBottle: 2.31)
  { players: 11, bottles: 6, rounds: 2, bottlesPerRound: 3, bottleEqPerPerson: 0.55, ozPerPersonPerBottle: 2.31 },
  { players: 11, bottles: 8, rounds: 2, bottlesPerRound: 4, bottleEqPerPerson: 0.73, ozPerPersonPerBottle: 2.31 },
  { players: 11, bottles: 9, rounds: 3, bottlesPerRound: 3, bottleEqPerPerson: 0.82, ozPerPersonPerBottle: 2.31 },

  // players: 12 (ozPerPersonPerBottle: 2.11)
  { players: 12, bottles: 6, rounds: 2, bottlesPerRound: 3, bottleEqPerPerson: 0.5, ozPerPersonPerBottle: 2.11 },
  { players: 12, bottles: 8, rounds: 2, bottlesPerRound: 4, bottleEqPerPerson: 0.67, ozPerPersonPerBottle: 2.11 },
  { players: 12, bottles: 9, rounds: 3, bottlesPerRound: 3, bottleEqPerPerson: 0.75, ozPerPersonPerBottle: 2.11 },
  { players: 12, bottles: 12, rounds: 3, bottlesPerRound: 4, bottleEqPerPerson: 1.0, ozPerPersonPerBottle: 2.11 },
  { players: 12, bottles: 12, rounds: 4, bottlesPerRound: 3, bottleEqPerPerson: 1.0, ozPerPersonPerBottle: 2.11 },

  // players: 13 (ozPerPersonPerBottle: 1.95)
  { players: 13, bottles: 6, rounds: 2, bottlesPerRound: 3, bottleEqPerPerson: 0.46, ozPerPersonPerBottle: 1.95 },
  { players: 13, bottles: 8, rounds: 2, bottlesPerRound: 4, bottleEqPerPerson: 0.62, ozPerPersonPerBottle: 1.95 },
  { players: 13, bottles: 9, rounds: 3, bottlesPerRound: 3, bottleEqPerPerson: 0.69, ozPerPersonPerBottle: 1.95 },
  { players: 13, bottles: 12, rounds: 3, bottlesPerRound: 4, bottleEqPerPerson: 0.92, ozPerPersonPerBottle: 1.95 },
  { players: 13, bottles: 12, rounds: 4, bottlesPerRound: 3, bottleEqPerPerson: 0.92, ozPerPersonPerBottle: 1.95 },

  // players: 14 (ozPerPersonPerBottle: 1.81)
  { players: 14, bottles: 6, rounds: 2, bottlesPerRound: 3, bottleEqPerPerson: 0.43, ozPerPersonPerBottle: 1.81 },
  { players: 14, bottles: 8, rounds: 2, bottlesPerRound: 4, bottleEqPerPerson: 0.57, ozPerPersonPerBottle: 1.81 },
  { players: 14, bottles: 9, rounds: 3, bottlesPerRound: 3, bottleEqPerPerson: 0.64, ozPerPersonPerBottle: 1.81 },
  { players: 14, bottles: 12, rounds: 3, bottlesPerRound: 4, bottleEqPerPerson: 0.86, ozPerPersonPerBottle: 1.81 },
  { players: 14, bottles: 12, rounds: 4, bottlesPerRound: 3, bottleEqPerPerson: 0.86, ozPerPersonPerBottle: 1.81 },

  // players: 15 (ozPerPersonPerBottle: 1.69)
  { players: 15, bottles: 6, rounds: 2, bottlesPerRound: 3, bottleEqPerPerson: 0.4, ozPerPersonPerBottle: 1.69 },
  { players: 15, bottles: 8, rounds: 2, bottlesPerRound: 4, bottleEqPerPerson: 0.53, ozPerPersonPerBottle: 1.69 },
  { players: 15, bottles: 9, rounds: 3, bottlesPerRound: 3, bottleEqPerPerson: 0.6, ozPerPersonPerBottle: 1.69 },
  { players: 15, bottles: 12, rounds: 3, bottlesPerRound: 4, bottleEqPerPerson: 0.8, ozPerPersonPerBottle: 1.69 },
  { players: 15, bottles: 12, rounds: 4, bottlesPerRound: 3, bottleEqPerPerson: 0.8, ozPerPersonPerBottle: 1.69 },
  { players: 15, bottles: 15, rounds: 5, bottlesPerRound: 3, bottleEqPerPerson: 1.0, ozPerPersonPerBottle: 1.69 },

  // players: 16 (ozPerPersonPerBottle: 1.58)
  { players: 16, bottles: 6, rounds: 2, bottlesPerRound: 3, bottleEqPerPerson: 0.38, ozPerPersonPerBottle: 1.58 },
  { players: 16, bottles: 8, rounds: 2, bottlesPerRound: 4, bottleEqPerPerson: 0.5, ozPerPersonPerBottle: 1.58 },
  { players: 16, bottles: 9, rounds: 3, bottlesPerRound: 3, bottleEqPerPerson: 0.56, ozPerPersonPerBottle: 1.58 },
  { players: 16, bottles: 12, rounds: 3, bottlesPerRound: 4, bottleEqPerPerson: 0.75, ozPerPersonPerBottle: 1.58 },
  { players: 16, bottles: 12, rounds: 4, bottlesPerRound: 3, bottleEqPerPerson: 0.75, ozPerPersonPerBottle: 1.58 },
  { players: 16, bottles: 15, rounds: 5, bottlesPerRound: 3, bottleEqPerPerson: 0.94, ozPerPersonPerBottle: 1.58 },
  { players: 16, bottles: 16, rounds: 4, bottlesPerRound: 4, bottleEqPerPerson: 1.0, ozPerPersonPerBottle: 1.58 },

  // players: 17 (ozPerPersonPerBottle: 1.49)
  { players: 17, bottles: 6, rounds: 2, bottlesPerRound: 3, bottleEqPerPerson: 0.35, ozPerPersonPerBottle: 1.49 },
  { players: 17, bottles: 8, rounds: 2, bottlesPerRound: 4, bottleEqPerPerson: 0.47, ozPerPersonPerBottle: 1.49 },
  { players: 17, bottles: 9, rounds: 3, bottlesPerRound: 3, bottleEqPerPerson: 0.53, ozPerPersonPerBottle: 1.49 },
  { players: 17, bottles: 12, rounds: 3, bottlesPerRound: 4, bottleEqPerPerson: 0.71, ozPerPersonPerBottle: 1.49 },
  { players: 17, bottles: 12, rounds: 4, bottlesPerRound: 3, bottleEqPerPerson: 0.71, ozPerPersonPerBottle: 1.49 },
  { players: 17, bottles: 15, rounds: 5, bottlesPerRound: 3, bottleEqPerPerson: 0.88, ozPerPersonPerBottle: 1.49 },
  { players: 17, bottles: 16, rounds: 4, bottlesPerRound: 4, bottleEqPerPerson: 0.94, ozPerPersonPerBottle: 1.49 },

  // players: 18 (ozPerPersonPerBottle: 1.41)
  { players: 18, bottles: 6, rounds: 2, bottlesPerRound: 3, bottleEqPerPerson: 0.33, ozPerPersonPerBottle: 1.41 },
  { players: 18, bottles: 8, rounds: 2, bottlesPerRound: 4, bottleEqPerPerson: 0.44, ozPerPersonPerBottle: 1.41 },
  { players: 18, bottles: 9, rounds: 3, bottlesPerRound: 3, bottleEqPerPerson: 0.5, ozPerPersonPerBottle: 1.41 },
  { players: 18, bottles: 12, rounds: 3, bottlesPerRound: 4, bottleEqPerPerson: 0.67, ozPerPersonPerBottle: 1.41 },
  { players: 18, bottles: 12, rounds: 4, bottlesPerRound: 3, bottleEqPerPerson: 0.67, ozPerPersonPerBottle: 1.41 },
  { players: 18, bottles: 15, rounds: 5, bottlesPerRound: 3, bottleEqPerPerson: 0.83, ozPerPersonPerBottle: 1.41 },
  { players: 18, bottles: 16, rounds: 4, bottlesPerRound: 4, bottleEqPerPerson: 0.89, ozPerPersonPerBottle: 1.41 },

  // players: 19 (ozPerPersonPerBottle: 1.33)
  { players: 19, bottles: 6, rounds: 2, bottlesPerRound: 3, bottleEqPerPerson: 0.32, ozPerPersonPerBottle: 1.33 },
  { players: 19, bottles: 8, rounds: 2, bottlesPerRound: 4, bottleEqPerPerson: 0.42, ozPerPersonPerBottle: 1.33 },
  { players: 19, bottles: 9, rounds: 3, bottlesPerRound: 3, bottleEqPerPerson: 0.47, ozPerPersonPerBottle: 1.33 },
  { players: 19, bottles: 12, rounds: 3, bottlesPerRound: 4, bottleEqPerPerson: 0.63, ozPerPersonPerBottle: 1.33 },
  { players: 19, bottles: 12, rounds: 4, bottlesPerRound: 3, bottleEqPerPerson: 0.63, ozPerPersonPerBottle: 1.33 },
  { players: 19, bottles: 15, rounds: 5, bottlesPerRound: 3, bottleEqPerPerson: 0.79, ozPerPersonPerBottle: 1.33 },
  { players: 19, bottles: 16, rounds: 4, bottlesPerRound: 4, bottleEqPerPerson: 0.84, ozPerPersonPerBottle: 1.33 },

  // players: 20 (ozPerPersonPerBottle: 1.27)
  { players: 20, bottles: 6, rounds: 2, bottlesPerRound: 3, bottleEqPerPerson: 0.3, ozPerPersonPerBottle: 1.27 },
  { players: 20, bottles: 8, rounds: 2, bottlesPerRound: 4, bottleEqPerPerson: 0.4, ozPerPersonPerBottle: 1.27 },
  { players: 20, bottles: 9, rounds: 3, bottlesPerRound: 3, bottleEqPerPerson: 0.45, ozPerPersonPerBottle: 1.27 },
  { players: 20, bottles: 12, rounds: 3, bottlesPerRound: 4, bottleEqPerPerson: 0.6, ozPerPersonPerBottle: 1.27 },
  { players: 20, bottles: 12, rounds: 4, bottlesPerRound: 3, bottleEqPerPerson: 0.6, ozPerPersonPerBottle: 1.27 },
  { players: 20, bottles: 15, rounds: 5, bottlesPerRound: 3, bottleEqPerPerson: 0.75, ozPerPersonPerBottle: 1.27 },
  { players: 20, bottles: 16, rounds: 4, bottlesPerRound: 4, bottleEqPerPerson: 0.8, ozPerPersonPerBottle: 1.27 },
  { players: 20, bottles: 20, rounds: 5, bottlesPerRound: 4, bottleEqPerPerson: 1.0, ozPerPersonPerBottle: 1.27 },

  // players: 21 (ozPerPersonPerBottle: 1.21)
  { players: 21, bottles: 6, rounds: 2, bottlesPerRound: 3, bottleEqPerPerson: 0.29, ozPerPersonPerBottle: 1.21 },
  { players: 21, bottles: 8, rounds: 2, bottlesPerRound: 4, bottleEqPerPerson: 0.38, ozPerPersonPerBottle: 1.21 },
  { players: 21, bottles: 9, rounds: 3, bottlesPerRound: 3, bottleEqPerPerson: 0.43, ozPerPersonPerBottle: 1.21 },
  { players: 21, bottles: 12, rounds: 3, bottlesPerRound: 4, bottleEqPerPerson: 0.57, ozPerPersonPerBottle: 1.21 },
  { players: 21, bottles: 12, rounds: 4, bottlesPerRound: 3, bottleEqPerPerson: 0.57, ozPerPersonPerBottle: 1.21 },
  { players: 21, bottles: 15, rounds: 5, bottlesPerRound: 3, bottleEqPerPerson: 0.71, ozPerPersonPerBottle: 1.21 },
  { players: 21, bottles: 16, rounds: 4, bottlesPerRound: 4, bottleEqPerPerson: 0.76, ozPerPersonPerBottle: 1.21 },
  { players: 21, bottles: 20, rounds: 5, bottlesPerRound: 4, bottleEqPerPerson: 0.95, ozPerPersonPerBottle: 1.21 },

  // players: 22 (ozPerPersonPerBottle: 1.15)
  { players: 22, bottles: 6, rounds: 2, bottlesPerRound: 3, bottleEqPerPerson: 0.27, ozPerPersonPerBottle: 1.15 },
  { players: 22, bottles: 8, rounds: 2, bottlesPerRound: 4, bottleEqPerPerson: 0.36, ozPerPersonPerBottle: 1.15 },
  { players: 22, bottles: 9, rounds: 3, bottlesPerRound: 3, bottleEqPerPerson: 0.41, ozPerPersonPerBottle: 1.15 },
  { players: 22, bottles: 12, rounds: 3, bottlesPerRound: 4, bottleEqPerPerson: 0.55, ozPerPersonPerBottle: 1.15 },
  { players: 22, bottles: 12, rounds: 4, bottlesPerRound: 3, bottleEqPerPerson: 0.55, ozPerPersonPerBottle: 1.15 },
  { players: 22, bottles: 15, rounds: 5, bottlesPerRound: 3, bottleEqPerPerson: 0.68, ozPerPersonPerBottle: 1.15 },
  { players: 22, bottles: 16, rounds: 4, bottlesPerRound: 4, bottleEqPerPerson: 0.73, ozPerPersonPerBottle: 1.15 },
  { players: 22, bottles: 20, rounds: 5, bottlesPerRound: 4, bottleEqPerPerson: 0.91, ozPerPersonPerBottle: 1.15 },

  // players: 23 (ozPerPersonPerBottle: 1.1)
  { players: 23, bottles: 6, rounds: 2, bottlesPerRound: 3, bottleEqPerPerson: 0.26, ozPerPersonPerBottle: 1.1 },
  { players: 23, bottles: 8, rounds: 2, bottlesPerRound: 4, bottleEqPerPerson: 0.35, ozPerPersonPerBottle: 1.1 },
  { players: 23, bottles: 9, rounds: 3, bottlesPerRound: 3, bottleEqPerPerson: 0.39, ozPerPersonPerBottle: 1.1 },
  { players: 23, bottles: 12, rounds: 3, bottlesPerRound: 4, bottleEqPerPerson: 0.52, ozPerPersonPerBottle: 1.1 },
  { players: 23, bottles: 12, rounds: 4, bottlesPerRound: 3, bottleEqPerPerson: 0.52, ozPerPersonPerBottle: 1.1 },
  { players: 23, bottles: 15, rounds: 5, bottlesPerRound: 3, bottleEqPerPerson: 0.65, ozPerPersonPerBottle: 1.1 },
  { players: 23, bottles: 16, rounds: 4, bottlesPerRound: 4, bottleEqPerPerson: 0.7, ozPerPersonPerBottle: 1.1 },
  { players: 23, bottles: 20, rounds: 5, bottlesPerRound: 4, bottleEqPerPerson: 0.87, ozPerPersonPerBottle: 1.1 },

  // players: 24 (ozPerPersonPerBottle: 1.06)
  { players: 24, bottles: 6, rounds: 2, bottlesPerRound: 3, bottleEqPerPerson: 0.25, ozPerPersonPerBottle: 1.06 },
  { players: 24, bottles: 8, rounds: 2, bottlesPerRound: 4, bottleEqPerPerson: 0.33, ozPerPersonPerBottle: 1.06 },
  { players: 24, bottles: 9, rounds: 3, bottlesPerRound: 3, bottleEqPerPerson: 0.38, ozPerPersonPerBottle: 1.06 },
  { players: 24, bottles: 12, rounds: 3, bottlesPerRound: 4, bottleEqPerPerson: 0.5, ozPerPersonPerBottle: 1.06 },
  { players: 24, bottles: 12, rounds: 4, bottlesPerRound: 3, bottleEqPerPerson: 0.5, ozPerPersonPerBottle: 1.06 },
  { players: 24, bottles: 15, rounds: 5, bottlesPerRound: 3, bottleEqPerPerson: 0.63, ozPerPersonPerBottle: 1.06 },
  { players: 24, bottles: 16, rounds: 4, bottlesPerRound: 4, bottleEqPerPerson: 0.67, ozPerPersonPerBottle: 1.06 },
  { players: 24, bottles: 20, rounds: 5, bottlesPerRound: 4, bottleEqPerPerson: 0.83, ozPerPersonPerBottle: 1.06 },
];

function uniqSorted(nums: number[]) {
  return Array.from(new Set(nums)).sort((a, b) => a - b);
}

export function getPlayersOptions() {
  return uniqSorted(wineySetups.map((s) => s.players));
}

export function getBottleOptions(players: number) {
  return uniqSorted(wineySetups.filter((s) => s.players === players).map((s) => s.bottles));
}

export function getRoundOptions(players: number, bottles: number) {
  return uniqSorted(
    wineySetups
      .filter((s) => s.players === players && s.bottles === bottles)
      .map((s) => s.rounds)
  );
}

export function findSetup(players: number, bottles: number, rounds: number) {
  return wineySetups.find((s) => s.players === players && s.bottles === bottles && s.rounds === rounds) ?? null;
}

export function defaultSetup() {
  return findSetup(20, 20, 5) ?? wineySetups[0];
}
