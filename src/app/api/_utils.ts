import { NextResponse } from 'next/server';

const ERROR_STATUS: Record<string, number> = {
  INVALID_INPUT: 400,
  UNAUTHORIZED: 401,

  NOT_HOST: 403,
  NOT_IN_GAME: 403,

  GAME_NOT_FOUND: 404,
  ROUND_NOT_FOUND: 404,

  GAME_FULL: 409,
  GAME_ALREADY_STARTED: 409,
  GAME_NOT_STARTED: 409,
  GAME_FINISHED: 409,
  GAME_NOT_FINISHED: 409,
  GAME_NOT_IN_GAMBIT: 409,
  WINE_LIST_INCOMPLETE: 409,
  ROUND_CLOSED: 409,
  ROUND_NOT_CURRENT: 409,
  ROUND_NOT_CLOSED: 409,
  HOST_MUST_SUBMIT: 409,
  GAMBIT_NOT_CLOSED: 409,
  GAMBIT_NOT_AVAILABLE: 409,
  GAMBIT_INCOMPLETE: 409,
  GAMBIT_DUPLICATE_PICK: 409,
  ROUND_NOT_CONFIGURED: 409,
  INVALID_RANKING: 409,
  CONFLICT: 409,

  CANNOT_BOOT_HOST: 400,
  INVALID_WINE_ID: 400,

  FAILED_TO_CREATE_GAME: 500,
  SUPABASE_NOT_CONFIGURED: 500,
};

const ERROR_MESSAGE: Record<string, string> = {
  NOT_IN_GAME: 'You were removed from the lobby.',
  WINE_LIST_INCOMPLETE: 'Please complete your Wine List (matching your Setup Tasting bottle count) and enter prices for every wine before starting the game.',
  GAME_ALREADY_STARTED: 'This game has already started.',
  GAME_NOT_STARTED: 'This game has not started yet.',
  GAME_NOT_FINISHED: 'Please wait for the host to finalize the game before viewing the full reveal export.',
  GAME_NOT_IN_GAMBIT: 'This game is not in the Gambit phase.',
  GAME_FULL: 'This game lobby is full.',
  HOST_MUST_SUBMIT: 'Host must submit before closing the round.',
  ROUND_NOT_CURRENT: 'This round is no longer active.',
  ROUND_NOT_CONFIGURED: 'This round has not been configured yet (host needs to assign wines).',
  INVALID_RANKING: 'Your ranking is invalid for this round. Please refresh and try again.',
  ROUND_NOT_CLOSED: 'Please close the current round before proceeding.',
  GAMBIT_NOT_AVAILABLE: 'Sommelier’s Gambit isn’t available yet.',
  GAMBIT_NOT_CLOSED: 'Please wait for the host to close the Gambit before viewing results.',
  GAMBIT_INCOMPLETE: 'Not everyone has submitted their Gambit yet.',
  GAMBIT_DUPLICATE_PICK: 'Cheapest and most expensive must be different wines.',
};

export function apiError(e: unknown) {
  const raw = e instanceof Error ? e.message : 'UNKNOWN';
  const status = ERROR_STATUS[raw] ?? 500;
  const error = ERROR_MESSAGE[raw] ?? raw;
  // `code` is a stable machine-readable identifier; `error` remains user-friendly for backwards compatibility.
  return NextResponse.json({ code: raw, error }, { status });
}

/**
 * Optional hardening: if the client sends both an `x-uid` header and a body `uid`,
 * require them to match. This prevents accidental/malicious mismatches while keeping
 * backwards compatibility for clients that only send one of them.
 */
export function assertRequestUidMatches(req: Request, uid: string) {
  const headerUid = (req.headers.get('x-uid') ?? '').trim();
  const bodyUid = (uid ?? '').trim();
  if (headerUid && bodyUid && headerUid !== bodyUid) throw new Error('UNAUTHORIZED');
}


