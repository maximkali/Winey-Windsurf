export type Wine = {
  id: string;
  letter: string;
  labelBlinded: string;
  nickname: string;
  price: number | null;
};

export type RoundAssignment = {
  roundId: number;
  wineIds: string[];
};
