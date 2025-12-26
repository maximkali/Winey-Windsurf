'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useUrlBackedIdentity } from '@/utils/hooks';
import { WineyCard } from '@/components/winey/WineyCard';
import { WineyShell } from '@/components/winey/WineyShell';
import { WineySubtitle, WineyTitle } from '@/components/winey/Typography';
import { LOCAL_STORAGE_GAME_KEY, LOCAL_STORAGE_UID_KEY } from '@/utils/constants';
import { formatMoney } from '@/lib/money';

type Leaderboard = {
  gameCode: string;
  status: string;
  leaderboard: Array<{ uid: string; name: string; score: number; delta?: number }>;
};

type FinalReveal = {
  gameCode: string;
  status: string;
  me: {
    uid: string;
    name: string;
    totalRoundPoints: number;
    totalRoundMaxPoints: number;
  };
  rounds: Array<{
    roundId: number;
    totalPoints: number;
    maxPoints: number;
    submittedAt: number;
    wines: Array<{
      id: string;
      label: string;
      price: number | null;
      correctRankText: string;
      yourRankText: string;
      isCorrect: boolean;
      note: string;
    }>;
  }>;
  gambit: null | {
    totalPoints: number;
    maxPoints: number;
    cheapestPickLabel: string | null;
    cheapestCorrectLabels: string[];
    mostExpensivePickLabel: string | null;
    mostExpensiveCorrectLabels: string[];
    favoriteLabels: string[];
  };
};

function resultPill(isCorrect: boolean, text?: string) {
  return (
    <div
      className={[
        'flex-shrink-0 rounded-[4px] border border-[#2f2f2f] px-2 py-1 text-[11px] font-semibold text-white shadow-[2px_2px_0_rgba(0,0,0,0.35)]',
        isCorrect ? 'bg-[#6f7f6a]' : 'bg-[#7a2a1d]',
      ].join(' ')}
    >
      {text ?? (isCorrect ? '✓' : '—')}
    </div>
  );
}

export default function FinalLeaderboardPage() {
  const [data, setData] = useState<Leaderboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recap, setRecap] = useState<FinalReveal | null>(null);
  const [recapError, setRecapError] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    async function loadRecap() {
      if (!effectiveGameCode) return;
      if (!effectiveUid) return;
      try {
        const res = await apiFetch<FinalReveal>(`/api/final-reveal/get?gameCode=${encodeURIComponent(effectiveGameCode)}`);
        if (cancelled) return;
        setRecap(res);
        setRecapError(null);
      } catch (e) {
        if (cancelled) return;
        setRecapError(e instanceof Error ? e.message : 'Failed to load recap');
      }
    }
    void loadRecap();
    return () => {
      cancelled = true;
    };
  }, [effectiveGameCode, effectiveUid]);

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

        <div className="mx-auto mt-6 w-full max-w-[860px] px-3">
          <WineyCard className="px-5 py-5">
            <div className="text-center">
              <WineyTitle className="text-[18px] text-[#b08a3c]">Your Game Recap</WineyTitle>
              <WineySubtitle className="mt-1">
                {recap
                  ? `${recap.me.name}: ${recap.me.totalRoundPoints}/${recap.me.totalRoundMaxPoints} round points`
                  : effectiveUid
                    ? 'Loading…'
                    : 'Open this page from your player link to see your recap.'}
              </WineySubtitle>
            </div>

            {recapError ? <p className="mt-3 text-center text-[12px] text-red-600">{recapError}</p> : null}

            {recap?.gambit ? (
              <div className="mt-4 rounded-[4px] border border-[#2f2f2f] bg-[#e9e5dd] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-[#2b2b2b]">Sommelier’s Gambit</p>
                    <p className="mt-1 text-[11px] text-[#3d3d3d]">
                      {`Points: ${recap.gambit.totalPoints}/${recap.gambit.maxPoints}`}
                    </p>

                    <p className="mt-2 text-[12px] text-[#2b2b2b]">
                      <span className="font-semibold">Cheapest pick:</span> {recap.gambit.cheapestPickLabel || '—'}
                    </p>
                    <p className="mt-1 text-[12px] text-[#2b2b2b]">
                      <span className="font-semibold">Correct:</span>{' '}
                      {recap.gambit.cheapestCorrectLabels.length ? recap.gambit.cheapestCorrectLabels.join(' / ') : '—'}
                    </p>

                    <p className="mt-2 text-[12px] text-[#2b2b2b]">
                      <span className="font-semibold">Most expensive pick:</span> {recap.gambit.mostExpensivePickLabel || '—'}
                    </p>
                    <p className="mt-1 text-[12px] text-[#2b2b2b]">
                      <span className="font-semibold">Correct:</span>{' '}
                      {recap.gambit.mostExpensiveCorrectLabels.length ? recap.gambit.mostExpensiveCorrectLabels.join(' / ') : '—'}
                    </p>

                    <p className="mt-2 text-[12px] text-[#2b2b2b]">
                      <span className="font-semibold">Favorites:</span>{' '}
                      {recap.gambit.favoriteLabels.length ? recap.gambit.favoriteLabels.join(', ') : '—'}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {recap ? (
              <div className="mt-4 space-y-4">
                {recap.rounds.map((r) => (
                  <div key={r.roundId} className="rounded-[6px] border border-[#2f2f2f] bg-white">
                    <div className="border-b border-[#2f2f2f] px-4 py-3">
                      <p className="text-[13px] font-semibold text-[#2b2b2b]">{`Round ${r.roundId}`}</p>
                      <p className="mt-1 text-[11px] text-[#3d3d3d]">{`You scored ${r.totalPoints}/${r.maxPoints}`}</p>
                    </div>

                    <div className="divide-y divide-[#2f2f2f]">
                      {r.wines.map((w) => (
                        <div key={w.id} className="px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-[12px] font-semibold text-[#2b2b2b] break-words">{w.label}</p>
                              <p className="mt-1 text-[11px] text-[#3d3d3d]">{formatMoney(w.price)}</p>
                              <p className="mt-2 text-[12px] text-[#2b2b2b]">
                                <span className="font-semibold">Your rank:</span> {w.yourRankText}
                                <span className="mx-2">•</span>
                                <span className="font-semibold">Correct rank:</span> {w.correctRankText}
                              </p>
                              {w.note ? (
                                <p className="mt-2 text-[11px] text-[#3d3d3d] whitespace-pre-wrap break-words">
                                  <span className="font-semibold">Your note:</span> {w.note}
                                </p>
                              ) : (
                                <p className="mt-2 text-[11px] text-[#3d3d3d]">
                                  <span className="font-semibold">Your note:</span> —
                                </p>
                              )}
                            </div>
                            {resultPill(w.isCorrect, w.isCorrect ? '+1' : '0')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </WineyCard>
        </div>
      </main>
    </WineyShell>
  );
}


