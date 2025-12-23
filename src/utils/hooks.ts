'use client';

import { useEffect, useState } from 'react';
import { LOCAL_STORAGE_GAME_KEY, LOCAL_STORAGE_UID_KEY } from '@/utils/constants';

export function useLocalIdentity() {
  const [uid] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(LOCAL_STORAGE_UID_KEY);
  });

  const [gameCode] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(LOCAL_STORAGE_GAME_KEY);
  });

  return { uid, gameCode };
}

function normalizeGameCode(raw: string | null) {
  const v = (raw ?? '').trim().toUpperCase();
  return v ? v : null;
}

function normalizeUid(raw: string | null) {
  const v = (raw ?? '').trim();
  return v ? v : null;
}

/**
 * Reads `gameCode` (and optional `uid`) from the URL query string and syncs them to localStorage.
 * This enables copy/paste deep links that still work after a refresh or returning days later.
 *
 * Supported params:
 * - gameCode / game
 * - uid / hostUid
 */
export function useUrlBackedIdentity() {
  const [uid, setUid] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(LOCAL_STORAGE_UID_KEY);
  });

  const [gameCode, setGameCode] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(LOCAL_STORAGE_GAME_KEY);
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const urlGameCode = normalizeGameCode(params.get('gameCode') ?? params.get('game'));
    const urlUid = normalizeUid(params.get('uid') ?? params.get('hostUid'));

    if (urlGameCode) {
      try {
        window.localStorage.setItem(LOCAL_STORAGE_GAME_KEY, urlGameCode);
      } catch {
        // ignore
      }
      setGameCode(urlGameCode);
    }

    if (urlUid) {
      try {
        window.localStorage.setItem(LOCAL_STORAGE_UID_KEY, urlUid);
      } catch {
        // ignore
      }
      setUid(urlUid);
    }
  }, []);

  return { uid, gameCode };
}
