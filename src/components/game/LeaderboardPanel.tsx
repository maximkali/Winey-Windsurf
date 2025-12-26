'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';

type Leaderboard = {
  gameCode: string;
  status: string;
  leaderboard: Array<{ uid: string; name: string; score: number; delta?: number }>;
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

      <div className="mt-2 rounded-[4px] border border-[#2f2f2f] bg-white">
        {(data?.leaderboard ?? []).map((p, idx) => (
          <div key={p.uid} className="flex items-center justify-between px-3 py-2 border-b border-[#2f2f2f] last:border-b-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold w-5">{idx + 1}.</span>
              <span className="text-[12px] font-semibold">{p.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-green-700 font-semibold">+{p.delta ?? 0}</span>
              <span className="text-[12px] font-semibold">{p.score}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 space-y-2">
        {data?.status === 'finished' && baseQs ? (
          <Button variant="outline" className="w-full py-2" onClick={() => router.push(`/game/final-leaderboard?${baseQs}`)}>
            View Final Leaderboard
          </Button>
        ) : null}

        {showBackToGameButton && !!data ? (
          <Button
            variant="outline"
            className="w-full py-2"
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


