'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { LOCAL_STORAGE_GAME_KEY } from '@/utils/constants';
import { WineyCard } from '@/components/winey/WineyCard';
import { WineyShell } from '@/components/winey/WineyShell';

type GameState = {
  gameCode: string;
  status: string;
  currentRound: number;
  totalRounds: number;
  setupPlayers?: number | null;
  players: Array<{ uid: string; name: string; joinedAt: number }>;
  isHost: boolean;
};

export default function PlayerLobbyPage() {
  const router = useRouter();
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const gameCode = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(LOCAL_STORAGE_GAME_KEY);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      if (!gameCode) return;
      try {
        const s = await apiFetch<GameState>(`/api/game/get?gameCode=${encodeURIComponent(gameCode)}`);
        if (!cancelled) setState(s);
        if (!cancelled) setError(null);

        if (s.status === 'in_progress') router.push('/game/round/1');
        if (s.status === 'finished') router.push('/game/leaderboard');
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      }
    }

    tick();
    const id = window.setInterval(tick, 1200);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [gameCode, router]);

  return (
    <WineyShell maxWidthClassName="max-w-[860px]">
      <main className="pt-6">
        <div className="mx-auto w-full max-w-[560px] space-y-4">
          <WineyCard className="px-6 py-5">
            <div className="text-center">
              <h1 className="text-[18px] font-semibold">Lobby</h1>
            </div>

            <div className="mt-3 rounded-[4px] border border-[#2f2f2f] bg-[#e9e5dd] px-4 py-3 text-center">
              <p className="text-[12px]">
                <span className="text-[#b08a3c] font-semibold">●</span>{' '}
                <span className="font-semibold">Game Code:</span> {state?.gameCode ?? gameCode ?? '—'}
              </p>
              <p className="mt-1 text-[11px] text-[#3d3d3d]">
                {(state?.players?.length ?? 0)} Players Joined{state?.setupPlayers ? ` / ${state.setupPlayers}` : ''}
              </p>
              <p className="text-[11px] text-[#3d3d3d]">Waiting for the host to start the game…</p>
            </div>

            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

            <div className="mt-3 grid grid-cols-2 gap-2">
              {(state?.players ?? []).map((p) => (
                <div key={p.uid} className="rounded-[4px] border border-[#2f2f2f] bg-white px-3 py-2">
                  <p className="text-[12px] font-semibold truncate">{p.name}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-[4px] border border-[#2f2f2f] bg-[#e9e5dd] px-4 py-2 text-center text-[12px] font-semibold text-[#3d3d3d]">
              Waiting for host to start the game…
            </div>
          </WineyCard>

          <WineyCard className="px-6 py-5">
            <h2 className="text-center text-[13px] font-semibold">Tasting Details</h2>
            <p className="mt-3 text-[10px] leading-relaxed text-[#3d3d3d]">
              In this blind tasting, you’ll organize 4 different wines across multiple rounds. Each round, taste each wine and rank them from most to
              least expensive. Once everyone votes, you’ll see how your picks stacked up against your friends.
            </p>
          </WineyCard>

          <Link href="/" className="block">
            <Button variant="outline" className="w-full py-3">Back Home</Button>
          </Link>
        </div>
      </main>
    </WineyShell>
  );
}
