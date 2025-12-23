'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  LOCAL_STORAGE_BOTTLE_COUNT_KEY,
  LOCAL_STORAGE_BOTTLES_PER_ROUND_KEY,
  LOCAL_STORAGE_GAME_KEY,
  LOCAL_STORAGE_ROUND_COUNT_KEY,
  LOCAL_STORAGE_UID_KEY,
} from '@/utils/constants';
import { useUrlBackedIdentity } from '@/utils/hooks';
import { WineyCard } from '@/components/winey/WineyCard';
import { WineyShell } from '@/components/winey/WineyShell';

type GameState = {
  gameCode: string;
  status: string;
  currentRound: number;
  totalRounds: number;
  setupPlayers?: number | null;
  setupBottles?: number | null;
  setupBottlesPerRound?: number | null;
  setupOzPerPersonPerBottle?: number | null;
  players: Array<{ uid: string; name: string; joinedAt: number }>;
  isHost: boolean;
};

export default function PlayerLobbyPage() {
  const router = useRouter();
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedReturn, setCopiedReturn] = useState(false);

  const { gameCode, uid } = useUrlBackedIdentity();

  async function copyReturnLink(code: string, playerUid: string) {
    const normalized = code.trim().toUpperCase();
    const url = `${window.location.origin}/player/lobby?gameCode=${encodeURIComponent(normalized)}&uid=${encodeURIComponent(playerUid)}`;
    try {
      await navigator.clipboard?.writeText(url);
      return;
    } catch {
      // ignore
    }
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand('copy');
    } finally {
      document.body.removeChild(ta);
    }
  }

  function showCopiedReturn() {
    setCopiedReturn(true);
    window.setTimeout(() => setCopiedReturn(false), 1200);
  }

  const tastingConfig = useMemo(() => {
    const standard750mlBottleOz = 25.36;

    const setupBottlesPerRound = state?.setupBottlesPerRound;
    const setupBottles = state?.setupBottles;
    const setupOz = state?.setupOzPerPersonPerBottle;
    const setupRounds = state?.totalRounds;

    const bottlesPerRoundFallback =
      typeof window === 'undefined' ? NaN : Number(window.localStorage.getItem(LOCAL_STORAGE_BOTTLES_PER_ROUND_KEY) ?? '4');
    const bottlesFallback = typeof window === 'undefined' ? NaN : Number(window.localStorage.getItem(LOCAL_STORAGE_BOTTLE_COUNT_KEY) ?? '0');
    const roundsFallback = typeof window === 'undefined' ? NaN : Number(window.localStorage.getItem(LOCAL_STORAGE_ROUND_COUNT_KEY) ?? '0');

    const bottlesPerRound =
      typeof setupBottlesPerRound === 'number' && Number.isFinite(setupBottlesPerRound) && setupBottlesPerRound > 0
        ? setupBottlesPerRound
        : Number.isFinite(bottlesPerRoundFallback) && bottlesPerRoundFallback > 0
          ? bottlesPerRoundFallback
          : 4;

    const bottles =
      typeof setupBottles === 'number' && Number.isFinite(setupBottles) && setupBottles > 0
        ? setupBottles
        : Number.isFinite(bottlesFallback) && bottlesFallback > 0
          ? bottlesFallback
          : 0;

    const rounds =
      typeof setupRounds === 'number' && Number.isFinite(setupRounds) && setupRounds > 0
        ? setupRounds
        : Number.isFinite(roundsFallback) && roundsFallback > 0
          ? roundsFallback
          : 0;

    const ozPerPersonPerBottle = typeof setupOz === 'number' && Number.isFinite(setupOz) && setupOz > 0 ? setupOz : null;
    const totalOzPerPerson = ozPerPersonPerBottle !== null && bottles ? bottles * ozPerPersonPerBottle : null;
    const percentOfStandardBottle =
      totalOzPerPerson !== null ? Math.round((totalOzPerPerson / standard750mlBottleOz) * 100) : null;

    return {
      bottlesPerRound,
      bottles,
      rounds,
      ozPerPersonPerBottle,
      totalOzPerPerson,
      percentOfStandardBottle,
    };
  }, [state?.setupBottles, state?.setupBottlesPerRound, state?.setupOzPerPersonPerBottle, state?.totalRounds]);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      if (!gameCode) return;
      try {
        const s = await apiFetch<GameState>(`/api/game/get?gameCode=${encodeURIComponent(gameCode)}`);
        if (!cancelled) setState(s);
        if (!cancelled) setError(null);

        const qs = `gameCode=${encodeURIComponent(gameCode)}${uid ? `&uid=${encodeURIComponent(uid)}` : ''}`;
        if (s.status === 'in_progress') router.push(`/game/round/1?${qs}`);
        if (s.status === 'finished') router.push(`/game/leaderboard?${qs}`);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to load';
        if (message === 'You were removed from the lobby.') {
          try {
            window.localStorage.removeItem(LOCAL_STORAGE_GAME_KEY);
            window.localStorage.removeItem(LOCAL_STORAGE_UID_KEY);
          } catch {
            // ignore
          }
          router.push(`/player/join?gameCode=${encodeURIComponent(gameCode)}`);
          return;
        }
        if (!cancelled) setError(message);
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
                {uid ? (
                  <button
                    type="button"
                    onClick={() => {
                      const code = state?.gameCode ?? gameCode;
                      if (!code) return;
                      setError(null);
                      copyReturnLink(code, uid)
                        .then(() => showCopiedReturn())
                        .catch(() => setError('Failed to copy return link'));
                    }}
                    className={[
                      'ml-2 rounded-[4px] border border-[#2f2f2f] px-2 py-1 text-[11px] font-semibold text-white shadow-[2px_2px_0_rgba(0,0,0,0.35)] transition-colors',
                      copiedReturn ? 'bg-green-700 animate-pulse' : 'bg-[#6f7f6a]',
                    ].join(' ')}
                    title="Private return link (keep secret)"
                  >
                    {copiedReturn ? 'Copied!' : 'Copy Return Link'}
                  </button>
                ) : null}
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
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-[12px] font-semibold truncate">{p.name}</p>
                    {uid && p.uid === uid ? <span className="text-[10px] text-[#3d3d3d]">(Me)</span> : null}
                  </div>
                </div>
              ))}
            </div>
          </WineyCard>

          <WineyCard className="px-6 py-5">
            <div className="rounded-[4px] border border-[#2f2f2f] bg-[#f4f1ea] px-4 py-3">
              <p className="text-center text-[13px] font-semibold">Tasting Details</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-[4px] border border-[#2f2f2f] bg-[#6f7f6a]/20 px-3 py-2 text-center">
                  <p className="text-[10px] text-[#2b2b2b]">Tastings / Round</p>
                  <p className="text-[14px] font-semibold">{tastingConfig.bottlesPerRound} Wines</p>
                </div>
                <div className="rounded-[4px] border border-[#2f2f2f] bg-[#6f7f6a]/20 px-3 py-2 text-center">
                  <p className="text-[10px] text-[#2b2b2b]">Max Pour Per Tasting</p>
                  <p className="text-[14px] font-semibold">
                    {tastingConfig.ozPerPersonPerBottle === null ? '—' : `${tastingConfig.ozPerPersonPerBottle.toFixed(2)} Oz`}
                  </p>
                </div>
              </div>

              <div className="mt-3 space-y-2 text-[10px] leading-relaxed text-[#3d3d3d]">
                <p>
                  In this blind tasting, you’ll sample {tastingConfig.bottlesPerRound} different wines across {tastingConfig.rounds || '—'} rounds –{' '}
                  {tastingConfig.bottles || '—'} wines total. For each wine, pour up to{' '}
                  {tastingConfig.ozPerPersonPerBottle === null ? '—' : tastingConfig.ozPerPersonPerBottle.toFixed(2)} oz. That adds up to{' '}
                  {tastingConfig.totalOzPerPerson === null ? '—' : tastingConfig.totalOzPerPerson.toFixed(2)} oz per person over the full game (roughly{' '}
                  {tastingConfig.percentOfStandardBottle === null ? '—' : tastingConfig.percentOfStandardBottle}% of a standard 750ml bottle).
                </p>
                <p>
                  After each round, write down quick notes on aroma, flavor, and finish. Then, rank the {tastingConfig.bottlesPerRound} wines from most to
                  least expensive based on what you think they’re worth. Once everyone submits their rankings, the game shows the correct price order – without
                  revealing labels or actual prices – and updates the live leaderboard.
                </p>
                <p>
                  You get one point for each wine you rank correctly. The player with the highest total score wins.
                </p>
              </div>
            </div>
          </WineyCard>
        </div>
      </main>
    </WineyShell>
  );
}
