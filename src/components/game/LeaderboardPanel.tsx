'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { formatOrdinal } from '@/lib/ordinal';

type Leaderboard = {
  gameCode: string;
  status: string;
  leaderboard: Array<{ uid: string; name: string; score: number; delta?: number }>;
  excluded?: Array<{ uid: string; name: string; score: number; delta?: number }>;
  isHost?: boolean;
};

type Props = {
  gameCode: string | null;
  uid?: string | null;
  redirectToFinalOnFinished?: boolean;
  showBackToGameButton?: boolean;
  onBackToGame?: () => void;
  onData?: (data: Leaderboard | null) => void;
};

export function LeaderboardPanel({
  gameCode,
  uid,
  redirectToFinalOnFinished,
  showBackToGameButton,
  onBackToGame,
  onData,
}: Props) {
  const router = useRouter();
  const [data, setData] = useState<Leaderboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const baseQs = useMemo(() => {
    if (!gameCode) return null;
    return `gameCode=${encodeURIComponent(gameCode)}${uid ? `&uid=${encodeURIComponent(uid)}` : ''}`;
  }, [gameCode, uid]);

  const loadOnce = useCallback(async () => {
    if (!gameCode) return;
    try {
      const res = await apiFetch<Leaderboard>(`/api/leaderboard/get?gameCode=${encodeURIComponent(gameCode)}`);
      setData(res);
      onData?.(res);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load leaderboard');
    }
  }, [gameCode, onData]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- This is a data-fetch on mount; state updates occur after the async request resolves.
    void loadOnce();
  }, [loadOnce]);

  useEffect(() => {
    if (!redirectToFinalOnFinished) return;
    if (!data) return;
    if (data.status !== 'finished') return;
    if (!baseQs) return;
    router.replace(`/game/final-leaderboard?${baseQs}`);
  }, [redirectToFinalOnFinished, data, baseQs, router]);

  return (
    <div className="mt-4">
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      {(data?.leaderboard ?? []).length > 0 ? (
        <div className="mt-2 rounded-[var(--winey-radius)] border border-[color:var(--winey-border)] bg-white shadow-[var(--winey-shadow-sm)]">
          {(data?.leaderboard ?? []).map((p, idx, arr) => {
            // Tied rank: count how many players have a strictly higher score
            const rank = arr.filter((other) => other.score > p.score).length + 1;
            return (
          <div
            key={p.uid}
            className={[
              'flex items-center justify-between px-3 py-2 border-b border-[color:var(--winey-border)] last:border-b-0',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold w-10">{formatOrdinal(rank)}</span>
              {uid && p.uid === uid ? (
                <span
                  className="h-2 w-2 rounded-full bg-[color:var(--winey-title)]"
                  aria-label="You"
                  title="You"
                />
              ) : null}
              <span className="text-[13px] font-semibold">{p.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-[13px] font-semibold ${(p.delta ?? 0) > 0 ? 'text-[color:var(--winey-accent-green)]' : 'text-[color:var(--winey-muted)]'}`}>+{p.delta ?? 0}</span>
              <span className="text-[13px] font-semibold">{p.score}</span>
            </div>
            </div>
            );
          })}
        </div>
      ) : null}

      {(data?.excluded ?? []).length ? (
        <div className="mt-3 rounded-[var(--winey-radius)] border border-[color:var(--winey-border)] bg-white shadow-[var(--winey-shadow-sm)]">
          <div className="px-3 py-2 border-b border-[color:var(--winey-border)]">
            <p className="text-[13px] font-semibold text-[color:var(--winey-muted-2)]">Not playing</p>
          </div>

          {(data?.excluded ?? []).map((p) => (
            <div
              key={p.uid}
              className={[
                'flex items-center justify-between px-3 py-2 border-b border-[color:var(--winey-border)] last:border-b-0',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold w-10">Excl</span>
                {uid && p.uid === uid ? (
                  <span
                    className="h-2 w-2 rounded-full bg-[color:var(--winey-title)]"
                    aria-label="You"
                    title="You"
                  />
                ) : null}
                <span className="text-[13px] font-semibold">{p.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[13px] font-semibold ${(p.delta ?? 0) > 0 ? 'text-[color:var(--winey-accent-green)]' : 'text-[color:var(--winey-muted)]'}`}>+{p.delta ?? 0}</span>
                <span className="text-[13px] font-semibold">{p.score}</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        {data?.status === 'finished' && baseQs ? (
          <Button variant="outline" className="w-full" onClick={() => router.push(`/game/final-leaderboard?${baseQs}`)}>
            View Final Leaderboard
          </Button>
        ) : null}

        {showBackToGameButton && !!data ? (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              if (onBackToGame) onBackToGame();
            }}
            disabled={!onBackToGame}
          >
            Continue to Game
          </Button>
        ) : null}
      </div>
    </div>
  );
}


