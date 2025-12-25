'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/winey/ConfirmModal';
import { WineyCard } from '@/components/winey/WineyCard';
import { WineyShell } from '@/components/winey/WineyShell';
import { WineyTitle } from '@/components/winey/Typography';
import { apiFetch } from '@/lib/api';
import { useUrlBackedIdentity } from '@/utils/hooks';

type GambitWine = { id: string; letter: string; nickname: string };
type GambitState = {
  gameCode: string;
  status: string;
  isHost: boolean;
  submissionsCount?: number;
  playersDoneCount?: number;
  playersTotalCount?: number;
  wines: GambitWine[];
  mySubmission: {
    cheapestWineId: string | null;
    mostExpensiveWineId: string | null;
    favoriteWineIds: string[];
    submittedAt: number;
  } | null;
};

type ModalKind = 'cheapest' | 'expensive' | 'favorites';

export default function GambitPage() {
  const router = useRouter();

  const [data, setData] = useState<GambitState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);
  const [confirmDoneOpen, setConfirmDoneOpen] = useState(false);
  const [confirmFinalizeOpen, setConfirmFinalizeOpen] = useState(false);
  const redirectedToLeaderboardRef = useRef(false);

  const [cheapestWineId, setCheapestWineId] = useState<string | null>(null);
  const [mostExpensiveWineId, setMostExpensiveWineId] = useState<string | null>(null);
  const [favoriteWineIds, setFavoriteWineIds] = useState<string[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalKind, setModalKind] = useState<ModalKind>('cheapest');
  const [draftSingleWineId, setDraftSingleWineId] = useState<string | null>(null);
  const [draftFavoriteIds, setDraftFavoriteIds] = useState<string[]>([]);

  const { gameCode, uid } = useUrlBackedIdentity();

  const qs = useMemo(() => {
    if (!gameCode) return null;
    return `gameCode=${encodeURIComponent(gameCode)}${uid ? `&uid=${encodeURIComponent(uid)}` : ''}`;
  }, [gameCode, uid]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!gameCode) return;
      try {
        const res = await apiFetch<GambitState>(`/api/gambit/get?gameCode=${encodeURIComponent(gameCode)}`);
        if (cancelled) return;
        setData(res);
        setError(null);

        // If the host finalized the game while we're on this page, send everyone to results.
        if (!redirectedToLeaderboardRef.current && res.status === 'finished') {
          redirectedToLeaderboardRef.current = true;
          const baseQs = `gameCode=${encodeURIComponent(gameCode)}${uid ? `&uid=${encodeURIComponent(uid)}` : ''}`;
          router.push(`/game/final-leaderboard?${baseQs}`);
          return;
        }

        if (res.mySubmission) {
          setCheapestWineId(res.mySubmission.cheapestWineId);
          setMostExpensiveWineId(res.mySubmission.mostExpensiveWineId);
          setFavoriteWineIds(res.mySubmission.favoriteWineIds ?? []);
          setLocked(true);
        }
      } catch {
        if (cancelled) return;
        setError('Failed to load Gambit');
      }
      if (!cancelled) setLoading(false);
    }

    load();
    const id = window.setInterval(load, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [gameCode, uid, router]);

  const wineById = useMemo(() => new Map((data?.wines ?? []).map((w) => [w.id, w] as const)), [data?.wines]);

  function labelForWineId(wineId: string | null) {
    if (!wineId) return null;
    const w = wineById.get(wineId);
    if (!w) return null;
    return `${w.letter}. ${w.nickname || 'Unnamed wine'}`;
  }

  function labelsForWineIds(wineIds: string[]) {
    return (wineIds ?? [])
      .map((id) => labelForWineId(id))
      .filter((x): x is string => typeof x === 'string' && x.length > 0);
  }

  const selectedFavorites = useMemo(() => {
    const unique = Array.from(new Set(favoriteWineIds));
    return unique.filter((id) => wineById.has(id));
  }, [favoriteWineIds, wineById]);

  const selectedFavoriteLabels = useMemo(() => labelsForWineIds(selectedFavorites), [selectedFavorites, wineById]);

  function openModal(kind: ModalKind) {
    setModalKind(kind);
    if (kind === 'cheapest') {
      setDraftSingleWineId(cheapestWineId);
    } else if (kind === 'expensive') {
      setDraftSingleWineId(mostExpensiveWineId);
    } else {
      setDraftFavoriteIds(selectedFavorites);
    }
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setDraftSingleWineId(null);
    setDraftFavoriteIds([]);
  }

  function confirmModal() {
    if (modalKind === 'cheapest') setCheapestWineId(draftSingleWineId);
    if (modalKind === 'expensive') setMostExpensiveWineId(draftSingleWineId);
    if (modalKind === 'favorites') setFavoriteWineIds(draftFavoriteIds);
    closeModal();
  }

  function toggleFavorite(id: string) {
    setDraftFavoriteIds((prev) => {
      const exists = prev.includes(id);
      if (exists) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  }

  const canSubmit =
    !!gameCode &&
    !!uid &&
    !!cheapestWineId &&
    !!mostExpensiveWineId &&
    cheapestWineId !== mostExpensiveWineId &&
    selectedFavorites.length >= 1;

  async function onSubmit() {
    if (!gameCode || !uid) return;
    if (!canSubmit) {
      setError('Pick cheapest, most expensive, and at least one favorite.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await apiFetch<{ ok: true }>(`/api/gambit/submit`, {
        method: 'POST',
        body: JSON.stringify({
          gameCode,
          uid,
          cheapestWineId,
          mostExpensiveWineId,
          favoriteWineIds: selectedFavorites,
        }),
      });
      setLocked(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save Gambit');
    } finally {
      setSaving(false);
    }
  }

  async function onHostFinalizeGame() {
    if (!gameCode || !uid) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch<{ ok: true }>(`/api/game/finish`, {
        method: 'POST',
        body: JSON.stringify({ gameCode, uid }),
      });
      if (qs) router.push(`/game/leaderboard?${qs}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to finalize game');
    } finally {
      setSaving(false);
    }
  }

  return (
    <WineyShell maxWidthClassName="max-w-[860px]">
      <main className="pt-6">
        <div className="mx-auto w-full max-w-[420px]">
          <WineyCard className="px-5 py-5">
            <div className="text-center">
              <WineyTitle className="text-[18px] text-[#b08a3c]">Sommelier&apos;s Gambit</WineyTitle>
              {loading ? <p className="mt-2 text-[12px] text-[#3d3d3d]">Loading…</p> : null}
              {data?.status === 'finished' ? (
                <p className="mt-2 text-[11px] text-[#3d3d3d]">Game is finalized. You can still view results.</p>
              ) : (
                <p className="mt-2 text-[11px] text-[#3d3d3d]">
                  Three quick picks: cheapest, most expensive, and your favorite(s).
                </p>
              )}
            </div>

            {data ? (
              <p className="mt-2 text-center text-[12px] text-[#3d3d3d]">
                Players done:{' '}
                <span className="font-semibold">
                  {data.playersDoneCount ?? data.submissionsCount}/{data.playersTotalCount ?? ' – '}
                </span>
              </p>
            ) : null}

            {error ? <p className="mt-3 text-center text-[12px] text-red-600">{error}</p> : null}

            {locked ? (
              <p className="mt-2 text-center text-[12px] text-[#3d3d3d]">
                Saved. Your Gambit picks are locked.
              </p>
            ) : null}

            <div className="mt-4 space-y-3">
              <div className="rounded-[6px] border border-[#2f2f2f] bg-[#f1efea] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold">Cheapest wine (+1 point)</p>
                    <p className="mt-1 text-[11px] text-[#3d3d3d] truncate">
                      {labelForWineId(cheapestWineId) ?? 'Not selected'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openModal('cheapest')}
                    className="rounded-[4px] border border-[#2f2f2f] bg-white px-3 py-1.5 text-[12px] font-semibold shadow-[2px_2px_0_rgba(0,0,0,0.25)]"
                    disabled={!data?.wines?.length || locked || data?.status === 'finished'}
                  >
                    Select
                  </button>
                </div>
              </div>

              <div className="rounded-[6px] border border-[#2f2f2f] bg-[#f1efea] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold">Most expensive wine (+2 points)</p>
                    <p className="mt-1 text-[11px] text-[#3d3d3d] truncate">
                      {labelForWineId(mostExpensiveWineId) ?? 'Not selected'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openModal('expensive')}
                    className="rounded-[4px] border border-[#2f2f2f] bg-white px-3 py-1.5 text-[12px] font-semibold shadow-[2px_2px_0_rgba(0,0,0,0.25)]"
                    disabled={!data?.wines?.length || locked || data?.status === 'finished'}
                  >
                    Select
                  </button>
                </div>
              </div>

              <div className="rounded-[6px] border border-[#2f2f2f] bg-[#f1efea] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold">Favorite wine(s)</p>
                    <p className="mt-1 text-[11px] text-[#3d3d3d] break-words whitespace-normal">
                      {selectedFavoriteLabels.length ? selectedFavoriteLabels.join(', ') : 'Pick at least one'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openModal('favorites')}
                    className="rounded-[4px] border border-[#2f2f2f] bg-white px-3 py-1.5 text-[12px] font-semibold shadow-[2px_2px_0_rgba(0,0,0,0.25)]"
                    disabled={!data?.wines?.length || locked || data?.status === 'finished'}
                  >
                    Select
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {data?.isHost ? (
                <Button
                  className="w-full py-3"
                  onClick={() => setConfirmDoneOpen(true)}
                  disabled={!canSubmit || saving || locked || data?.status === 'finished' || !!data?.mySubmission}
                >
                  Save
                </Button>
              ) : (
                <Button
                  className="w-full py-3"
                  onClick={() => setConfirmDoneOpen(true)}
                  disabled={!canSubmit || saving || locked || data?.status === 'finished' || !!data?.mySubmission}
                >
                  Done
                </Button>
              )}

              {data?.isHost ? (
                <Button
                  variant="outline"
                  className="w-full py-3 bg-[#b08a3c] hover:bg-[#9a7533] text-white"
                  onClick={() => setConfirmFinalizeOpen(true)}
                  disabled={saving || data?.status === 'finished'}
                >
                  (Admin) Finalize Game
                </Button>
              ) : null}
            </div>

            <div className="mt-3 text-center">
              {data?.isHost ? (
                <Link
                  href={
                    qs ? `/game/manage-players?${qs}&from=${encodeURIComponent(`/game/gambit?${qs}`)}` : `/game/manage-players?from=${encodeURIComponent('/game/gambit')}`
                  }
                  className="text-[11px] text-blue-700 underline"
                >
                  Manage Players
                </Link>
              ) : null}
              {data?.isHost ? <div className="mt-2" /> : null}
              <Link
                href={
                  qs ? `/game/leaderboard?${qs}` : '/game/leaderboard'
                }
                className="text-[11px] text-blue-700 underline"
              >
                View Leaderboard
              </Link>
            </div>
          </WineyCard>
        </div>
      </main>

      <ConfirmModal
        open={confirmDoneOpen}
        title={data?.isHost ? 'Save your Gambit?' : 'Submit your Gambit?'}
        description="This will lock your answers. You won’t be able to change them later."
        confirmLabel={data?.isHost ? 'Save' : 'Done'}
        onCancel={() => setConfirmDoneOpen(false)}
        loading={saving}
        onConfirm={() => {
          setConfirmDoneOpen(false);
          void onSubmit();
        }}
      />

      <ConfirmModal
        open={confirmFinalizeOpen}
        title="Finalize the game?"
        description="This finalizes the game and locks results. This can’t be undone."
        confirmLabel="Finalize Game"
        confirmVariant="danger"
        loading={saving}
        onCancel={() => setConfirmFinalizeOpen(false)}
        onConfirm={() => {
          setConfirmFinalizeOpen(false);
          void onHostFinalizeGame();
        }}
      />

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="w-full max-w-[560px] rounded-[8px] border border-[#2f2f2f] bg-white shadow-[6px_6px_0_rgba(0,0,0,0.25)]">
            <div className="flex items-center justify-between border-b border-[#2f2f2f] px-5 py-3">
              <div>
                <p className="text-[14px] font-semibold">
                  {modalKind === 'cheapest'
                    ? 'Pick the cheapest wine'
                    : modalKind === 'expensive'
                      ? 'Pick the most expensive wine'
                      : 'Pick your favorite wine(s)'}
                </p>
                <p className="text-[11px] text-[#3d3d3d]">
                  {modalKind === 'favorites' ? 'Select one or more.' : 'Select exactly one.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="h-7 w-7 rounded-full border border-[#2f2f2f] bg-white text-[14px] leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="max-h-[55vh] overflow-auto px-5 py-4">
              <div className="space-y-2">
                {(data?.wines ?? []).map((w) => {
                  const checked =
                    modalKind === 'favorites' ? draftFavoriteIds.includes(w.id) : draftSingleWineId === w.id;
                  return (
                    <label
                      key={w.id}
                      className={[
                        'flex items-center justify-between gap-3 rounded-[6px] border border-[#2f2f2f] px-3 py-2',
                        checked ? 'bg-[#eaf5e7]' : 'bg-white',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {modalKind === 'favorites' ? (
                          <input type="checkbox" checked={checked} onChange={() => toggleFavorite(w.id)} />
                        ) : (
                          <input
                            type="radio"
                            name="gambit-single"
                            checked={checked}
                            onChange={() => setDraftSingleWineId(w.id)}
                          />
                        )}
                        <div className="h-6 w-6 rounded-full border border-[#2f2f2f] bg-[#7a2a1d] text-white flex items-center justify-center text-[11px] font-semibold flex-shrink-0">
                          {w.letter}
                        </div>
                        <p className="text-[12px] font-semibold leading-none truncate">{w.nickname || 'Unnamed wine'}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[#2f2f2f] px-5 py-3">
              <p className="text-[11px] text-[#3d3d3d]">
                {modalKind === 'favorites'
                  ? `Selected: ${draftFavoriteIds.length}`
                  : draftSingleWineId
                    ? 'Selected: 1'
                    : 'Selected: 0'}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-[4px] border border-[#2f2f2f] bg-white px-3 py-1.5 text-[12px] font-semibold shadow-[2px_2px_0_rgba(0,0,0,0.25)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmModal}
                  disabled={modalKind === 'favorites' ? draftFavoriteIds.length < 1 : !draftSingleWineId}
                  className="rounded-[4px] border border-[#2f2f2f] bg-[#6f7f6a] px-3 py-1.5 text-[12px] font-semibold text-white shadow-[2px_2px_0_rgba(0,0,0,0.25)] disabled:opacity-50"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </WineyShell>
  );
}
