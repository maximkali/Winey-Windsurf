'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { LOCAL_STORAGE_GAME_KEY, LOCAL_STORAGE_PLAYER_COUNT_KEY, LOCAL_STORAGE_UID_KEY } from '@/utils/constants';
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

export default function HostLobbyPage() {
  const router = useRouter();
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingStart, setLoadingStart] = useState(false);

  const gameCode = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(LOCAL_STORAGE_GAME_KEY);
  }, []);

  const uid = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(LOCAL_STORAGE_UID_KEY);
  }, []);

  const targetPlayers = useMemo(() => {
    const fromState = state?.setupPlayers;
    if (typeof fromState === 'number' && Number.isFinite(fromState) && fromState > 0) return fromState;
    if (typeof window === 'undefined') return 8;
    const raw = window.localStorage.getItem(LOCAL_STORAGE_PLAYER_COUNT_KEY);
    const n = Number(raw ?? '8');
    return Number.isFinite(n) && n > 0 ? n : 8;
  }, [state?.setupPlayers]);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      if (!gameCode) return;
      try {
        const s = await apiFetch<GameState>(`/api/game/get?gameCode=${encodeURIComponent(gameCode)}`);
        if (!cancelled) setState(s);
        if (!cancelled) setError(null);

        if (s.status === 'in_progress') router.push(`/game/round/1`);
        if (s.status === 'finished') router.push(`/game/leaderboard`);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load lobby');
      }
    }

    tick();
    const id = window.setInterval(tick, 1200);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [gameCode, router]);

  async function onStart() {
    if (!gameCode || !uid) return;
    setLoadingStart(true);
    setError(null);
    try {
      await apiFetch<{ ok: true }>(`/api/game/start`, {
        method: 'POST',
        body: JSON.stringify({ gameCode, uid }),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start');
    } finally {
      setLoadingStart(false);
    }
  }

  async function onBoot(playerUid: string) {
    if (!gameCode || !uid) return;
    setError(null);
    try {
      await apiFetch<{ ok: true }>(`/api/players/boot`, {
        method: 'POST',
        body: JSON.stringify({ gameCode, uid, playerUid }),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to boot');
    }
  }

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
                <span className="font-semibold">Game Code:</span> {state?.gameCode ?? gameCode ?? '—'}{' '}
                <button
                  type="button"
                  onClick={() => {
                    const code = state?.gameCode ?? gameCode;
                    if (code) navigator.clipboard?.writeText(code).catch(() => undefined);
                  }}
                  className="ml-2 rounded-[4px] border border-[#2f2f2f] bg-[#6f7f6a] px-2 py-1 text-[11px] font-semibold text-white shadow-[2px_2px_0_rgba(0,0,0,0.35)]"
                >
                  Copy Link
                </button>
              </p>
              <p className="mt-1 text-[11px] text-[#3d3d3d]">
                {(state?.players?.length ?? 0)} Players Joined &nbsp;&amp;&nbsp; {targetPlayers} Total
              </p>
              <p className="text-[11px] text-[#3d3d3d]">Waiting for {playersRemaining(state?.players?.length, targetPlayers)} more participants.</p>
            </div>

            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

            <div className="mt-3 grid grid-cols-2 gap-2">
              {(state?.players ?? []).map((p) => (
                <div
                  key={p.uid}
                  className="flex items-center justify-between rounded-[4px] border border-[#2f2f2f] bg-white px-3 py-2"
                >
                  <p className="text-[12px] font-semibold truncate">{p.name}</p>
                  {p.uid !== uid ? (
                    <button
                      type="button"
                      onClick={() => onBoot(p.uid)}
                      className="ml-3 h-5 w-5 rounded-[4px] border border-[#2f2f2f] bg-[#e9e5dd] text-[12px] leading-none shadow-[2px_2px_0_rgba(0,0,0,0.35)]"
                      aria-label="Boot"
                    >
                      ×
                    </button>
                  ) : (
                    <span className="ml-3 text-[10px] text-[#3d3d3d]">(Admin)</span>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4">
              <Button className="w-full py-3" onClick={onStart} disabled={loadingStart || !state?.isHost}>
                {loadingStart ? 'Starting…' : '(Admin) Start Game'}
              </Button>
            </div>
          </WineyCard>

          <WineyCard className="px-6 py-5">
            <h2 className="text-center text-[13px] font-semibold">Tasting Details</h2>
            <p className="mt-3 text-[10px] leading-relaxed text-[#3d3d3d]">
              In this blind tasting, you’ll organize 4 different wines across multiple rounds. Each round, each player will taste each wine and rank them
              from most to least expensive. At the end of each round, you’ll see how your picks stacked up against your friends.
            </p>
          </WineyCard>
        </div>
      </main>
    </WineyShell>
  );
}

function playersRemaining(count: number | undefined, target: number) {
  const joined = count ?? 0;
  return Math.max(0, target - joined);
}
