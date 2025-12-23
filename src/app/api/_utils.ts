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
  WINE_LIST_INCOMPLETE: 409,
  ROUND_CLOSED: 409,
  ROUND_NOT_CURRENT: 409,
  ROUND_NOT_CLOSED: 409,
  ROUND_NOT_CONFIGURED: 409,
  INVALID_RANKING: 409,
  CONFLICT: 409,

  CANNOT_BOOT_HOST: 400,

  SUPABASE_NOT_CONFIGURED: 500,
};

const ERROR_MESSAGE: Record<string, string> = {
  NOT_IN_GAME: 'You were removed from the lobby.',
  WINE_LIST_INCOMPLETE: 'Please complete your Wine List (matching your Setup Tasting bottle count) before starting the game.',
  GAME_ALREADY_STARTED: 'This game has already started.',
  GAME_NOT_STARTED: 'This game has not started yet.',
  GAME_FULL: 'This game lobby is full.',
  ROUND_NOT_CURRENT: 'This round is no longer active.',
  ROUND_NOT_CONFIGURED: 'This round has not been configured yet (host needs to assign wines).',
  INVALID_RANKING: 'Your ranking is invalid for this round. Please refresh and try again.',
  ROUND_NOT_CLOSED: 'Please close the current round before proceeding.',
};

export function apiError(e: unknown) {
  const raw = e instanceof Error ? e.message : 'UNKNOWN';
  const status = ERROR_STATUS[raw] ?? 500;
  const error = ERROR_MESSAGE[raw] ?? raw;
  return NextResponse.json({ error }, { status });
}


