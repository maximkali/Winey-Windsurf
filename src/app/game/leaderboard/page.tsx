'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useUrlBackedIdentity } from '@/utils/hooks';
import { WineyCard } from '@/components/winey/WineyCard';
import { WineyShell } from '@/components/winey/WineyShell';

type Leaderboard = {
  gameCode: string;
  status: string;
  leaderboard: Array<{ uid: string; name: string; score: number; delta?: number }>;
  isHost?: boolean;
};

export default function LeaderboardPage() {
  const router = useRouter();
  const [data, setData] = useState<Leaderboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fromHref] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const from = params.get('from');
    return from && from.startsWith('/') ? from : null;
  });

  const { gameCode, uid } = useUrlBackedIdentity();

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

  function onBackToGame() {
    if (fromHref) {
      router.push(fromHref);
      return;
    }
    router.back();
  }

  const qs = gameCode ? `gameCode=${encodeURIComponent(gameCode)}${uid ? `&uid=${encodeURIComponent(uid)}` : ''}` : null;

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
                    <span className="text-[11px] text-green-700 font-semibold">+{p.delta ?? 0}</span>
                    <span className="text-[12px] font-semibold">{p.score}</span>
                  </div>
                </div>
              ))}
            </div>

            {data?.isHost ? (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => {
                    if (!gameCode) return;
                    const from = `/game/leaderboard${qs ? `?${qs}` : ''}`;
                    router.push(qs ? `/game/manage-players?${qs}&from=${encodeURIComponent(from)}` : `/game/manage-players?from=${encodeURIComponent(from)}`);
                  }}
                  className="text-[11px] text-blue-700 underline"
                >
                  Manage Players
                </button>
              </div>
            ) : null}

            <div className="mt-4">
              <div className="text-center">
                <button type="button" onClick={onBackToGame} className="text-[11px] text-blue-700 underline">
                  Back to Game
                </button>
              </div>
            </div>
          </WineyCard>
        </div>
      </main>
    </WineyShell>
  );
}
