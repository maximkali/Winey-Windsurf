'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useUrlBackedIdentity } from '@/utils/hooks';
import { WineyCard } from '@/components/winey/WineyCard';
import { WineyShell } from '@/components/winey/WineyShell';
import { WineySubtitle, WineyTitle } from '@/components/winey/Typography';
import { Button } from '@/components/ui/button';

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

  const { gameCode, uid } = useUrlBackedIdentity();

  const qs = useMemo(() => {
    if (!gameCode) return null;
    return `gameCode=${encodeURIComponent(gameCode)}${uid ? `&uid=${encodeURIComponent(uid)}` : ''}`;
  }, [gameCode, uid]);

  const [data, setData] = useState<RevealState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!gameCode) return;
      setLoading(true);
      try {
        const res = await apiFetch<RevealState>(
          `/api/round/reveal/get?gameCode=${encodeURIComponent(gameCode)}&roundId=${encodeURIComponent(String(roundId))}`
        );
        if (!cancelled) setData(res);
        if (!cancelled) setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load reveal');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    // If a user hits Reveal early, it may 409 until the host closes the round — keep retrying.
    load();
    const id = window.setInterval(load, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [gameCode, roundId]);

  function onContinue() {
    if (!qs) return;
    router.push(`/game/leaderboard?${qs}`);
  }

  const header = data ? `Round ${data.roundId} of ${data.totalRounds}` : `Round ${roundId}`;

  return (
    <WineyShell maxWidthClassName="max-w-[860px]">
      <main className="pt-6">
        <div className="mx-auto w-full max-w-[420px]">
          <WineyCard className="px-5 py-5">
            <div className="text-center">
              <WineyTitle className="text-[18px] text-[#b08a3c]">Reveal</WineyTitle>
              <WineySubtitle className="mt-1">{header}</WineySubtitle>
              {loading && !data ? <p className="mt-2 text-[12px] text-[#3d3d3d]">Loading…</p> : null}
            </div>

            {error ? (
              <p className="mt-3 text-center text-[12px] text-red-600">
                {error === 'Please close the current round before proceeding.'
                  ? 'Waiting for the host to close the round…'
                  : error}
              </p>
            ) : null}

            {data ? (
              <div className="mt-3 text-center">
                <p className="text-[12px] text-[#3d3d3d]">
                  You scored <span className="font-semibold">{data.totalPoints}</span> / {data.maxPoints} this round.
                </p>
                {data.hasTies ? (
                  <p className="mt-1 text-[11px] text-[#3d3d3d]">
                    Note: some wines were tied in price — either ordering is correct for those slots.
                  </p>
                ) : null}
              </div>
            ) : null}

            {data ? (
              <div className="mt-4 space-y-3">
                {data.rows.map((r) => {
                  const correctText = r.correctNicknames.length
                    ? r.correctNicknames.join(' / ')
                    : r.correctWineIds.join(' / ');
                  const yoursText = r.submittedNickname || r.submittedWineId || '—';
                  const isCorrect = r.point === 1;

                  return (
                    <div
                      key={r.position}
                      className="rounded-[4px] border border-[#2f2f2f] bg-[#e9e5dd] p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold text-[#2b2b2b]">{placeBadge(r.position)}</p>
                          <p className="mt-1 text-[12px] text-[#2b2b2b]">
                            <span className="font-semibold">Your pick:</span> {yoursText}
                          </p>
                          <p className="mt-1 text-[12px] text-[#2b2b2b]">
                            <span className="font-semibold">Correct:</span> {r.isTie ? `(${correctText})` : correctText}
                          </p>
                          {r.note ? (
                            <p className="mt-2 text-[11px] text-[#3d3d3d]">
                              <span className="font-semibold">Your note:</span> {r.note}
                            </p>
                          ) : null}
                        </div>

                        <div
                          className={[
                            'flex-shrink-0 rounded-[4px] border border-[#2f2f2f] px-2 py-1 text-[11px] font-semibold shadow-[2px_2px_0_rgba(0,0,0,0.35)]',
                            isCorrect ? 'bg-[#6f7f6a] text-white' : 'bg-[#b65b4c] text-white',
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
              <Button className="w-full" onClick={onContinue} disabled={!qs}>
                Continue
              </Button>
            </div>
          </WineyCard>
        </div>
      </main>
    </WineyShell>
  );
}


