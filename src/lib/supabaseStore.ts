import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { generateGameCode } from '@/lib/gameCode';
import { newUid } from '@/lib/uid';
import { buildAcceptableByPosition, scoreRanking } from '@/lib/scoring';
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

type DbRoundDraft = {
  game_code: string;
  round_id: number;
  uid: string;
  notes: string;
  ranking: unknown;
  updated_at: string;
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
  wines: { nickname: string } | null;
};

type DbRoundWineFullJoin = {
  round_id: number;
  wine_id: string;
  position: number | null;
  wines: { letter: string | null; label_blinded: string | null; nickname: string | null; price: unknown } | null;
};

function toMs(ts: string | null) {
  if (!ts) return null;
  const n = Date.parse(ts);
  return Number.isFinite(n) ? n : null;
}

function isMissingTableError(message: string, table: string) {
  const msg = (message ?? '').toLowerCase();
  const t = table.toLowerCase();
  return msg.includes(t) && (msg.includes('does not exist') || msg.includes('could not find the table') || msg.includes('not found'));
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

async function ensureInGame(gameCode: string, uid: string): Promise<{ game: DbGame; isHost: boolean }> {
  const supabase = getSupabaseAdmin();
  const game = await mustGetGame(gameCode);
  const isHost = uid === game.host_uid;
  if (isHost) return { game, isHost: true };

  const { data: player, error } = await supabase
    .from('players')
    .select('uid')
    .eq('game_code', gameCode)
    .eq('uid', uid)
    .maybeSingle<{ uid: string }>();
  if (error) throw new Error(error.message);
  if (!player) throw new Error('NOT_IN_GAME');
  return { game, isHost: false };
}

export async function upsertRoundDraft(gameCode: string, roundId: number, uid: string, notes: string, ranking: string[]) {
  const supabase = getSupabaseAdmin();

  const game = await mustGetGame(gameCode);
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

  // Validate ranking against assigned wines for this round (same rule as submit).
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

  const { error: upsertError } = await supabase.from('round_drafts').upsert({
    game_code: gameCode,
    round_id: roundId,
    uid,
    notes: notes ?? '',
    ranking,
    updated_at: new Date().toISOString(),
  });
  if (upsertError) throw new Error(upsertError.message);

  return { ok: true };
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
  if (game.status === 'finished' || game.status === 'gambit') throw new Error('GAME_FINISHED');
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

  if (game.status === 'finished' || game.status === 'gambit') throw new Error('GAME_FINISHED');
  if (game.status === 'in_progress') return { ok: true };

  if (typeof game.bottles === 'number' && Number.isFinite(game.bottles) && game.bottles > 0) {
    const { count, error: winesCountError } = await supabase
      .from('wines')
      .select('*', { count: 'exact', head: true })
      .eq('game_code', gameCode);

    if (winesCountError) throw new Error(winesCountError.message);

    const winesCount = typeof count === 'number' ? count : 0;
    if (winesCount !== game.bottles) throw new Error('WINE_LIST_INCOMPLETE');

    // Ensure every wine has a real price before starting; scoring (including Gambit) depends on it.
    const { count: pricedCount, error: pricedCountError } = await supabase
      .from('wines')
      .select('*', { count: 'exact', head: true })
      .eq('game_code', gameCode)
      .not('price', 'is', null);
    if (pricedCountError) throw new Error(pricedCountError.message);
    const pricesFilled = typeof pricedCount === 'number' ? pricedCount : 0;
    if (pricesFilled !== game.bottles) throw new Error('WINE_LIST_INCOMPLETE');
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

export async function finishGame(gameCode: string, hostUid: string) {
  const supabase = getSupabaseAdmin();
  const game = await ensureHost(gameCode, hostUid);
  if (game.status !== 'gambit') throw new Error('GAME_NOT_IN_GAMBIT');

  // Mirror round-close behavior: when the host closes Gambit, create placeholder submissions
  // for any missing players so the game can proceed cleanly (and nobody gets stuck).
  // IMPORTANT: We do NOT fabricate picks — blank submissions should earn 0 points.
  const { data: players, error: playersErr } = await supabase
    .from('players')
    .select('uid')
    .eq('game_code', gameCode)
    .returns<Array<Pick<DbPlayer, 'uid'>>>();
  if (playersErr) throw new Error(playersErr.message);
  const playerUids = (players ?? []).map((p) => p.uid).filter((u): u is string => typeof u === 'string' && u.length > 0);

  const { data: existingSubs, error: subsErr } = await supabase
    .from('gambit_submissions')
    .select('uid')
    .eq('game_code', gameCode)
    .returns<Array<Pick<DbGambitSubmission, 'uid'>>>();
  if (subsErr) throw new Error(subsErr.message);

  const submittedSet = new Set((existingSubs ?? []).map((s) => s.uid).filter((u): u is string => typeof u === 'string' && u.length > 0));
  const missingUids = playerUids.filter((u) => !submittedSet.has(u));

  if (missingUids.length) {
    const now = new Date().toISOString();
    const rows = missingUids.map((uid) => ({
      game_code: gameCode,
      uid,
      cheapest_wine_id: null,
      most_expensive_wine_id: null,
      favorite_wine_ids: [],
      submitted_at: now,
    }));

    const { error: insertErr } = await supabase.from('gambit_submissions').upsert(rows);
    if (insertErr) throw new Error(insertErr.message);
  }

  const { error } = await supabase.from('games').update({ status: 'finished' }).eq('game_code', gameCode);
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
    if (game.status !== 'in_progress' && game.status !== 'gambit' && game.status !== 'finished') throw new Error('GAME_NOT_STARTED');
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
    // Count includes the host (the host plays too).
    ;

  if (countError) throw new Error(countError.message);

  const { count: playersCount, error: playersCountError } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('game_code', gameCode);
  if (playersCountError) throw new Error(playersCountError.message);

  const playersTotalCount = Math.max(0, playersCount ?? 0);
  const playersDoneCount = submissionsCount ?? 0;

  // Host-only: provide per-player submission visibility so the admin can nudge stragglers.
  // (Players should not be able to see which specific people have/haven't submitted.)
  let submittedAtByUid: Record<string, number> | null = null;
  if (isHost) {
    const { data: subs, error: subsErr } = await supabase
      .from('round_submissions')
      .select('uid, submitted_at')
      .eq('game_code', gameCode)
      .eq('round_id', roundId)
      .returns<Array<Pick<DbSubmission, 'uid' | 'submitted_at'>>>();
    if (subsErr) throw new Error(subsErr.message);

    submittedAtByUid = {};
    for (const s of subs ?? []) {
      if (!s.uid) continue;
      submittedAtByUid[s.uid] = toMs(s.submitted_at) ?? Date.now();
    }
  }

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

  let myDraft: { uid: string; notes: string; ranking: string[]; updatedAt: number } | null = null;
  if (uid && !mySubmission) {
    const { data: draft, error: draftError } = await supabase
      .from('round_drafts')
      .select('uid, notes, ranking, updated_at')
      .eq('game_code', gameCode)
      .eq('round_id', roundId)
      .eq('uid', uid)
      .maybeSingle<Pick<DbRoundDraft, 'uid' | 'notes' | 'ranking' | 'updated_at'>>();
    if (draftError) {
      if (!isMissingTableError(draftError.message, 'round_drafts')) throw new Error(draftError.message);
    }
    if (draft) {
      myDraft = {
        uid: draft.uid,
        notes: draft.notes ?? '',
        ranking: Array.isArray(draft.ranking) ? (draft.ranking as unknown[]).filter((x): x is string => typeof x === 'string') : [],
        updatedAt: toMs(draft.updated_at) ?? Date.now(),
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
    // Back-compat: this used to be the raw submission count. We treat it as "players done" (including host).
    submissionsCount: playersDoneCount,
    playersDoneCount,
    playersTotalCount,
    mySubmission,
    myDraft,
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
  const supabase = getSupabaseAdmin();
  const { game, isHost } = await ensureInGame(gameCode, uid);

  // Players shouldn't interact with rounds before the game begins.
  if (!isHost) {
    if (game.status !== 'in_progress' && game.status !== 'gambit' && game.status !== 'finished') throw new Error('GAME_NOT_STARTED');
  }

  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .select('round_id, state')
    .eq('game_code', gameCode)
    .eq('round_id', roundId)
    .maybeSingle<Pick<DbRound, 'round_id' | 'state'>>();

  if (roundError) throw new Error(roundError.message);
  if (!round) throw new Error('ROUND_NOT_FOUND');
  if (round.state !== 'closed') throw new Error('ROUND_NOT_CLOSED');

  const { data: submission, error: subError } = await supabase
    .from('round_submissions')
    .select('uid, notes, ranking, submitted_at')
    .eq('game_code', gameCode)
    .eq('round_id', roundId)
    .eq('uid', uid)
    .maybeSingle<Pick<DbSubmission, 'uid' | 'notes' | 'ranking' | 'submitted_at'>>();
  if (subError) throw new Error(subError.message);
  if (!submission) throw new Error('UNAUTHORIZED');

  const submittedRanking =
    Array.isArray(submission.ranking) && submission.ranking.every((x: unknown) => typeof x === 'string')
      ? (submission.ranking as string[])
      : Array.isArray(submission.ranking)
        ? (submission.ranking as unknown[]).filter((x: unknown): x is string => typeof x === 'string')
        : [];

  const { data: roundWines, error: roundWinesError } = await supabase
    .from('round_wines')
    .select('wine_id, position, wines ( nickname, price )')
    .eq('game_code', gameCode)
    .eq('round_id', roundId)
    .returns<Array<{ wine_id: string; position: number | null; wines: { nickname: string | null; price: number | null } | null }>>();
  if (roundWinesError) throw new Error(roundWinesError.message);

  const sorted = [...(roundWines ?? [])].sort((a, b) => {
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
      nickname: rw.wines?.nickname ?? '',
      price: normalizeMoney(rw.wines?.price ?? null),
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
      note: submittedWineId ? safeParseNotesMap(submission.notes ?? '')[submittedWineId] ?? '' : '',
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
    submittedAt: toMs(submission.submitted_at) ?? Date.now(),
    rows,
  };
}

export async function submitRound(gameCode: string, roundId: number, uid: string, notes: string, ranking: string[]) {
  const supabase = getSupabaseAdmin();

  const game = await mustGetGame(gameCode);
  if (game.status === 'finished' || game.status === 'gambit') throw new Error('GAME_FINISHED');
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

  // Best-effort: clear draft once a real submission exists.
  const { error: draftDeleteErr } = await supabase
    .from('round_drafts')
    .delete()
    .eq('game_code', gameCode)
    .eq('round_id', roundId)
    .eq('uid', uid);
  if (draftDeleteErr && !isMissingTableError(draftDeleteErr.message, 'round_drafts')) {
    // ignore non-fatal draft cleanup failures
  }
  return { ok: true };
}

export async function closeRound(gameCode: string, hostUid: string, roundId: number) {
  const supabase = getSupabaseAdmin();
  const game = await ensureHost(gameCode, hostUid);
  // Idempotency: if the game already moved past rounds, treat this as a no-op.
  if (game.status === 'gambit' || game.status === 'finished') return { ok: true };
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
  if (round.state === 'closed') return { ok: true };

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
    // If round drafts exist, prefer them for missing submissions (so "leaderboard bounce" doesn't lose progress).
    let draftByUid: Map<string, { notes: string; ranking: string[] }> | null = null;
    try {
      const { data: drafts, error: draftsErr } = await supabase
        .from('round_drafts')
        .select('uid, notes, ranking')
        .eq('game_code', gameCode)
        .eq('round_id', roundId)
        .in('uid', missingUids)
        .returns<Array<Pick<DbRoundDraft, 'uid' | 'notes' | 'ranking'>>>();
      if (draftsErr) {
        if (!isMissingTableError(draftsErr.message, 'round_drafts')) throw new Error(draftsErr.message);
      } else {
        draftByUid = new Map<string, { notes: string; ranking: string[] }>();
        for (const d of drafts ?? []) {
          if (!d.uid) continue;
          const r = Array.isArray(d.ranking) ? (d.ranking as unknown[]).filter((x): x is string => typeof x === 'string') : [];
          draftByUid.set(d.uid, { notes: d.notes ?? '', ranking: r });
        }
      }
    } catch {
      draftByUid = null;
    }

    const now = new Date().toISOString();
    const rows = missingUids.map((uid) => ({
      game_code: gameCode,
      round_id: roundId,
      uid,
      notes: (() => {
        const d = draftByUid?.get(uid);
        return d?.notes ?? '';
      })(),
      ranking: (() => {
        const d = draftByUid?.get(uid);
        const ranking = d?.ranking ?? [];
        // Validate ranking against assigned ids (must be a permutation).
        const uniqueSubmitted = new Set(ranking);
        const uniqueAssigned = new Set(assignedIds);
        const sameLength = uniqueSubmitted.size === uniqueAssigned.size && ranking.length === assignedIds.length;
        const allBelong = ranking.every((id) => uniqueAssigned.has(id));
        return sameLength && allBelong ? ranking : assignedIds;
      })(),
      submitted_at: now,
    }));

    const { error: insertError } = await supabase.from('round_submissions').insert(rows);
    if (insertError) throw new Error(insertError.message);

    // Best-effort cleanup: drafts are no longer relevant once the round is closed.
    const { error: cleanupErr } = await supabase
      .from('round_drafts')
      .delete()
      .eq('game_code', gameCode)
      .eq('round_id', roundId)
      .in('uid', missingUids);
    if (cleanupErr && !isMissingTableError(cleanupErr.message, 'round_drafts')) {
      // ignore
    }
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
  // Idempotency: if we're already in (or past) Gambit, treat "advance" as already-finished.
  if (game.status === 'gambit' || game.status === 'finished') return { ok: true, finished: true, nextRound: null };
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
    // After the final round, move into the post-game Gambit stage before finalizing.
    const { error } = await supabase.from('games').update({ status: 'gambit' }).eq('game_code', gameCode);
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

  // Score only completed rounds. Rounds are pre-created as `closed` before being opened, so
  // "closed" alone is not enough — we treat a round as completed iff:
  // - it is `closed`, AND
  // - it has at least one submission row.
  //
  // This avoids delta bugs like: Round 1 just closed, but rounds 2/3 are still "closed" (never opened yet),
  // making the "last closed round" appear to be round 3.
  const { data: rounds, error: roundsError } = await supabase
    .from('rounds')
    .select('round_id, state')
    .eq('game_code', gameCode)
    .returns<Array<Pick<DbRound, 'round_id' | 'state'>>>();
  if (roundsError) throw new Error(roundsError.message);

  const closedRoundIds = new Set<number>();
  for (const r of rounds ?? []) {
    if (typeof r.round_id !== 'number' || !Number.isFinite(r.round_id)) continue;
    if (r.state === 'closed') closedRoundIds.add(r.round_id);
  }

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

  const roundIdsWithSubmissions = new Set<number>();
  for (const s of submissionsRaw ?? []) {
    if (typeof s.round_id !== 'number' || !Number.isFinite(s.round_id)) continue;
    roundIdsWithSubmissions.add(s.round_id);
  }

  const completedRoundIds = new Set<number>();
  for (const rid of closedRoundIds) if (roundIdsWithSubmissions.has(rid)) completedRoundIds.add(rid);
  const lastCompletedRoundId = completedRoundIds.size ? Math.max(...Array.from(completedRoundIds.values())) : 0;

  const { data: roundWineRows, error: roundWinesError } = await supabase
    .from('round_wines')
    .select('round_id, wine_id, wines ( price )')
    .eq('game_code', gameCode)
    .returns<Array<{ round_id: number; wine_id: string; wines: { price: number | null } | null }>>();

  if (roundWinesError) throw new Error(roundWinesError.message);

  const scores: Record<string, number> = {};
  const lastRoundPoints: Record<string, number> = {};
  const gambitPoints: Record<string, number> = {};
  for (const p of players ?? []) scores[p.uid] = 0;

  const winesByRound = new Map<number, Array<{ wineId: string; price: number | null }>>();
  for (const row of roundWineRows ?? []) {
    if (typeof row.round_id !== 'number' || !Number.isFinite(row.round_id)) continue;
    if (!row.wine_id) continue;
    const list = winesByRound.get(row.round_id) ?? [];
    list.push({ wineId: row.wine_id, price: normalizeMoney(row.wines?.price ?? null) });
    winesByRound.set(row.round_id, list);
  }

  // Tie-aware scoring: if multiple wines share the same price, any ordering among them is correct.
  // We build, for each round and each position index, the set of wineIds that are acceptable at that
  // position given price ties.
  const acceptableByPositionByRound = new Map<number, Array<Set<string>>>();
  for (const [rid, wines] of winesByRound.entries()) {
    acceptableByPositionByRound.set(rid, buildAcceptableByPosition(wines));
  }

  for (const s of submissionsRaw ?? []) {
    // Only count submissions for rounds that are actually finished.
    if (!completedRoundIds.has(s.round_id)) continue;

    const acceptableByPosition = acceptableByPositionByRound.get(s.round_id) ?? [];
    const submitted =
      Array.isArray(s.ranking) && s.ranking.every((x: unknown) => typeof x === 'string')
        ? (s.ranking as string[])
        : Array.isArray(s.ranking)
          ? (s.ranking as unknown[]).filter((x: unknown): x is string => typeof x === 'string')
          : [];

    const points = scoreRanking(acceptableByPosition, submitted);

    scores[s.uid] = (scores[s.uid] ?? 0) + points;
    if (lastCompletedRoundId > 0 && s.round_id === lastCompletedRoundId) {
      lastRoundPoints[s.uid] = (lastRoundPoints[s.uid] ?? 0) + points;
    }
  }

  // Gambit scoring (post-game): +1 for correct cheapest, +2 for correct most expensive.
  // Tie-aware: if multiple wines share the min/max price, any of them is treated as correct.
  let hasAnyGambitSubmissions = false;
  if (game.status === 'gambit' || game.status === 'finished') {
    const { data: wineRows, error: wineErr } = await supabase
      .from('wines')
      .select('wine_id, price')
      .eq('game_code', gameCode)
      .returns<Array<Pick<DbWine, 'wine_id' | 'price'>>>();
    if (wineErr) throw new Error(wineErr.message);

    const priced = (wineRows ?? []).map((w) => {
      const normalized = normalizeMoney(w.price);
      const cents = typeof normalized === 'number' && Number.isFinite(normalized) ? Math.round(normalized * 100) : null;
      return { id: w.wine_id, cents };
    });

    const pricedOnly = priced.filter((w): w is { id: string; cents: number } => typeof w.cents === 'number' && Number.isFinite(w.cents));

    if (pricedOnly.length) {
      const minCents = Math.min(...pricedOnly.map((w) => w.cents));
      const maxCents = Math.max(...pricedOnly.map((w) => w.cents));
      const cheapestIds = new Set(pricedOnly.filter((w) => w.cents === minCents).map((w) => w.id));
      const mostExpensiveIds = new Set(pricedOnly.filter((w) => w.cents === maxCents).map((w) => w.id));

      const { data: gambitRows, error: gambitErr } = await supabase
        .from('gambit_submissions')
        .select('uid, cheapest_wine_id, most_expensive_wine_id')
        .eq('game_code', gameCode)
        .returns<Array<Pick<DbGambitSubmission, 'uid' | 'cheapest_wine_id' | 'most_expensive_wine_id'>>>();
      if (gambitErr) throw new Error(gambitErr.message);
      hasAnyGambitSubmissions = !!(gambitRows && gambitRows.length);

      for (const g of gambitRows ?? []) {
        if (!g.uid) continue;
        let pts = 0;
        if (g.cheapest_wine_id && cheapestIds.has(g.cheapest_wine_id)) pts += 1;
        if (g.most_expensive_wine_id && mostExpensiveIds.has(g.most_expensive_wine_id)) pts += 2;
        gambitPoints[g.uid] = pts;
        if (pts) scores[g.uid] = (scores[g.uid] ?? 0) + pts;
      }
    }
  }

  const shouldShowGambitDelta =
    (game.status === 'gambit' || game.status === 'finished') && hasAnyGambitSubmissions;

  const leaderboard = (players ?? [])
    .map((p: Pick<DbPlayer, 'uid' | 'name'>) => ({
      uid: p.uid,
      name: p.name,
      score: scores[p.uid] ?? 0,
      // Delta:
      // - Main game: points from the most recently closed round.
      // - Gambit/Finished: show Gambit bonus points once any Gambit submissions exist; otherwise keep showing the last round delta
      //   so the final round results aren't masked by an initial "+0" Gambit phase.
      delta: shouldShowGambitDelta ? (gambitPoints[p.uid] ?? 0) : (lastRoundPoints[p.uid] ?? 0),
    }))
    .sort((a: { score: number }, b: { score: number }) => b.score - a.score);

  return {
    gameCode,
    status: game.status,
    isHost: !!uid && uid === game.host_uid,
    leaderboard,
  };
}

export async function getGambitState(gameCode: string, uid: string) {
  const supabase = getSupabaseAdmin();
  const { game, isHost } = await ensureInGame(gameCode, uid);

  if (game.status !== 'gambit' && game.status !== 'finished') throw new Error('GAMBIT_NOT_AVAILABLE');

  const { count: submissionsCount, error: countError } = await supabase
    .from('gambit_submissions')
    .select('*', { count: 'exact', head: true })
    .eq('game_code', gameCode);
  if (countError) throw new Error(countError.message);

  const { count: playersCount, error: playersCountError } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('game_code', gameCode);
  if (playersCountError) throw new Error(playersCountError.message);

  const playersTotalCount = Math.max(0, playersCount ?? 0);
  const playersDoneCount = submissionsCount ?? 0;

  const { data: wines, error: winesError } = await supabase
    .from('wines')
    .select('wine_id, letter, nickname, created_at')
    .eq('game_code', gameCode)
    .order('created_at', { ascending: true })
    .returns<Array<Pick<DbWine, 'wine_id' | 'letter' | 'nickname' | 'created_at'>>>();
  if (winesError) throw new Error(winesError.message);

  const { data: submission, error: subError } = await supabase
    .from('gambit_submissions')
    .select('cheapest_wine_id, most_expensive_wine_id, favorite_wine_ids, submitted_at')
    .eq('game_code', gameCode)
    .eq('uid', uid)
    .maybeSingle<Pick<DbGambitSubmission, 'cheapest_wine_id' | 'most_expensive_wine_id' | 'favorite_wine_ids' | 'submitted_at'>>();
  if (subError) throw new Error(subError.message);

  const favoriteWineIds = Array.isArray(submission?.favorite_wine_ids)
    ? (submission?.favorite_wine_ids as unknown[]).filter((x): x is string => typeof x === 'string' && x.length > 0)
    : [];

  return {
    gameCode,
    status: game.status,
    isHost,
    // Back-compat: treat this as "players done" (including host).
    submissionsCount: playersDoneCount,
    playersDoneCount,
    playersTotalCount,
    wines: (wines ?? []).map((w) => ({
      id: w.wine_id,
      letter: w.letter,
      nickname: w.nickname ?? '',
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
  const supabase = getSupabaseAdmin();
  const { game, isHost } = await ensureInGame(gameCode, uid);
  if (game.status !== 'gambit' && game.status !== 'finished') throw new Error('GAMBIT_NOT_AVAILABLE');
  // Reveal is only available once the host closes Gambit (mirrors round reveal gating).
  if (game.status !== 'finished') throw new Error('GAMBIT_NOT_CLOSED');

  const { data: submission, error: subError } = await supabase
    .from('gambit_submissions')
    .select('uid, cheapest_wine_id, most_expensive_wine_id, favorite_wine_ids, submitted_at')
    .eq('game_code', gameCode)
    .eq('uid', uid)
    .maybeSingle<Pick<DbGambitSubmission, 'uid' | 'cheapest_wine_id' | 'most_expensive_wine_id' | 'favorite_wine_ids' | 'submitted_at'>>();
  if (subError) throw new Error(subError.message);
  if (!submission) throw new Error('NO_GAMBIT_SUBMISSION');

  const favoriteWineIds = Array.isArray(submission.favorite_wine_ids)
    ? (submission.favorite_wine_ids as unknown[]).filter((x): x is string => typeof x === 'string' && x.length > 0)
    : [];

  const { data: wines, error: winesError } = await supabase
    .from('wines')
    .select('wine_id, letter, nickname, price')
    .eq('game_code', gameCode)
    .returns<Array<Pick<DbWine, 'wine_id' | 'letter' | 'nickname' | 'price'>>>();
  if (winesError) throw new Error(winesError.message);

  const labelById = new Map<string, string>();
  const centsById = new Map<string, number | null>();
  for (const w of wines ?? []) {
    if (!w.wine_id) continue;
    const label = `${w.letter}. ${w.nickname ?? ''}`.trim();
    labelById.set(w.wine_id, label || w.wine_id);
    const normalized = normalizeMoney(w.price);
    const cents = typeof normalized === 'number' && Number.isFinite(normalized) ? Math.round(normalized * 100) : null;
    centsById.set(w.wine_id, cents);
  }

  const pricedOnly: Array<{ id: string; cents: number }> = [];
  for (const [id, cents] of centsById.entries()) {
    if (typeof cents === 'number' && Number.isFinite(cents)) pricedOnly.push({ id, cents });
  }
  if (!pricedOnly.length) throw new Error('WINE_LIST_INCOMPLETE');

  const minCents = Math.min(...pricedOnly.map((w) => w.cents));
  const maxCents = Math.max(...pricedOnly.map((w) => w.cents));
  const cheapestIds = new Set(pricedOnly.filter((w) => w.cents === minCents).map((w) => w.id));
  const mostExpensiveIds = new Set(pricedOnly.filter((w) => w.cents === maxCents).map((w) => w.id));

  const cheapestPickId = submission.cheapest_wine_id ?? null;
  const expensivePickId = submission.most_expensive_wine_id ?? null;

  const cheapestPoints = cheapestPickId && cheapestIds.has(cheapestPickId) ? 1 : 0;
  const expensivePoints = expensivePickId && mostExpensiveIds.has(expensivePickId) ? 2 : 0;
  const totalPoints = cheapestPoints + expensivePoints;

  function labelsFor(ids: Iterable<string>) {
    return Array.from(ids)
      .map((id) => labelById.get(id) ?? id)
      .sort((a, b) => a.localeCompare(b));
  }

  return {
    gameCode: game.game_code,
    status: game.status,
    isHost,
    submittedAt: toMs(submission.submitted_at) ?? Date.now(),
    totalPoints,
    maxPoints: 3,
    cheapest: {
      pickId: cheapestPickId,
      pickLabel: cheapestPickId ? labelById.get(cheapestPickId) ?? cheapestPickId : null,
      correctIds: Array.from(cheapestIds),
      correctLabels: labelsFor(cheapestIds),
      isTie: cheapestIds.size > 1,
      points: cheapestPoints,
    },
    mostExpensive: {
      pickId: expensivePickId,
      pickLabel: expensivePickId ? labelById.get(expensivePickId) ?? expensivePickId : null,
      correctIds: Array.from(mostExpensiveIds),
      correctLabels: labelsFor(mostExpensiveIds),
      isTie: mostExpensiveIds.size > 1,
      points: expensivePoints,
    },
    favorites: {
      ids: favoriteWineIds,
      labels: favoriteWineIds.map((id) => labelById.get(id) ?? id),
    },
  };
}

export async function getFinalRevealExport(gameCode: string, uid: string) {
  const supabase = getSupabaseAdmin();
  const { game, isHost } = await ensureInGame(gameCode, uid);
  if (game.status !== 'finished') throw new Error('GAME_NOT_FINISHED');

  const bottlesPerRound = game.bottles_per_round ?? 4;

  const { data: players, error: playersErr } = await supabase
    .from('players')
    .select('uid, name, joined_at')
    .eq('game_code', gameCode)
    .order('joined_at', { ascending: true })
    .returns<Array<Pick<DbPlayer, 'uid' | 'name' | 'joined_at'>>>();
  if (playersErr) throw new Error(playersErr.message);
  const playersByUid = new Map<string, { uid: string; name: string }>();
  for (const p of players ?? []) {
    if (!p.uid) continue;
    playersByUid.set(p.uid, { uid: p.uid, name: p.name ?? 'Player' });
  }

  const { data: wineRows, error: winesErr } = await supabase
    .from('wines')
    .select('wine_id, letter, label_blinded, nickname, price, created_at')
    .eq('game_code', gameCode)
    .order('created_at', { ascending: true })
    .returns<Array<Pick<DbWine, 'wine_id' | 'letter' | 'label_blinded' | 'nickname' | 'price' | 'created_at'>>>();
  if (winesErr) throw new Error(winesErr.message);

  const wineById = new Map<
    string,
    { id: string; letter: string; labelBlinded: string; nickname: string; price: number | null }
  >();
  for (const w of wineRows ?? []) {
    if (!w.wine_id) continue;
    wineById.set(w.wine_id, {
      id: w.wine_id,
      letter: w.letter ?? '',
      labelBlinded: w.label_blinded ?? '',
      nickname: w.nickname ?? '',
      price: normalizeMoney(w.price),
    });
  }

  const { data: roundWineRows, error: roundWinesErr } = await supabase
    .from('round_wines')
    .select('round_id, wine_id, position, wines ( letter, label_blinded, nickname, price )')
    .eq('game_code', gameCode)
    .returns<DbRoundWineFullJoin[]>();
  if (roundWinesErr) throw new Error(roundWinesErr.message);

  const winesByRound = new Map<number, Array<{ wineId: string; price: number | null }>>();
  const roundWinesDetailedByRound = new Map<
    number,
    Array<{ position: number | null; wineId: string; letter: string; labelBlinded: string; nickname: string; price: number | null }>
  >();
  for (const row of roundWineRows ?? []) {
    if (typeof row.round_id !== 'number' || !Number.isFinite(row.round_id)) continue;
    if (!row.wine_id) continue;

    const fromWinesTable = wineById.get(row.wine_id) ?? null;
    const letter = fromWinesTable?.letter ?? row.wines?.letter ?? '';
    const labelBlinded = fromWinesTable?.labelBlinded ?? row.wines?.label_blinded ?? '';
    const nickname = fromWinesTable?.nickname ?? row.wines?.nickname ?? '';
    const price = fromWinesTable?.price ?? normalizeMoney(row.wines?.price ?? null);

    const rid = row.round_id;
    const listForScoring = winesByRound.get(rid) ?? [];
    listForScoring.push({ wineId: row.wine_id, price });
    winesByRound.set(rid, listForScoring);

    const listDetailed = roundWinesDetailedByRound.get(rid) ?? [];
    listDetailed.push({ position: row.position ?? null, wineId: row.wine_id, letter, labelBlinded, nickname, price });
    roundWinesDetailedByRound.set(rid, listDetailed);
  }

  // Precompute acceptable-by-position per round (tie-aware).
  const acceptableByPositionByRound = new Map<number, Array<Set<string>>>();
  for (const [rid, wines] of winesByRound.entries()) acceptableByPositionByRound.set(rid, buildAcceptableByPosition(wines));

  const { data: submissions, error: subsErr } = await supabase
    .from('round_submissions')
    .select('uid, round_id, notes, ranking, submitted_at')
    .eq('game_code', gameCode)
    .returns<Array<Pick<DbSubmission, 'uid' | 'round_id' | 'notes' | 'ranking' | 'submitted_at'>>>();
  if (subsErr) throw new Error(subsErr.message);

  function wineLabelFor(id: string | null) {
    if (!id) return '';
    const w = wineById.get(id);
    const base = `${w?.letter ?? ''}. ${w?.nickname ?? ''}`.trim();
    return base || id;
  }

  // Gambit (all players) scoring: +1 cheapest, +2 most expensive (tie-aware).
  const pricedOnly: Array<{ id: string; cents: number }> = [];
  for (const w of wineById.values()) {
    const normalized = normalizeMoney(w.price);
    const cents = typeof normalized === 'number' && Number.isFinite(normalized) ? Math.round(normalized * 100) : null;
    if (typeof cents === 'number' && Number.isFinite(cents)) pricedOnly.push({ id: w.id, cents });
  }
  const hasPricedWines = pricedOnly.length > 0;
  const minCents = hasPricedWines ? Math.min(...pricedOnly.map((w) => w.cents)) : 0;
  const maxCents = hasPricedWines ? Math.max(...pricedOnly.map((w) => w.cents)) : 0;
  const cheapestIds = new Set(pricedOnly.filter((w) => w.cents === minCents).map((w) => w.id));
  const mostExpensiveIds = new Set(pricedOnly.filter((w) => w.cents === maxCents).map((w) => w.id));

  const { data: gambitRows, error: gambitErr } = await supabase
    .from('gambit_submissions')
    .select('uid, cheapest_wine_id, most_expensive_wine_id, favorite_wine_ids, submitted_at')
    .eq('game_code', gameCode)
    .returns<Array<Pick<DbGambitSubmission, 'uid' | 'cheapest_wine_id' | 'most_expensive_wine_id' | 'favorite_wine_ids' | 'submitted_at'>>>();
  if (gambitErr) throw new Error(gambitErr.message);

  const gambitByUid = new Map<
    string,
    Pick<DbGambitSubmission, 'uid' | 'cheapest_wine_id' | 'most_expensive_wine_id' | 'favorite_wine_ids' | 'submitted_at'>
  >();
  for (const g of gambitRows ?? []) {
    if (!g.uid) continue;
    gambitByUid.set(g.uid, g);
  }

  const gambitSubmissions = Array.from(playersByUid.values())
    .map((p) => {
      const g = gambitByUid.get(p.uid) ?? null;
      const favorites = Array.isArray(g?.favorite_wine_ids)
        ? (g?.favorite_wine_ids as unknown[]).filter((x): x is string => typeof x === 'string' && x.length > 0)
        : [];

      const cheapestPickId = g?.cheapest_wine_id ?? null;
      const expensivePickId = g?.most_expensive_wine_id ?? null;
      const cheapestPoints = cheapestPickId && cheapestIds.has(cheapestPickId) ? 1 : 0;
      const expensivePoints = expensivePickId && mostExpensiveIds.has(expensivePickId) ? 2 : 0;

      return {
        uid: p.uid,
        name: p.name,
        submittedAt: toMs(g?.submitted_at ?? null) ?? 0,
        totalPoints: cheapestPoints + expensivePoints,
        cheapest: {
          pickId: cheapestPickId,
          pickLabel: cheapestPickId ? wineLabelFor(cheapestPickId) : null,
          points: cheapestPoints,
        },
        mostExpensive: {
          pickId: expensivePickId,
          pickLabel: expensivePickId ? wineLabelFor(expensivePickId) : null,
          points: expensivePoints,
        },
        favorites: {
          ids: favorites,
          labels: favorites.map((id) => wineLabelFor(id)),
        },
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // Shape export, by round.
  const rounds: Array<{
    roundId: number;
    wines: Array<{
      position: number | null;
      wineId: string;
      letter: string;
      labelBlinded: string;
      nickname: string;
      price: number | null;
    }>;
    submissions: Array<{
      uid: string;
      name: string;
      submittedAt: number;
      totalPoints: number;
      maxPoints: number;
      notesByWineId: Record<string, string>;
      rows: Array<{
        position: number;
        submittedWineId: string | null;
        submittedLabel: string;
        correctWineIds: string[];
        correctLabels: string[];
        isTie: boolean;
        point: number;
        note: string;
      }>;
    }>;
  }> = [];

  // Index submissions by round for fast assembly.
  const submissionsByRound = new Map<number, Array<Pick<DbSubmission, 'uid' | 'round_id' | 'notes' | 'ranking' | 'submitted_at'>>>();
  for (const s of submissions ?? []) {
    if (typeof s.round_id !== 'number' || !Number.isFinite(s.round_id)) continue;
    if (!s.uid) continue;
    const list = submissionsByRound.get(s.round_id) ?? [];
    list.push(s);
    submissionsByRound.set(s.round_id, list);
  }

  for (let rid = 1; rid <= (game.total_rounds ?? 0); rid += 1) {
    const winesDetailedRaw = roundWinesDetailedByRound.get(rid) ?? [];
    const winesDetailed = [...winesDetailedRaw].sort((a, b) => {
      const ap = a.position ?? Number.MAX_SAFE_INTEGER;
      const bp = b.position ?? Number.MAX_SAFE_INTEGER;
      if (ap !== bp) return ap - bp;
      return a.wineId.localeCompare(b.wineId);
    });

    const acceptableByPosition = acceptableByPositionByRound.get(rid) ?? [];
    const maxPoints = acceptableByPosition.length;

    const subsForRoundRaw = submissionsByRound.get(rid) ?? [];
    const subsForRound = [...subsForRoundRaw].sort((a, b) => {
      const an = playersByUid.get(a.uid)?.name ?? a.uid;
      const bn = playersByUid.get(b.uid)?.name ?? b.uid;
      return an.localeCompare(bn);
    });

    const submissionsOut = subsForRound.map((s) => {
      const submittedRanking =
        Array.isArray(s.ranking) && s.ranking.every((x: unknown) => typeof x === 'string')
          ? (s.ranking as string[])
          : Array.isArray(s.ranking)
            ? (s.ranking as unknown[]).filter((x: unknown): x is string => typeof x === 'string')
            : [];

      const notesByWineId = safeParseNotesMap(s.notes ?? '');

      const used = new Set<string>();
      const rows = acceptableByPosition.map((acceptable, idx) => {
        const submittedWineId = submittedRanking[idx] ?? null;
        const acceptableIds = Array.from(acceptable ?? new Set<string>());
        const acceptableLabels = acceptableIds.map((id) => wineLabelFor(id)).sort((a, b) => a.localeCompare(b));

        let point = 0;
        if (submittedWineId && !used.has(submittedWineId) && acceptable && acceptable.has(submittedWineId)) {
          point = 1;
          used.add(submittedWineId);
        }

        return {
          position: idx,
          submittedWineId,
          submittedLabel: submittedWineId ? wineLabelFor(submittedWineId) : '',
          correctWineIds: acceptableIds,
          correctLabels: acceptableLabels,
          isTie: acceptableIds.length > 1,
          point,
          note: submittedWineId ? notesByWineId[submittedWineId] ?? '' : '',
        };
      });

      const totalPoints = rows.reduce((sum, r) => sum + (r.point ?? 0), 0);

      return {
        uid: s.uid,
        name: playersByUid.get(s.uid)?.name ?? 'Player',
        submittedAt: toMs(s.submitted_at) ?? Date.now(),
        totalPoints,
        maxPoints,
        notesByWineId,
        rows,
      };
    });

    rounds.push({
      roundId: rid,
      wines: winesDetailed,
      submissions: submissionsOut,
    });
  }

  return {
    gameCode: game.game_code,
    status: game.status,
    isHost,
    generatedAt: Date.now(),
    totalRounds: game.total_rounds,
    bottlesPerRound,
    players: (players ?? []).map((p) => ({
      uid: p.uid,
      name: p.name ?? 'Player',
      joinedAt: toMs(p.joined_at) ?? Date.now(),
    })),
    wines: Array.from(wineById.values()).sort((a, b) => a.letter.localeCompare(b.letter)),
    rounds,
    gambit: {
      correct: {
        cheapestIds: Array.from(cheapestIds),
        cheapestLabels: Array.from(cheapestIds).map((id) => wineLabelFor(id)).sort((a, b) => a.localeCompare(b)),
        mostExpensiveIds: Array.from(mostExpensiveIds),
        mostExpensiveLabels: Array.from(mostExpensiveIds).map((id) => wineLabelFor(id)).sort((a, b) => a.localeCompare(b)),
        cheapestIsTie: cheapestIds.size > 1,
        mostExpensiveIsTie: mostExpensiveIds.size > 1,
      },
      submissions: gambitSubmissions,
    },
  };
}

export async function getGambitProgress(gameCode: string, uid: string) {
  const supabase = getSupabaseAdmin();
  const { game } = await ensureInGame(gameCode, uid);
  if (game.status !== 'gambit' && game.status !== 'finished') throw new Error('GAMBIT_NOT_AVAILABLE');

  const { data: players, error: playersErr } = await supabase
    .from('players')
    .select('uid, name, joined_at')
    .eq('game_code', gameCode)
    .order('joined_at', { ascending: true })
    .returns<Array<Pick<DbPlayer, 'uid' | 'name' | 'joined_at'>>>();
  if (playersErr) throw new Error(playersErr.message);
  const normalizedPlayers = (players ?? []).filter((p) => !!p.uid);
  const playerUids = normalizedPlayers.map((p) => p.uid);

  const { data: subs, error: subsErr } = await supabase
    .from('gambit_submissions')
    .select('uid, submitted_at')
    .eq('game_code', gameCode)
    .returns<Array<Pick<DbGambitSubmission, 'uid' | 'submitted_at'>>>();
  if (subsErr) throw new Error(subsErr.message);

  const submittedAtByUid: Record<string, number> = {};
  for (const s of subs ?? []) {
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
  const supabase = getSupabaseAdmin();
  const { game } = await ensureInGame(gameCode, uid);

  if (game.status !== 'gambit' && game.status !== 'finished') throw new Error('GAMBIT_NOT_AVAILABLE');

  const uniqueFavs = Array.from(new Set((favoriteWineIds ?? []).filter((x) => typeof x === 'string' && x.length > 0)));
  if (!uniqueFavs.length) throw new Error('INVALID_INPUT');

  if (cheapestWineId === mostExpensiveWineId) throw new Error('GAMBIT_DUPLICATE_PICK');

  const allIds = new Set([cheapestWineId, mostExpensiveWineId, ...uniqueFavs]);
  const { data: validRows, error } = await supabase
    .from('wines')
    .select('wine_id')
    .eq('game_code', gameCode)
    .in('wine_id', Array.from(allIds))
    .returns<Array<Pick<DbWine, 'wine_id'>>>();
  if (error) throw new Error(error.message);
  const valid = new Set((validRows ?? []).map((r) => r.wine_id));
  for (const id of allIds) {
    if (!valid.has(id)) throw new Error('INVALID_WINE_ID');
  }

  const { error: upsertError } = await supabase.from('gambit_submissions').upsert({
    game_code: gameCode,
    uid,
    cheapest_wine_id: cheapestWineId,
    most_expensive_wine_id: mostExpensiveWineId,
    favorite_wine_ids: uniqueFavs,
    submitted_at: new Date().toISOString(),
  });
  if (upsertError) throw new Error(upsertError.message);

  return { ok: true };
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
    price: normalizeMoney(w.price),
  }));
}

export async function upsertWines(
  gameCode: string,
  hostUid: string,
  wines: Array<{ id: string; letter: string; labelBlinded: string; nickname: string; price?: number | null }>
) {
  const supabase = getSupabaseAdmin();
  await ensureHost(gameCode, hostUid);

  function normalizePriceForStorage(n: unknown): number | null {
    const normalized = normalizeMoney(n);
    if (normalized === null) return null;
    if (normalized < 0) return null;
    return normalized;
  }

  const payload = wines.map((w) => ({
    game_code: gameCode,
    wine_id: w.id,
    letter: w.letter,
    label_blinded: stripTrailingNumberMatchingLetter(w.labelBlinded ?? '', w.letter),
    nickname: w.nickname ?? '',
    price: normalizePriceForStorage(w.price),
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
