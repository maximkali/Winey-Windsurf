'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { WineyCard } from '@/components/winey/WineyCard';
import { WineyShell } from '@/components/winey/WineyShell';
import { apiFetch } from '@/lib/api';
import { shuffle } from '@/lib/winesClient';
import {
  LOCAL_STORAGE_BOTTLES_PER_ROUND_KEY,
  LOCAL_STORAGE_GAME_KEY,
  LOCAL_STORAGE_ROUND_COUNT_KEY,
  LOCAL_STORAGE_UID_KEY,
} from '@/utils/constants';
import type { RoundAssignment, Wine } from '@/types/wine';

type GameState = {
  setupBottlesPerRound?: number | null;
};

export default function OrganizeRoundsPage() {
  const gameCode = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(LOCAL_STORAGE_GAME_KEY);
  }, []);

  const uid = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(LOCAL_STORAGE_UID_KEY);
  }, []);

  const rounds = useMemo(() => {
    if (typeof window === 'undefined') return 5;
    const raw = Number(window.localStorage.getItem(LOCAL_STORAGE_ROUND_COUNT_KEY) ?? '5');
    return Number.isFinite(raw) && raw > 0 ? raw : 5;
  }, []);

  const [bottlesPerRound, setBottlesPerRound] = useState<number>(4);

  const [wines, setWines] = useState<Wine[]>([]);
  const [assignments, setAssignments] = useState<RoundAssignment[]>(Array.from({ length: rounds }, (_, idx) => ({ roundId: idx + 1, wineIds: [] })));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!gameCode) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        let configuredBottlesPerRound = 4;
        if (typeof window !== 'undefined') {
          const raw = Number(window.localStorage.getItem(LOCAL_STORAGE_BOTTLES_PER_ROUND_KEY) ?? '4');
          configuredBottlesPerRound = Number.isFinite(raw) && raw > 0 ? raw : 4;
        }

        try {
          const g = await apiFetch<GameState>(`/api/game/get?gameCode=${encodeURIComponent(gameCode)}`);
          const fromGame = g?.setupBottlesPerRound;
          if (typeof fromGame === 'number' && Number.isFinite(fromGame) && fromGame > 0) {
            configuredBottlesPerRound = fromGame;
            window.localStorage.setItem(LOCAL_STORAGE_BOTTLES_PER_ROUND_KEY, String(fromGame));
          }
        } catch {
          // ignore
        }

        setBottlesPerRound(configuredBottlesPerRound);

        const [wRes, aRes] = await Promise.all([
          apiFetch<{ wines: Wine[] }>(`/api/wines/get?gameCode=${encodeURIComponent(gameCode)}`),
          apiFetch<{ assignments: RoundAssignment[] }>(`/api/assignments/get?gameCode=${encodeURIComponent(gameCode)}`),
        ]);
        if (cancelled) return;

        setWines(wRes.wines);

        const normalized = aRes.assignments.length
          ? aRes.assignments
          : Array.from({ length: rounds }, (_, idx) => ({ roundId: idx + 1, wineIds: [] }));
        setAssignments(normalized);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [gameCode, rounds]);

  const unassigned = useMemo(() => {
    const assigned = new Set(assignments.flatMap((a) => a.wineIds));
    return wines.filter((w) => !assigned.has(w.id));
  }, [assignments, wines]);

  async function setAndPersist(next: RoundAssignment[]) {
    setAssignments(next);
    if (!gameCode || !uid) return;
    try {
      await apiFetch<{ ok: true }>(`/api/assignments/set`, {
        method: 'POST',
        body: JSON.stringify({ gameCode, uid, assignments: next }),
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  }

  function reset() {
    void setAndPersist(Array.from({ length: rounds }, (_, idx) => ({ roundId: idx + 1, wineIds: [] })));
  }

  function autoAssign() {
    const shuffled = shuffle(wines.map((w) => w.id));
    const next: RoundAssignment[] = Array.from({ length: rounds }, (_, idx) => ({ roundId: idx + 1, wineIds: [] }));
    let cursor = 0;
    for (const a of next) {
      const slice = shuffled.slice(cursor, cursor + bottlesPerRound);
      a.wineIds = slice;
      cursor += bottlesPerRound;
    }
    void setAndPersist(next);
  }

  function mixEmUp() {
    const flattened = assignments.flatMap((a) => a.wineIds);
    const shuffled = shuffle(flattened);
    const next = assignments.map((a) => ({ ...a, wineIds: [] as string[] }));
    let cursor = 0;
    for (const a of next) {
      const slice = shuffled.slice(cursor, cursor + bottlesPerRound);
      a.wineIds = slice;
      cursor += bottlesPerRound;
    }
    void setAndPersist(next);
  }

  function removeFromRound(roundId: number, wineId: string) {
    const next = assignments.map((a) =>
      a.roundId === roundId ? { ...a, wineIds: a.wineIds.filter((id) => id !== wineId) } : a
    );
    void setAndPersist(next);
  }

  function addToRound(roundId: number) {
    const nextWine = unassigned[0];
    if (!nextWine) return;
    const next = assignments.map((a) => {
      if (a.roundId !== roundId) return a;
      if (a.wineIds.length >= bottlesPerRound) return a;
      return { ...a, wineIds: [...a.wineIds, nextWine.id] };
    });
    void setAndPersist(next);
  }

  function wineById(id: string) {
    return wines.find((w) => w.id === id);
  }

  function saveAndContinue() {
    window.location.href = '/host/lobby';
  }

  return (
    <WineyShell maxWidthClassName="max-w-[1100px]">
      <main className="pt-6">
        <WineyCard className="px-8 py-6">
          <div className="text-center">
            <h1 className="text-[22px] font-semibold">Organize Wines into Rounds</h1>
            {loading ? <p className="mt-2 text-[12px] text-[#3d3d3d]">Loading…</p> : null}
            {error ? <p className="mt-2 text-[12px] text-red-600">{error}</p> : null}
            <div className="mt-3 flex items-center justify-center gap-3">
              <Button className="px-4 py-2" onClick={autoAssign}>
                Auto-Assign
              </Button>
              <Button variant="outline" className="px-4 py-2" onClick={mixEmUp}>
                Mix &apos;Em Up
              </Button>
              <button
                type="button"
                onClick={reset}
                className="rounded-[4px] border border-[#2f2f2f] bg-white px-4 py-2 text-sm font-semibold shadow-[2px_2px_0_rgba(0,0,0,0.35)]"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {Array.from({ length: rounds }, (_, idx) => idx + 1).map((rid) => {
              const a = assignments.find((x) => x.roundId === rid) ?? { roundId: rid, wineIds: [] };
              const sum = a.wineIds
                .map((id) => wineById(id)?.price ?? 0)
                .reduce((acc, v) => acc + v, 0);
              const avg = a.wineIds.length ? Math.round((sum / a.wineIds.length) * 100) / 100 : 0;
              const filled = a.wineIds.length;

              const active = rid === 1;

              return (
                <div
                  key={rid}
                  className={[
                    'rounded-[6px] border border-[#2f2f2f] bg-[#f1efea] p-3',
                    active ? 'outline outline-2 outline-green-600 bg-[#eaf5e7]' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <p className="font-semibold">Round {rid}</p>
                    <div className="flex items-center gap-3 text-[#2b2b2b]">
                      <span>Sum: ${sum}</span>
                      <span>Avg: ${avg}</span>
                      <span>
                        {filled}/{bottlesPerRound}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {a.wineIds.map((id) => {
                      const w = wineById(id);
                      if (!w) return null;
                      return (
                        <div key={id} className="flex items-center justify-between rounded-[4px] bg-white px-3 py-2 border border-[#2f2f2f]">
                          <div className="flex items-center gap-3">
                            <div className="h-6 w-6 rounded-full border border-[#2f2f2f] bg-[#7a2a1d] text-white flex items-center justify-center text-[11px] font-semibold">
                              {w.letter}
                            </div>
                            <div>
                              <p className="text-[12px] font-semibold leading-none">{w.labelBlinded || 'Label Name'}</p>
                              <p className="text-[10px] text-[#3d3d3d] leading-none">“{w.nickname || 'Nickname'}”</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-[12px] font-semibold">${w.price ?? 0}</p>
                            <button
                              type="button"
                              onClick={() => removeFromRound(rid, id)}
                              className="h-5 w-5 rounded-full border border-[#2f2f2f] bg-white text-[12px] leading-none"
                              aria-label="Remove"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    <div className="pt-2 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => addToRound(rid)}
                        className="rounded-[4px] border border-[#2f2f2f] bg-[#6f7f6a] px-4 py-2 text-sm font-semibold text-white shadow-[2px_2px_0_rgba(0,0,0,0.35)] disabled:opacity-50"
                        disabled={a.wineIds.length >= bottlesPerRound || unassigned.length === 0}
                      >
                        + Add Wines
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8">
            <p className="text-[14px] font-semibold">Unassigned Wines ({unassigned.length})</p>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
              {unassigned.map((w) => (
                <div key={w.id} className="rounded-[6px] border border-[#2f2f2f] bg-white px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-5 rounded-full border border-[#2f2f2f] bg-[#7a2a1d] text-white flex items-center justify-center text-[10px] font-semibold">
                      ×
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold leading-none">{w.labelBlinded || 'Label Name'}</p>
                      <p className="text-[10px] text-[#3d3d3d] leading-none">“{w.nickname || 'Nickname'}”</p>
                    </div>
                  </div>
                  <p className="text-[12px] font-semibold">${w.price ?? 0}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex items-center justify-center">
            <Button className="px-8 py-3" onClick={saveAndContinue}>
              Save &amp; Continue
            </Button>
          </div>
        </WineyCard>
      </main>
    </WineyShell>
  );
}
