'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { LOCAL_STORAGE_GAME_KEY, LOCAL_STORAGE_UID_KEY } from '@/utils/constants';
import { WineyCard } from '@/components/winey/WineyCard';
import { WineyShell } from '@/components/winey/WineyShell';
import { WineyTextarea } from '@/components/winey/fields';

type RoundState = {
  gameCode: string;
  roundId: number;
  totalRounds: number;
  gameStatus?: string;
  gameCurrentRound?: number;
  bottlesPerRound: number;
  wineNicknames: string[];
  roundWines?: Array<{ id: string; nickname: string }>;
  state: 'open' | 'closed';
  isHost: boolean;
  submissionsCount: number;
  mySubmission: { uid: string; notes: string; ranking: string[]; submittedAt: number } | null;
};

function placeBadge(pos: number) {
  const num = pos + 1;
  if (num === 1) return '1st';
  if (num === 2) return '2nd';
  if (num === 3) return '3rd';
  return `${num}th`;
}

function reorder<T>(list: T[], fromIdx: number, toIdx: number) {
  const next = [...list];
  const [moved] = next.splice(fromIdx, 1);
  next.splice(toIdx, 0, moved);
  return next;
}

export default function RoundPage() {
  const params = useParams();
  const router = useRouter();

  const roundId = useMemo(() => {
    const raw = params?.id;
    const value = Array.isArray(raw) ? raw[0] : raw;
    const num = Number(value);
    return Number.isFinite(num) ? num : 1;
  }, [params]);

  const [data, setData] = useState<RoundState | null>(null);
  const [notesByWineId, setNotesByWineId] = useState<Record<string, string>>({});
  const [rankedWineIds, setRankedWineIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const appliedSubmissionAtRef = useRef<number | null>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pendingFlipFirstTopsRef = useRef<Record<string, number> | null>(null);

  function captureTops(ids: string[]) {
    const tops: Record<string, number> = {};
    for (const id of ids) {
      const el = itemRefs.current[id];
      if (!el) continue;
      tops[id] = el.getBoundingClientRect().top;
    }
    return tops;
  }

  function moveWine(wineId: string, direction: 'up' | 'down') {
    if (data?.state === 'closed') return;
    
    setRankedWineIds((prev) => {
      const currentIdx = prev.indexOf(wineId);
      if (currentIdx < 0) return prev;
      
      const newIdx = direction === 'up' ? currentIdx - 1 : currentIdx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;

      pendingFlipFirstTopsRef.current = captureTops(prev);
      return reorder(prev, currentIdx, newIdx);
    });
  }

  useLayoutEffect(() => {
    const firstTops = pendingFlipFirstTopsRef.current;
    if (!firstTops) return;
    pendingFlipFirstTopsRef.current = null;

    const ids = rankedWineIds;
    const animations: Array<{ el: HTMLDivElement; cleanupId: number }> = [];

    for (const id of ids) {
      const el = itemRefs.current[id];
      if (!el) continue;
      const firstTop = firstTops[id];
      if (typeof firstTop !== 'number') continue;
      const lastTop = el.getBoundingClientRect().top;
      const delta = firstTop - lastTop;
      if (!Number.isFinite(delta) || delta === 0) continue;

      el.style.transition = 'transform 0s';
      el.style.transform = `translateY(${delta}px)`;

      requestAnimationFrame(() => {
        el.style.transition = 'transform 160ms ease';
        el.style.transform = 'translateY(0px)';
      });

      const cleanupId = window.setTimeout(() => {
        el.style.transition = '';
        el.style.transform = '';
      }, 220);
      animations.push({ el, cleanupId });
    }

    return () => {
      for (const a of animations) window.clearTimeout(a.cleanupId);
    };
  }, [rankedWineIds]);

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

    async function tick() {
      if (!gameCode) return;
      try {
        const s = await apiFetch<RoundState>(
          `/api/round/get?gameCode=${encodeURIComponent(gameCode)}&roundId=${encodeURIComponent(String(roundId))}`
        );
        if (cancelled) return;
        setData(s);
        setError(null);

        if (s.gameStatus === 'finished') {
          router.push('/game/leaderboard');
          return;
        }
        if (typeof s.gameCurrentRound === 'number' && Number.isFinite(s.gameCurrentRound) && s.gameCurrentRound !== roundId) {
          router.push(`/game/round/${s.gameCurrentRound}`);
          return;
        }

        const defaultIds = (s.roundWines ?? []).map((w) => w.id);

        if (s.mySubmission) {
          const shouldApply = appliedSubmissionAtRef.current !== s.mySubmission.submittedAt;
          if (shouldApply) {
            appliedSubmissionAtRef.current = s.mySubmission.submittedAt;

            try {
              const parsed = JSON.parse(s.mySubmission.notes) as unknown;
              if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                const obj = parsed as Record<string, unknown>;
                const nextNotes: Record<string, string> = {};
                for (const [k, v] of Object.entries(obj)) if (typeof v === 'string') nextNotes[k] = v;
                setNotesByWineId(nextNotes);
              } else if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
                const arr = parsed as string[];
                const nextNotes: Record<string, string> = {};
                for (let i = 0; i < arr.length; i += 1) {
                  const wid = defaultIds[i];
                  if (wid) nextNotes[wid] = arr[i] ?? '';
                }
                setNotesByWineId(nextNotes);
              } else {
                setNotesByWineId({});
              }
            } catch {
              setNotesByWineId({});
            }

            const submitted = s.mySubmission.ranking ?? [];
            const submittedValid = submitted.length && defaultIds.length && submitted.every((id) => defaultIds.includes(id));
            setRankedWineIds(submittedValid ? submitted : defaultIds);
          }
        } else {
          if (defaultIds.length) setRankedWineIds((prev) => (prev.length ? prev : defaultIds));
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load round');
      }
    }

    tick();
    const id = window.setInterval(tick, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [gameCode, roundId]);

  async function onSubmit() {
    if (!gameCode || !uid) return;
    setLoading(true);
    setError(null);

    const ranking = rankedWineIds;

    try {
      await apiFetch<{ ok: true }>(`/api/round/submit`, {
        method: 'POST',
        body: JSON.stringify({ gameCode, roundId, uid, notes: JSON.stringify(notesByWineId), ranking }),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit');
    } finally {
      setLoading(false);
    }
  }

  const roundWines = useMemo(() => {
    const base = data?.roundWines ?? [];
    const byId = new Map(base.map((w) => [w.id, w] as const));
    const ids = rankedWineIds.length ? rankedWineIds : base.map((w) => w.id);
    return ids.map((id) => byId.get(id)).filter(Boolean) as Array<{ id: string; nickname: string }>;
  }, [data?.roundWines, rankedWineIds]);

  async function onAdminCloseAndProceed() {
    if (!gameCode || !uid) return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch<{ ok: true }>(`/api/round/close`, {
        method: 'POST',
        body: JSON.stringify({ gameCode, roundId, uid }),
      });

      const res = await apiFetch<{ ok: true; finished: boolean; nextRound: number | null }>(
        `/api/round/advance`,
        {
          method: 'POST',
          body: JSON.stringify({ gameCode, uid }),
        }
      );

      if (res.finished) router.push('/game/leaderboard');
      else if (res.nextRound) router.push(`/game/round/${res.nextRound}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to proceed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <WineyShell maxWidthClassName="max-w-[860px]">
      <main className="pt-6">
        <div className="mx-auto w-full max-w-[420px]">
          <WineyCard className="px-5 py-5">
            <div className="text-center">
              <p className="text-[13px] font-semibold text-[#b08a3c]">
                Round {roundId} / {data?.totalRounds ?? 5}
              </p>
            </div>

            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

            <div className="mt-4 space-y-3">
              {roundWines.map((w, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === roundWines.length - 1;
                const canMoveUp = !isFirst && data?.state !== 'closed';
                const canMoveDown = !isLast && data?.state !== 'closed';

                return (
                  <div
                    key={w.id}
                    ref={(el) => {
                      itemRefs.current[w.id] = el;
                    }}
                    className="rounded-[4px] border border-[#2f2f2f] bg-[#e9e5dd] p-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <p className="text-[11px] font-semibold truncate">{w.nickname || 'Nickname'}</p>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => moveWine(w.id, 'up')}
                          disabled={!canMoveUp}
                          className={[
                            'h-auto py-1 px-2 rounded-[4px] border border-[#2f2f2f] flex items-center justify-center text-[10px] font-semibold shadow-[2px_2px_0_rgba(0,0,0,0.35)] transition-all active:scale-95',
                            canMoveUp
                              ? 'bg-[#6f7f6a] text-white cursor-pointer'
                              : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          aria-label="Move up"
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveWine(w.id, 'down')}
                          disabled={!canMoveDown}
                          className={[
                            'h-auto py-1 px-2 rounded-[4px] border border-[#2f2f2f] flex items-center justify-center text-[10px] font-semibold shadow-[2px_2px_0_rgba(0,0,0,0.35)] transition-all active:scale-95',
                            canMoveDown
                              ? 'bg-[#6f7f6a] text-white cursor-pointer'
                              : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          aria-label="Move down"
                          title="Move down"
                        >
                          ↓
                        </button>
                        <span className="rounded-[4px] border border-[#2f2f2f] bg-white px-2 py-1 text-[10px] font-semibold min-w-[2.5rem] text-center">
                          {placeBadge(idx)}
                        </span>
                      </div>
                    </div>

                    <WineyTextarea
                      value={notesByWineId[w.id] ?? ''}
                      onChange={(e) =>
                        setNotesByWineId((prev) => ({
                          ...prev,
                          [w.id]: e.target.value,
                        }))
                      }
                      className="mt-2 min-h-[72px]"
                      disabled={data?.state === 'closed'}
                    />
                  </div>
                );
              })}
            </div>

            <div className="mt-4">
              {data?.isHost ? (
                <Button className="w-full py-3" onClick={onAdminCloseAndProceed} disabled={loading}>
                  (Admin) Close Round &amp; Proceed
                </Button>
              ) : (
                <Button
                  className="w-full py-3"
                  onClick={onSubmit}
                  disabled={loading || data?.state === 'closed' || !!data?.mySubmission}
                >
                  Done
                </Button>
              )}
            </div>

            <div className="mt-3 text-center">
              <Link href={`/game/leaderboard?from=${encodeURIComponent(`/game/round/${roundId}`)}`} className="text-[11px] text-blue-700 underline">
                View Leaderboard
              </Link>
            </div>
          </WineyCard>
        </div>
      </main>
    </WineyShell>
  );
}

function normalizeNotes(input: string[], length: number) {
  const len = Number.isFinite(length) && length > 0 ? length : 4;
  const out = input.slice(0, len);
  while (out.length < len) out.push('');
  return out;
}
