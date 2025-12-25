'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useUrlBackedIdentity } from '@/utils/hooks';
import { WineyCard } from '@/components/winey/WineyCard';
import { WineyShell } from '@/components/winey/WineyShell';
import { WineyTitle } from '@/components/winey/Typography';

type Leaderboard = {
  gameCode: string;
  status: string;
  leaderboard: Array<{ uid: string; name: string; score: number; delta?: number }>;
};

export default function FinalLeaderboardPage() {
  const [data, setData] = useState<Leaderboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { gameCode, uid } = useUrlBackedIdentity();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!gameCode) return;
      try {
        const res = await apiFetch<Leaderboard>(`/api/leaderboard/get?gameCode=${encodeURIComponent(gameCode)}`);
        if (cancelled) return;
        setData(res);
        setError(null);
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

  // If someone lands here before the game is actually finalized, keep them on the regular leaderboard.
  useEffect(() => {
    if (!gameCode) return;
    if (!data) return;
    if (data.status === 'finished') return;
    const qs = `gameCode=${encodeURIComponent(gameCode)}${uid ? `&uid=${encodeURIComponent(uid)}` : ''}`;
    window.location.assign(`/game/leaderboard?${qs}`);
  }, [data, gameCode, uid]);

  return (
    <WineyShell maxWidthClassName="max-w-[860px]">
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


