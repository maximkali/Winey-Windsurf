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
  fromHref?: string | null;
  redirectToFinalOnFinished?: boolean;
  showBackToGameButton?: boolean;
  onBackToGame?: () => void;
  onData?: (data: Leaderboard | null) => void;
};

export function LeaderboardPanel({
  gameCode,
  uid,
  fromHref,
  redirectToFinalOnFinished,
  showBackToGameButton,
  onBackToGame,
  onData,
}: Props) {
  const router = useRouter();
  const [data, setData] = useState<Leaderboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const baseQs = useMemo(() => {
    if (!gameCode) return null;
    return `gameCode=${encodeURIComponent(gameCode)}${uid ? `&uid=${encodeURIComponent(uid)}` : ''}`;
  }, [gameCode, uid]);

  const load = useCallback(async () => {
    if (!gameCode) return;
    setLoading(true);
    try {
      const res = await apiFetch<Leaderboard>(`/api/leaderboard/get?gameCode=${encodeURIComponent(gameCode)}`);
      setData(res);
      onData?.(res);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, [gameCode, onData]);

  useEffect(() => {
    void load();
  }, [load]);

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
        <Button variant="outline" className="w-full py-2" onClick={() => void load()} disabled={loading || !gameCode}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>

        {data?.status === 'finished' && baseQs ? (
          <Button variant="outline" className="w-full py-2" onClick={() => router.push(`/game/final-leaderboard?${baseQs}`)}>
            View Final Leaderboard
          </Button>
        ) : null}

        {showBackToGameButton ? (
          <Button
            variant="outline"
            className="w-full py-2"
            onClick={() => {
              if (onBackToGame) onBackToGame();
            }}
            disabled={!onBackToGame}
          >
            Back to Game
          </Button>
        ) : null}

        {fromHref && baseQs ? (
          <div className="text-center">
            <button
              type="button"
              onClick={() => router.push(`/game/leaderboard?${baseQs}&from=${encodeURIComponent(fromHref)}`)}
              className="text-[11px] text-blue-700 underline"
            >
              Open full leaderboard page
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}


