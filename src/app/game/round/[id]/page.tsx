'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { useUrlBackedIdentity } from '@/utils/hooks';
import { LOCAL_STORAGE_GAME_KEY, LOCAL_STORAGE_ROUND_COUNT_KEY, LOCAL_STORAGE_ROUND_DRAFT_KEY, LOCAL_STORAGE_UID_KEY } from '@/utils/constants';
import { useVisiblePoll } from '@/utils/useVisiblePoll';
import { WineyCard } from '@/components/winey/WineyCard';
import { WineyShell } from '@/components/winey/WineyShell';
import { WineyTextarea } from '@/components/winey/fields';
import { ConfirmModal } from '@/components/winey/ConfirmModal';
import { WineyTitle } from '@/components/winey/Typography';
import { LeaderboardPanel } from '@/components/game/LeaderboardPanel';
import { ManagePlayersPanel } from '@/components/game/ManagePlayersPanel';

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

  const totalRounds = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = window.localStorage.getItem(LOCAL_STORAGE_ROUND_COUNT_KEY);
      const num = Number(stored);
      return Number.isFinite(num) && num > 0 ? num : null;
    } catch {
      return null;
    }
  }, []);

  const [data, setData] = useState<RoundState | null>(null);
  const [notesByWineId, setNotesByWineId] = useState<Record<string, string>>({});
  const [rankedWineIds, setRankedWineIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [managePlayersOpen, setManagePlayersOpen] = useState(false);
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

  useVisiblePoll(
    async ({ isCancelled }) => {
      if (!gameCode) return;
      try {
        const s = await apiFetch<RoundState>(
          `/api/round/get?gameCode=${encodeURIComponent(gameCode)}&roundId=${encodeURIComponent(String(roundId))}`
        );
        if (isCancelled()) return;
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
        // to Gambit/Finished before non-host clients poll. Always show the latest round's Reveal first.
        if (s.gameStatus === 'gambit') {
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

          const finalRound =
            typeof s.totalRounds === 'number' && Number.isFinite(s.totalRounds) && s.totalRounds > 0 ? s.totalRounds : roundId;
          if (fallbackQs) router.push(`/game/reveal/${finalRound}?${fallbackQs}`);
          return;
        }
        if (s.gameStatus === 'finished') {
          if (qs) router.push(`/game/final-leaderboard?${qs}`);
          return;
        }
        if (typeof s.gameCurrentRound === 'number' && Number.isFinite(s.gameCurrentRound) && s.gameCurrentRound !== roundId) {
          const current = s.gameCurrentRound;
          const latestClosed = current > 1 ? current - 1 : 0;
          // Catch-up behavior: if the game has moved on, bring everyone to the latest closed round reveal
          // rather than leaving them on stale rounds.
          if (latestClosed >= 1 && roundId < latestClosed) {
            if (qs) router.push(`/game/reveal/${latestClosed}?${qs}`);
            return;
          }
          if (qs) router.push(`/game/round/${current}?${qs}`);
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
        if (!isCancelled()) setError(e instanceof Error ? e.message : 'Failed to load round');
      }
    },
    [gameCode, roundId, qs, router, uid]
  );

  useEffect(() => {
    setLocked(false);
    setConfirmDoneOpen(false);
    setConfirmAdminProceedOpen(false);
    setLeaderboardOpen(false);
    setManagePlayersOpen(false);
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

  const roundWines = useMemo(() => {
    const base = data?.roundWines ?? [];
    const byId = new Map(base.map((w) => [w.id, w] as const));
    const ids = rankedWineIds.length ? rankedWineIds : base.map((w) => w.id);
    return ids.map((id) => byId.get(id)).filter(Boolean) as Array<{ id: string; nickname: string }>;
  }, [data?.roundWines, rankedWineIds]);

  // Hosts should be able to play too. Hosting only adds extra controls.
  const canEdit = data?.state === 'open' && !locked;
  const canAdminCloseAndProceed = !!data?.isHost && !!locked && data?.state !== 'closed';

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

  // Mirror draft to localStorage on every change (fast, offline-safe).
  useEffect(() => {
    if (!gameCode || !uid) return;
    if (locked) return;
    writeLocalDraft({ notesByWineId, rankedWineIds });
  }, [gameCode, uid, roundId, locked, notesByWineId, rankedWineIds, writeLocalDraft]);

  async function onAdminCloseAndProceed() {
    if (!gameCode || !uid) return;
    setLoading(true);
    setError(null);
    try {
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
    <WineyShell maxWidthClassName="max-w-[860px]" hideHeader={true}>
      <main className="winey-main">
        <div className="mx-auto w-full max-w-[560px]">
          <WineyCard className="winey-card-pad">
            <div className="text-center">
              <WineyTitle>Round {roundId}{totalRounds ? ` of ${totalRounds}` : isRoundDataReady ? ` of ${data.totalRounds}` : ''}</WineyTitle>
              {!isRoundDataReady ? (
                <p className="mt-2 text-[13px] text-[color:var(--winey-muted)]">Loading…</p>
              ) : null}
            </div>

            {error ? <p className="mt-2 text-center text-[13px] text-red-600">{error}</p> : null}

            {data ? (
              <p className="mt-2 text-center text-[12px] text-[color:var(--winey-muted)]">
                Players done:{' '}
                <span className="font-semibold">
                  {data.playersDoneCount ?? data.submissionsCount}/{data.playersTotalCount ?? ' – '}
                </span>
              </p>
            ) : null}

            {locked ? (
              <p className="mt-2 text-center text-[12px] text-[color:var(--winey-muted)]">
                Answers saved. Waiting for host...
              </p>
            ) : null}

            <div className="mt-5 space-y-3">
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
                    className="rounded-[var(--winey-radius)] border border-[color:var(--winey-border)] bg-[color:var(--winey-card-tan)] p-3 shadow-[var(--winey-shadow-sm)]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <p className="text-[14px] font-semibold truncate">{w.nickname || 'Nickname'}</p>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => moveWine(w.id, 'up')}
                          disabled={!canMoveUp}
                          className={[
                            'h-auto py-1 px-2 rounded-[var(--winey-radius-sm)] border border-[color:var(--winey-border-strong)] flex items-center justify-center text-[12px] font-semibold shadow-[var(--winey-shadow-sm)] transition-all active:scale-95',
                            canMoveUp
                              ? 'bg-[color:var(--winey-title)] text-white cursor-pointer'
                              : 'bg-[color:var(--winey-disabled-bg)] text-[color:var(--winey-disabled-text)] cursor-not-allowed opacity-50',
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
                            'h-auto py-1 px-2 rounded-[var(--winey-radius-sm)] border border-[color:var(--winey-border-strong)] flex items-center justify-center text-[12px] font-semibold shadow-[var(--winey-shadow-sm)] transition-all active:scale-95',
                            canMoveDown
                              ? 'bg-[color:var(--winey-title)] text-white cursor-pointer'
                              : 'bg-[color:var(--winey-disabled-bg)] text-[color:var(--winey-disabled-text)] cursor-not-allowed opacity-50',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          aria-label="Move down"
                          title="Move down"
                        >
                          ↓
                        </button>
                        <span className="rounded-[999px] border border-[color:var(--winey-border)] bg-white px-2 py-1 text-[12px] font-semibold min-w-[2.75rem] text-center shadow-[var(--winey-shadow-sm)]">
                          {placeBadge(idx)}
                        </span>
                      </div>
                    </div>

                    <WineyTextarea
                      value={notesByWineId[w.id] ?? ''}
                      onChange={(e) => {
                        const textarea = e.target;
                        // Auto-resize textarea
                        textarea.style.height = 'auto';
                        textarea.style.height = `${textarea.scrollHeight}px`;
                        
                        setNotesByWineId((prev) => ({
                          ...prev,
                          [w.id]: e.target.value,
                        }));
                      }}
                      onFocus={(e) => {
                        // Size on focus in case content was pre-loaded
                        const textarea = e.currentTarget;
                        textarea.style.height = 'auto';
                        textarea.style.height = `${textarea.scrollHeight}px`;
                      }}
                      className="mt-2 min-h-[72px] resize-none overflow-hidden"
                      disabled={!canEdit}
                    />
                  </div>
                );
              })}
            </div>

            <div className="mt-5 space-y-2">
              {data && isRoundDataReady ? (
                <Button
                  className="w-full"
                  onClick={() => setConfirmDoneOpen(true)}
                  disabled={loading || data?.state === 'closed' || locked || !!data?.mySubmission}
                >
                  {locked || !!data?.mySubmission ? 'Submitted' : 'Submit'}
                </Button>
              ) : null}

              {data?.isHost ? (
                <Button
                  className="w-full"
                  onClick={() => setConfirmAdminProceedOpen(true)}
                  disabled={loading || !canAdminCloseAndProceed}
                  title={!locked ? 'Submit your answers first, then you can close the round.' : undefined}
                >
                  (Admin) Close Round &amp; Proceed
                </Button>
              ) : null}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setLeaderboardOpen((v) => !v)}
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
                <LeaderboardPanel
                  gameCode={gameCode}
                  uid={uid}
                />
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
        title="Submit your ranking?"
        description="Once you submit, you won't be able to change your order or notes for this round."
        confirmLabel="Submit"
        confirmVariant="danger"
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
        description="This closes the round and advances the game. Players who haven’t clicked Submit will NOT be auto-saved."
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

