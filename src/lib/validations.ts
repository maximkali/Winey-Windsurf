import { z } from 'zod';

export const CreateGameSchema = z.object({
  hostName: z.string().trim().min(1).max(40).optional(),
  totalRounds: z.coerce.number().int().min(1).max(50).optional(),
  players: z.coerce.number().int().min(2).max(50).optional(),
  bottles: z.coerce.number().int().min(1).max(200).optional(),
  bottlesPerRound: z.coerce.number().int().min(1).max(20).optional(),
  bottleEqPerPerson: z.coerce.number().min(0).max(10).optional(),
  ozPerPersonPerBottle: z.coerce.number().min(0).max(20).optional(),
});

export const JoinGameSchema = z.object({
  gameCode: z.string().trim().min(4).max(10),
  playerName: z.string().trim().min(1).max(40),
});

export const StartGameSchema = z.object({
  gameCode: z.string().trim().min(4).max(10),
  uid: z.string().trim().min(10),
});

export const BootPlayerSchema = z.object({
  gameCode: z.string().trim().min(4).max(10),
  uid: z.string().trim().min(10),
  playerUid: z.string().trim().min(10),
});

export const RoundGetSchema = z.object({
  gameCode: z.string().trim().min(4).max(10),
  roundId: z.coerce.number().int().min(1).max(50),
});

export const RoundSubmitSchema = z.object({
  gameCode: z.string().trim().min(4).max(10),
  roundId: z.coerce.number().int().min(1).max(50),
  uid: z.string().trim().min(10),
  notes: z.string().max(5000).default(''),
  ranking: z.array(z.string().trim().min(1)).max(20).default([]),
});

export const RoundHostActionSchema = z.object({
  gameCode: z.string().trim().min(4).max(10),
  roundId: z.coerce.number().int().min(1).max(50).optional(),
  uid: z.string().trim().min(10),
});

export const WinesGetSchema = z.object({
  gameCode: z.string().trim().min(4).max(10),
});

export const WineUpsertItemSchema = z.object({
  id: z.string().trim().min(3).max(100),
  letter: z.string().trim().min(1).max(3),
  labelBlinded: z.string().max(120).default(''),
  nickname: z.string().max(120).default(''),
  price: z.number().nullable().optional(),
});

export const WinesUpsertSchema = z.object({
  gameCode: z.string().trim().min(4).max(10),
  uid: z.string().trim().min(10),
  wines: z.array(WineUpsertItemSchema).max(300),
});

export const WinesDeleteSchema = z.object({
  gameCode: z.string().trim().min(4).max(10),
  uid: z.string().trim().min(10),
  wineId: z.string().trim().min(3).max(100),
});

export const AssignmentsGetSchema = z.object({
  gameCode: z.string().trim().min(4).max(10),
});

export const AssignmentsSetSchema = z.object({
  gameCode: z.string().trim().min(4).max(10),
  uid: z.string().trim().min(10),
  assignments: z
    .array(
      z.object({
        roundId: z.coerce.number().int().min(1).max(50),
        wineIds: z.array(z.string().trim().min(3).max(100)).max(50),
      })
    )
    .max(50),
});
