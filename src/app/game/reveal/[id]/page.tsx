'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useUrlBackedIdentity } from '@/utils/hooks';
import { WineyCard } from '@/components/winey/WineyCard';
import { WineyShell } from '@/components/winey/WineyShell';
import { WineyTitle } from '@/components/winey/Typography';
import { Button } from '@/components/ui/button';
import { LOCAL_STORAGE_GAME_KEY, LOCAL_STORAGE_ROUND_COUNT_KEY, LOCAL_STORAGE_UID_KEY } from '@/utils/constants';
import { useVisiblePoll } from '@/utils/useVisiblePoll';

type RevealRow = {
  position: number;
  submittedWineId: string | null;
  submittedNickname: string;
  correctWineIds: string[];
  correctNicknames: string[];
  isTie: boolean;
  point: number;
  note: string;
};

type RevealState = {
  gameCode: string;
  roundId: number;
  totalRounds: number;
  gameStatus: string;
  gameCurrentRound: number;
  isHost: boolean;
  bottlesPerRound: number;
  totalPoints: number;
  maxPoints: number;
  hasTies: boolean;
  submittedAt: number;
  rows: RevealRow[];
};

function placeBadge(pos: number) {
  const num = pos + 1;
  if (num === 1) return '1st';
  if (num === 2) return '2nd';
  if (num === 3) return '3rd';
  return `${num}th`;
}

export default function RevealPage() {
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

  const { gameCode, uid } = useUrlBackedIdentity();

  const [data, setData] = useState<RevealState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const hasLoadedOnceRef = useRef(false);

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

  const continueHref = useMemo(() => {
    const g = effectiveGameCode || (data?.gameCode ?? '').trim().toUpperCase();
    if (!g) return '/game/leaderboard';
    const u = effectiveUid;
    const recoveredQs = `gameCode=${encodeURIComponent(g)}${u ? `&uid=${encodeURIComponent(u)}` : ''}`;
    return `/game/leaderboard?${recoveredQs}`;
  }, [data?.gameCode, effectiveGameCode, effectiveUid]);

  useVisiblePoll(
    async ({ isCancelled }) => {
      if (!effectiveGameCode) return;
      // Only show the loading indicator for the initial load; polling runs in the background.
      if (!hasLoadedOnceRef.current) setLoading(true);
      try {
        const res = await apiFetch<RevealState>(
          `/api/round/reveal/get?gameCode=${encodeURIComponent(effectiveGameCode)}&roundId=${encodeURIComponent(String(roundId))}`
        );
        if (isCancelled()) return;

        // If the host has closed Gambit and finalized the game, the "next" step in the flow is Gambit Results
        // (not another round reveal). Move everyone there automatically so nobody gets stuck on stale reveals.
        if (res.gameStatus === 'finished') {
          const u = effectiveUid;
          const recoveredQs = `gameCode=${encodeURIComponent(effectiveGameCode)}${u ? `&uid=${encodeURIComponent(u)}` : ''}`;
          router.replace(`/game/gambit-reveal?${recoveredQs}`);
          return;
        }

        // Catch-up behavior: if the game has advanced beyond this reveal, route to the latest closed round.
        //
        // - In-progress: gameCurrentRound is the *open* round ⇒ latest closed is (current - 1)
        // - Gambit/Finished: all rounds are closed ⇒ latest closed is totalRounds
        const latestClosedRound = (() => {
          const totalRounds =
            typeof res.totalRounds === 'number' && Number.isFinite(res.totalRounds) ? res.totalRounds : null;
          const currentRound =
            typeof res.gameCurrentRound === 'number' && Number.isFinite(res.gameCurrentRound) ? res.gameCurrentRound : 1;

          if (res.gameStatus === 'in_progress') return Math.max(0, currentRound - 1);
          if (res.gameStatus === 'gambit' || res.gameStatus === 'finished') return Math.max(0, totalRounds ?? currentRound);
          return Math.max(0, currentRound - 1);
        })();

        if (latestClosedRound >= 1 && roundId < latestClosedRound) {
          const u = effectiveUid;
          const recoveredQs = `gameCode=${encodeURIComponent(effectiveGameCode)}${u ? `&uid=${encodeURIComponent(u)}` : ''}`;
          router.replace(`/game/reveal/${latestClosedRound}?${recoveredQs}`);
          return;
        }

        setData(res);
        setError(null);

        // Persist gameCode so refresh/deep links keep working even if the query string disappears.
        try {
          window.localStorage.setItem(LOCAL_STORAGE_GAME_KEY, (res.gameCode ?? '').trim().toUpperCase());
        } catch {
          // ignore
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load reveal');
      } finally {
        hasLoadedOnceRef.current = true;
        if (!isCancelled()) setLoading(false);
      }
    },
    [effectiveGameCode, roundId, effectiveUid, router]
  );

  function onContinue() {
    router.push(continueHref);
  }

  return (
    <WineyShell maxWidthClassName="max-w-[860px]" hideHeader={true}>
      <main className="winey-main">
        <div className="mx-auto w-full max-w-[560px]">
          <WineyCard className="winey-card-pad">
            <div className="text-center">
              <WineyTitle>Round {roundId} of {totalRounds || data?.totalRounds || '–'} Results</WineyTitle>
              {loading && !data ? (
                <p className="mt-2 text-[13px] text-[color:var(--winey-muted)]">Loading…</p>
              ) : null}
            </div>

            {error ? (
              <p className="mt-3 text-center text-[13px] text-red-600">
                {error === 'Please close the current round before proceeding.'
                  ? 'Waiting for the host to close the round…'
                  : error}
              </p>
            ) : null}

            {data?.hasTies ? (
              <div className="mt-3 text-center">
                <p className="text-[12px] text-[color:var(--winey-muted)]">
                  Note: some wines were tied in price – either ordering is correct for those slots.
                </p>
              </div>
            ) : null}

            {data ? (
              <div className="mt-5 space-y-3">
                {data.rows.map((r) => {
                  const correctText = r.correctNicknames.length
                    ? r.correctNicknames.join(' / ')
                    : r.correctWineIds.join(' / ');
                  const yoursText = r.submittedNickname || r.submittedWineId || '–';
                  const isCorrect = r.point === 1;

                  return (
                    <div
                      key={r.position}
                      className="rounded-[var(--winey-radius)] border border-[color:var(--winey-border)] bg-white p-3 shadow-[var(--winey-shadow-sm)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-semibold text-[color:var(--winey-muted-2)]">{placeBadge(r.position)}</p>
                          <p className="mt-1 text-[12px] text-[color:var(--winey-muted-2)]">
                            <span className="font-semibold">Your pick:</span> {yoursText}
                          </p>
                          <p className="mt-1 text-[12px] text-[color:var(--winey-muted-2)]">
                            <span className="font-semibold">Correct answer:</span> {r.isTie ? `(${correctText})` : correctText}
                          </p>
                          {r.note ? (
                            <p className="mt-2 text-[12px] text-[color:var(--winey-muted)]">
                              <span className="font-semibold">Notes for your pick:</span> {r.note}
                            </p>
                          ) : null}
                        </div>

                        <div
                          className={[
                            'flex-shrink-0 rounded-[var(--winey-radius-sm)] border border-[color:var(--winey-border-strong)] px-2 py-1 text-[12px] font-semibold shadow-[var(--winey-shadow-sm)]',
                            // Match existing Winey button colors (outline=green, default=red).
                            isCorrect ? 'bg-[color:var(--winey-success)] text-white' : 'bg-[color:var(--winey-danger)] text-white',
                          ].join(' ')}
                          aria-label={isCorrect ? 'Correct (+1)' : 'Incorrect (0)'}
                        >
                          {isCorrect ? '+1' : '0'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            <div className="mt-5">
              <Button className="w-full" onClick={onContinue}>
                Continue
              </Button>
            </div>
          </WineyCard>
        </div>
      </main>
    </WineyShell>
  );
}


