import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { generateGameCode } from '@/lib/gameCode';
import { newUid } from '@/lib/uid';

export type GameStatus = 'setup' | 'lobby' | 'in_progress' | 'finished';
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
  price: number | null;
  created_at: string;
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
  wines: { nickname: string } | null;
};

function toMs(ts: string | null) {
  if (!ts) return null;
  const n = Date.parse(ts);
  return Number.isFinite(n) ? n : null;
}

type GameSetupFields = {
  players?: number;
  bottles?: number;
  bottlesPerRound?: number;
  bottleEqPerPerson?: number;
  ozPerPersonPerBottle?: number;
};

async function mustGetGame(gameCode: string): Promise<DbGame> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('games')
    .select(
      'game_code, host_uid, status, created_at, started_at, current_round, total_rounds, players, bottles, bottles_per_round, bottle_eq_per_person, oz_per_person_per_bottle'
    )
    .eq('game_code', gameCode)
    .maybeSingle<DbGame>();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('GAME_NOT_FOUND');
  return data;
}

async function ensureHost(gameCode: string, uid: string): Promise<DbGame> {
  const game = await mustGetGame(gameCode);
  if (game.host_uid !== uid) throw new Error('NOT_HOST');
  return game;
}

export async function createGame(
  hostName: string | undefined,
  totalRounds?: number,
  setup?: GameSetupFields
) {
  const supabase = getSupabaseAdmin();

  const hostUid = newUid();
  const rounds = totalRounds && Number.isFinite(totalRounds) ? totalRounds : 3;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const gameCode = generateGameCode();

    const { error: insertGameError } = await supabase.from('games').insert({
      game_code: gameCode,
      host_uid: hostUid,
      status: 'setup',
      current_round: 1,
      total_rounds: rounds,
      players: setup?.players ?? null,
      bottles: setup?.bottles ?? null,
      bottles_per_round: setup?.bottlesPerRound ?? null,
      bottle_eq_per_person: setup?.bottleEqPerPerson ?? null,
      oz_per_person_per_bottle: setup?.ozPerPersonPerBottle ?? null,
    });

    if (insertGameError) {
      const msg = insertGameError.message.toLowerCase();
      if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('already exists')) {
        continue;
      }
      throw new Error(insertGameError.message);
    }

    const { error: insertHostError } = await supabase.from('players').insert({
      game_code: gameCode,
      uid: hostUid,
      name: hostName?.trim() || 'Host',
    });

    if (insertHostError) throw new Error(insertHostError.message);

    const roundsRows = Array.from({ length: rounds }, (_, idx) => ({
      game_code: gameCode,
      round_id: idx + 1,
      // keep rounds locked until the game starts
      state: 'closed' as const,
    }));

    const { error: insertRoundsError } = await supabase.from('rounds').insert(roundsRows);
    if (insertRoundsError) throw new Error(insertRoundsError.message);

    return { gameCode, hostUid };
  }

  throw new Error('FAILED_TO_CREATE_GAME');
}

export async function joinGame(gameCode: string, playerName: string) {
  const supabase = getSupabaseAdmin();
  const game = await mustGetGame(gameCode);
  if (game.status === 'finished') throw new Error('GAME_FINISHED');
  if (game.status === 'in_progress') throw new Error('GAME_ALREADY_STARTED');

  // If the host configured a max player count, enforce it.
  if (typeof game.players === 'number' && Number.isFinite(game.players) && game.players > 0) {
    const { count, error: countError } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('game_code', gameCode);
    if (countError) throw new Error(countError.message);
    const current = typeof count === 'number' ? count : 0;
    if (current >= game.players) throw new Error('GAME_FULL');
  }

  const uid = newUid();
  const { error: insertPlayerError } = await supabase.from('players').insert({
    game_code: gameCode,
    uid,
    name: playerName.trim() || 'Player',
  });

  if (insertPlayerError) throw new Error(insertPlayerError.message);

  if (game.status === 'setup') {
    const { error: updateStatusError } = await supabase
      .from('games')
      .update({ status: 'lobby' })
      .eq('game_code', gameCode)
      .eq('status', 'setup');

    if (updateStatusError) throw new Error(updateStatusError.message);
  }

  return { uid };
}

export async function getGamePublic(gameCode: string, uid?: string | null) {
  const supabase = getSupabaseAdmin();
  const game = await mustGetGame(gameCode);

  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('uid, name, joined_at')
    .eq('game_code', gameCode)
    .order('joined_at', { ascending: true })
    .returns<Array<Pick<DbPlayer, 'uid' | 'name' | 'joined_at'>>>();

  if (playersError) throw new Error(playersError.message);

  if (uid && uid !== game.host_uid) {
    const exists = (players ?? []).some((p: Pick<DbPlayer, 'uid'>) => p.uid === uid);
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
    players: (players ?? []).map((p: Pick<DbPlayer, 'uid' | 'name' | 'joined_at'>) => ({
      uid: p.uid,
      name: p.name,
      joinedAt: toMs(p.joined_at) ?? Date.now(),
    })),
    isHost,
  };
}

export async function startGame(gameCode: string, hostUid: string) {
  const supabase = getSupabaseAdmin();
  const game = await ensureHost(gameCode, hostUid);

  if (game.status === 'finished') throw new Error('GAME_FINISHED');
  if (game.status === 'in_progress') return { ok: true };

  if (typeof game.bottles === 'number' && Number.isFinite(game.bottles) && game.bottles > 0) {
    const { count, error: winesCountError } = await supabase
      .from('wines')
      .select('*', { count: 'exact', head: true })
      .eq('game_code', gameCode);

    if (winesCountError) throw new Error(winesCountError.message);

    const winesCount = typeof count === 'number' ? count : 0;
    if (winesCount !== game.bottles) throw new Error('WINE_LIST_INCOMPLETE');
  }

  const { error } = await supabase
    .from('games')
    .update({ status: 'in_progress', started_at: new Date().toISOString(), current_round: 1 })
    .eq('game_code', gameCode);

  if (error) throw new Error(error.message);

  // Open the first round, keep the rest closed.
  const { error: closeAllRoundsError } = await supabase.from('rounds').update({ state: 'closed' }).eq('game_code', gameCode);
  if (closeAllRoundsError) throw new Error(closeAllRoundsError.message);

  const { data: opened, error: openFirstError } = await supabase
    .from('rounds')
    .update({ state: 'open' })
    .eq('game_code', gameCode)
    .eq('round_id', 1)
    .select('round_id')
    .maybeSingle<{ round_id: number }>();
  if (openFirstError) throw new Error(openFirstError.message);
  if (!opened) throw new Error('ROUND_NOT_FOUND');

  return { ok: true };
}

export async function bootPlayer(gameCode: string, hostUid: string, playerUid: string) {
  const supabase = getSupabaseAdmin();
  if (playerUid === hostUid) throw new Error('CANNOT_BOOT_HOST');
  await ensureHost(gameCode, hostUid);

  const { error } = await supabase.from('players').delete().eq('game_code', gameCode).eq('uid', playerUid);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function getRound(gameCode: string, roundId: number, uid?: string | null) {
  const supabase = getSupabaseAdmin();
  const game = await mustGetGame(gameCode);

  if (!uid) throw new Error('UNAUTHORIZED');
  const isHost = uid === game.host_uid;
  if (!isHost) {
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('uid')
      .eq('game_code', gameCode)
      .eq('uid', uid)
      .maybeSingle<{ uid: string }>();
    if (playerError) throw new Error(playerError.message);
    if (!player) throw new Error('NOT_IN_GAME');

    // Players shouldn't interact with rounds before the game begins.
    if (game.status !== 'in_progress' && game.status !== 'finished') throw new Error('GAME_NOT_STARTED');
  }

  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .select('round_id, state')
    .eq('game_code', gameCode)
    .eq('round_id', roundId)
    .maybeSingle<Pick<DbRound, 'round_id' | 'state'>>();

  if (roundError) throw new Error(roundError.message);
  if (!round) throw new Error('ROUND_NOT_FOUND');

  const { count: submissionsCount, error: countError } = await supabase
    .from('round_submissions')
    .select('*', { count: 'exact', head: true })
    .eq('game_code', gameCode)
    .eq('round_id', roundId)
    // Host typically doesn't submit a ranking; exclude them from "players done" for admin progress.
    .neq('uid', game.host_uid);

  if (countError) throw new Error(countError.message);

  const { count: playersCount, error: playersCountError } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('game_code', gameCode);
  if (playersCountError) throw new Error(playersCountError.message);

  const playersTotalCount = Math.max(0, (playersCount ?? 0) - 1);
  const playersDoneCount = submissionsCount ?? 0;

  let mySubmission: { uid: string; notes: string; ranking: string[]; submittedAt: number } | null = null;
  if (uid) {
    const { data: submission, error: subError } = await supabase
      .from('round_submissions')
      .select('uid, notes, ranking, submitted_at')
      .eq('game_code', gameCode)
      .eq('round_id', roundId)
      .eq('uid', uid)
      .maybeSingle<Pick<DbSubmission, 'uid' | 'notes' | 'ranking' | 'submitted_at'>>();

    if (subError) throw new Error(subError.message);
    if (submission) {
      mySubmission = {
        uid: submission.uid,
        notes: submission.notes,
        ranking: Array.isArray(submission.ranking) ? (submission.ranking as string[]) : [],
        submittedAt: toMs(submission.submitted_at) ?? Date.now(),
      };
    }
  }

  const bottlesPerRound = game.bottles_per_round ?? 4;
  const { data: roundWines, error: roundWinesError } = await supabase
    .from('round_wines')
    .select('wine_id, position, wines ( nickname )')
    .eq('game_code', gameCode)
    .eq('round_id', roundId)
    .returns<DbRoundWineJoin[]>();

  if (roundWinesError) throw new Error(roundWinesError.message);

  const sorted = [...(roundWines ?? [])].sort((a, b) => {
    const ap = a.position ?? Number.MAX_SAFE_INTEGER;
    const bp = b.position ?? Number.MAX_SAFE_INTEGER;
    if (ap !== bp) return ap - bp;
    return a.wine_id.localeCompare(b.wine_id);
  });

  const wineNicknamesRaw = sorted.map((rw) => rw.wines?.nickname ?? '');
  const wineNicknames = wineNicknamesRaw.slice(0, bottlesPerRound);
  while (wineNicknames.length < bottlesPerRound) wineNicknames.push('');

  const roundWinesListRaw = sorted.map((rw) => ({ id: rw.wine_id, nickname: rw.wines?.nickname ?? '' }));
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
    // Back-compat: this used to be the raw submission count. We now treat it as "players done" (excluding host).
    submissionsCount: playersDoneCount,
    playersDoneCount,
    playersTotalCount,
    mySubmission,
  };
}

export async function submitRound(gameCode: string, roundId: number, uid: string, notes: string, ranking: string[]) {
  const supabase = getSupabaseAdmin();

  const game = await mustGetGame(gameCode);
  if (game.status === 'finished') throw new Error('GAME_FINISHED');
  if (game.status !== 'in_progress') throw new Error('GAME_NOT_STARTED');
  if (roundId !== game.current_round) throw new Error('ROUND_NOT_CURRENT');

  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .select('state')
    .eq('game_code', gameCode)
    .eq('round_id', roundId)
    .maybeSingle<Pick<DbRound, 'state'>>();

  if (roundError) throw new Error(roundError.message);
  if (!round) throw new Error('ROUND_NOT_FOUND');
  if (round.state !== 'open') throw new Error('ROUND_CLOSED');

  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('uid')
    .eq('game_code', gameCode)
    .eq('uid', uid)
    .maybeSingle<{ uid: string }>();

  if (playerError) throw new Error(playerError.message);
  if (!player) throw new Error('NOT_IN_GAME');

  const { data: assignedRows, error: assignedError } = await supabase
    .from('round_wines')
    .select('wine_id, position')
    .eq('game_code', gameCode)
    .eq('round_id', roundId)
    .order('position', { ascending: true })
    .returns<Array<Pick<DbRoundWine, 'wine_id' | 'position'>>>();
  if (assignedError) throw new Error(assignedError.message);

  const assignedIds = (assignedRows ?? [])
    .map((r: Pick<DbRoundWine, 'wine_id'>) => r.wine_id)
    .filter((x: unknown): x is string => typeof x === 'string' && x.length > 0);
  if (!assignedIds.length) throw new Error('ROUND_NOT_CONFIGURED');

  const uniqueSubmitted = new Set(ranking);
  const uniqueAssigned = new Set(assignedIds);
  const sameLength = uniqueSubmitted.size === uniqueAssigned.size && ranking.length === assignedIds.length;
  const allBelong = ranking.every((id) => uniqueAssigned.has(id));
  if (!sameLength || !allBelong) throw new Error('INVALID_RANKING');

  const { error: upsertError } = await supabase.from('round_submissions').upsert({
    game_code: gameCode,
    round_id: roundId,
    uid,
    notes,
    ranking,
    submitted_at: new Date().toISOString(),
  });

  if (upsertError) throw new Error(upsertError.message);
  return { ok: true };
}

export async function closeRound(gameCode: string, hostUid: string, roundId: number) {
  const supabase = getSupabaseAdmin();
  const game = await ensureHost(gameCode, hostUid);
  if (game.status !== 'in_progress') throw new Error('GAME_NOT_STARTED');
  if (roundId !== game.current_round) throw new Error('ROUND_NOT_CURRENT');

  // Ensure every player has a submission before the round locks.
  // This prevents players who didn't click "Done" from getting 0 credit
  // when their current/default ordering already has wines in the right spots.
  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .select('state')
    .eq('game_code', gameCode)
    .eq('round_id', roundId)
    .maybeSingle<Pick<DbRound, 'state'>>();
  if (roundError) throw new Error(roundError.message);
  if (!round) throw new Error('ROUND_NOT_FOUND');

  const { data: assignedRows, error: assignedError } = await supabase
    .from('round_wines')
    .select('wine_id, position')
    .eq('game_code', gameCode)
    .eq('round_id', roundId)
    .order('position', { ascending: true })
    .returns<Array<Pick<DbRoundWine, 'wine_id' | 'position'>>>();
  if (assignedError) throw new Error(assignedError.message);

  const assignedIds = (assignedRows ?? [])
    .map((r: Pick<DbRoundWine, 'wine_id'>) => r.wine_id)
    .filter((x: unknown): x is string => typeof x === 'string' && x.length > 0);
  if (!assignedIds.length) throw new Error('ROUND_NOT_CONFIGURED');

  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('uid')
    .eq('game_code', gameCode)
    .neq('uid', game.host_uid)
    .returns<Array<Pick<DbPlayer, 'uid'>>>();
  if (playersError) throw new Error(playersError.message);

  const { data: existingSubs, error: subsError } = await supabase
    .from('round_submissions')
    .select('uid')
    .eq('game_code', gameCode)
    .eq('round_id', roundId)
    .returns<Array<Pick<DbSubmission, 'uid'>>>();
  if (subsError) throw new Error(subsError.message);

  const submittedUids = new Set((existingSubs ?? []).map((s) => s.uid));
  const missingUids = (players ?? []).map((p) => p.uid).filter((u) => !!u && !submittedUids.has(u));

  if (missingUids.length) {
    const now = new Date().toISOString();
    const rows = missingUids.map((uid) => ({
      game_code: gameCode,
      round_id: roundId,
      uid,
      notes: '',
      ranking: assignedIds,
      submitted_at: now,
    }));

    const { error: insertError } = await supabase.from('round_submissions').insert(rows);
    if (insertError) throw new Error(insertError.message);
  }

  const { data, error } = await supabase
    .from('rounds')
    .update({ state: 'closed' })
    .eq('game_code', gameCode)
    .eq('round_id', roundId)
    .select('round_id')
    .maybeSingle<{ round_id: number }>();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('ROUND_NOT_FOUND');
  return { ok: true };
}

export async function advanceRound(gameCode: string, hostUid: string) {
  const supabase = getSupabaseAdmin();
  const game = await ensureHost(gameCode, hostUid);
  if (game.status !== 'in_progress') throw new Error('GAME_NOT_STARTED');

  const { data: currentRound, error: currentRoundError } = await supabase
    .from('rounds')
    .select('state')
    .eq('game_code', gameCode)
    .eq('round_id', game.current_round)
    .maybeSingle<Pick<DbRound, 'state'>>();
  if (currentRoundError) throw new Error(currentRoundError.message);
  if (!currentRound) throw new Error('ROUND_NOT_FOUND');
  if (currentRound.state !== 'closed') throw new Error('ROUND_NOT_CLOSED');

  if (game.current_round >= game.total_rounds) {
    const { error } = await supabase.from('games').update({ status: 'finished' }).eq('game_code', gameCode);
    if (error) throw new Error(error.message);
    return { ok: true, finished: true, nextRound: null };
  }

  const nextRound = game.current_round + 1;
  const { error: updateGameError } = await supabase
    .from('games')
    .update({ current_round: nextRound })
    .eq('game_code', gameCode);

  if (updateGameError) throw new Error(updateGameError.message);

  const { data: opened, error: openError } = await supabase
    .from('rounds')
    .update({ state: 'open' })
    .eq('game_code', gameCode)
    .eq('round_id', nextRound)
    .select('round_id')
    .maybeSingle<{ round_id: number }>();
  if (openError) throw new Error(openError.message);
  if (!opened) throw new Error('ROUND_NOT_FOUND');

  return { ok: true, finished: false, nextRound };
}

export async function getLeaderboard(gameCode: string, uid?: string | null) {
  const supabase = getSupabaseAdmin();
  const game = await mustGetGame(gameCode);

  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('uid, name, joined_at')
    .eq('game_code', gameCode)
    .order('joined_at', { ascending: true })
    .returns<Array<Pick<DbPlayer, 'uid' | 'name' | 'joined_at'>>>();

  if (playersError) throw new Error(playersError.message);

  const { data: submissionsRaw, error: submissionsError } = await supabase
    .from('round_submissions')
    .select('uid, round_id, ranking')
    .eq('game_code', gameCode)
    .returns<Array<Pick<DbSubmission, 'uid' | 'round_id' | 'ranking'>>>();

  if (submissionsError) throw new Error(submissionsError.message);

  const { data: roundWineRows, error: roundWinesError } = await supabase
    .from('round_wines')
    .select('round_id, wine_id, wines ( price )')
    .eq('game_code', gameCode)
    .returns<Array<{ round_id: number; wine_id: string; wines: { price: number | null } | null }>>();

  if (roundWinesError) throw new Error(roundWinesError.message);

  const scores: Record<string, number> = {};
  for (const p of players ?? []) scores[p.uid] = 0;

  const threshold = game.status === 'finished' ? Number.MAX_SAFE_INTEGER : game.current_round;

  const winesByRound = new Map<number, Array<{ wineId: string; price: number | null }>>();
  for (const row of roundWineRows ?? []) {
    if (typeof row.round_id !== 'number' || !Number.isFinite(row.round_id)) continue;
    if (!row.wine_id) continue;
    const list = winesByRound.get(row.round_id) ?? [];
    list.push({ wineId: row.wine_id, price: row.wines?.price ?? null });
    winesByRound.set(row.round_id, list);
  }

  const correctOrderByRound = new Map<number, string[]>();
  for (const [rid, wines] of winesByRound.entries()) {
    const ordered = [...wines].sort((a, b) => {
      const ap = typeof a.price === 'number' && Number.isFinite(a.price) ? a.price : -Infinity;
      const bp = typeof b.price === 'number' && Number.isFinite(b.price) ? b.price : -Infinity;
      if (bp !== ap) return bp - ap; // most expensive -> least expensive
      return a.wineId.localeCompare(b.wineId);
    });
    correctOrderByRound.set(
      rid,
      ordered.map((w) => w.wineId)
    );
  }

  for (const s of submissionsRaw ?? []) {
    if (typeof s.round_id === 'number' && s.round_id >= threshold) continue;

    const correct = correctOrderByRound.get(s.round_id) ?? [];
    const submitted =
      Array.isArray(s.ranking) && s.ranking.every((x: unknown) => typeof x === 'string')
        ? (s.ranking as string[])
        : Array.isArray(s.ranking)
          ? (s.ranking as unknown[]).filter((x: unknown): x is string => typeof x === 'string')
          : [];

    let points = 0;
    const len = Math.min(correct.length, submitted.length);
    for (let i = 0; i < len; i += 1) if (submitted[i] === correct[i]) points += 1;

    scores[s.uid] = (scores[s.uid] ?? 0) + points;
  }

  const leaderboard = (players ?? [])
    .map((p: Pick<DbPlayer, 'uid' | 'name'>) => ({ uid: p.uid, name: p.name, score: scores[p.uid] ?? 0 }))
    .sort((a: { score: number }, b: { score: number }) => b.score - a.score);

  return {
    gameCode,
    status: game.status,
    isHost: !!uid && uid === game.host_uid,
    leaderboard,
  };
}

export async function listWines(gameCode: string, hostUid: string) {
  const supabase = getSupabaseAdmin();
  await ensureHost(gameCode, hostUid);

  const { data, error } = await supabase
    .from('wines')
    .select('wine_id, letter, label_blinded, nickname, price, created_at')
    .eq('game_code', gameCode)
    .order('created_at', { ascending: true })
    .returns<Array<Pick<DbWine, 'wine_id' | 'letter' | 'label_blinded' | 'nickname' | 'price' | 'created_at'>>>();

  if (error) throw new Error(error.message);

  return (data ?? []).map((w: Pick<DbWine, 'wine_id' | 'letter' | 'label_blinded' | 'nickname' | 'price'>) => ({
    id: w.wine_id,
    letter: w.letter,
    labelBlinded: w.label_blinded,
    nickname: w.nickname,
    price: w.price ?? null,
  }));
}

export async function upsertWines(
  gameCode: string,
  hostUid: string,
  wines: Array<{ id: string; letter: string; labelBlinded: string; nickname: string; price?: number | null }>
) {
  const supabase = getSupabaseAdmin();
  await ensureHost(gameCode, hostUid);

  const payload = wines.map((w) => ({
    game_code: gameCode,
    wine_id: w.id,
    letter: w.letter,
    label_blinded: w.labelBlinded ?? '',
    nickname: w.nickname ?? '',
    price: typeof w.price === 'number' ? w.price : null,
  }));

  const { error } = await supabase.from('wines').upsert(payload);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteWine(gameCode: string, hostUid: string, wineId: string) {
  const supabase = getSupabaseAdmin();
  await ensureHost(gameCode, hostUid);

  const { error } = await supabase.from('wines').delete().eq('game_code', gameCode).eq('wine_id', wineId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function getAssignments(gameCode: string, hostUid: string) {
  const supabase = getSupabaseAdmin();
  const game = await ensureHost(gameCode, hostUid);

  const { data, error } = await supabase
    .from('round_wines')
    .select('round_id, wine_id, position')
    .eq('game_code', gameCode)
    .order('round_id', { ascending: true })
    .order('position', { ascending: true })
    .returns<Array<Pick<DbRoundWine, 'round_id' | 'wine_id' | 'position'>>>();

  if (error) throw new Error(error.message);

  const map = new Map<number, string[]>();
  for (let rid = 1; rid <= game.total_rounds; rid += 1) map.set(rid, []);

  for (const row of data ?? []) {
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
  const supabase = getSupabaseAdmin();
  const game = await ensureHost(gameCode, hostUid);

  const { error: clearError } = await supabase.from('round_wines').delete().eq('game_code', gameCode);
  if (clearError) throw new Error(clearError.message);

  const rows: Array<{ game_code: string; round_id: number; wine_id: string; position: number }> = [];
  for (const a of assignments) {
    if (a.roundId < 1 || a.roundId > game.total_rounds) continue;
    for (let i = 0; i < a.wineIds.length; i += 1) {
      rows.push({ game_code: gameCode, round_id: a.roundId, wine_id: a.wineIds[i], position: i + 1 });
    }
  }

  if (rows.length) {
    const { error: insertError } = await supabase.from('round_wines').insert(rows);
    if (insertError) throw new Error(insertError.message);
  }

  return { ok: true };
}
