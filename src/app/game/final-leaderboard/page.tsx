'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useUrlBackedIdentity } from '@/utils/hooks';
import { WineyCard } from '@/components/winey/WineyCard';
import { WineyShell } from '@/components/winey/WineyShell';
import { WineySectionHeading, WineyTitle } from '@/components/winey/Typography';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/money';

type Leaderboard = {
  gameCode: string;
  status: string;
  leaderboard: Array<{ uid: string; name: string; score: number; delta?: number }>;
};

type FinalRevealExport = {
  gameCode: string;
  status: string;
  isHost: boolean;
  generatedAt: number;
  totalRounds: number;
  bottlesPerRound: number;
  players: Array<{ uid: string; name: string; joinedAt: number }>;
  wines: Array<{ id: string; letter: string; labelBlinded: string; nickname: string; price: number | null }>;
  rounds: Array<{
    roundId: number;
    wines: Array<{
      position: number | null;
      wineId: string;
      letter: string;
      labelBlinded: string;
      nickname: string;
      price: number | null;
    }>;
    submissions: Array<{
      uid: string;
      name: string;
      submittedAt: number;
      totalPoints: number;
      maxPoints: number;
      notesByWineId: Record<string, string>;
      rows: Array<{
        position: number;
        submittedWineId: string | null;
        submittedLabel: string;
        correctWineIds: string[];
        correctLabels: string[];
        isTie: boolean;
        point: number;
        note: string;
      }>;
    }>;
  }>;
  gambit: {
    correct: {
      cheapestIds: string[];
      cheapestLabels: string[];
      mostExpensiveIds: string[];
      mostExpensiveLabels: string[];
      cheapestIsTie: boolean;
      mostExpensiveIsTie: boolean;
    };
    submissions: Array<{
      uid: string;
      name: string;
      submittedAt: number;
      totalPoints: number;
      cheapest: { pickId: string | null; pickLabel: string | null; points: number };
      mostExpensive: { pickId: string | null; pickLabel: string | null; points: number };
      favorites: { ids: string[]; labels: string[] };
    }>;
  };
};

function placeBadge(pos: number) {
  const num = pos + 1;
  if (num === 1) return '1st';
  if (num === 2) return '2nd';
  if (num === 3) return '3rd';
  return `${num}th`;
}

export default function FinalLeaderboardPage() {
  const [data, setData] = useState<Leaderboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finalReveal, setFinalReveal] = useState<FinalRevealExport | null>(null);
  const [finalRevealError, setFinalRevealError] = useState<string | null>(null);
  const [finalRevealLoading, setFinalRevealLoading] = useState(false);

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

  useEffect(() => {
    let cancelled = false;

    async function loadFinalReveal() {
      if (!gameCode) return;
      setFinalRevealLoading(true);
      try {
        const res = await apiFetch<FinalRevealExport>(`/api/final-reveal/get?gameCode=${encodeURIComponent(gameCode)}`);
        if (cancelled) return;
        setFinalReveal(res);
        setFinalRevealError(null);
      } catch (e) {
        if (cancelled) return;
        setFinalRevealError(e instanceof Error ? e.message : 'Failed to load final reveal export');
      } finally {
        if (!cancelled) setFinalRevealLoading(false);
      }
    }

    // Only fetch once the game is finished (this page should enforce that, but avoid extra calls).
    if (data?.status === 'finished') loadFinalReveal();

    return () => {
      cancelled = true;
    };
  }, [data?.status, gameCode]);

  // If someone lands here before the game is actually finalized, keep them on the regular leaderboard.
  useEffect(() => {
    if (!gameCode) return;
    if (!data) return;
    if (data.status === 'finished') return;
    const qs = `gameCode=${encodeURIComponent(gameCode)}${uid ? `&uid=${encodeURIComponent(uid)}` : ''}`;
    window.location.assign(`/game/leaderboard?${qs}`);
  }, [data, gameCode, uid]);

  async function onCopyJson() {
    if (!finalReveal) return;
    const text = JSON.stringify(finalReveal, null, 2);
    await navigator.clipboard.writeText(text);
  }

  function onDownloadJson() {
    if (!finalReveal) return;
    const text = JSON.stringify(finalReveal, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `winey-${finalReveal.gameCode}-final-reveal.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <WineyShell maxWidthClassName="max-w-[980px]">
      <main className="pt-6 space-y-6">
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

        <div className="mx-auto w-full max-w-[980px]">
          <WineyCard className="px-5 py-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <WineySectionHeading>Full Game Reveal (Export)</WineySectionHeading>
                <p className="mt-1 text-[12px] text-[#3d3d3d]">
                  All rounds, all wine details, all player notes, and a per-position points breakdown.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="h-9" onClick={() => void onCopyJson()} disabled={!finalReveal}>
                  Copy JSON
                </Button>
                <Button className="h-9" onClick={onDownloadJson} disabled={!finalReveal}>
                  Download JSON
                </Button>
              </div>
            </div>

            {finalRevealError ? <p className="mt-3 text-[12px] text-red-600">{finalRevealError}</p> : null}
            {finalRevealLoading && !finalReveal ? (
              <p className="mt-3 text-[12px] text-[#3d3d3d]">Loading full reveal…</p>
            ) : null}

            {finalReveal ? (
              <div className="mt-4 space-y-4">
                {finalReveal.rounds.map((round) => (
                  <details key={round.roundId} className="rounded-[6px] border border-[#2f2f2f] bg-white">
                    <summary className="cursor-pointer select-none px-3 py-2 text-[12px] font-semibold">
                      Round {round.roundId} — {round.wines.length || 0} wines — Submissions: {round.submissions.length || 0}
                    </summary>

                    <div className="px-3 pb-3 pt-1 space-y-3">
                      <div className="rounded-[4px] border border-[#2f2f2f] bg-[#e9e5dd] p-3">
                        <p className="text-[12px] font-semibold text-[#2b2b2b]">Wines (revealed)</p>
                        <div className="mt-2 overflow-x-auto">
                          <table className="w-full text-left text-[12px]">
                            <thead>
                              <tr className="border-b border-[#2f2f2f]">
                                <th className="py-1 pr-3">Slot</th>
                                <th className="py-1 pr-3">Letter</th>
                                <th className="py-1 pr-3">Label</th>
                                <th className="py-1 pr-3">Nickname</th>
                                <th className="py-1 pr-0">Price</th>
                              </tr>
                            </thead>
                            <tbody>
                              {round.wines.map((w) => (
                                <tr key={w.wineId} className="border-b border-[#2f2f2f] last:border-b-0">
                                  <td className="py-1 pr-3">{typeof w.position === 'number' ? placeBadge(w.position - 1) : '—'}</td>
                                  <td className="py-1 pr-3">{w.letter || '—'}</td>
                                  <td className="py-1 pr-3 break-words">{w.labelBlinded || '—'}</td>
                                  <td className="py-1 pr-3 break-words">{w.nickname || '—'}</td>
                                  <td className="py-1 pr-0">{formatMoney(w.price)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="rounded-[4px] border border-[#2f2f2f] bg-[#e9e5dd] p-3">
                        <p className="text-[12px] font-semibold text-[#2b2b2b]">Scoring + notes (all players)</p>
                        <div className="mt-2 space-y-3">
                          {round.submissions.map((s) => (
                            <details key={s.uid} className="rounded-[4px] border border-[#2f2f2f] bg-white">
                              <summary className="cursor-pointer select-none px-3 py-2 text-[12px] font-semibold">
                                {s.name} — {s.totalPoints}/{s.maxPoints}
                              </summary>
                              <div className="px-3 pb-3 pt-1 space-y-2">
                                {s.rows.map((r) => (
                                  <div key={r.position} className="rounded-[4px] border border-[#2f2f2f] bg-[#e9e5dd] p-2">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0 flex-1">
                                        <p className="text-[11px] font-semibold text-[#2b2b2b]">{placeBadge(r.position)}</p>
                                        <p className="mt-1 text-[12px] text-[#2b2b2b] break-words">
                                          <span className="font-semibold">Pick:</span> {r.submittedLabel || '—'}
                                        </p>
                                        <p className="mt-1 text-[12px] text-[#2b2b2b] break-words">
                                          <span className="font-semibold">Correct:</span>{' '}
                                          {r.isTie ? `(${(r.correctLabels ?? []).join(' / ') || '—'})` : (r.correctLabels ?? []).join(' / ') || '—'}
                                        </p>
                                        {r.note ? (
                                          <p className="mt-1 text-[11px] text-[#3d3d3d] break-words">
                                            <span className="font-semibold">Note:</span> {r.note}
                                          </p>
                                        ) : null}
                                      </div>
                                      <div
                                        className={[
                                          'flex-shrink-0 rounded-[4px] border border-[#2f2f2f] px-2 py-1 text-[11px] font-semibold text-white shadow-[2px_2px_0_rgba(0,0,0,0.35)]',
                                          r.point === 1 ? 'bg-[#6f7f6a]' : 'bg-[#7a2a1d]',
                                        ].join(' ')}
                                      >
                                        {r.point === 1 ? '+1' : '0'}
                                      </div>
                                    </div>
                                  </div>
                                ))}

                                <details className="rounded-[4px] border border-[#2f2f2f] bg-white">
                                  <summary className="cursor-pointer select-none px-3 py-2 text-[12px] font-semibold">
                                    All notes (raw map)
                                  </summary>
                                  <pre className="px-3 pb-3 pt-1 overflow-x-auto text-[11px] text-[#2b2b2b] whitespace-pre">
                                    {JSON.stringify(s.notesByWineId ?? {}, null, 2)}
                                  </pre>
                                </details>
                              </div>
                            </details>
                          ))}
                        </div>
                      </div>
                    </div>
                  </details>
                ))}

                <details className="rounded-[6px] border border-[#2f2f2f] bg-white">
                  <summary className="cursor-pointer select-none px-3 py-2 text-[12px] font-semibold">
                    Sommelier’s Gambit — Submissions: {finalReveal.gambit.submissions.length || 0}
                  </summary>
                  <div className="px-3 pb-3 pt-1 space-y-3">
                    <div className="rounded-[4px] border border-[#2f2f2f] bg-[#e9e5dd] p-3">
                      <p className="text-[12px] font-semibold text-[#2b2b2b]">Correct answers</p>
                      <p className="mt-1 text-[12px] text-[#2b2b2b] break-words">
                        <span className="font-semibold">Cheapest:</span>{' '}
                        {finalReveal.gambit.correct.cheapestIsTie
                          ? `(${finalReveal.gambit.correct.cheapestLabels.join(' / ') || '—'})`
                          : finalReveal.gambit.correct.cheapestLabels.join(' / ') || '—'}
                      </p>
                      <p className="mt-1 text-[12px] text-[#2b2b2b] break-words">
                        <span className="font-semibold">Most expensive:</span>{' '}
                        {finalReveal.gambit.correct.mostExpensiveIsTie
                          ? `(${finalReveal.gambit.correct.mostExpensiveLabels.join(' / ') || '—'})`
                          : finalReveal.gambit.correct.mostExpensiveLabels.join(' / ') || '—'}
                      </p>
                    </div>

                    <div className="rounded-[4px] border border-[#2f2f2f] bg-[#e9e5dd] p-3">
                      <p className="text-[12px] font-semibold text-[#2b2b2b]">All submissions</p>
                      <div className="mt-2 space-y-2">
                        {finalReveal.gambit.submissions.map((g) => (
                          <div key={g.uid} className="rounded-[4px] border border-[#2f2f2f] bg-white p-3">
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-[12px] font-semibold text-[#2b2b2b]">{g.name}</p>
                              <div className="rounded-[4px] border border-[#2f2f2f] bg-black px-2 py-1 text-[11px] font-semibold text-white">
                                +{g.totalPoints}
                              </div>
                            </div>
                            <p className="mt-2 text-[12px] text-[#2b2b2b] break-words">
                              <span className="font-semibold">Cheapest (+1):</span> {g.cheapest.pickLabel || '—'}{' '}
                              <span className="text-[#3d3d3d]">({g.cheapest.points ? '+1' : '0'})</span>
                            </p>
                            <p className="mt-1 text-[12px] text-[#2b2b2b] break-words">
                              <span className="font-semibold">Most expensive (+2):</span> {g.mostExpensive.pickLabel || '—'}{' '}
                              <span className="text-[#3d3d3d]">({g.mostExpensive.points ? '+2' : '0'})</span>
                            </p>
                            <p className="mt-1 text-[12px] text-[#2b2b2b] break-words">
                              <span className="font-semibold">Favorites:</span> {g.favorites.labels?.length ? g.favorites.labels.join(', ') : '—'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            ) : null}
          </WineyCard>
        </div>
      </main>
    </WineyShell>
  );
}


