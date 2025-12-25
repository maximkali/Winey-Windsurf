'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { useUrlBackedIdentity } from '@/utils/hooks';
import { LOCAL_STORAGE_GAME_KEY, LOCAL_STORAGE_ROUND_DRAFT_KEY, LOCAL_STORAGE_UID_KEY } from '@/utils/constants';
import { WineyCard } from '@/components/winey/WineyCard';
import { WineyShell } from '@/components/winey/WineyShell';
import { WineyTextarea } from '@/components/winey/fields';
import { ConfirmModal } from '@/components/winey/ConfirmModal';
import { WineyTitle } from '@/components/winey/Typography';
import { WineySubtitle } from '@/components/winey/Typography';

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
  playersDoneCount?: number;
  playersTotalCount?: number;
  mySubmission: { uid: string; notes: string; ranking: string[]; submittedAt: number } | null;
  myDraft?: { uid: string; notes: string; ranking: string[]; updatedAt: number } | null;
};

type LocalRoundDraftV1 = {
  v: 1;
  gameCode: string;
  uid: string;
  roundId: number;
  notesByWineId: Record<string, string>;
  rankedWineIds: string[];
  savedAt: number;
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
  const [savingDraft, setSavingDraft] = useState(false);
  const [confirmDoneOpen, setConfirmDoneOpen] = useState(false);
  const [confirmAdminProceedOpen, setConfirmAdminProceedOpen] = useState(false);
  const [locked, setLocked] = useState(false);
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
    if (data?.state === 'closed' || locked) return;

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

  const { gameCode, uid } = useUrlBackedIdentity();

  const localDraftStorageKey = useMemo(() => {
    if (!gameCode || !uid) return null;
    return `${LOCAL_STORAGE_ROUND_DRAFT_KEY}:${gameCode}:${uid}:${roundId}`;
  }, [gameCode, uid, roundId]);

  const readLocalDraft = useMemo(() => {
    return (): LocalRoundDraftV1 | null => {
      if (!localDraftStorageKey || !gameCode || !uid) return null;
      if (typeof window === 'undefined') return null;
      try {
        const raw = window.localStorage.getItem(localDraftStorageKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== 'object') return null;
        const d = parsed as Partial<LocalRoundDraftV1>;
        if (d.v !== 1) return null;
        if (d.gameCode !== gameCode) return null;
        if (d.uid !== uid) return null;
        if (d.roundId !== roundId) return null;
        return {
          v: 1,
          gameCode,
          uid,
          roundId,
          notesByWineId: d.notesByWineId && typeof d.notesByWineId === 'object' ? (d.notesByWineId as Record<string, string>) : {},
          rankedWineIds: Array.isArray(d.rankedWineIds)
            ? d.rankedWineIds.filter((x): x is string => typeof x === 'string')
            : [],
          savedAt: typeof d.savedAt === 'number' && Number.isFinite(d.savedAt) ? d.savedAt : Date.now(),
        };
      } catch {
        return null;
      }
    };
  }, [localDraftStorageKey, gameCode, uid, roundId]);

  const writeLocalDraft = useMemo(() => {
    return (draft: Omit<LocalRoundDraftV1, 'v' | 'gameCode' | 'uid' | 'roundId' | 'savedAt'>) => {
      if (!localDraftStorageKey || !gameCode || !uid) return;
      if (typeof window === 'undefined') return;
      const payload: LocalRoundDraftV1 = { v: 1, gameCode, uid, roundId, savedAt: Date.now(), ...draft };
      try {
        window.localStorage.setItem(localDraftStorageKey, JSON.stringify(payload));
      } catch {
        // ignore
      }
    };
  }, [localDraftStorageKey, gameCode, uid, roundId]);
  // Hydrate local draft once early so page bounces (leaderboard/back) don't lose progress even offline.
  // NOTE: This must be declared AFTER the "reset state on identity change" effect below, otherwise the reset
  // can wipe hydrated state on mount/return (effects run in declaration order).
  const hydratedLocalDraftRef = useRef(false);

  const qs = useMemo(() => {
    if (!gameCode) return null;
    return `gameCode=${encodeURIComponent(gameCode)}${uid ? `&uid=${encodeURIComponent(uid)}` : ''}`;
  }, [gameCode, uid]);

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
        setLocked(!!s.mySubmission);

        // After the host closes the round, everyone should move to the Reveal page.
        // If query-string identity is missing, fall back to localStorage so players don't get stuck.
        if (s.state === 'closed') {
          const fallbackQs = (() => {
            if (qs) return qs;
            if (typeof window === 'undefined') return null;
            try {
              const storedGameCode = (window.localStorage.getItem(LOCAL_STORAGE_GAME_KEY) ?? '').trim().toUpperCase();
              const storedUid = (window.localStorage.getItem(LOCAL_STORAGE_UID_KEY) ?? '').trim();
              const g = storedGameCode || gameCode;
              const u = storedUid || uid || '';
              if (!g) return null;
              return `gameCode=${encodeURIComponent(g)}${u ? `&uid=${encodeURIComponent(u)}` : ''}`;
            } catch {
              return null;
            }
          })();
          if (fallbackQs) router.push(`/game/reveal/${roundId}?${fallbackQs}`);
          return;
        }
        // Important: the host may "close & proceed" immediately, which can advance the game status
        // to Gambit/Finished before non-host clients poll. Always show the round's Reveal first.
        if (s.gameStatus === 'gambit') {
          if (qs) router.push(`/game/gambit?${qs}`);
          return;
        }
        if (s.gameStatus === 'finished') {
          if (qs) router.push(`/game/final-leaderboard?${qs}`);
          return;
        }
        if (typeof s.gameCurrentRound === 'number' && Number.isFinite(s.gameCurrentRound) && s.gameCurrentRound !== roundId) {
          if (qs) router.push(`/game/round/${s.gameCurrentRound}?${qs}`);
          return;
        }

        const defaultIds = (s.roundWines ?? []).map((w) => w.id);

        // IMPORTANT: Never overwrite in-progress typing from polling.
        // Polling is only for redirects / counts. We only populate local state when:
        // - the player has a real submission (locked), or
        // - the page has no local ranking yet and we need an initial default order.
        if (s.mySubmission) {
          setNotesByWineId(parseNotesToMap(s.mySubmission.notes ?? '', defaultIds));
          const submitted = s.mySubmission.ranking ?? [];
          const submittedValid = submitted.length && defaultIds.length && submitted.every((id) => defaultIds.includes(id));
          setRankedWineIds(submittedValid ? submitted : defaultIds);
        } else if (defaultIds.length) {
          setRankedWineIds((prev) => (prev.length ? prev : defaultIds));
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
  }, [gameCode, roundId, qs, router, uid]);

  useEffect(() => {
    setLocked(false);
    setConfirmDoneOpen(false);
    setConfirmAdminProceedOpen(false);
    setData(null);
    setError(null);
    setNotesByWineId({});
    setRankedWineIds([]);
    hydratedLocalDraftRef.current = false;
  }, [gameCode, uid, roundId]);

  useEffect(() => {
    if (!gameCode || !uid) return;
    if (hydratedLocalDraftRef.current) return;
    if (locked) return;
    const hasAnyLocalState = Object.keys(notesByWineId).length > 0 || rankedWineIds.length > 0;
    if (hasAnyLocalState) return;
    const d = readLocalDraft();
    hydratedLocalDraftRef.current = true;
    if (!d) return;
    if (d.rankedWineIds.length) setRankedWineIds(d.rankedWineIds);
    if (d.notesByWineId && typeof d.notesByWineId === 'object') setNotesByWineId(d.notesByWineId);
  }, [gameCode, uid, locked, notesByWineId, rankedWineIds, readLocalDraft]);

  const isRoundDataReady = !!data && data.roundId === roundId;

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
      setLocked(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit');
    } finally {
      setLoading(false);
    }
  }

  async function onViewLeaderboard() {
    const href = qs
      ? `/game/leaderboard?${qs}&from=${encodeURIComponent(`/game/round/${roundId}?${qs}`)}`
      : `/game/leaderboard?from=${encodeURIComponent(`/game/round/${roundId}`)}`;

    // Best-effort: soft-save draft before leaving the page.
    // (Does not lock answers; only preserves progress.)
    if (canEdit && gameCode && uid && data?.roundWines?.length) {
      try {
        setSavingDraft(true);
        const fallbackRanking = data.roundWines.map((w) => w.id);
        const ranking = rankedWineIds.length ? rankedWineIds : fallbackRanking;
        await apiFetch<{ ok: true }>(`/api/round/draft/upsert`, {
          method: 'POST',
          body: JSON.stringify({ gameCode, roundId, uid, notes: JSON.stringify(notesByWineId), ranking }),
        });
      } catch {
        // ignore; navigation still works
      } finally {
        setSavingDraft(false);
      }
    }

    router.push(href);
  }

  const roundWines = useMemo(() => {
    const base = data?.roundWines ?? [];
    const byId = new Map(base.map((w) => [w.id, w] as const));
    const ids = rankedWineIds.length ? rankedWineIds : base.map((w) => w.id);
    return ids.map((id) => byId.get(id)).filter(Boolean) as Array<{ id: string; nickname: string }>;
  }, [data?.roundWines, rankedWineIds]);

  // Hosts should be able to play too. Hosting only adds extra controls.
  const canEdit = data?.state === 'open' && !locked;

  function parseNotesToMap(raw: string, defaultIds: string[]) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const obj = parsed as Record<string, unknown>;
        const nextNotes: Record<string, string> = {};
        for (const [k, v] of Object.entries(obj)) if (typeof v === 'string') nextNotes[k] = v;
        return nextNotes;
      }
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
        const arr = parsed as string[];
        const nextNotes: Record<string, string> = {};
        for (let i = 0; i < arr.length; i += 1) {
          const wid = defaultIds[i];
          if (wid) nextNotes[wid] = arr[i] ?? '';
        }
        return nextNotes;
      }
    } catch {
      // ignore
    }
    return {};
  }

  // Soft-save drafts while editing (debounced) so "View Leaderboard" / refresh doesn't lose progress.
  useEffect(() => {
    if (!canEdit) return;
    if (!gameCode || !uid) return;
    if (!data?.roundWines?.length) return;

    const fallbackRanking = data.roundWines.map((w) => w.id);
    const ranking = rankedWineIds.length ? rankedWineIds : fallbackRanking;
    if (!ranking.length) return;

    const notes = JSON.stringify(notesByWineId);

    const t = window.setTimeout(() => {
      void apiFetch<{ ok: true }>(`/api/round/draft/upsert`, {
        method: 'POST',
        body: JSON.stringify({ gameCode, roundId, uid, notes, ranking }),
      }).catch(() => {
        // ignore: best-effort persistence
      });
    }, 250);

    return () => window.clearTimeout(t);
  }, [canEdit, data?.roundWines, gameCode, notesByWineId, rankedWineIds, roundId, uid]);

  // Mirror draft to localStorage on every change (fast, offline-safe).
  useEffect(() => {
    if (!gameCode || !uid) return;
    if (locked) return;
    writeLocalDraft({ notesByWineId, rankedWineIds });
  }, [gameCode, uid, roundId, locked, notesByWineId, rankedWineIds, writeLocalDraft]);

  // Best-effort: flush draft when navigating away / backgrounding.
  const draftFlushRef = useRef<{ gameCode: string; uid: string; roundId: number; notes: string; ranking: string[] } | null>(null);
  useEffect(() => {
    if (!canEdit) return;
    if (!gameCode || !uid) return;
    if (!data?.roundWines?.length) return;
    const fallbackRanking = data.roundWines.map((w) => w.id);
    const ranking = rankedWineIds.length ? rankedWineIds : fallbackRanking;
    draftFlushRef.current = { gameCode, uid, roundId, notes: JSON.stringify(notesByWineId), ranking };
  }, [canEdit, data?.roundWines, gameCode, uid, roundId, notesByWineId, rankedWineIds]);

  useEffect(() => {
    function flush() {
      const p = draftFlushRef.current;
      if (!p) return;
      const body = JSON.stringify({ gameCode: p.gameCode, roundId: p.roundId, uid: p.uid, notes: p.notes, ranking: p.ranking });
      try {
        if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
          navigator.sendBeacon('/api/round/draft/upsert', new Blob([body], { type: 'application/json' }));
          return;
        }
      } catch {
        // fall through
      }
      try {
        void fetch('/api/round/draft/upsert', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
          keepalive: true,
        });
      } catch {
        // ignore
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') flush();
    }

    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  async function saveDraftNow() {
    if (!canEdit) return;
    if (!gameCode || !uid) return;
    if (!data?.roundWines?.length) return;
    const fallbackRanking = data.roundWines.map((w) => w.id);
    const ranking = rankedWineIds.length ? rankedWineIds : fallbackRanking;
    if (!ranking.length) return;
    try {
      await apiFetch<{ ok: true }>(`/api/round/draft/upsert`, {
        method: 'POST',
        body: JSON.stringify({ gameCode, roundId, uid, notes: JSON.stringify(notesByWineId), ranking }),
      });
    } catch {
      // ignore
    }
  }

  async function onAdminCloseAndProceed() {
    if (!gameCode || !uid) return;
    setLoading(true);
    setError(null);
    try {
      // If the host hasn't submitted yet, submit their ranking/notes first so
      // "Close & Proceed" fully supersedes "Done".
      if (data?.state === 'open' && !locked) {
        const fallbackRanking = (data?.roundWines ?? []).map((w) => w.id);
        const ranking = rankedWineIds.length ? rankedWineIds : fallbackRanking;

        await apiFetch<{ ok: true }>(`/api/round/submit`, {
          method: 'POST',
          body: JSON.stringify({
            gameCode,
            roundId,
            uid,
            notes: JSON.stringify(notesByWineId),
            ranking,
          }),
        });
        setLocked(true);
      }

      await apiFetch<{ ok: true }>(`/api/round/close`, {
        method: 'POST',
        body: JSON.stringify({ gameCode, roundId, uid }),
      });
      // Advance immediately so the Leaderboard "Back to Game" goes to the next Round (or Gambit),
      // while everyone still gets routed to Reveal for the round that just closed.
      await apiFetch<{ ok: true; finished: boolean; nextRound: number | null }>(`/api/round/advance`, {
        method: 'POST',
        body: JSON.stringify({ gameCode, uid }),
      });
      const fallbackQs = (() => {
        if (qs) return qs;
        if (typeof window === 'undefined') return null;
        try {
          const storedGameCode = (window.localStorage.getItem(LOCAL_STORAGE_GAME_KEY) ?? '').trim().toUpperCase();
          const storedUid = (window.localStorage.getItem(LOCAL_STORAGE_UID_KEY) ?? '').trim();
          const g = storedGameCode || gameCode;
          const u = storedUid || uid || '';
          if (!g) return null;
          return `gameCode=${encodeURIComponent(g)}${u ? `&uid=${encodeURIComponent(u)}` : ''}`;
        } catch {
          return null;
        }
      })();
      if (!fallbackQs) return;
      router.push(`/game/reveal/${roundId}?${fallbackQs}`);
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
              <WineyTitle className="text-[18px] text-[#b08a3c]">
                {`Round ${roundId}${isRoundDataReady ? ` of ${data.totalRounds}` : ''}`}
              </WineyTitle>
              {!isRoundDataReady ? <WineySubtitle className="mt-1">Loading...</WineySubtitle> : null}
            </div>

            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

            {data ? (
              <p className="mt-2 text-center text-[12px] text-[#3d3d3d]">
                Players done:{' '}
                <span className="font-semibold">
                  {data.playersDoneCount ?? data.submissionsCount}/{data.playersTotalCount ?? ' – '}
                </span>
              </p>
            ) : null}

            {locked ? (
              <p className="mt-2 text-center text-[12px] text-[#3d3d3d]">
                Submitted. Your answers are locked.
              </p>
            ) : null}

            <div className="mt-4 space-y-3">
              {roundWines.map((w, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === roundWines.length - 1;
                const canMoveUp = !isFirst && canEdit;
                const canMoveDown = !isLast && canEdit;

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
                      onChange={(e) => {
                        setNotesByWineId((prev) => ({
                          ...prev,
                          [w.id]: e.target.value,
                        }));
                      }}
                      onBlur={() => void saveDraftNow()}
                      className="mt-2 min-h-[72px]"
                      disabled={!canEdit}
                    />
                  </div>
                );
              })}
            </div>

            <div className="mt-4">
              <div className="space-y-2">
                {data && isRoundDataReady && data.isHost ? (
                  <Button
                    className="w-full py-3"
                    onClick={() => setConfirmDoneOpen(true)}
                    disabled={loading || data?.state === 'closed' || locked || !!data?.mySubmission}
                  >
                    Save
                  </Button>
                ) : null}

                {data && isRoundDataReady && !data.isHost ? (
                  <Button
                    className="w-full py-3"
                    onClick={() => setConfirmDoneOpen(true)}
                    disabled={loading || data?.state === 'closed' || locked || !!data?.mySubmission}
                  >
                    Done
                  </Button>
                ) : null}

                {data?.isHost ? (
                  <Button
                    className="w-full py-3"
                    onClick={() => setConfirmAdminProceedOpen(true)}
                    disabled={loading}
                    title={!locked ? 'Tip: submit your ranking first, then close & proceed.' : undefined}
                  >
                    (Admin) Close Round &amp; Proceed
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="mt-3 text-center">
              <Button
                variant="outline"
                className="w-full py-3"
                onClick={() => void onViewLeaderboard()}
                disabled={savingDraft}
              >
                View Leaderboard
              </Button>
              {data?.isHost ? (
                <div className="mt-2">
                  <Link
                    href={
                      qs
                        ? `/game/manage-players?${qs}&from=${encodeURIComponent(`/game/round/${roundId}?${qs}`)}`
                        : `/game/manage-players?from=${encodeURIComponent(`/game/round/${roundId}`)}`
                    }
                    className="text-[11px] text-blue-700 underline"
                  >
                    Manage Players
                  </Link>
                </div>
              ) : null}
            </div>
          </WineyCard>
        </div>
      </main>

      <ConfirmModal
        open={confirmDoneOpen}
        title={data?.isHost ? 'Save your ranking?' : 'Submit your ranking?'}
        description="Once you submit, you won’t be able to change your order or notes for this round."
        confirmLabel={data?.isHost ? 'Save' : 'Done'}
        confirmDisabled={!canEdit}
        loading={loading}
        onCancel={() => setConfirmDoneOpen(false)}
        onConfirm={() => {
          setConfirmDoneOpen(false);
          void onSubmit();
        }}
      />

      <ConfirmModal
        open={confirmAdminProceedOpen}
        title="Close the round and continue?"
        description="This locks everyone’s rankings and notes for this round and advances the game. This can’t be undone."
        confirmLabel="Close & Proceed"
        confirmVariant="danger"
        loading={loading}
        onCancel={() => setConfirmAdminProceedOpen(false)}
        onConfirm={() => {
          setConfirmAdminProceedOpen(false);
          void onAdminCloseAndProceed();
        }}
      />
    </WineyShell>
  );
}

