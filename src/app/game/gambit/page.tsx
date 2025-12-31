'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/winey/ConfirmModal';
import { WineyCard } from '@/components/winey/WineyCard';
import { WineyShell } from '@/components/winey/WineyShell';
import { WineyTitle } from '@/components/winey/Typography';
import { apiFetch } from '@/lib/api';
import { useUrlBackedIdentity } from '@/utils/hooks';
import { LOCAL_STORAGE_GAMBIT_DRAFT_KEY } from '@/utils/constants';
import { LeaderboardPanel } from '@/components/game/LeaderboardPanel';
import { ManagePlayersPanel } from '@/components/game/ManagePlayersPanel';
import { useVisiblePoll } from '@/utils/useVisiblePoll';

type GambitWine = { id: string; letter: string; nickname: string; note?: string; roundId?: number | null };
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

type GambitDraft = {
  v: 1;
  gameCode: string;
  uid: string;
  cheapestWineId: string | null;
  mostExpensiveWineId: string | null;
  favoriteWineIds: string[];
  locked: boolean;
  savedAt: number;
};

export default function GambitPage() {
  const router = useRouter();

  const [data, setData] = useState<GambitState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [managePlayersOpen, setManagePlayersOpen] = useState(false);
  const [confirmDoneOpen, setConfirmDoneOpen] = useState(false);
  const [confirmFinalizeOpen, setConfirmFinalizeOpen] = useState(false);
  const redirectedToRevealRef = useRef(false);
  const hydratedDraftRef = useRef(false);

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

  const draftStorageKey = useMemo(() => {
    if (!gameCode || !uid) return null;
    return `${LOCAL_STORAGE_GAMBIT_DRAFT_KEY}:${gameCode}:${uid}`;
  }, [gameCode, uid]);

  const readDraft = useCallback((): GambitDraft | null => {
    if (!draftStorageKey || !gameCode || !uid) return null;
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(draftStorageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') return null;
      const d = parsed as Partial<GambitDraft>;
      if (d.v !== 1) return null;
      if (d.gameCode !== gameCode) return null;
      if (d.uid !== uid) return null;
      return {
        v: 1,
        gameCode,
        uid,
        cheapestWineId: typeof d.cheapestWineId === 'string' ? d.cheapestWineId : null,
        mostExpensiveWineId: typeof d.mostExpensiveWineId === 'string' ? d.mostExpensiveWineId : null,
        favoriteWineIds: Array.isArray(d.favoriteWineIds) ? d.favoriteWineIds.filter((x): x is string => typeof x === 'string') : [],
        locked: !!d.locked,
        savedAt: typeof d.savedAt === 'number' && Number.isFinite(d.savedAt) ? d.savedAt : Date.now(),
      };
    } catch {
      return null;
    }
  }, [draftStorageKey, gameCode, uid]);

  const writeDraft = useCallback(
    (next: Omit<GambitDraft, 'v' | 'gameCode' | 'uid' | 'savedAt'>) => {
      if (!draftStorageKey || !gameCode || !uid) return;
      if (typeof window === 'undefined') return;
      const payload: GambitDraft = { v: 1, gameCode, uid, savedAt: Date.now(), ...next };
      try {
        window.localStorage.setItem(draftStorageKey, JSON.stringify(payload));
      } catch {
        // ignore
      }
    },
    [draftStorageKey, gameCode, uid]
  );

  // Hydrate local draft once (pre-submit picks), so navigating away/back doesn't wipe progress.
  useEffect(() => {
    if (!gameCode || !uid) return;
    if (hydratedDraftRef.current) return;
    if (locked) return;
    const hasAnySelection = !!cheapestWineId || !!mostExpensiveWineId || (favoriteWineIds?.length ?? 0) > 0;
    if (hasAnySelection) return;

    const draft = readDraft();
    hydratedDraftRef.current = true;
    if (draft && !draft.locked) {
      setCheapestWineId(draft.cheapestWineId);
      setMostExpensiveWineId(draft.mostExpensiveWineId);
      setFavoriteWineIds(draft.favoriteWineIds ?? []);
    }
  }, [gameCode, uid, locked, cheapestWineId, mostExpensiveWineId, favoriteWineIds, readDraft]);

  useVisiblePoll(
    async ({ isCancelled }) => {
      if (!gameCode) return;
      try {
        const res = await apiFetch<GambitState>(`/api/gambit/get?gameCode=${encodeURIComponent(gameCode)}`);
        if (isCancelled()) return;
        setData(res);
        setError(null);

        // Once the host closes Gambit, everyone should move to the Reveal page (like round reveals).
        if (!redirectedToRevealRef.current && res.status === 'finished') {
          redirectedToRevealRef.current = true;
          const baseQs = `gameCode=${encodeURIComponent(gameCode)}${uid ? `&uid=${encodeURIComponent(uid)}` : ''}`;
          router.push(`/game/gambit-reveal?${baseQs}`);
          return;
        }

        // Keep locked state consistent with the server.
        setLocked(!!res.mySubmission);

        if (res.mySubmission) {
          setCheapestWineId(res.mySubmission.cheapestWineId);
          setMostExpensiveWineId(res.mySubmission.mostExpensiveWineId);
          setFavoriteWineIds(res.mySubmission.favoriteWineIds ?? []);
          writeDraft({
            cheapestWineId: res.mySubmission.cheapestWineId,
            mostExpensiveWineId: res.mySubmission.mostExpensiveWineId,
            favoriteWineIds: res.mySubmission.favoriteWineIds ?? [],
            locked: true,
          });
        }
      } catch {
        if (!isCancelled()) setError('Failed to load Gambit');
      } finally {
        if (!isCancelled()) setLoading(false);
      }
    },
    [gameCode, uid, router, writeDraft]
  );

  // Persist draft selections so leaving / returning doesn't wipe in-progress picks.
  useEffect(() => {
    if (!gameCode || !uid) return;
    // Don't overwrite a locked/server-backed submission with an empty draft.
    const hasAnySelection = !!cheapestWineId || !!mostExpensiveWineId || (favoriteWineIds?.length ?? 0) > 0;
    if (!hasAnySelection && !locked) return;

    writeDraft({
      cheapestWineId,
      mostExpensiveWineId,
      favoriteWineIds,
      locked,
    });
  }, [gameCode, uid, cheapestWineId, mostExpensiveWineId, favoriteWineIds, locked, writeDraft]);

  const wineById = useMemo(() => new Map((data?.wines ?? []).map((w) => [w.id, w] as const)), [data?.wines]);

  const labelForWineId = useMemo(() => {
    return (wineId: string | null) => {
      if (!wineId) return null;
      const w = wineById.get(wineId);
      if (!w) return null;
      return `${w.nickname || 'Unnamed wine'}`;
    };
  }, [wineById]);

  const labelsForWineIds = useMemo(() => {
    return (wineIds: string[]) => {
      return (wineIds ?? [])
        .map((id) => labelForWineId(id))
        .filter((x): x is string => typeof x === 'string' && x.length > 0);
    };
  }, [labelForWineId]);

  /*
   * NOTE: Keep helpers memoized so hook deps remain stable (no exhaustive-deps warnings).
   */

  const selectedFavorites = useMemo(() => {
    const unique = Array.from(new Set(favoriteWineIds));
    return unique.filter((id) => wineById.has(id));
  }, [favoriteWineIds, wineById]);

  const selectedFavoriteLabels = useMemo(() => labelsForWineIds(selectedFavorites), [selectedFavorites, labelsForWineIds]);
  // Per-player submission status UI removed; we only show the aggregate "Players done" count.

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
    // Apply selections and persist immediately (don't rely on post-render effects).
    const nextCheapest = modalKind === 'cheapest' ? draftSingleWineId : cheapestWineId;
    const nextMostExpensive = modalKind === 'expensive' ? draftSingleWineId : mostExpensiveWineId;
    const nextFavorites = modalKind === 'favorites' ? draftFavoriteIds : favoriteWineIds;

    // Prevent invalid state: cheapest and most expensive cannot be the same wine.
    if (nextCheapest && nextMostExpensive && nextCheapest === nextMostExpensive) {
      setError('Cheapest and most expensive must be different wines.');
      return;
    }

    if (modalKind === 'cheapest') setCheapestWineId(draftSingleWineId);
    if (modalKind === 'expensive') setMostExpensiveWineId(draftSingleWineId);
    if (modalKind === 'favorites') setFavoriteWineIds(draftFavoriteIds);

    writeDraft({
      cheapestWineId: nextCheapest,
      mostExpensiveWineId: nextMostExpensive,
      favoriteWineIds: nextFavorites,
      locked: false,
    });
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

  const canEdit = !locked && !saving && data?.status !== 'finished' && !data?.mySubmission;
  const hasCheapestMostExpensiveConflict = !!cheapestWineId && !!mostExpensiveWineId && cheapestWineId === mostExpensiveWineId;
  const forbiddenSingleId =
    modalKind === 'cheapest' ? mostExpensiveWineId : modalKind === 'expensive' ? cheapestWineId : null;
  const canAdminCloseGambit = !!data?.isHost && !!locked && data?.status !== 'finished';

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
      writeDraft({
        cheapestWineId,
        mostExpensiveWineId,
        favoriteWineIds: selectedFavorites,
        locked: true,
      });
      setData((prev) =>
        prev
          ? {
              ...prev,
              mySubmission: {
                cheapestWineId,
                mostExpensiveWineId,
                favoriteWineIds: selectedFavorites,
                submittedAt: Date.now(),
              },
            }
          : prev
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save Gambit');
    } finally {
      setSaving(false);
    }
  }

  async function onHostCloseGambit() {
    if (!gameCode || !uid) return;
    setSaving(true);
    setError(null);
    try {
      // Require the host to submit first (mirrors "Close Round & Proceed").
      if (!locked) throw new Error('Please submit your Gambit before closing it.');

      await apiFetch<{ ok: true }>(`/api/game/finish`, {
        method: 'POST',
        body: JSON.stringify({ gameCode, uid }),
      });
      // The poll loop will also redirect, but do it immediately for snappier UX.
      if (qs) router.push(`/game/gambit-reveal?${qs}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to close Gambit');
    } finally {
      setSaving(false);
    }
  }

  return (
    <WineyShell maxWidthClassName="max-w-[860px]" hideHeader={true}>
      <main className="winey-main">
        <div className="mx-auto w-full max-w-[560px]">
          <WineyCard className="winey-card-pad">
            <div className="text-center">
              <WineyTitle>Sommelier&apos;s Gambit</WineyTitle>
              {loading ? (
                <p className="mt-2 text-[13px] text-[color:var(--winey-muted)]">Loading…</p>
              ) : (
                <>
                  {data ? (
                    <p className="mt-2 text-[12px] text-[color:var(--winey-muted)]">
                      Players done:{' '}
                      <span className="font-semibold">
                        {data.playersDoneCount ?? data.submissionsCount}/{data.playersTotalCount ?? ' – '}
                      </span>
                    </p>
                  ) : null}
                  {data?.status === 'finished' ? (
                    <p className="mt-2 text-[12px] text-[color:var(--winey-muted)]">Game is finalized. You can still view results.</p>
                  ) : (
                    <p className="mt-2 text-[12px] text-[color:var(--winey-muted)]">
                      Your chance for bonus points: pick the cheapest and most expensive, plus your favorite wine(s) (just for fun).
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Removed per-player "Submissions" panel; "Players done" above is the only status indicator needed. */}

            {error ? <p className="mt-3 text-center text-[13px] text-red-600">{error}</p> : null}

            {locked ? (
              <p className="mt-2 text-center text-[12px] text-[color:var(--winey-muted)]">
                Answers saved. Waiting for host...
              </p>
            ) : null}

            {hasCheapestMostExpensiveConflict ? (
              <p className="mt-2 text-center text-[12px] text-[color:var(--winey-warning)]">
                Cheapest and most expensive can’t be the same wine – pick a different one.
              </p>
            ) : null}

            <div className="mt-5 space-y-3">
              <div
                className={[
                  'rounded-[var(--winey-radius)] border border-[color:var(--winey-border)] p-3 shadow-[var(--winey-shadow-sm)]',
                  cheapestWineId ? 'outline outline-2 outline-[color:var(--winey-accent-outline)] bg-[color:var(--winey-selected)]' : 'bg-white',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold">Cheapest wine (+1 point)</p>
                    <p className="mt-1 text-[12px] text-[color:var(--winey-muted)] truncate">
                      {labelForWineId(cheapestWineId) ?? 'Not selected'}
                    </p>
                  </div>
                  {canEdit ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="neutral"
                      onClick={() => openModal('cheapest')}
                      disabled={!data?.wines?.length}
                    >
                      Select
                    </Button>
                  ) : null}
                </div>
              </div>

              <div
                className={[
                  'rounded-[var(--winey-radius)] border border-[color:var(--winey-border)] p-3 shadow-[var(--winey-shadow-sm)]',
                  mostExpensiveWineId ? 'outline outline-2 outline-[color:var(--winey-accent-outline)] bg-[color:var(--winey-selected)]' : 'bg-white',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold">Most expensive wine (+2 points)</p>
                    <p className="mt-1 text-[12px] text-[color:var(--winey-muted)] truncate">
                      {labelForWineId(mostExpensiveWineId) ?? 'Not selected'}
                    </p>
                  </div>
                  {canEdit ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="neutral"
                      onClick={() => openModal('expensive')}
                      disabled={!data?.wines?.length}
                    >
                      Select
                    </Button>
                  ) : null}
                </div>
              </div>

              <div
                className={[
                  'rounded-[var(--winey-radius)] border border-[color:var(--winey-border)] p-3 shadow-[var(--winey-shadow-sm)]',
                  selectedFavorites.length ? 'outline outline-2 outline-[color:var(--winey-accent-outline)] bg-[color:var(--winey-selected)]' : 'bg-white',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold">Favorite wine(s)</p>
                    <p className="mt-1 text-[12px] text-[color:var(--winey-muted)] break-words whitespace-normal">
                      {selectedFavoriteLabels.length ? selectedFavoriteLabels.join(', ') : 'Pick at least one'}
                    </p>
                  </div>
                  {canEdit ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="neutral"
                      onClick={() => openModal('favorites')}
                      disabled={!data?.wines?.length}
                    >
                      Select
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <Button
                className="w-full"
                onClick={() => setConfirmDoneOpen(true)}
                disabled={!canSubmit || saving || locked || data?.status === 'finished' || !!data?.mySubmission}
              >
                {locked || !!data?.mySubmission ? 'Submitted' : 'Submit'}
              </Button>

              {data?.isHost ? (
                <Button
                  variant="outline"
                  className="w-full bg-black hover:bg-zinc-900 text-white"
                  onClick={() => setConfirmFinalizeOpen(true)}
                  disabled={saving || !canAdminCloseGambit}
                  title={!locked ? 'Submit your Gambit first, then you can close it.' : undefined}
                >
                  (Admin) End Game &amp; Show Results
                </Button>
              ) : null}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setLeaderboardOpen((v) => !v);
                }}
              >
                {leaderboardOpen ? 'Hide Leaderboard' : 'View Leaderboard'}
              </Button>

              {data?.isHost ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setManagePlayersOpen((v) => !v)}
                >
                  {managePlayersOpen ? 'Hide Manage Players' : 'Manage Players'}
                </Button>
              ) : null}
            </div>

            {leaderboardOpen ? (
              <div className="mt-3">
                <LeaderboardPanel gameCode={gameCode} uid={uid} />
              </div>
            ) : null}

            {data?.isHost && managePlayersOpen ? (
              <div className="mt-3">
                <ManagePlayersPanel
                  variant="inline"
                  gameCode={gameCode}
                  uid={uid}
                  onClose={() => setManagePlayersOpen(false)}
                />
              </div>
            ) : null}
          </WineyCard>
        </div>
      </main>

      <ConfirmModal
        open={confirmDoneOpen}
        title="Submit your Gambit?"
        description="This will lock your answers. You won't be able to change them later."
        confirmLabel="Submit"
        confirmVariant="danger"
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
          void onHostCloseGambit();
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
          <div className="w-full max-w-[560px] rounded-[var(--winey-radius)] border border-[color:var(--winey-border)] bg-white shadow-[var(--winey-shadow-lg)]">
            <div className="flex items-center justify-between border-b border-[color:var(--winey-border)] px-5 py-3">
              <div>
                <p className="text-[14px] font-semibold">
                  {modalKind === 'cheapest'
                    ? 'Pick the cheapest wine'
                    : modalKind === 'expensive'
                      ? 'Pick the most expensive wine'
                      : 'Pick your favorite wine(s)'}
                </p>
                <p className="text-[12px] text-[color:var(--winey-muted)]">
                  {modalKind === 'favorites' ? 'Select one or more.' : 'Select exactly one.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="h-7 w-7 rounded-full border border-[color:var(--winey-border)] bg-white text-[14px] leading-none shadow-[var(--winey-shadow-sm)]"
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
                  const disabledSingle = modalKind !== 'favorites' && !!forbiddenSingleId && w.id === forbiddenSingleId;
                  const hasNote = !!(w.note && w.note.trim());
                  return (
                    <label
                      key={w.id}
                      className={[
                        'flex flex-col gap-2 rounded-[var(--winey-radius)] border border-[color:var(--winey-border)] px-3 py-2 shadow-[var(--winey-shadow-sm)]',
                        checked ? 'bg-[color:var(--winey-selected)]' : 'bg-white',
                        disabledSingle ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
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
                            disabled={disabledSingle}
                            onChange={() => {
                              if (disabledSingle) return;
                              setDraftSingleWineId(w.id);
                            }}
                          />
                        )}
                        <p className="text-[12px] leading-none truncate">
                          <span className="font-semibold">{w.nickname || 'Unnamed wine'}</span>
                          {w.roundId ? <span className="text-[color:var(--winey-muted)]"> (from round {w.roundId})</span> : null}
                        </p>
                      </div>
                      {hasNote && (
                        <div className="ml-6 pl-1 border-l-2 border-[color:var(--winey-border)]">
                          <p className="text-[11px] text-[color:var(--winey-muted)] whitespace-pre-wrap break-words">{w.note}</p>
                        </div>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[color:var(--winey-border)] px-5 py-3">
              <p className="text-[12px] text-[color:var(--winey-muted)]">
                {modalKind === 'favorites'
                  ? `Selected: ${draftFavoriteIds.length}`
                  : draftSingleWineId
                    ? 'Selected: 1'
                    : 'Selected: 0'}
              </p>
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="neutral" onClick={closeModal}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={confirmModal}
                  disabled={
                    modalKind === 'favorites'
                      ? draftFavoriteIds.length < 1
                      : !draftSingleWineId || (!!forbiddenSingleId && draftSingleWineId === forbiddenSingleId)
                  }
                >
                  Confirm
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </WineyShell>
  );
}
