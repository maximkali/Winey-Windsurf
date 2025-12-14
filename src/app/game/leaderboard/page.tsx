'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { LOCAL_STORAGE_GAME_KEY, LOCAL_STORAGE_UID_KEY } from '@/utils/constants';
import { WineyCard } from '@/components/winey/WineyCard';
import { WineyShell } from '@/components/winey/WineyShell';

type Leaderboard = {
  gameCode: string;
  status: string;
  leaderboard: Array<{ uid: string; name: string; score: number }>;
  isHost?: boolean;
};

export default function LeaderboardPage() {
  const router = useRouter();
  const [data, setData] = useState<Leaderboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingNext, setLoadingNext] = useState(false);

  const gameCode = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(LOCAL_STORAGE_GAME_KEY);
  }, []);

  const uid = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(LOCAL_STORAGE_UID_KEY);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!gameCode) return;
      try {
        const res = await apiFetch<Leaderboard>(`/api/leaderboard/get?gameCode=${encodeURIComponent(gameCode)}`);
        if (!cancelled) setData(res);
        if (!cancelled) setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load leaderboard');
      }
    }

    load();
    const id = window.setInterval(load, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [gameCode]);

  async function onStartNextRound() {
    if (loadingNext) return;
    setLoadingNext(true);
    setError(null);
    try {
      const res = await apiFetch<{ ok: true; finished: boolean; nextRound: number | null }>(
        `/api/round/advance`,
        {
          method: 'POST',
          body: JSON.stringify({ gameCode, uid }),
        }
      );

      if (res.finished) router.refresh();
      else if (res.nextRound) router.push(`/game/round/${res.nextRound}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start next round');
    } finally {
      setLoadingNext(false);
    }
  }

  return (
    <WineyShell maxWidthClassName="max-w-[860px]">
      <main className="pt-6">
        <div className="mx-auto w-full max-w-[420px]">
          <WineyCard className="px-5 py-5">
            <div className="text-center">
              <h1 className="text-[18px] font-semibold text-[#b08a3c]">Leaderboard</h1>
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
                    <span className="text-[11px] text-green-700 font-semibold">+{p.score}</span>
                    <span className="text-[12px] font-semibold">{p.score}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4">
              {data?.isHost ? (
                <Button className="w-full py-3" onClick={onStartNextRound} disabled={loadingNext}>
                  {loadingNext ? 'Starting…' : '(Admin) Start Next Round'}
                </Button>
              ) : null}
            </div>
          </WineyCard>
        </div>
      </main>
    </WineyShell>
  );
}
