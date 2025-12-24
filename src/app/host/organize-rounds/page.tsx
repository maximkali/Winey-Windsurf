'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { WineyCard } from '@/components/winey/WineyCard';
import { WineyShell } from '@/components/winey/WineyShell';
import { WineyTitle } from '@/components/winey/Typography';
import { apiFetch } from '@/lib/api';
import { shuffle } from '@/lib/winesClient';
import { formatMoney, toCents } from '@/lib/money';
import {
  LOCAL_STORAGE_BOTTLES_PER_ROUND_KEY,
  LOCAL_STORAGE_ROUND_COUNT_KEY,
} from '@/utils/constants';
import { useUrlBackedIdentity } from '@/utils/hooks';
import type { RoundAssignment, Wine } from '@/types/wine';

type GameState = {
  setupBottlesPerRound?: number | null;
  totalRounds?: number | null;
};

export default function OrganizeRoundsPage() {
  const { gameCode, uid } = useUrlBackedIdentity();

  const qs = useMemo(() => {
    if (!gameCode) return null;
    return `gameCode=${encodeURIComponent(gameCode)}${uid ? `&uid=${encodeURIComponent(uid)}` : ''}`;
  }, [gameCode, uid]);

  const wineListHref = useMemo(() => {
    if (!qs) return '/host/wine-list';
    return `/host/wine-list?${qs}`;
  }, [qs]);

  function readRoundsFromStorage() {
    if (typeof window === 'undefined') return 5;
    const raw = Number(window.localStorage.getItem(LOCAL_STORAGE_ROUND_COUNT_KEY) ?? '5');
    return Number.isFinite(raw) && raw > 0 ? raw : 5;
  }

  const [rounds, setRounds] = useState<number>(() => readRoundsFromStorage());

  const [bottlesPerRound, setBottlesPerRound] = useState<number>(4);

  const [wines, setWines] = useState<Wine[]>([]);
  const [assignments, setAssignments] = useState<RoundAssignment[]>(
    Array.from({ length: rounds }, (_, idx) => ({ roundId: idx + 1, wineIds: [] }))
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addModalRoundId, setAddModalRoundId] = useState<number | null>(null);
  const [selectedWineIds, setSelectedWineIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!gameCode) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        let configuredRounds = readRoundsFromStorage();
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
          const fromGameRounds = g?.totalRounds;
          if (typeof fromGameRounds === 'number' && Number.isFinite(fromGameRounds) && fromGameRounds > 0) {
            configuredRounds = fromGameRounds;
            window.localStorage.setItem(LOCAL_STORAGE_ROUND_COUNT_KEY, String(fromGameRounds));
          }
        } catch {
          // ignore
        }

        setRounds(configuredRounds);
        setBottlesPerRound(configuredBottlesPerRound);

        const [wRes, aRes] = await Promise.all([
          apiFetch<{ wines: Wine[] }>(`/api/wines/get?gameCode=${encodeURIComponent(gameCode)}`),
          apiFetch<{ assignments: RoundAssignment[] }>(`/api/assignments/get?gameCode=${encodeURIComponent(gameCode)}`),
        ]);
        if (cancelled) return;

        setWines(wRes.wines);

        const normalizedAssignments = Array.from({ length: configuredRounds }, (_, idx) => {
          const roundId = idx + 1;
          return aRes.assignments.find((a) => a.roundId === roundId) ?? { roundId, wineIds: [] as string[] };
        });
        const normalized = normalizedAssignments.length
          ? normalizedAssignments
          : Array.from({ length: configuredRounds }, (_, idx) => ({ roundId: idx + 1, wineIds: [] }));
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
  }, [gameCode]);

  const unassigned = useMemo(() => {
    const assigned = new Set(assignments.flatMap((a) => a.wineIds));
    return wines.filter((w) => !assigned.has(w.id));
  }, [assignments, wines]);

  const completion = useMemo(() => {
    const assignedCount = wines.length - unassigned.length;
    const total = wines.length;
    const allAssigned = unassigned.length === 0;
    const expectedTotal = rounds * bottlesPerRound;
    const shouldEnforceFullRounds = total === expectedTotal;
    const normalizedAssignments = Array.from({ length: rounds }, (_, idx) => {
      const roundId = idx + 1;
      return assignments.find((a) => a.roundId === roundId) ?? { roundId, wineIds: [] as string[] };
    });
    const allRoundsFull = normalizedAssignments.every((a) => a.wineIds.length === bottlesPerRound);
    const canContinue = allAssigned && (!shouldEnforceFullRounds || allRoundsFull);

    let message: string | null = null;
    if (!allAssigned) message = `Assign all wines before continuing (${assignedCount}/${total} assigned).`;
    else if (shouldEnforceFullRounds && !allRoundsFull) message = `Fill every round with ${bottlesPerRound} wines before continuing.`;

    return { canContinue, message };
  }, [assignments, bottlesPerRound, rounds, unassigned.length, wines.length]);

  const unassignedById = useMemo(() => new Map(unassigned.map((w) => [w.id, w] as const)), [unassigned]);
  const wineNumberById = useMemo(() => new Map(wines.map((w, idx) => [w.id, String(idx + 1)] as const)), [wines]);

  function isPositiveIntString(v: string) {
    if (!/^\d+$/.test(v)) return false;
    const n = Number(v);
    return Number.isFinite(n) && n > 0;
  }

  function displayWineNumber(w: Wine) {
    return isPositiveIntString(w.letter) ? w.letter : (wineNumberById.get(w.id) ?? w.letter);
  }

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

  function openAddWinesModal(roundId: number) {
    setAddModalRoundId(roundId);
    setSelectedWineIds([]);
    setAddModalOpen(true);
  }

  function closeAddWinesModal() {
    setAddModalOpen(false);
    setAddModalRoundId(null);
    setSelectedWineIds([]);
  }

  function toggleSelectedWineId(wineId: string, maxToSelect: number) {
    setSelectedWineIds((prev) => {
      const exists = prev.includes(wineId);
      if (exists) return prev.filter((id) => id !== wineId);
      if (prev.length >= maxToSelect) return prev;
      return [...prev, wineId];
    });
  }

  async function confirmAddSelectedWines() {
    if (addModalRoundId == null) return;
    const a = assignments.find((x) => x.roundId === addModalRoundId) ?? { roundId: addModalRoundId, wineIds: [] as string[] };
    const remaining = Math.max(0, bottlesPerRound - a.wineIds.length);
    const toAdd = selectedWineIds
      .filter((id) => unassignedById.has(id))
      .slice(0, remaining);
    if (!toAdd.length) {
      closeAddWinesModal();
      return;
    }

    const next = assignments.map((x) => {
      if (x.roundId !== addModalRoundId) return x;
      return { ...x, wineIds: [...x.wineIds, ...toAdd] };
    });
    await setAndPersist(next);
    closeAddWinesModal();
  }

  function wineById(id: string) {
    return wines.find((w) => w.id === id);
  }

  function centsOrZero(price: unknown): number {
    return toCents(price) ?? 0;
  }

  function saveAndContinue() {
    if (!completion.canContinue) {
      setError(completion.message ?? 'Please assign wines before continuing.');
      return;
    }
    if (!gameCode) {
      window.location.href = '/host/lobby';
      return;
    }
    const qs = `gameCode=${encodeURIComponent(gameCode)}${uid ? `&uid=${encodeURIComponent(uid)}` : ''}`;
    window.location.href = `/host/lobby?${qs}`;
  }

  return (
    <WineyShell maxWidthClassName="max-w-[1100px]">
      <main className="pt-6">
        <WineyCard className="px-8 py-6">
          <div className="text-center">
            <WineyTitle>Organize Wines into Rounds</WineyTitle>
            {loading ? <p className="mt-2 text-[12px] text-[#3d3d3d]">Loading…</p> : null}
            {error ? <p className="mt-2 text-[12px] text-red-600">{error}</p> : null}
            <div className="mt-3 flex items-center justify-center gap-3">
              <Button className="px-3 py-1.5 text-[12px]" onClick={autoAssign}>
                Auto-Assign
              </Button>
              <Button className="px-3 py-1.5 text-[12px]" onClick={mixEmUp}>
                Mix &apos;Em Up
              </Button>
              <button
                type="button"
                onClick={reset}
                className="rounded-[4px] border border-[#2f2f2f] bg-white px-3 py-1.5 text-[12px] font-semibold shadow-[2px_2px_0_rgba(0,0,0,0.35)]"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {Array.from({ length: rounds }, (_, idx) => idx + 1).map((rid) => {
              const a = assignments.find((x) => x.roundId === rid) ?? { roundId: rid, wineIds: [] };
              const sumCents = a.wineIds.map((id) => centsOrZero(wineById(id)?.price)).reduce((acc, v) => acc + v, 0);
              const sum = sumCents / 100;
              const avg = a.wineIds.length ? sumCents / a.wineIds.length / 100 : 0;
              const filled = a.wineIds.length;

              const isFull = filled >= bottlesPerRound;
              const highlight = isFull;

              return (
                <div
                  key={rid}
                  className={[
                    'rounded-[6px] border border-[#2f2f2f] bg-[#f1efea] p-3',
                    highlight ? 'outline outline-2 outline-green-600 bg-[#eaf5e7]' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <p className="font-semibold">Round {rid}</p>
                    <div className="flex items-center gap-3 text-[#2b2b2b]">
                      <span>{`Sum: $${sum.toFixed(2)}`}</span>
                      <span>{`Avg: $${avg.toFixed(2)}`}</span>
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
                              {displayWineNumber(w)}
                            </div>
                            <div>
                              <p className="text-[12px] font-semibold leading-none">{w.labelBlinded || 'Label Name'}</p>
                              <p className="text-[10px] text-[#3d3d3d] leading-none">“{w.nickname || 'Nickname'}”</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-[12px] font-semibold">{formatMoney(w.price)}</p>
                            <button
                              type="button"
                              onClick={() => removeFromRound(rid, id)}
                              className="h-7 w-7 rounded-[4px] border border-[#2f2f2f] bg-[#e9e5dd] text-[14px] leading-none shadow-[2px_2px_0_rgba(0,0,0,0.35)] disabled:opacity-60"
                              aria-label="Remove wine"
                              title="Remove wine"
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
                        onClick={() => openAddWinesModal(rid)}
                        className="rounded-[4px] border border-[#2f2f2f] bg-[#6f7f6a] px-3 py-1.5 text-[12px] font-semibold text-white shadow-[2px_2px_0_rgba(0,0,0,0.35)] disabled:opacity-50"
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
            <p className="w-full text-center text-[14px] font-semibold">Unassigned Wines ({unassigned.length})</p>
            {!completion.canContinue && completion.message ? (
              <p className="mt-2 text-center text-[12px] text-[#3d3d3d]">{completion.message}</p>
            ) : null}
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
              {unassigned.map((w) => (
                <div key={w.id} className="rounded-[6px] border border-[#2f2f2f] bg-white px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-5 rounded-full border border-[#2f2f2f] bg-[#7a2a1d] text-white flex items-center justify-center text-[10px] font-semibold">
                      {displayWineNumber(w)}
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold leading-none">{w.labelBlinded || 'Label Name'}</p>
                      <p className="text-[10px] text-[#3d3d3d] leading-none">“{w.nickname || 'Nickname'}”</p>
                    </div>
                  </div>
                  <p className="text-[12px] font-semibold">{formatMoney(w.price)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex items-center justify-center">
            <div className="w-full max-w-[520px] md:max-w-[420px]">
              <Button className="w-full px-8 py-3" onClick={saveAndContinue} disabled={!completion.canContinue}>
                Save &amp; Continue
              </Button>
              <div className="mt-3 text-center">
                <Link href={wineListHref} className="text-[11px] text-blue-700 underline">
                  Back to Wine List
                </Link>
              </div>
            </div>
          </div>

        </WineyCard>

        {addModalOpen && addModalRoundId != null ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) closeAddWinesModal();
            }}
          >
            <div className="w-full max-w-[560px] rounded-[8px] border border-[#2f2f2f] bg-white shadow-[6px_6px_0_rgba(0,0,0,0.25)]">
              <div className="flex items-center justify-between border-b border-[#2f2f2f] px-5 py-3">
                <div>
                  <p className="text-[14px] font-semibold">Add Wines to Round {addModalRoundId}</p>
                  {(() => {
                    const a = assignments.find((x) => x.roundId === addModalRoundId) ?? { roundId: addModalRoundId, wineIds: [] as string[] };
                    const remaining = Math.max(0, bottlesPerRound - a.wineIds.length);
                    return (
                      <p className="text-[11px] text-[#3d3d3d]">
                        Select up to <span className="font-semibold">{remaining}</span> unassigned wines
                      </p>
                    );
                  })()}
                </div>
                <button
                  type="button"
                  onClick={closeAddWinesModal}
                  className="h-7 w-7 rounded-full border border-[#2f2f2f] bg-white text-[14px] leading-none"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              {(() => {
                const a = assignments.find((x) => x.roundId === addModalRoundId) ?? { roundId: addModalRoundId, wineIds: [] as string[] };
                const remaining = Math.max(0, bottlesPerRound - a.wineIds.length);
                const maxToSelect = Math.min(remaining, unassigned.length);

                return (
                  <>
                    <div className="max-h-[55vh] overflow-auto px-5 py-4">
                      {unassigned.length ? (
                        <div className="space-y-2">
                          {unassigned.map((w) => {
                            const checked = selectedWineIds.includes(w.id);
                            const disabled = !checked && selectedWineIds.length >= maxToSelect;
                            return (
                              <label
                                key={w.id}
                                className={[
                                  'flex items-center justify-between gap-3 rounded-[6px] border border-[#2f2f2f] px-3 py-2',
                                  checked ? 'bg-[#eaf5e7]' : 'bg-white',
                                  disabled ? 'opacity-60' : '',
                                ]
                                  .filter(Boolean)
                                  .join(' ')}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={disabled}
                                    onChange={() => toggleSelectedWineId(w.id, maxToSelect)}
                                  />
                                  <div className="h-6 w-6 rounded-full border border-[#2f2f2f] bg-[#7a2a1d] text-white flex items-center justify-center text-[11px] font-semibold flex-shrink-0">
                                    {displayWineNumber(w)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[12px] font-semibold leading-none truncate">{w.labelBlinded || 'Label Name'}</p>
                                    <p className="text-[10px] text-[#3d3d3d] leading-none truncate">“{w.nickname || 'Nickname'}”</p>
                                  </div>
                                </div>
                                <p className="text-[12px] font-semibold flex-shrink-0">{formatMoney(w.price)}</p>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[12px] text-[#3d3d3d]">No unassigned wines available.</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3 border-t border-[#2f2f2f] px-5 py-3">
                      <p className="text-[11px] text-[#3d3d3d]">
                        Selected: <span className="font-semibold">{selectedWineIds.length}</span>
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={closeAddWinesModal}
                          className="rounded-[4px] border border-[#2f2f2f] bg-white px-3 py-1.5 text-[12px] font-semibold shadow-[2px_2px_0_rgba(0,0,0,0.25)]"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void confirmAddSelectedWines()}
                          disabled={!selectedWineIds.length}
                          className="rounded-[4px] border border-[#2f2f2f] bg-[#6f7f6a] px-3 py-1.5 text-[12px] font-semibold text-white shadow-[2px_2px_0_rgba(0,0,0,0.25)] disabled:opacity-50"
                        >
                          Add Selected
                        </button>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        ) : null}
      </main>
    </WineyShell>
  );
}
