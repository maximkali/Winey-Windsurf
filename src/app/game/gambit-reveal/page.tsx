'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useUrlBackedIdentity } from '@/utils/hooks';
import { WineyCard } from '@/components/winey/WineyCard';
import { WineyShell } from '@/components/winey/WineyShell';
import { WineySubtitle, WineyTitle } from '@/components/winey/Typography';
import { Button } from '@/components/ui/button';
import { LOCAL_STORAGE_GAME_KEY, LOCAL_STORAGE_UID_KEY } from '@/utils/constants';

type GambitReveal = {
  gameCode: string;
  status: string;
  isHost: boolean;
  submittedAt: number;
  totalPoints: number;
  maxPoints: number;
  cheapest: {
    pickId: string | null;
    pickLabel: string | null;
    correctIds: string[];
    correctLabels: string[];
    isTie: boolean;
    points: number;
  };
  mostExpensive: {
    pickId: string | null;
    pickLabel: string | null;
    correctIds: string[];
    correctLabels: string[];
    isTie: boolean;
    points: number;
  };
  favorites: { ids: string[]; labels: string[] };
};

export default function GambitRevealPage() {
  const router = useRouter();
  const { gameCode, uid } = useUrlBackedIdentity();

  const [data, setData] = useState<GambitReveal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const finalizedRef = useRef(false);

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

  const continueHref = useMemo(() => {
    const g = effectiveGameCode || (data?.gameCode ?? '').trim().toUpperCase();
    if (!g) return '/game/final-leaderboard';
    const u = effectiveUid;
    const recoveredQs = `gameCode=${encodeURIComponent(g)}${u ? `&uid=${encodeURIComponent(u)}` : ''}`;
    return `/game/final-leaderboard?${recoveredQs}`;
  }, [data?.gameCode, effectiveGameCode, effectiveUid]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!effectiveGameCode) return;
      setLoading(true);
      try {
        const res = await apiFetch<GambitReveal>(`/api/gambit/reveal/get?gameCode=${encodeURIComponent(effectiveGameCode)}`);
        if (cancelled) return;
        setData(res);
        setError(null);

        // Persist gameCode so deep links / refreshes can still navigate to the final leaderboard.
        try {
          window.localStorage.setItem(LOCAL_STORAGE_GAME_KEY, (res.gameCode ?? '').trim().toUpperCase());
        } catch {
          // ignore
        }

        // If the game is already finalized, keep players on the final leaderboard once they continue.
        if (!finalizedRef.current && res.status === 'finished') finalizedRef.current = true;
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load Gambit results');
      } finally {
        if (!cancelled) setLoading(false);
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

  async function onFinalizeGame() {
    if (!gameCode || !uid) return;
    try {
      await apiFetch<{ ok: true }>(`/api/game/finish`, {
        method: 'POST',
        body: JSON.stringify({ gameCode, uid }),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to finalize game');
    }
  }

  function rowLabel(kind: 'Cheapest' | 'Most expensive', points: number) {
    const earned = Number.isFinite(points) ? points : 0;
    const isCorrect = earned > 0;
    const ptsText = isCorrect ? `+${earned}` : '0';
    return (
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-[#2b2b2b]">{kind}</p>
        </div>
        <div
          className={[
            'flex-shrink-0 rounded-[4px] border border-[#2f2f2f] px-2 py-1 text-[11px] font-semibold text-white shadow-[2px_2px_0_rgba(0,0,0,0.35)]',
            // Keep color logic consistent with round reveals: green only when points > 0.
            isCorrect ? 'bg-[#6f7f6a]' : 'bg-[#7a2a1d]',
          ].join(' ')}
        >
          {ptsText}
        </div>
      </div>
    );
  }

  const cheapestCorrect = data?.cheapest?.correctLabels?.length ? data.cheapest.correctLabels.join(' / ') : '—';
  const expensiveCorrect = data?.mostExpensive?.correctLabels?.length ? data.mostExpensive.correctLabels.join(' / ') : '—';

  return (
    <WineyShell maxWidthClassName="max-w-[860px]">
      <main className="pt-6">
        <div className="mx-auto w-full max-w-[420px]">
          <WineyCard className="px-5 py-5">
            <div className="text-center">
              <WineyTitle className="text-[18px] text-[#b08a3c]">Gambit Results</WineyTitle>
              <WineySubtitle className="mt-1">
                {data ? `You scored ${data.totalPoints}/${data.maxPoints}` : loading ? 'Loading…' : ' '}
              </WineySubtitle>
            </div>

            {error ? <p className="mt-3 text-center text-[12px] text-red-600">{error}</p> : null}

            {/* Removed per-player "Submissions" panel; results screen doesn't need it. */}

            {data ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-[4px] border border-[#2f2f2f] bg-[#e9e5dd] p-3">
                  {rowLabel('Cheapest', data.cheapest.points)}
                  <p className="mt-2 text-[12px] text-[#2b2b2b]">
                    <span className="font-semibold">Your pick:</span> {data.cheapest.pickLabel || '—'}
                  </p>
                  <p className="mt-1 text-[12px] text-[#2b2b2b]">
                    <span className="font-semibold">Correct:</span>{' '}
                    {data.cheapest.isTie ? `(${cheapestCorrect})` : cheapestCorrect}
                  </p>
                </div>

                <div className="rounded-[4px] border border-[#2f2f2f] bg-[#e9e5dd] p-3">
                  {rowLabel('Most expensive', data.mostExpensive.points)}
                  <p className="mt-2 text-[12px] text-[#2b2b2b]">
                    <span className="font-semibold">Your pick:</span> {data.mostExpensive.pickLabel || '—'}
                  </p>
                  <p className="mt-1 text-[12px] text-[#2b2b2b]">
                    <span className="font-semibold">Correct:</span>{' '}
                    {data.mostExpensive.isTie ? `(${expensiveCorrect})` : expensiveCorrect}
                  </p>
                </div>

                <div className="rounded-[4px] border border-[#2f2f2f] bg-[#e9e5dd] p-3">
                  <p className="text-[12px] font-semibold text-[#2b2b2b]">Favorites (no points)</p>
                  <p className="mt-2 text-[12px] text-[#2b2b2b] break-words whitespace-normal">
                    {data.favorites.labels?.length ? data.favorites.labels.join(', ') : '—'}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="mt-5 space-y-2">
              {data?.isHost && data.status !== 'finished' ? (
                <Button className="w-full bg-black hover:bg-zinc-900 text-white" variant="outline" onClick={onFinalizeGame}>
                  (Admin) Finalize Game
                </Button>
              ) : null}
              <Button className="w-full" onClick={() => router.push(continueHref)}>
                Continue
              </Button>
            </div>
          </WineyCard>
        </div>
      </main>
    </WineyShell>
  );
}


