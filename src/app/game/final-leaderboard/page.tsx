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
      letter: string;
      realLabel: string;
      nickname: string;
      price: number | null;
      actualRankText: string;
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
    cheapestPick?: { id: string; nickname: string; realLabel: string; price: number | null } | null;
    cheapestCorrect?: Array<{ id: string; nickname: string; realLabel: string; price: number | null }>;
    mostExpensivePick?: { id: string; nickname: string; realLabel: string; price: number | null } | null;
    mostExpensiveCorrect?: Array<{ id: string; nickname: string; realLabel: string; price: number | null }>;
    favorites?: Array<{ id: string; nickname: string; realLabel: string; price: number | null }>;
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

function miniPill(label: string, value: string) {
  return (
    <span className="inline-flex items-center gap-1 rounded-[999px] border border-[#2f2f2f]/30 bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-[#2b2b2b]">
      <span className="text-[#3d3d3d]">{label}</span>
      <span>{value}</span>
    </span>
  );
}

function ordinal(n: number) {
  const num = Math.max(0, Math.floor(n));
  const mod100 = num % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${num}th`;
  const mod10 = num % 10;
  if (mod10 === 1) return `${num}st`;
  if (mod10 === 2) return `${num}nd`;
  if (mod10 === 3) return `${num}rd`;
  return `${num}th`;
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
                <div
                  key={p.uid}
                  className={[
                    'flex items-center justify-between px-3 py-2 border-b border-[#2f2f2f] last:border-b-0',
                    effectiveUid && p.uid === effectiveUid ? 'bg-[#f6f3ee]' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
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

        <div className="mx-auto mt-6 w-full max-w-[420px]">
          <WineyCard className="px-5 py-5">
            <div className="text-center">
              <WineyTitle className="text-[18px] text-[#b08a3c]">Your Game Recap</WineyTitle>
              {recap ? (
                (() => {
                  const leaderboard = data?.leaderboard ?? [];
                  const myUid = recap.me.uid;
                  const idx = leaderboard.findIndex((p) => p.uid === myUid);
                  const placeText =
                    idx >= 0
                      ? `Finished ${ordinal(idx + 1)} of ${leaderboard.length || '—'}`
                      : 'Final placement unavailable';

                  const earned = recap.me.totalRoundPoints + (recap.gambit?.totalPoints ?? 0);
                  const max = recap.me.totalRoundMaxPoints + (recap.gambit?.maxPoints ?? 0);

                  return (
                    <div className="mt-3 grid grid-cols-2 gap-2 text-left">
                      <div className="rounded-[10px] border border-[#2f2f2f]/30 bg-[#f6f3ee] px-3 py-2">
                        <p className="text-[10px] font-semibold text-[#3d3d3d]">Placement</p>
                        <p className="mt-0.5 text-[12px] font-semibold text-[#2b2b2b]">{placeText}</p>
                      </div>
                      <div className="rounded-[10px] border border-[#2f2f2f]/30 bg-[#f6f3ee] px-3 py-2">
                        <p className="text-[10px] font-semibold text-[#3d3d3d]">Total points</p>
                        <p className="mt-0.5 text-[12px] font-semibold text-[#2b2b2b]">
                          {`${earned}/${max || '—'}`}
                        </p>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <WineySubtitle className="mt-1">
                  {effectiveUid ? 'Loading…' : 'Open this page from your player link to see your recap.'}
                </WineySubtitle>
              )}
            </div>

            {recapError ? <p className="mt-3 text-center text-[12px] text-red-600">{recapError}</p> : null}

            {recap?.gambit ? (
              <div className="mt-4 rounded-[10px] border border-[#2f2f2f]/30 bg-[#f6f3ee] p-3">
                {/*
                 * Gambit uses the same green/red "points pill" as the round recap for visual consistency.
                 * We infer correctness from the (id-based) correct sets when available.
                 */}
                {(() => {
                  const cheapestCorrectIds = new Set((recap.gambit.cheapestCorrect ?? []).map((w) => w.id));
                  const mostExpensiveCorrectIds = new Set((recap.gambit.mostExpensiveCorrect ?? []).map((w) => w.id));
                  const cheapestPickId = recap.gambit.cheapestPick?.id ?? null;
                  const mostExpensivePickId = recap.gambit.mostExpensivePick?.id ?? null;
                  const cheapestIsCorrect = !!cheapestPickId && cheapestCorrectIds.has(cheapestPickId);
                  const mostExpensiveIsCorrect = !!mostExpensivePickId && mostExpensiveCorrectIds.has(mostExpensivePickId);
                  const cheapestPts = cheapestIsCorrect ? 1 : 0;
                  const mostExpensivePts = mostExpensiveIsCorrect ? 2 : 0;

                  return (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-[#2b2b2b]">Sommelier’s Gambit</p>
                    <p className="mt-1 text-[11px] text-[#3d3d3d]">{`You scored ${recap.gambit.totalPoints}/${recap.gambit.maxPoints}`}</p>

                    <div className="mt-3 space-y-3">
                      <div className="rounded-[10px] border border-[#2f2f2f]/30 bg-white px-3 py-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-[12px] font-semibold text-[#2b2b2b]">Cheapest (+1 possible)</p>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {resultPill(cheapestIsCorrect, cheapestPts ? `+${cheapestPts}` : '0')}
                              </div>
                            </div>
                          </div>
                        </div>
                        <p className="mt-1 text-[12px] text-[#2b2b2b] break-words">
                          <span className="font-semibold">Your pick:</span>{' '}
                          {recap.gambit.cheapestPick
                            ? `${recap.gambit.cheapestPick.nickname || '—'} — Real name: ${recap.gambit.cheapestPick.realLabel}${
                                recap.gambit.cheapestPick.price != null ? ` (${formatMoney(recap.gambit.cheapestPick.price)})` : ''
                              }`
                            : recap.gambit.cheapestPickLabel || '—'}
                        </p>
                        <p className="mt-1 text-[11px] text-[#3d3d3d] break-words">
                          <span className="font-semibold text-[#2b2b2b]">Correct:</span>{' '}
                          {recap.gambit.cheapestCorrect?.length
                            ? recap.gambit.cheapestCorrect
                                .map(
                                  (w) =>
                                    `${w.nickname || '—'} — Real name: ${w.realLabel}${w.price != null ? ` (${formatMoney(w.price)})` : ''}`
                                )
                                .join(' / ')
                            : recap.gambit.cheapestCorrectLabels.length
                              ? recap.gambit.cheapestCorrectLabels.join(' / ')
                              : '—'}
                        </p>
                      </div>

                      <div className="rounded-[10px] border border-[#2f2f2f]/30 bg-white px-3 py-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-[12px] font-semibold text-[#2b2b2b]">Most expensive (+2 possible)</p>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {resultPill(mostExpensiveIsCorrect, mostExpensivePts ? `+${mostExpensivePts}` : '0')}
                              </div>
                            </div>
                          </div>
                        </div>
                        <p className="mt-1 text-[12px] text-[#2b2b2b] break-words">
                          <span className="font-semibold">Your pick:</span>{' '}
                          {recap.gambit.mostExpensivePick
                            ? `${recap.gambit.mostExpensivePick.nickname || '—'} — Real name: ${recap.gambit.mostExpensivePick.realLabel}${
                                recap.gambit.mostExpensivePick.price != null
                                  ? ` (${formatMoney(recap.gambit.mostExpensivePick.price)})`
                                  : ''
                              }`
                            : recap.gambit.mostExpensivePickLabel || '—'}
                        </p>
                        <p className="mt-1 text-[11px] text-[#3d3d3d] break-words">
                          <span className="font-semibold text-[#2b2b2b]">Correct:</span>{' '}
                          {recap.gambit.mostExpensiveCorrect?.length
                            ? recap.gambit.mostExpensiveCorrect
                                .map(
                                  (w) =>
                                    `${w.nickname || '—'} — Real name: ${w.realLabel}${w.price != null ? ` (${formatMoney(w.price)})` : ''}`
                                )
                                .join(' / ')
                            : recap.gambit.mostExpensiveCorrectLabels.length
                              ? recap.gambit.mostExpensiveCorrectLabels.join(' / ')
                              : '—'}
                        </p>
                      </div>

                      <div className="rounded-[10px] border border-[#2f2f2f]/30 bg-white px-3 py-2">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-[12px] font-semibold text-[#2b2b2b]">Favorites</p>
                        </div>
                        {recap.gambit.favorites?.length ? (
                          <div className="mt-2 space-y-2">
                            {recap.gambit.favorites.map((w) => (
                              <div
                                key={w.id}
                                className="rounded-[10px] border border-[#2f2f2f]/30 bg-[#fafafa] px-3 py-2"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[12px] font-semibold text-[#2b2b2b] break-words">
                                      {w.nickname || '—'}
                                    </p>
                                    <p className="mt-1 text-[11px] text-[#3d3d3d] break-words">
                                      <span className="font-semibold text-[#2b2b2b]">Real name:</span> {w.realLabel}
                                    </p>
                                  </div>
                                  <p className="text-[11px] font-semibold text-[#2b2b2b] flex-shrink-0">
                                    {w.price != null ? formatMoney(w.price) : '—'}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-1 text-[11px] text-[#3d3d3d] break-words">
                            {recap.gambit.favoriteLabels.length ? recap.gambit.favoriteLabels.join(', ') : '—'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                  );
                })()}
              </div>
            ) : null}

            {recap ? (
              <div className="mt-5 space-y-6">
                {recap.rounds.map((r) => (
                  <div key={r.roundId} className="space-y-3">
                    <div>
                      <p className="text-[13px] font-semibold text-[#2b2b2b]">{`Round ${r.roundId}`}</p>
                      <p className="mt-1 text-[11px] text-[#3d3d3d]">{`You scored ${r.totalPoints}/${r.maxPoints}`}</p>
                      <p className="mt-2 text-[11px] font-semibold text-[#2b2b2b]">Actual order (highest → lowest price)</p>
                    </div>

                    <div className="space-y-3">
                      {r.wines.map((w) => (
                        <div key={w.id} className="rounded-[12px] border border-[#2f2f2f]/30 bg-white px-3 py-3 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                {miniPill('Ranks', w.actualRankText)}
                                <p className="text-[12px] font-semibold text-[#2b2b2b] break-words">{w.nickname || w.realLabel}</p>
                              </div>
                              <p className="mt-1 text-[11px] text-[#3d3d3d] break-words">
                                <span className="font-semibold text-[#2b2b2b]">Real name:</span> {w.realLabel}
                              </p>

                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                {miniPill('Your guess', w.yourRankText)}
                              </div>

                              <p className="mt-2 text-[11px] text-[#2b2b2b] break-words">
                                <span className="font-semibold">Your note:</span>{' '}
                                <span className="text-[#3d3d3d] whitespace-pre-wrap">{w.note ? w.note : '—'}</span>
                              </p>
                            </div>

                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              <p className="text-[12px] font-semibold text-[#2b2b2b]">{formatMoney(w.price)}</p>
                              {resultPill(w.isCorrect, w.isCorrect ? '+1' : '0')}
                            </div>
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


