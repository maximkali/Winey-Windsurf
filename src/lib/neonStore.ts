/** Game persistence backed by Neon (PostgreSQL). */

import { getSql, withTransaction } from '@/lib/db';
import { generateGameCode } from '@/lib/gameCode';
import { newUid } from '@/lib/uid';
import { buildAcceptableByPosition, scoreRanking } from '@/lib/scoring';
import { shouldIncludeGambitPoints } from '@/lib/leaderboardGating';
import { GAMBIT_MAX_POINTS, getGambitMinMaxSets, scoreGambitPicks } from '@/lib/gambitScoring';
import { normalizeMoney } from '@/lib/money';
import { stripTrailingNumberMatchingLetter } from '@/lib/wineLabel';

export type GameStatus = 'setup' | 'lobby' | 'in_progress' | 'gambit' | 'finished';
export type RoundState = 'open' | 'closed';

type DbGame = {
  game_code: string;
  host_uid: string;
  status: GameStatus;
  created_at: string;
  started_at: string | null;
  current_round: number;
  total_rounds: number;
  players: number | null;
  bottles: number | null;
  bottles_per_round: number | null;
  bottle_eq_per_person: number | null;
  oz_per_person_per_bottle: number | null;
};

type DbPlayer = {
  game_code: string;
  uid: string;
  name: string;
  joined_at: string;
  is_competing: boolean;
};

type DbRound = {
  game_code: string;
  round_id: number;
  state: RoundState;
};

type DbSubmission = {
  game_code: string;
  round_id: number;
  uid: string;
  notes: string;
  ranking: unknown;
  submitted_at: string;
};

type DbWine = {
  game_code: string;
  wine_id: string;
  letter: string;
  label_blinded: string;
  nickname: string;
  price: unknown;
  created_at: string;
};

type DbGambitSubmission = {
  game_code: string;
  uid: string;
  cheapest_wine_id: string | null;
  most_expensive_wine_id: string | null;
  favorite_wine_ids: unknown;
  submitted_at: string;
};

type DbRoundWine = {
  game_code: string;
  round_id: number;
  wine_id: string;
  position: number | null;
};

type DbRoundWineJoin = {
  wine_id: string;
  position: number | null;
  nickname: string | null;
};

function toMs(ts: string | null) {
  if (!ts) return null;
  const n = Date.parse(ts);
  return Number.isFinite(n) ? n : null;
}

function placeBadge(pos: number) {
  const num = pos + 1;
  if (num === 1) return '1st';
  if (num === 2) return '2nd';
  if (num === 3) return '3rd';
  return `${num}th`;
}

type GameSetupFields = {
  players?: number;
  bottles?: number;
  bottlesPerRound?: number;
  bottleEqPerPerson?: number;
  ozPerPersonPerBottle?: number;
};

function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; message?: string };
  if (err.code === '23505') return true;
  const m = (err.message ?? '').toLowerCase();
  return m.includes('duplicate') || m.includes('unique');
}

function parseRanking(raw: unknown): string[] {
  if (Array.isArray(raw) && raw.every((x: unknown) => typeof x === 'string')) return raw as string[];
  if (Array.isArray(raw)) return (raw as unknown[]).filter((x): x is string => typeof x === 'string');
  return [];
}

async function mustGetGame(gameCode: string): Promise<DbGame> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      game_code,
      host_uid,
      status,
      created_at::text AS created_at,
      started_at::text AS started_at,
      current_round,
      total_rounds,
      players,
      bottles,
      bottles_per_round,
      bottle_eq_per_person,
      oz_per_person_per_bottle
    FROM games
    WHERE game_code = ${gameCode}
    LIMIT 1
  ` as DbGame[];
  const data = rows[0];
  if (!data) throw new Error('GAME_NOT_FOUND');
  return data;
}

async function ensureHost(gameCode: string, uid: string): Promise<DbGame> {
  const game = await mustGetGame(gameCode);
  if (game.host_uid !== uid) throw new Error('NOT_HOST');
  return game;
}

async function ensureInGame(gameCode: string, uid: string): Promise<{ game: DbGame; isHost: boolean }> {
  const sql = getSql();
  const game = await mustGetGame(gameCode);
  const isHost = uid === game.host_uid;
  if (isHost) return { game, isHost: true };

  const rows = await sql`
    SELECT uid FROM players WHERE game_code = ${gameCode} AND uid = ${uid} LIMIT 1
  ` as { uid: string }[];
  if (!rows[0]) throw new Error('NOT_IN_GAME');
  return { game, isHost: false };
}

export async function createGame(
  hostName: string | undefined,
  totalRounds?: number,
  setup?: GameSetupFields
) {
  const hostUid = newUid();
  const rounds = totalRounds && Number.isFinite(totalRounds) ? totalRounds : 3;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const gameCode = generateGameCode();

    try {
      await withTransaction(async (q) => {
        await q(
          `INSERT INTO games (
            game_code, host_uid, status, current_round, total_rounds,
            players, bottles, bottles_per_round, bottle_eq_per_person, oz_per_person_per_bottle
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            gameCode,
            hostUid,
            'setup',
            1,
            rounds,
            setup?.players ?? null,
            setup?.bottles ?? null,
            setup?.bottlesPerRound ?? null,
            setup?.bottleEqPerPerson ?? null,
            setup?.ozPerPersonPerBottle ?? null,
          ]
        );

        await q(`INSERT INTO players (game_code, uid, name) VALUES ($1, $2, $3)`, [
          gameCode,
          hostUid,
          hostName?.trim() || 'Host',
        ]);

        const parts: string[] = [];
        const params: unknown[] = [];
        let pi = 1;
        for (let idx = 0; idx < rounds; idx += 1) {
          parts.push(`($${pi}, $${pi + 1}, $${pi + 2})`);
          pi += 3;
          params.push(gameCode, idx + 1, 'closed');
        }
        await q(`INSERT INTO rounds (game_code, round_id, state) VALUES ${parts.join(', ')}`, params);
      });

      return { gameCode, hostUid };
    } catch (e) {
      if (isUniqueViolation(e)) continue;
      throw e instanceof Error ? e : new Error(String(e));
    }
  }

  throw new Error('FAILED_TO_CREATE_GAME');
}

export async function joinGame(gameCode: string, playerName: string) {
  const sql = getSql();
  const game = await mustGetGame(gameCode);
  if (game.status === 'finished' || game.status === 'gambit') throw new Error('GAME_FINISHED');
  if (game.status === 'in_progress') throw new Error('GAME_ALREADY_STARTED');

  if (typeof game.players === 'number' && Number.isFinite(game.players) && game.players > 0) {
    const cnt = await sql`
      SELECT COUNT(*)::int AS c FROM players WHERE game_code = ${gameCode}
    ` as { c: number }[];
    const current = cnt[0]?.c ?? 0;
    if (current >= game.players) throw new Error('GAME_FULL');
  }

  const uid = newUid();
  await sql`INSERT INTO players (game_code, uid, name) VALUES (${gameCode}, ${uid}, ${playerName.trim() || 'Player'})`;

  if (game.status === 'setup') {
    await sql`
      UPDATE games SET status = 'lobby'
      WHERE game_code = ${gameCode} AND status = 'setup'
    `;
  }

  return { uid };
}

export async function getGamePublic(gameCode: string, uid?: string | null) {
  const sql = getSql();
  const game = await mustGetGame(gameCode);

  const players = await sql`
    SELECT uid, name, joined_at::text AS joined_at, is_competing
    FROM players
    WHERE game_code = ${gameCode}
    ORDER BY joined_at ASC
  ` as Pick<DbPlayer, 'uid' | 'name' | 'joined_at' | 'is_competing'>[];

  if (uid && uid !== game.host_uid) {
    const exists = players.some((p) => p.uid === uid);
    if (!exists) throw new Error('NOT_IN_GAME');
  }

  const isHost = !!uid && uid === game.host_uid;

  return {
    gameCode: game.game_code,
    status: game.status,
    createdAt: toMs(game.created_at),
    startedAt: toMs(game.started_at),
    currentRound: game.current_round,
    totalRounds: game.total_rounds,
    setupPlayers: game.players,
    setupBottles: game.bottles,
    setupBottlesPerRound: game.bottles_per_round,
    setupBottleEqPerPerson: game.bottle_eq_per_person,
    setupOzPerPersonPerBottle: game.oz_per_person_per_bottle,
    players: players.map((p) => ({
      uid: p.uid,
      name: p.name,
      joinedAt: toMs(p.joined_at) ?? Date.now(),
      isCompeting: typeof p.is_competing === 'boolean' ? p.is_competing : true,
    })),
    isHost,
  };
}

export async function setHostCompeting(gameCode: string, hostUid: string, isCompeting: boolean) {
  const sql = getSql();
  await ensureHost(gameCode, hostUid);

  await sql`
    UPDATE players SET is_competing = ${!!isCompeting}
    WHERE game_code = ${gameCode} AND uid = ${hostUid}
  `;
  return { ok: true };
}

export async function startGame(gameCode: string, hostUid: string) {
  const sql = getSql();
  const game = await ensureHost(gameCode, hostUid);

  if (game.status === 'finished' || game.status === 'gambit') throw new Error('GAME_FINISHED');
  if (game.status === 'in_progress') return { ok: true };

  if (typeof game.bottles === 'number' && Number.isFinite(game.bottles) && game.bottles > 0) {
    const winesCountRow = await sql`
      SELECT COUNT(*)::int AS c FROM wines WHERE game_code = ${gameCode}
    ` as { c: number }[];
    const winesCount = winesCountRow[0]?.c ?? 0;
    if (winesCount !== game.bottles) throw new Error('WINE_LIST_INCOMPLETE');

    const pricedRow = await sql`
      SELECT COUNT(*)::int AS c FROM wines WHERE game_code = ${gameCode} AND price IS NOT NULL
    ` as { c: number }[];
    const pricesFilled = pricedRow[0]?.c ?? 0;
    if (pricesFilled !== game.bottles) throw new Error('WINE_LIST_INCOMPLETE');
  }

  await sql`
    UPDATE games
    SET status = 'in_progress', started_at = NOW(), current_round = 1
    WHERE game_code = ${gameCode}
  `;

  await sql`UPDATE rounds SET state = 'closed' WHERE game_code = ${gameCode}`;

  const opened = await sql`
    UPDATE rounds SET state = 'open'
    WHERE game_code = ${gameCode} AND round_id = 1
    RETURNING round_id
  ` as { round_id: number }[];
  if (!opened[0]) throw new Error('ROUND_NOT_FOUND');

  return { ok: true };
}

export async function bootPlayer(gameCode: string, hostUid: string, playerUid: string) {
  const sql = getSql();
  if (playerUid === hostUid) throw new Error('CANNOT_BOOT_HOST');
  await ensureHost(gameCode, hostUid);

  await sql`DELETE FROM players WHERE game_code = ${gameCode} AND uid = ${playerUid}`;
  return { ok: true };
}

export async function finishGame(gameCode: string, hostUid: string) {
  const sql = getSql();
  const game = await ensureHost(gameCode, hostUid);
  if (game.status !== 'gambit') throw new Error('GAME_NOT_IN_GAMBIT');

  const players = await sql`
    SELECT uid FROM players WHERE game_code = ${gameCode}
  ` as Pick<DbPlayer, 'uid'>[];
  const playerUids = players.map((p) => p.uid).filter((u): u is string => typeof u === 'string' && u.length > 0);

  const existingSubs = await sql`
    SELECT uid FROM gambit_submissions WHERE game_code = ${gameCode}
  ` as Pick<DbGambitSubmission, 'uid'>[];
  const submittedSet = new Set(existingSubs.map((s) => s.uid).filter((u): u is string => typeof u === 'string' && u.length > 0));
  const missingUids = playerUids.filter((u) => !submittedSet.has(u));

  if (missingUids.length) {
    const now = new Date().toISOString();
    await withTransaction(async (q) => {
      for (const uid of missingUids) {
        await q(
          `INSERT INTO gambit_submissions (game_code, uid, cheapest_wine_id, most_expensive_wine_id, favorite_wine_ids, submitted_at)
           VALUES ($1, $2, NULL, NULL, '[]'::jsonb, $3)
           ON CONFLICT (game_code, uid) DO NOTHING`,
          [gameCode, uid, now]
        );
      }
    });
  }

  await sql`UPDATE games SET status = 'finished' WHERE game_code = ${gameCode}`;
  return { ok: true };
}

export async function getRound(gameCode: string, roundId: number, uid?: string | null) {
  const sql = getSql();
  const game = await mustGetGame(gameCode);

  if (!uid) throw new Error('UNAUTHORIZED');
  const isHost = uid === game.host_uid;
  if (!isHost) {
    const prow = await sql`
      SELECT uid FROM players WHERE game_code = ${gameCode} AND uid = ${uid} LIMIT 1
    ` as { uid: string }[];
    if (!prow[0]) throw new Error('NOT_IN_GAME');
    if (game.status !== 'in_progress' && game.status !== 'gambit' && game.status !== 'finished') throw new Error('GAME_NOT_STARTED');
  }

  const roundRows = await sql`
    SELECT round_id, state FROM rounds WHERE game_code = ${gameCode} AND round_id = ${roundId} LIMIT 1
  ` as Pick<DbRound, 'round_id' | 'state'>[];
  const round = roundRows[0];
  if (!round) throw new Error('ROUND_NOT_FOUND');

  const subCnt = await sql`
    SELECT COUNT(*)::int AS c FROM round_submissions WHERE game_code = ${gameCode} AND round_id = ${roundId}
  ` as { c: number }[];
  const playersCnt = await sql`
    SELECT COUNT(*)::int AS c FROM players WHERE game_code = ${gameCode}
  ` as { c: number }[];

  const playersTotalCount = Math.max(0, playersCnt[0]?.c ?? 0);
  const playersDoneCount = subCnt[0]?.c ?? 0;

  let submittedAtByUid: Record<string, number> | null = null;
  if (isHost) {
    const subs = await sql`
      SELECT uid, submitted_at::text AS submitted_at
      FROM round_submissions
      WHERE game_code = ${gameCode} AND round_id = ${roundId}
    ` as Pick<DbSubmission, 'uid' | 'submitted_at'>[];
    submittedAtByUid = {};
    for (const s of subs) {
      if (!s.uid) continue;
      submittedAtByUid[s.uid] = toMs(s.submitted_at) ?? Date.now();
    }
  }

  let mySubmission: { uid: string; notes: string; ranking: string[]; submittedAt: number } | null = null;
  if (uid) {
    const subRows = await sql`
      SELECT uid, notes, ranking, submitted_at::text AS submitted_at
      FROM round_submissions
      WHERE game_code = ${gameCode} AND round_id = ${roundId} AND uid = ${uid}
      LIMIT 1
    ` as Pick<DbSubmission, 'uid' | 'notes' | 'ranking' | 'submitted_at'>[];
    const submission = subRows[0];
    if (submission) {
      mySubmission = {
        uid: submission.uid,
        notes: submission.notes,
        ranking: parseRanking(submission.ranking),
        submittedAt: toMs(submission.submitted_at) ?? Date.now(),
      };
    }
  }

  const bottlesPerRound = game.bottles_per_round ?? 4;
  const roundWines = await sql`
    SELECT rw.wine_id, rw.position, w.nickname
    FROM round_wines rw
    INNER JOIN wines w ON w.game_code = rw.game_code AND w.wine_id = rw.wine_id
    WHERE rw.game_code = ${gameCode} AND rw.round_id = ${roundId}
    ORDER BY rw.position ASC NULLS LAST, rw.wine_id ASC
  ` as DbRoundWineJoin[];

  const sorted = [...roundWines].sort((a, b) => {
    const ap = a.position ?? Number.MAX_SAFE_INTEGER;
    const bp = b.position ?? Number.MAX_SAFE_INTEGER;
    if (ap !== bp) return ap - bp;
    return a.wine_id.localeCompare(b.wine_id);
  });

  const wineNicknamesRaw = sorted.map((rw) => rw.nickname ?? '');
  const wineNicknames = wineNicknamesRaw.slice(0, bottlesPerRound);
  while (wineNicknames.length < bottlesPerRound) wineNicknames.push('');

  const roundWinesListRaw = sorted.map((rw) => ({ id: rw.wine_id, nickname: rw.nickname ?? '' }));
  const roundWinesList = roundWinesListRaw.slice(0, bottlesPerRound);

  return {
    gameCode,
    roundId: round.round_id,
    totalRounds: game.total_rounds,
    gameStatus: game.status,
    gameCurrentRound: game.current_round,
    bottlesPerRound,
    roundWines: roundWinesList,
    wineNicknames,
    state: round.state,
    isHost,
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

function safeParseNotesMap(notes: string): Record<string, string> {
  try {
    const parsed = JSON.parse(notes) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(obj)) if (typeof v === 'string') out[k] = v;
      return out;
    }
  } catch {
    // ignore
  }
  return {};
}

export async function getRoundReveal(gameCode: string, roundId: number, uid: string) {
  const sql = getSql();
  const { game, isHost } = await ensureInGame(gameCode, uid);

  if (!isHost) {
    if (game.status !== 'in_progress' && game.status !== 'gambit' && game.status !== 'finished') throw new Error('GAME_NOT_STARTED');
  }

  const roundRows = await sql`
    SELECT round_id, state FROM rounds WHERE game_code = ${gameCode} AND round_id = ${roundId} LIMIT 1
  ` as Pick<DbRound, 'round_id' | 'state'>[];
  const round = roundRows[0];
  if (!round) throw new Error('ROUND_NOT_FOUND');
  if (round.state !== 'closed') throw new Error('ROUND_NOT_CLOSED');

  const subRows = await sql`
    SELECT uid, notes, ranking, submitted_at::text AS submitted_at
    FROM round_submissions
    WHERE game_code = ${gameCode} AND round_id = ${roundId} AND uid = ${uid}
    LIMIT 1
  ` as Pick<DbSubmission, 'uid' | 'notes' | 'ranking' | 'submitted_at'>[];
  const submission = subRows[0];

  const submittedRanking = submission ? parseRanking(submission.ranking) : [];
  const notesByWineId = submission ? safeParseNotesMap(submission.notes ?? '') : {};

  const roundWines = await sql`
    SELECT rw.wine_id, rw.position, w.nickname, w.price
    FROM round_wines rw
    INNER JOIN wines w ON w.game_code = rw.game_code AND w.wine_id = rw.wine_id
    WHERE rw.game_code = ${gameCode} AND rw.round_id = ${roundId}
    ORDER BY rw.position ASC NULLS LAST, rw.wine_id ASC
  ` as {
    wine_id: string;
    position: number | null;
    nickname: string | null;
    price: unknown;
  }[];

  const sorted = [...roundWines].sort((a, b) => {
    const ap = a.position ?? Number.MAX_SAFE_INTEGER;
    const bp = b.position ?? Number.MAX_SAFE_INTEGER;
    if (ap !== bp) return ap - bp;
    return a.wine_id.localeCompare(b.wine_id);
  });

  const wineMap = new Map<string, { id: string; nickname: string; price: number | null }>();
  for (const rw of sorted) {
    if (!rw.wine_id) continue;
    wineMap.set(rw.wine_id, {
      id: rw.wine_id,
      nickname: rw.nickname ?? '',
      price: normalizeMoney(rw.price ?? null),
    });
  }

  const winesForScoring = [...wineMap.values()].map((w) => ({ wineId: w.id, price: w.price }));
  const acceptableByPosition = buildAcceptableByPosition(winesForScoring);

  const used = new Set<string>();
  const rows = acceptableByPosition.map((acceptable, idx) => {
    const submittedWineId = submittedRanking[idx] ?? null;
    const acceptableIds = Array.from(acceptable ?? new Set<string>());

    const acceptableNicknames = acceptableIds
      .map((id) => ({ id, nickname: wineMap.get(id)?.nickname ?? '' }))
      .sort((a, b) => a.nickname.localeCompare(b.nickname))
      .map((x) => x.nickname || x.id);

    let point = 0;
    if (submittedWineId && !used.has(submittedWineId) && acceptable && acceptable.has(submittedWineId)) {
      point = 1;
      used.add(submittedWineId);
    }

    return {
      position: idx,
      submittedWineId,
      submittedNickname: submittedWineId ? wineMap.get(submittedWineId)?.nickname ?? '' : '',
      correctWineIds: acceptableIds,
      correctNicknames: acceptableNicknames,
      isTie: acceptableIds.length > 1,
      point,
      note: submittedWineId ? notesByWineId[submittedWineId] ?? '' : '',
    };
  });

  const totalPoints = rows.reduce((sum, r) => sum + (r.point ?? 0), 0);
  const bottlesPerRound = game.bottles_per_round ?? 4;

  return {
    gameCode: game.game_code,
    roundId: round.round_id,
    totalRounds: game.total_rounds,
    gameStatus: game.status,
    gameCurrentRound: game.current_round,
    isHost,
    bottlesPerRound,
    totalPoints,
    maxPoints: acceptableByPosition.length,
    hasTies: rows.some((r) => r.isTie),
    submittedAt: submission ? (toMs(submission.submitted_at) ?? Date.now()) : Date.now(),
    rows,
  };
}

export async function getFinalReveal(gameCode: string, uid: string) {
  const sql = getSql();
  const { game } = await ensureInGame(gameCode, uid);

  if (game.status !== 'finished') throw new Error('FINAL_REVEAL_NOT_AVAILABLE');

  const meRows = await sql`
    SELECT uid, name FROM players WHERE game_code = ${gameCode} AND uid = ${uid} LIMIT 1
  ` as Pick<DbPlayer, 'uid' | 'name'>[];
  const me = meRows[0];
  if (!me) throw new Error('NOT_IN_GAME');

  const rounds = await sql`
    SELECT round_id, state FROM rounds WHERE game_code = ${gameCode}
  ` as Pick<DbRound, 'round_id' | 'state'>[];

  const submissionsRaw = await sql`
    SELECT round_id FROM round_submissions WHERE game_code = ${gameCode}
  ` as Pick<DbSubmission, 'round_id'>[];

  const roundIdsWithSubmissions = new Set<number>();
  for (const s of submissionsRaw) {
    if (typeof s.round_id !== 'number' || !Number.isFinite(s.round_id)) continue;
    roundIdsWithSubmissions.add(s.round_id);
  }

  const completedRoundIds = rounds
    .map((r) => r.round_id)
    .filter((rid) => typeof rid === 'number' && Number.isFinite(rid))
    .filter((rid) => rounds.some((r) => r.round_id === rid && r.state === 'closed'))
    .filter((rid) => roundIdsWithSubmissions.has(rid))
    .sort((a, b) => a - b);

  const roundsOut: Array<{
    roundId: number;
    totalPoints: number;
    maxPoints: number;
    submittedAt: number;
    wines: Array<{
      id: string;
      letter: string;
      realLabel: string;
      nickname: string;
      price: number | null;
      actualRankText: string;
      correctRankText: string;
      yourRankText: string;
      isCorrect: boolean;
      note: string;
    }>;
  }> = [];

  let totalRoundPoints = 0;
  let totalRoundMaxPoints = 0;

  for (const roundId of completedRoundIds) {
    const subRound = await sql`
      SELECT notes, ranking, submitted_at::text AS submitted_at
      FROM round_submissions
      WHERE game_code = ${gameCode} AND round_id = ${roundId} AND uid = ${uid}
      LIMIT 1
    ` as Pick<DbSubmission, 'notes' | 'ranking' | 'submitted_at'>[];
    const submission = subRound[0];

    const submittedRanking = submission ? parseRanking(submission.ranking) : [];

    const notesByWineId = submission ? safeParseNotesMap(submission.notes ?? '') : {};

    const roundWines = await sql`
      SELECT rw.wine_id, rw.position, w.letter, w.label_blinded, w.nickname, w.price
      FROM round_wines rw
      INNER JOIN wines w ON w.game_code = rw.game_code AND w.wine_id = rw.wine_id
      WHERE rw.game_code = ${gameCode} AND rw.round_id = ${roundId}
      ORDER BY rw.position ASC NULLS LAST, rw.wine_id ASC
    ` as {
      wine_id: string;
      position: number | null;
      letter: string | null;
      label_blinded: string | null;
      nickname: string | null;
      price: unknown;
    }[];

    const sorted = [...roundWines].sort((a, b) => {
      const ap = a.position ?? Number.MAX_SAFE_INTEGER;
      const bp = b.position ?? Number.MAX_SAFE_INTEGER;
      if (ap !== bp) return ap - bp;
      return a.wine_id.localeCompare(b.wine_id);
    });

    const wineMap = new Map<string, { id: string; letter: string; nickname: string; realLabel: string; price: number | null }>();
    for (const rw of sorted) {
      if (!rw.wine_id) continue;
      const letter = (rw.letter ?? '').trim();
      const nickname = (rw.nickname ?? '').trim();
      const realLabel = stripTrailingNumberMatchingLetter((rw.label_blinded ?? '').trim(), letter) || rw.wine_id;
      wineMap.set(rw.wine_id, {
        id: rw.wine_id,
        letter,
        nickname,
        realLabel,
        price: normalizeMoney(rw.price ?? null),
      });
    }

    const winesForScoring = [...wineMap.values()].map((w) => ({ wineId: w.id, price: w.price }));
    const acceptableByPosition = buildAcceptableByPosition(winesForScoring);

    const used = new Set<string>();
    const posRows = acceptableByPosition.map((acceptable, idx) => {
      const submittedWineId = submittedRanking[idx] ?? null;
      let point = 0;
      if (submittedWineId && !used.has(submittedWineId) && acceptable && acceptable.has(submittedWineId)) {
        point = 1;
        used.add(submittedWineId);
      }
      return {
        position: idx,
        submittedWineId,
        point,
      };
    });

    const isCorrectByWineId = new Map<string, boolean>();
    const yourPosByWineId = new Map<string, number>();
    for (const r of posRows) {
      if (!r.submittedWineId) continue;
      yourPosByWineId.set(r.submittedWineId, r.position);
      isCorrectByWineId.set(r.submittedWineId, r.point === 1);
    }

    const correctPositionsByWineId = new Map<string, number[]>();
    for (let pos = 0; pos < acceptableByPosition.length; pos += 1) {
      const set = acceptableByPosition[pos] ?? new Set<string>();
      for (const wineId of set.values()) {
        const list = correctPositionsByWineId.get(wineId) ?? [];
        list.push(pos);
        correctPositionsByWineId.set(wineId, list);
      }
    }

    const winesSortedByPrice = [...wineMap.values()]
      .map((w) => {
        const correctPositions = (correctPositionsByWineId.get(w.id) ?? []).sort((a, b) => a - b);
        const minCorrect = correctPositions.length ? correctPositions[0] : null;
        const maxCorrect = correctPositions.length ? correctPositions[correctPositions.length - 1] : null;
        const correctRankText =
          minCorrect === null || maxCorrect === null
            ? '–'
            : minCorrect === maxCorrect
              ? placeBadge(minCorrect)
              : `${placeBadge(minCorrect)}–${placeBadge(maxCorrect)}`;

        const yourPos = yourPosByWineId.get(w.id);
        const yourRankText = typeof yourPos === 'number' ? placeBadge(yourPos) : '–';
        const note = notesByWineId[w.id] ?? '';

        return {
          id: w.id,
          letter: w.letter,
          realLabel: w.realLabel,
          nickname: w.nickname,
          price: w.price,
          correctRankText,
          yourRankText,
          isCorrect: isCorrectByWineId.get(w.id) ?? false,
          note,
        };
      })
      .sort((a, b) => {
        const ap = typeof a.price === 'number' && Number.isFinite(a.price) ? a.price : Number.NEGATIVE_INFINITY;
        const bp = typeof b.price === 'number' && Number.isFinite(b.price) ? b.price : Number.NEGATIVE_INFINITY;
        if (bp !== ap) return bp - ap;
        return a.realLabel.localeCompare(b.realLabel);
      });

    const actualRankByWineId = new Map<string, string>();
    const cents = (v: number | null) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) : null);
    let i = 0;
    while (i < winesSortedByPrice.length) {
      const c = cents(winesSortedByPrice[i]?.price ?? null);
      let j = i;
      while (j + 1 < winesSortedByPrice.length && cents(winesSortedByPrice[j + 1]?.price ?? null) === c) j += 1;
      const text = i === j ? placeBadge(i) : `${placeBadge(i)}–${placeBadge(j)}`;
      for (let k = i; k <= j; k += 1) {
        const wid = winesSortedByPrice[k]?.id;
        if (wid) actualRankByWineId.set(wid, text);
      }
      i = j + 1;
    }

    const winesOut = winesSortedByPrice.map((w) => ({
      ...w,
      actualRankText: actualRankByWineId.get(w.id) ?? '–',
    }));

    const totalPoints = posRows.reduce((sum, r) => sum + (r.point ?? 0), 0);
    const maxPoints = acceptableByPosition.length;
    totalRoundPoints += totalPoints;
    totalRoundMaxPoints += maxPoints;

    roundsOut.push({
      roundId,
      totalPoints,
      maxPoints,
      submittedAt: submission ? (toMs(submission.submitted_at) ?? Date.now()) : Date.now(),
      wines: winesOut,
    });
  }

  let gambit: null | {
    totalPoints: number;
    maxPoints: number;
    cheapestPickLabel: string | null;
    cheapestCorrectLabels: string[];
    mostExpensivePickLabel: string | null;
    mostExpensiveCorrectLabels: string[];
    favoriteLabels: string[];
    cheapestPick?: { id: string; nickname: string; realLabel: string; price: number | null } | null;
    cheapestCorrect?: Array<{ id: string; nickname: string; realLabel: string; price: number | null }>;
    mostExpensivePick?: { id: string; nickname: string; realLabel: string; price: number | null } | null;
    mostExpensiveCorrect?: Array<{ id: string; nickname: string; realLabel: string; price: number | null }>;
    favorites?: Array<{ id: string; nickname: string; realLabel: string; price: number | null }>;
  } = null;

  {
    const gambitRowList = await sql`
      SELECT cheapest_wine_id, most_expensive_wine_id, favorite_wine_ids
      FROM gambit_submissions
      WHERE game_code = ${gameCode} AND uid = ${uid}
      LIMIT 1
    ` as Pick<DbGambitSubmission, 'cheapest_wine_id' | 'most_expensive_wine_id' | 'favorite_wine_ids'>[];
    const gambitRow = gambitRowList[0];

    const wineRows = await sql`
      SELECT wine_id, letter, nickname, label_blinded, price FROM wines WHERE game_code = ${gameCode}
    ` as Pick<DbWine, 'wine_id' | 'letter' | 'nickname' | 'label_blinded' | 'price'>[];

    const nicknameById = new Map<string, string>();
    const realLabelById = new Map<string, string>();
    const priceById = new Map<string, number | null>();
    const winesForGambit: Array<{ wineId: string; price: number | null }> = [];
    for (const w of wineRows) {
      if (!w.wine_id) continue;
      const letter = (w.letter ?? '').trim();
      const nickname = (w.nickname ?? '').trim();
      const realLabel = stripTrailingNumberMatchingLetter((w.label_blinded ?? '').trim(), letter) || w.wine_id;
      nicknameById.set(w.wine_id, nickname);
      realLabelById.set(w.wine_id, realLabel);
      const normalized = normalizeMoney(w.price);
      priceById.set(w.wine_id, normalized);
      winesForGambit.push({ wineId: w.wine_id, price: normalized });
    }

    const sets = getGambitMinMaxSets(winesForGambit);
    if (sets.hasPrices) {
      const favoriteWineIds = Array.isArray(gambitRow?.favorite_wine_ids)
        ? (gambitRow?.favorite_wine_ids as unknown[]).filter((x): x is string => typeof x === 'string' && x.length > 0)
        : [];

      const cheapestPick = gambitRow?.cheapest_wine_id ?? null;
      const mostExpensivePick = gambitRow?.most_expensive_wine_id ?? null;

      const scored = scoreGambitPicks({ cheapestPickId: cheapestPick, mostExpensivePickId: mostExpensivePick }, sets);

      const wineInfo = (id: string) => ({
        id,
        nickname: nicknameById.get(id) ?? '',
        realLabel: realLabelById.get(id) ?? id,
        price: priceById.get(id) ?? null,
      });

      gambit = {
        totalPoints: scored.totalPoints,
        maxPoints: GAMBIT_MAX_POINTS,
        cheapestPickLabel: cheapestPick ? nicknameById.get(cheapestPick) || cheapestPick : null,
        cheapestCorrectLabels: Array.from(sets.cheapestIds.values()).map((id) => nicknameById.get(id) || id),
        mostExpensivePickLabel: mostExpensivePick ? nicknameById.get(mostExpensivePick) || mostExpensivePick : null,
        mostExpensiveCorrectLabels: Array.from(sets.mostExpensiveIds.values()).map((id) => nicknameById.get(id) || id),
        favoriteLabels: favoriteWineIds.map((id) => nicknameById.get(id) || id),
        cheapestPick: cheapestPick ? wineInfo(cheapestPick) : null,
        cheapestCorrect: Array.from(sets.cheapestIds.values())
          .map(wineInfo)
          .sort((a, b) => (a.nickname || a.realLabel).localeCompare(b.nickname || b.realLabel)),
        mostExpensivePick: mostExpensivePick ? wineInfo(mostExpensivePick) : null,
        mostExpensiveCorrect: Array.from(sets.mostExpensiveIds.values())
          .map(wineInfo)
          .sort((a, b) => (a.nickname || a.realLabel).localeCompare(b.nickname || b.realLabel)),
        favorites: favoriteWineIds
          .map(wineInfo)
          .sort((a, b) => (a.nickname || a.realLabel).localeCompare(b.nickname || b.realLabel)),
      };
    }
  }

  return {
    gameCode,
    status: game.status,
    me: {
      uid: me.uid,
      name: me.name,
      totalRoundPoints,
      totalRoundMaxPoints,
    },
    rounds: roundsOut,
    gambit,
  };
}

export async function submitRound(gameCode: string, roundId: number, uid: string, notes: string, ranking: string[]) {
  const sql = getSql();

  const game = await mustGetGame(gameCode);
  if (game.status === 'finished' || game.status === 'gambit') throw new Error('GAME_FINISHED');
  if (game.status !== 'in_progress') throw new Error('GAME_NOT_STARTED');
  if (roundId !== game.current_round) throw new Error('ROUND_NOT_CURRENT');

  const roundRows = await sql`
    SELECT state FROM rounds WHERE game_code = ${gameCode} AND round_id = ${roundId} LIMIT 1
  ` as Pick<DbRound, 'state'>[];
  const round = roundRows[0];
  if (!round) throw new Error('ROUND_NOT_FOUND');
  if (round.state !== 'open') throw new Error('ROUND_CLOSED');

  const playerRows = await sql`
    SELECT uid FROM players WHERE game_code = ${gameCode} AND uid = ${uid} LIMIT 1
  ` as { uid: string }[];
  if (!playerRows[0]) throw new Error('NOT_IN_GAME');

  const assignedRows = await sql`
    SELECT wine_id, position FROM round_wines
    WHERE game_code = ${gameCode} AND round_id = ${roundId}
    ORDER BY position ASC NULLS LAST, wine_id ASC
  ` as Pick<DbRoundWine, 'wine_id' | 'position'>[];

  const assignedIds = assignedRows.map((r) => r.wine_id).filter((x): x is string => typeof x === 'string' && x.length > 0);
  if (!assignedIds.length) throw new Error('ROUND_NOT_CONFIGURED');

  const uniqueSubmitted = new Set(ranking);
  const uniqueAssigned = new Set(assignedIds);
  const sameLength = uniqueSubmitted.size === uniqueAssigned.size && ranking.length === assignedIds.length;
  const allBelong = ranking.every((id) => uniqueAssigned.has(id));
  if (!sameLength || !allBelong) throw new Error('INVALID_RANKING');

  const submittedAt = new Date().toISOString();
  const rankingJson = JSON.stringify(ranking);

  await sql`
    INSERT INTO round_submissions (game_code, round_id, uid, notes, ranking, submitted_at)
    VALUES (${gameCode}, ${roundId}, ${uid}, ${notes}, ${rankingJson}::jsonb, ${submittedAt}::timestamptz)
    ON CONFLICT (game_code, round_id, uid)
    DO UPDATE SET
      notes = EXCLUDED.notes,
      ranking = EXCLUDED.ranking,
      submitted_at = EXCLUDED.submitted_at
  `;

  return { ok: true };
}

export async function closeRound(gameCode: string, hostUid: string, roundId: number) {
  const sql = getSql();
  const game = await ensureHost(gameCode, hostUid);
  if (game.status === 'gambit' || game.status === 'finished') return { ok: true };
  if (game.status !== 'in_progress') throw new Error('GAME_NOT_STARTED');
  if (roundId !== game.current_round) throw new Error('ROUND_NOT_CURRENT');

  const roundRows = await sql`
    SELECT state FROM rounds WHERE game_code = ${gameCode} AND round_id = ${roundId} LIMIT 1
  ` as Pick<DbRound, 'state'>[];
  const round = roundRows[0];
  if (!round) throw new Error('ROUND_NOT_FOUND');
  if (round.state === 'closed') return { ok: true };

  const hostSub = await sql`
    SELECT uid FROM round_submissions
    WHERE game_code = ${gameCode} AND round_id = ${roundId} AND uid = ${hostUid}
    LIMIT 1
  ` as Pick<DbSubmission, 'uid'>[];
  if (!hostSub[0]) throw new Error('HOST_MUST_SUBMIT');

  const updated = await sql`
    UPDATE rounds SET state = 'closed'
    WHERE game_code = ${gameCode} AND round_id = ${roundId}
    RETURNING round_id
  ` as { round_id: number }[];
  if (!updated[0]) throw new Error('ROUND_NOT_FOUND');
  return { ok: true };
}

export async function advanceRound(gameCode: string, hostUid: string) {
  const sql = getSql();
  const game = await ensureHost(gameCode, hostUid);
  if (game.status === 'gambit' || game.status === 'finished') return { ok: true, finished: true, nextRound: null };
  if (game.status !== 'in_progress') throw new Error('GAME_NOT_STARTED');

  const curRows = await sql`
    SELECT state FROM rounds WHERE game_code = ${gameCode} AND round_id = ${game.current_round} LIMIT 1
  ` as Pick<DbRound, 'state'>[];
  const currentRound = curRows[0];
  if (!currentRound) throw new Error('ROUND_NOT_FOUND');
  if (currentRound.state !== 'closed') throw new Error('ROUND_NOT_CLOSED');

  if (game.current_round >= game.total_rounds) {
    await sql`UPDATE games SET status = 'gambit' WHERE game_code = ${gameCode}`;
    return { ok: true, finished: true, nextRound: null };
  }

  const nextRound = game.current_round + 1;
  await sql`UPDATE games SET current_round = ${nextRound} WHERE game_code = ${gameCode}`;

  const opened = await sql`
    UPDATE rounds SET state = 'open'
    WHERE game_code = ${gameCode} AND round_id = ${nextRound}
    RETURNING round_id
  ` as { round_id: number }[];
  if (!opened[0]) throw new Error('ROUND_NOT_FOUND');

  return { ok: true, finished: false, nextRound };
}

export async function getLeaderboard(gameCode: string, uid?: string | null) {
  const sql = getSql();
  const game = await mustGetGame(gameCode);

  const rounds = await sql`
    SELECT round_id, state FROM rounds WHERE game_code = ${gameCode}
  ` as Pick<DbRound, 'round_id' | 'state'>[];

  const closedRoundIds = new Set<number>();
  for (const r of rounds) {
    if (typeof r.round_id !== 'number' || !Number.isFinite(r.round_id)) continue;
    if (r.state === 'closed') closedRoundIds.add(r.round_id);
  }

  const players = await sql`
    SELECT uid, name, joined_at::text AS joined_at, is_competing
    FROM players
    WHERE game_code = ${gameCode}
    ORDER BY joined_at ASC
  ` as Pick<DbPlayer, 'uid' | 'name' | 'joined_at' | 'is_competing'>[];

  const submissionsRaw = await sql`
    SELECT uid, round_id, ranking FROM round_submissions WHERE game_code = ${gameCode}
  ` as Pick<DbSubmission, 'uid' | 'round_id' | 'ranking'>[];

  const roundIdsWithSubmissions = new Set<number>();
  for (const s of submissionsRaw) {
    if (typeof s.round_id !== 'number' || !Number.isFinite(s.round_id)) continue;
    roundIdsWithSubmissions.add(s.round_id);
  }

  const completedRoundIds = new Set<number>();
  for (const rid of closedRoundIds) if (roundIdsWithSubmissions.has(rid)) completedRoundIds.add(rid);
  const lastCompletedRoundId = completedRoundIds.size ? Math.max(...Array.from(completedRoundIds.values())) : 0;

  const roundWineRows = await sql`
    SELECT rw.round_id, rw.wine_id, w.price
    FROM round_wines rw
    INNER JOIN wines w ON w.game_code = rw.game_code AND w.wine_id = rw.wine_id
    WHERE rw.game_code = ${gameCode}
  ` as { round_id: number; wine_id: string; price: unknown }[];

  const scores: Record<string, number> = {};
  const lastRoundPoints: Record<string, number> = {};
  const gambitPoints: Record<string, number> = {};
  for (const p of players) scores[p.uid] = 0;

  const winesByRound = new Map<number, Array<{ wineId: string; price: number | null }>>();
  for (const row of roundWineRows) {
    if (typeof row.round_id !== 'number' || !Number.isFinite(row.round_id)) continue;
    if (!row.wine_id) continue;
    const list = winesByRound.get(row.round_id) ?? [];
    list.push({ wineId: row.wine_id, price: normalizeMoney(row.price ?? null) });
    winesByRound.set(row.round_id, list);
  }

  const acceptableByPositionByRound = new Map<number, Array<Set<string>>>();
  for (const [rid, wines] of winesByRound.entries()) {
    acceptableByPositionByRound.set(rid, buildAcceptableByPosition(wines));
  }

  for (const s of submissionsRaw) {
    if (!completedRoundIds.has(s.round_id)) continue;

    const acceptableByPosition = acceptableByPositionByRound.get(s.round_id) ?? [];
    const submitted = parseRanking(s.ranking);

    const points = scoreRanking(acceptableByPosition, submitted);

    scores[s.uid] = (scores[s.uid] ?? 0) + points;
    if (lastCompletedRoundId > 0 && s.round_id === lastCompletedRoundId) {
      lastRoundPoints[s.uid] = (lastRoundPoints[s.uid] ?? 0) + points;
    }
  }

  let hasAnyGambitSubmissions = false;
  if (shouldIncludeGambitPoints(game.status)) {
    const wineRows = await sql`
      SELECT wine_id, price FROM wines WHERE game_code = ${gameCode}
    ` as Pick<DbWine, 'wine_id' | 'price'>[];

    const winesForGambit = wineRows
      .filter((w) => !!w.wine_id)
      .map((w) => ({ wineId: w.wine_id, price: normalizeMoney(w.price) }));

    const sets = getGambitMinMaxSets(winesForGambit);
    if (sets.hasPrices) {
      const gambitRows = await sql`
        SELECT uid, cheapest_wine_id, most_expensive_wine_id FROM gambit_submissions WHERE game_code = ${gameCode}
      ` as Pick<DbGambitSubmission, 'uid' | 'cheapest_wine_id' | 'most_expensive_wine_id'>[];
      hasAnyGambitSubmissions = !!(gambitRows && gambitRows.length);

      for (const g of gambitRows) {
        if (!g.uid) continue;
        const scored = scoreGambitPicks(
          { cheapestPickId: g.cheapest_wine_id ?? null, mostExpensivePickId: g.most_expensive_wine_id ?? null },
          sets
        );
        gambitPoints[g.uid] = scored.totalPoints;
        if (scored.totalPoints) scores[g.uid] = (scores[g.uid] ?? 0) + scored.totalPoints;
      }
    }
  }

  const shouldShowGambitDelta = shouldIncludeGambitPoints(game.status) && hasAnyGambitSubmissions;

  const competingPlayers = players.filter((p) => (typeof p.is_competing === 'boolean' ? p.is_competing : true));
  const excludedPlayers = players.filter((p) => (typeof p.is_competing === 'boolean' ? !p.is_competing : false));

  const leaderboard = competingPlayers
    .map((p) => ({
      uid: p.uid,
      name: p.name,
      score: scores[p.uid] ?? 0,
      delta: shouldShowGambitDelta ? (gambitPoints[p.uid] ?? 0) : (lastRoundPoints[p.uid] ?? 0),
    }))
    .sort((a, b) => b.score - a.score);

  const excluded = excludedPlayers
    .map((p) => ({
      uid: p.uid,
      name: p.name,
      score: scores[p.uid] ?? 0,
      delta: shouldShowGambitDelta ? (gambitPoints[p.uid] ?? 0) : (lastRoundPoints[p.uid] ?? 0),
    }))
    .sort((a, b) => b.score - a.score);

  return {
    gameCode,
    status: game.status,
    isHost: !!uid && uid === game.host_uid,
    leaderboard,
    excluded,
  };
}

export async function getGambitState(gameCode: string, uid: string) {
  const sql = getSql();
  const { game, isHost } = await ensureInGame(gameCode, uid);

  if (game.status !== 'gambit' && game.status !== 'finished') throw new Error('GAMBIT_NOT_AVAILABLE');

  const subCnt = await sql`
    SELECT COUNT(*)::int AS c FROM gambit_submissions WHERE game_code = ${gameCode}
  ` as { c: number }[];
  const playersCnt = await sql`
    SELECT COUNT(*)::int AS c FROM players WHERE game_code = ${gameCode}
  ` as { c: number }[];

  const playersTotalCount = Math.max(0, playersCnt[0]?.c ?? 0);
  const playersDoneCount = subCnt[0]?.c ?? 0;

  const wines = await sql`
    SELECT wine_id, letter, nickname, created_at::text AS created_at
    FROM wines
    WHERE game_code = ${gameCode}
    ORDER BY created_at ASC
  ` as Pick<DbWine, 'wine_id' | 'letter' | 'nickname' | 'created_at'>[];

  const roundWines = await sql`
    SELECT wine_id, round_id FROM round_wines WHERE game_code = ${gameCode}
  ` as { wine_id: string; round_id: number }[];

  const roundByWineId: Record<string, number> = {};
  for (const rw of roundWines) {
    if (rw.wine_id && rw.round_id) {
      roundByWineId[rw.wine_id] = rw.round_id;
    }
  }

  const submissionRows = await sql`
    SELECT cheapest_wine_id, most_expensive_wine_id, favorite_wine_ids, submitted_at::text AS submitted_at
    FROM gambit_submissions
    WHERE game_code = ${gameCode} AND uid = ${uid}
    LIMIT 1
  ` as Pick<DbGambitSubmission, 'cheapest_wine_id' | 'most_expensive_wine_id' | 'favorite_wine_ids' | 'submitted_at'>[];
  const submission = submissionRows[0];

  const favoriteWineIds = Array.isArray(submission?.favorite_wine_ids)
    ? (submission?.favorite_wine_ids as unknown[]).filter((x): x is string => typeof x === 'string' && x.length > 0)
    : [];

  const roundSubmissions = await sql`
    SELECT notes FROM round_submissions WHERE game_code = ${gameCode} AND uid = ${uid}
  ` as Pick<DbSubmission, 'notes'>[];

  const notesByWineId: Record<string, string> = {};
  for (const sub of roundSubmissions) {
    const parsed = safeParseNotesMap(sub.notes ?? '');
    for (const [wineId, note] of Object.entries(parsed)) {
      if (note && note.trim()) {
        if (notesByWineId[wineId]) {
          notesByWineId[wineId] += '\n---\n' + note;
        } else {
          notesByWineId[wineId] = note;
        }
      }
    }
  }

  return {
    gameCode,
    status: game.status,
    isHost,
    submissionsCount: playersDoneCount,
    playersDoneCount,
    playersTotalCount,
    wines: wines.map((w) => ({
      id: w.wine_id,
      letter: w.letter,
      nickname: w.nickname ?? '',
      note: notesByWineId[w.wine_id] ?? '',
      roundId: roundByWineId[w.wine_id] ?? null,
    })),
    mySubmission: submission
      ? {
          cheapestWineId: submission.cheapest_wine_id ?? null,
          mostExpensiveWineId: submission.most_expensive_wine_id ?? null,
          favoriteWineIds,
          submittedAt: toMs(submission.submitted_at) ?? Date.now(),
        }
      : null,
  };
}

export async function getGambitReveal(gameCode: string, uid: string) {
  const sql = getSql();
  const { game, isHost } = await ensureInGame(gameCode, uid);
  if (game.status !== 'gambit' && game.status !== 'finished') throw new Error('GAMBIT_NOT_AVAILABLE');
  if (game.status !== 'finished') throw new Error('GAMBIT_NOT_CLOSED');

  const submissionRows = await sql`
    SELECT uid, cheapest_wine_id, most_expensive_wine_id, favorite_wine_ids, submitted_at::text AS submitted_at
    FROM gambit_submissions
    WHERE game_code = ${gameCode} AND uid = ${uid}
    LIMIT 1
  ` as Pick<DbGambitSubmission, 'uid' | 'cheapest_wine_id' | 'most_expensive_wine_id' | 'favorite_wine_ids' | 'submitted_at'>[];
  const submission = submissionRows[0];

  const favoriteWineIds = Array.isArray(submission?.favorite_wine_ids)
    ? (submission?.favorite_wine_ids as unknown[]).filter((x): x is string => typeof x === 'string' && x.length > 0)
    : [];

  const wines = await sql`
    SELECT wine_id, letter, nickname, label_blinded, price FROM wines WHERE game_code = ${gameCode}
  ` as Pick<DbWine, 'wine_id' | 'letter' | 'nickname' | 'label_blinded' | 'price'>[];

  const labelById = new Map<string, string>();
  const priceById = new Map<string, number | null>();
  const winesForGambit: Array<{ wineId: string; price: number | null }> = [];
  for (const w of wines) {
    if (!w.wine_id) continue;
    const nickname = (w.nickname ?? '').trim();
    labelById.set(w.wine_id, nickname || w.wine_id);
    const normalized = normalizeMoney(w.price);
    priceById.set(w.wine_id, normalized);
    winesForGambit.push({ wineId: w.wine_id, price: normalized });
  }

  const sets = getGambitMinMaxSets(winesForGambit);
  if (!sets.hasPrices) throw new Error('WINE_LIST_INCOMPLETE');

  const cheapestPickId = submission?.cheapest_wine_id ?? null;
  const expensivePickId = submission?.most_expensive_wine_id ?? null;

  const scored = scoreGambitPicks({ cheapestPickId, mostExpensivePickId: expensivePickId }, sets);

  function labelsFor(ids: Iterable<string>) {
    return Array.from(ids)
      .map((id) => labelById.get(id) ?? id)
      .sort((a, b) => a.localeCompare(b));
  }

  return {
    gameCode: game.game_code,
    status: game.status,
    isHost,
    submittedAt: toMs(submission?.submitted_at ?? null) ?? 0,
    totalPoints: scored.totalPoints,
    maxPoints: GAMBIT_MAX_POINTS,
    cheapest: {
      pickId: cheapestPickId,
      pickLabel: cheapestPickId ? labelById.get(cheapestPickId) ?? cheapestPickId : null,
      pickPrice: cheapestPickId ? (priceById.get(cheapestPickId) ?? null) : null,
      correctIds: Array.from(sets.cheapestIds),
      correctLabels: labelsFor(sets.cheapestIds),
      correct: Array.from(sets.cheapestIds)
        .map((id) => ({ id, label: labelById.get(id) ?? id, price: priceById.get(id) ?? null }))
        .sort((a, b) => a.label.localeCompare(b.label)),
      isTie: sets.cheapestIds.size > 1,
      points: scored.cheapestPoints,
    },
    mostExpensive: {
      pickId: expensivePickId,
      pickLabel: expensivePickId ? labelById.get(expensivePickId) ?? expensivePickId : null,
      pickPrice: expensivePickId ? (priceById.get(expensivePickId) ?? null) : null,
      correctIds: Array.from(sets.mostExpensiveIds),
      correctLabels: labelsFor(sets.mostExpensiveIds),
      correct: Array.from(sets.mostExpensiveIds)
        .map((id) => ({ id, label: labelById.get(id) ?? id, price: priceById.get(id) ?? null }))
        .sort((a, b) => a.label.localeCompare(b.label)),
      isTie: sets.mostExpensiveIds.size > 1,
      points: scored.mostExpensivePoints,
    },
    favorites: {
      ids: favoriteWineIds,
      labels: favoriteWineIds.map((id) => labelById.get(id) ?? id),
      wines: favoriteWineIds
        .map((id) => ({ id, label: labelById.get(id) ?? id, price: priceById.get(id) ?? null }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    },
  };
}

export async function getGambitProgress(gameCode: string, uid: string) {
  const sql = getSql();
  const { game } = await ensureInGame(gameCode, uid);
  if (game.status !== 'gambit' && game.status !== 'finished') throw new Error('GAMBIT_NOT_AVAILABLE');

  const players = await sql`
    SELECT uid, name, joined_at::text AS joined_at
    FROM players
    WHERE game_code = ${gameCode}
    ORDER BY joined_at ASC
  ` as Pick<DbPlayer, 'uid' | 'name' | 'joined_at'>[];
  const normalizedPlayers = players.filter((p) => !!p.uid);
  const playerUids = normalizedPlayers.map((p) => p.uid);

  const subs = await sql`
    SELECT uid, submitted_at::text AS submitted_at FROM gambit_submissions WHERE game_code = ${gameCode}
  ` as Pick<DbGambitSubmission, 'uid' | 'submitted_at'>[];

  const submittedAtByUid: Record<string, number> = {};
  for (const s of subs) {
    if (!s.uid) continue;
    submittedAtByUid[s.uid] = toMs(s.submitted_at) ?? Date.now();
  }

  const submittedUids = Object.keys(submittedAtByUid);
  const submittedSet = new Set(submittedUids);
  const playersTotalCount = playerUids.length;
  const playersDoneCount = playerUids.filter((u) => submittedSet.has(u)).length;

  return {
    gameCode,
    submissionsCount: playersDoneCount,
    playersDoneCount,
    playersTotalCount,
    players: normalizedPlayers.map((p) => ({
      uid: p.uid,
      name: p.name ?? 'Player',
      joinedAt: toMs(p.joined_at) ?? Date.now(),
    })),
    submittedUids,
    submittedAtByUid,
  };
}

export async function submitGambit(
  gameCode: string,
  uid: string,
  cheapestWineId: string,
  mostExpensiveWineId: string,
  favoriteWineIds: string[]
) {
  const sql = getSql();
  const { game } = await ensureInGame(gameCode, uid);

  if (game.status !== 'gambit' && game.status !== 'finished') throw new Error('GAMBIT_NOT_AVAILABLE');

  const uniqueFavs = Array.from(new Set((favoriteWineIds ?? []).filter((x) => typeof x === 'string' && x.length > 0)));
  if (!uniqueFavs.length) throw new Error('INVALID_INPUT');

  if (cheapestWineId === mostExpensiveWineId) throw new Error('GAMBIT_DUPLICATE_PICK');

  const allIds = new Set([cheapestWineId, mostExpensiveWineId, ...uniqueFavs]);
  for (const id of allIds) {
    const row = await sql`
      SELECT wine_id FROM wines WHERE game_code = ${gameCode} AND wine_id = ${id} LIMIT 1
    ` as { wine_id: string }[];
    if (!row[0]) throw new Error('INVALID_WINE_ID');
  }

  const submittedAt = new Date().toISOString();
  const favJson = JSON.stringify(uniqueFavs);

  await sql`
    INSERT INTO gambit_submissions (game_code, uid, cheapest_wine_id, most_expensive_wine_id, favorite_wine_ids, submitted_at)
    VALUES (${gameCode}, ${uid}, ${cheapestWineId}, ${mostExpensiveWineId}, ${favJson}::jsonb, ${submittedAt}::timestamptz)
    ON CONFLICT (game_code, uid)
    DO UPDATE SET
      cheapest_wine_id = EXCLUDED.cheapest_wine_id,
      most_expensive_wine_id = EXCLUDED.most_expensive_wine_id,
      favorite_wine_ids = EXCLUDED.favorite_wine_ids,
      submitted_at = EXCLUDED.submitted_at
  `;

  return { ok: true };
}

export async function listWines(gameCode: string, hostUid: string) {
  const sql = getSql();
  await ensureHost(gameCode, hostUid);

  const data = await sql`
    SELECT wine_id, letter, label_blinded, nickname, price, created_at::text AS created_at
    FROM wines
    WHERE game_code = ${gameCode}
    ORDER BY created_at ASC
  ` as Pick<DbWine, 'wine_id' | 'letter' | 'label_blinded' | 'nickname' | 'price' | 'created_at'>[];

  return data.map((w) => ({
    id: w.wine_id,
    letter: w.letter,
    labelBlinded: w.label_blinded,
    nickname: w.nickname,
    price: normalizeMoney(w.price),
  }));
}

export async function upsertWines(
  gameCode: string,
  hostUid: string,
  wines: Array<{ id: string; letter: string; labelBlinded: string; nickname: string; price?: number | null }>
) {
  await ensureHost(gameCode, hostUid);

  function normalizePriceForStorage(n: unknown): number | null {
    const normalized = normalizeMoney(n);
    if (normalized === null) return null;
    if (normalized < 0) return null;
    return normalized;
  }

  const sql = getSql();
  for (const w of wines) {
    const price = normalizePriceForStorage(w.price);
    const label = stripTrailingNumberMatchingLetter(w.labelBlinded ?? '', w.letter);
    await sql`
      INSERT INTO wines (game_code, wine_id, letter, label_blinded, nickname, price)
      VALUES (${gameCode}, ${w.id}, ${w.letter}, ${label}, ${w.nickname ?? ''}, ${price})
      ON CONFLICT (game_code, wine_id)
      DO UPDATE SET
        letter = EXCLUDED.letter,
        label_blinded = EXCLUDED.label_blinded,
        nickname = EXCLUDED.nickname,
        price = EXCLUDED.price
    `;
  }

  return { ok: true };
}

export async function deleteWine(gameCode: string, hostUid: string, wineId: string) {
  const sql = getSql();
  await ensureHost(gameCode, hostUid);

  await sql`DELETE FROM wines WHERE game_code = ${gameCode} AND wine_id = ${wineId}`;
  return { ok: true };
}

export async function getAssignments(gameCode: string, hostUid: string) {
  const sql = getSql();
  const game = await ensureHost(gameCode, hostUid);

  const data = await sql`
    SELECT round_id, wine_id, position
    FROM round_wines
    WHERE game_code = ${gameCode}
    ORDER BY round_id ASC, position ASC NULLS LAST
  ` as Pick<DbRoundWine, 'round_id' | 'wine_id' | 'position'>[];

  const map = new Map<number, string[]>();
  for (let rid = 1; rid <= game.total_rounds; rid += 1) map.set(rid, []);

  for (const row of data) {
    const list = map.get(row.round_id) ?? [];
    list.push(row.wine_id);
    map.set(row.round_id, list);
  }

  return Array.from(map.entries()).map(([roundId, wineIds]) => ({ roundId, wineIds }));
}

export async function setAssignments(
  gameCode: string,
  hostUid: string,
  assignments: Array<{ roundId: number; wineIds: string[] }>
) {
  const game = await ensureHost(gameCode, hostUid);

  await withTransaction(async (q) => {
    await q(`DELETE FROM round_wines WHERE game_code = $1`, [gameCode]);

    const rows: Array<{ game_code: string; round_id: number; wine_id: string; position: number }> = [];
    for (const a of assignments) {
      if (a.roundId < 1 || a.roundId > game.total_rounds) continue;
      for (let i = 0; i < a.wineIds.length; i += 1) {
        rows.push({ game_code: gameCode, round_id: a.roundId, wine_id: a.wineIds[i], position: i + 1 });
      }
    }

    if (rows.length) {
      const parts: string[] = [];
      const params: unknown[] = [];
      let pi = 1;
      for (const r of rows) {
        parts.push(`($${pi}, $${pi + 1}, $${pi + 2}, $${pi + 3})`);
        pi += 4;
        params.push(r.game_code, r.round_id, r.wine_id, r.position);
      }
      await q(`INSERT INTO round_wines (game_code, round_id, wine_id, position) VALUES ${parts.join(', ')}`, params);
    }
  });

  return { ok: true };
}
