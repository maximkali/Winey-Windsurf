import { randomUUID } from 'crypto';

export type GameStatus = 'setup' | 'lobby' | 'in_progress' | 'gambit' | 'finished';
export type RoundState = 'open' | 'closed';

export type Player = {
  uid: string;
  name: string;
  joinedAt: number;
};

export type RoundSubmission = {
  uid: string;
  notes: string;
  ranking: string[];
  submittedAt: number;
};

export type Round = {
  id: number;
  state: RoundState;
  submissions: Record<string, RoundSubmission>;
};

export type Game = {
  gameCode: string;
  hostUid: string;
  status: GameStatus;
  createdAt: number;
  startedAt?: number;
  currentRound: number;
  rounds: Round[];
  players: Player[];
};

type Store = {
  games: Map<string, Game>;
};

declare global {
  var __wineyStore: Store | undefined;
}

const store: Store = (globalThis.__wineyStore ??= { games: new Map() });

function uuid() {
  const maybeCrypto = (globalThis as unknown as { crypto?: Crypto }).crypto;
  if (maybeCrypto?.randomUUID) return maybeCrypto.randomUUID();
  return randomUUID();
}

function generateGameCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

function createDefaultRounds(count: number): Round[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: idx + 1,
    state: 'open',
    submissions: {},
  }));
}

export function createGame(hostName: string | undefined) {
  let gameCode = generateGameCode();
  while (store.games.has(gameCode)) gameCode = generateGameCode();

  const hostUid = uuid();
  const now = Date.now();

  const game: Game = {
    gameCode,
    hostUid,
    status: 'setup',
    createdAt: now,
    currentRound: 1,
    rounds: createDefaultRounds(3),
    players: [
      {
        uid: hostUid,
        name: hostName?.trim() || 'Host',
        joinedAt: now,
      },
    ],
  };

  store.games.set(gameCode, game);
  return { gameCode, hostUid };
}

export function joinGame(gameCode: string, playerName: string) {
  const game = store.games.get(gameCode);
  if (!game) throw new Error('GAME_NOT_FOUND');
  if (game.status === 'finished' || game.status === 'gambit') throw new Error('GAME_FINISHED');

  const uid = uuid();
  const now = Date.now();

  game.players.push({ uid, name: playerName.trim() || 'Player', joinedAt: now });

  if (game.status === 'setup') game.status = 'lobby';

  return { uid };
}

export function getGamePublic(gameCode: string, uid?: string | null) {
  const game = store.games.get(gameCode);
  if (!game) throw new Error('GAME_NOT_FOUND');

  const isHost = !!uid && uid === game.hostUid;

  return {
    gameCode: game.gameCode,
    status: game.status,
    createdAt: game.createdAt,
    startedAt: game.startedAt ?? null,
    currentRound: game.currentRound,
    totalRounds: game.rounds.length,
    players: game.players,
    isHost,
  };
}

export function startGame(gameCode: string, hostUid: string) {
  const game = store.games.get(gameCode);
  if (!game) throw new Error('GAME_NOT_FOUND');
  if (game.hostUid !== hostUid) throw new Error('NOT_HOST');

  if (game.status === 'finished' || game.status === 'gambit') throw new Error('GAME_FINISHED');
  game.status = 'in_progress';
  game.startedAt = Date.now();
  game.currentRound = 1;

  return { ok: true };
}

export function bootPlayer(gameCode: string, hostUid: string, playerUid: string) {
  const game = store.games.get(gameCode);
  if (!game) throw new Error('GAME_NOT_FOUND');
  if (game.hostUid !== hostUid) throw new Error('NOT_HOST');
  if (playerUid === hostUid) throw new Error('CANNOT_BOOT_HOST');

  game.players = game.players.filter((p) => p.uid !== playerUid);

  return { ok: true };
}

export function getRound(gameCode: string, roundId: number, uid?: string | null) {
  const game = store.games.get(gameCode);
  if (!game) throw new Error('GAME_NOT_FOUND');

  const round = game.rounds.find((r) => r.id === roundId);
  if (!round) throw new Error('ROUND_NOT_FOUND');

  const isHost = !!uid && uid === game.hostUid;
  const mySubmission = uid ? round.submissions[uid] ?? null : null;

  const playersTotalCount = Math.max(0, game.players.length);
  const playersDoneCount = Object.keys(round.submissions).length;

  let submittedAtByUid: Record<string, number> | null = null;
  if (isHost) {
    submittedAtByUid = {};
    for (const [submissionUid, submission] of Object.entries(round.submissions)) {
      submittedAtByUid[submissionUid] = submission?.submittedAt ?? Date.now();
    }
  }

  return {
    gameCode,
    roundId: round.id,
    totalRounds: game.rounds.length,
    state: round.state,
    isHost,
    // Back-compat: treat this as "players done" (including host).
    submissionsCount: playersDoneCount,
    playersDoneCount,
    playersTotalCount,
    mySubmission,
    ...(isHost
      ? {
          submittedUids: Object.keys(submittedAtByUid ?? {}),
          submittedAtByUid,
        }
      : {}),
  };
}

export function submitRound(
  gameCode: string,
  roundId: number,
  uid: string,
  notes: string,
  ranking: string[]
) {
  const game = store.games.get(gameCode);
  if (!game) throw new Error('GAME_NOT_FOUND');

  const round = game.rounds.find((r) => r.id === roundId);
  if (!round) throw new Error('ROUND_NOT_FOUND');
  if (round.state !== 'open') throw new Error('ROUND_CLOSED');

  const playerExists = game.players.some((p) => p.uid === uid);
  if (!playerExists) throw new Error('NOT_IN_GAME');

  round.submissions[uid] = {
    uid,
    notes,
    ranking,
    submittedAt: Date.now(),
  };

  return { ok: true };
}

export function closeRound(gameCode: string, hostUid: string, roundId: number) {
  const game = store.games.get(gameCode);
  if (!game) throw new Error('GAME_NOT_FOUND');
  if (game.hostUid !== hostUid) throw new Error('NOT_HOST');

  const round = game.rounds.find((r) => r.id === roundId);
  if (!round) throw new Error('ROUND_NOT_FOUND');

  round.state = 'closed';
  return { ok: true };
}

export function advanceRound(gameCode: string, hostUid: string) {
  const game = store.games.get(gameCode);
  if (!game) throw new Error('GAME_NOT_FOUND');
  if (game.hostUid !== hostUid) throw new Error('NOT_HOST');

  if (game.currentRound >= game.rounds.length) {
    game.status = 'gambit';
    return { ok: true, finished: true, nextRound: null };
  }

  game.currentRound += 1;
  return { ok: true, finished: false, nextRound: game.currentRound };
}

export function getLeaderboard(gameCode: string, uid?: string | null) {
  const game = store.games.get(gameCode);
  if (!game) throw new Error('GAME_NOT_FOUND');

  const isHost = !!uid && uid === game.hostUid;

  const scores: Record<string, number> = {};
  for (const p of game.players) scores[p.uid] = 0;

  // Only count completed rounds. While in progress, do NOT include the current round.
  const includeAllRounds = game.status === 'finished' || game.status === 'gambit';
  const threshold = includeAllRounds ? Number.MAX_SAFE_INTEGER : game.currentRound;
  for (const round of game.rounds) {
    if (round.id >= threshold) continue;
    for (const submissionUid of Object.keys(round.submissions)) {
      scores[submissionUid] = (scores[submissionUid] ?? 0) + 1;
    }
  }

  const leaderboard = game.players
    .map((p) => ({ uid: p.uid, name: p.name, score: scores[p.uid] ?? 0 }))
    .sort((a, b) => b.score - a.score);

  return {
    gameCode,
    status: game.status,
    isHost,
    leaderboard,
  };
}
