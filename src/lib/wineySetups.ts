export type WineySetup = {
  players: number;
  bottles: number;
  rounds: number;
  bottlesPerRound: number;
  bottleEqPerPerson: number;
  ozPerPersonPerBottle: number;
};

export const wineySetups: WineySetup[] = [
  { players: 22, bottles: 20, rounds: 5, bottlesPerRound: 4, bottleEqPerPerson: 0.91, ozPerPersonPerBottle: 1.15 },
  { players: 20, bottles: 20, rounds: 5, bottlesPerRound: 4, bottleEqPerPerson: 1.0, ozPerPersonPerBottle: 1.27 },
  { players: 20, bottles: 16, rounds: 4, bottlesPerRound: 4, bottleEqPerPerson: 0.8, ozPerPersonPerBottle: 1.27 },
  { players: 20, bottles: 15, rounds: 5, bottlesPerRound: 3, bottleEqPerPerson: 0.75, ozPerPersonPerBottle: 1.27 },
  { players: 20, bottles: 12, rounds: 4, bottlesPerRound: 3, bottleEqPerPerson: 0.6, ozPerPersonPerBottle: 1.27 },
  { players: 20, bottles: 12, rounds: 3, bottlesPerRound: 4, bottleEqPerPerson: 0.6, ozPerPersonPerBottle: 1.27 },
  { players: 20, bottles: 9, rounds: 3, bottlesPerRound: 3, bottleEqPerPerson: 0.45, ozPerPersonPerBottle: 1.27 },
  { players: 18, bottles: 16, rounds: 4, bottlesPerRound: 4, bottleEqPerPerson: 0.89, ozPerPersonPerBottle: 1.41 },
  { players: 16, bottles: 16, rounds: 4, bottlesPerRound: 4, bottleEqPerPerson: 1.0, ozPerPersonPerBottle: 1.58 },
  { players: 16, bottles: 15, rounds: 5, bottlesPerRound: 3, bottleEqPerPerson: 0.94, ozPerPersonPerBottle: 1.58 },
  { players: 16, bottles: 12, rounds: 4, bottlesPerRound: 3, bottleEqPerPerson: 0.75, ozPerPersonPerBottle: 1.58 },
  { players: 16, bottles: 12, rounds: 3, bottlesPerRound: 4, bottleEqPerPerson: 0.75, ozPerPersonPerBottle: 1.58 },
  { players: 16, bottles: 9, rounds: 3, bottlesPerRound: 3, bottleEqPerPerson: 0.56, ozPerPersonPerBottle: 1.58 },
  { players: 14, bottles: 12, rounds: 4, bottlesPerRound: 3, bottleEqPerPerson: 0.86, ozPerPersonPerBottle: 1.81 },
  { players: 14, bottles: 12, rounds: 3, bottlesPerRound: 4, bottleEqPerPerson: 0.86, ozPerPersonPerBottle: 1.81 },
  { players: 12, bottles: 12, rounds: 3, bottlesPerRound: 4, bottleEqPerPerson: 1.0, ozPerPersonPerBottle: 2.11 },
  { players: 12, bottles: 12, rounds: 4, bottlesPerRound: 3, bottleEqPerPerson: 1.0, ozPerPersonPerBottle: 2.11 },
  { players: 12, bottles: 9, rounds: 3, bottlesPerRound: 3, bottleEqPerPerson: 0.75, ozPerPersonPerBottle: 2.11 },
  { players: 10, bottles: 9, rounds: 3, bottlesPerRound: 3, bottleEqPerPerson: 0.9, ozPerPersonPerBottle: 2.54 },
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
