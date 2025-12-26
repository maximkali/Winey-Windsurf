'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useUrlBackedIdentity } from '@/utils/hooks';
import { WineyCard } from '@/components/winey/WineyCard';
import { WineyShell } from '@/components/winey/WineyShell';
import { WineyTitle } from '@/components/winey/Typography';
import { LOCAL_STORAGE_GAME_KEY, LOCAL_STORAGE_UID_KEY } from '@/utils/constants';

type Leaderboard = {
  gameCode: string;
  status: string;
  leaderboard: Array<{ uid: string; name: string; score: number; delta?: number }>;
};

export default function FinalLeaderboardPage() {
  const [data, setData] = useState<Leaderboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { gameCode, uid } = useUrlBackedIdentity();

  const effectiveGameCode = useMemo(() => {
    const g = (gameCode ?? '').trim().toUpperCase();
    if (g) return g;
    if (typeof window === 'undefined') return null;
    try {
      const params = new URLSearchParams(window.location.search);
      const urlGameCode = (params.get('gameCode') ?? params.get('game') ?? '').trim().toUpperCase();
      if (urlGameCode) return urlGameCode;
      const storedGameCode = (window.localStorage.getItem(LOCAL_STORAGE_GAME_KEY) ?? '').trim().toUpperCase();
      return storedGameCode || null;
    } catch {
      return null;
    }
  }, [gameCode]);

  const effectiveUid = useMemo(() => {
    const u = (uid ?? '').trim();
    if (u) return u;
    if (typeof window === 'undefined') return null;
    try {
      const params = new URLSearchParams(window.location.search);
      const urlUid = (params.get('uid') ?? params.get('hostUid') ?? '').trim();
      if (urlUid) return urlUid;
      const storedUid = (window.localStorage.getItem(LOCAL_STORAGE_UID_KEY) ?? '').trim();
      return storedUid || null;
    } catch {
      return null;
    }
  }, [uid]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!effectiveGameCode) return;
      try {
        const res = await apiFetch<Leaderboard>(`/api/leaderboard/get?gameCode=${encodeURIComponent(effectiveGameCode)}`);
        if (cancelled) return;
        setData(res);
        setError(null);

        // Persist gameCode so refresh/deep-link navigation stays stable.
        try {
          window.localStorage.setItem(LOCAL_STORAGE_GAME_KEY, (res.gameCode ?? '').trim().toUpperCase());
        } catch {
          // ignore
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load leaderboard');
      }
    }

    load();
    function onFocus() {
      void load();
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') void load();
    }

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
    };
  }, [effectiveGameCode]);

  // If someone lands here before the game is actually finalized, keep them on the regular leaderboard.
  useEffect(() => {
    if (!effectiveGameCode) return;
    if (!data) return;
    if (data.status === 'finished') return;
    const qs = `gameCode=${encodeURIComponent(effectiveGameCode)}${effectiveUid ? `&uid=${encodeURIComponent(effectiveUid)}` : ''}`;
    window.location.assign(`/game/leaderboard?${qs}`);
  }, [data, effectiveGameCode, effectiveUid]);

  return (
    <WineyShell maxWidthClassName="max-w-[980px]">
      <main className="pt-6">
        <div className="mx-auto w-full max-w-[420px]">
          <WineyCard className="px-5 py-5">
            <div className="text-center">
              <WineyTitle className="text-[18px]">Final Leaderboard</WineyTitle>
            </div>

            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

            <div className="mt-4 rounded-[4px] border border-[#2f2f2f] bg-white">
              {(data?.leaderboard ?? []).map((p, idx) => (
                <div key={p.uid} className="flex items-center justify-between px-3 py-2 border-b border-[#2f2f2f] last:border-b-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold w-5">{idx + 1}.</span>
                    <span className="text-[12px] font-semibold">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-green-700 font-semibold">+{p.delta ?? 0}</span>
                    <span className="text-[12px] font-semibold">{p.score}</span>
                  </div>
                </div>
              ))}
            </div>
          </WineyCard>
        </div>
      </main>
    </WineyShell>
  );
}


