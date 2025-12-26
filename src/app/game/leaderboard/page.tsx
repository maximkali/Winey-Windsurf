'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useUrlBackedIdentity } from '@/utils/hooks';
import { WineyCard } from '@/components/winey/WineyCard';
import { WineyShell } from '@/components/winey/WineyShell';
import { WineyTitle } from '@/components/winey/Typography';
import { LeaderboardPanel } from '@/components/game/LeaderboardPanel';

type Leaderboard = {
  gameCode: string;
  status: string;
  leaderboard: Array<{ uid: string; name: string; score: number; delta?: number }>;
  isHost?: boolean;
};

type GamePublic = {
  status?: string;
  currentRound?: number | null;
};

export default function LeaderboardPage() {
  const router = useRouter();
  const [data, setData] = useState<Leaderboard | null>(null);
  const [fromHref] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const from = params.get('from');
    return from && from.startsWith('/') ? from : null;
  });

  const { gameCode, uid } = useUrlBackedIdentity();

  // If the game is finalized, route everyone to the unified final leaderboard page.
  useEffect(() => {
    if (!gameCode) return;
    if (!data) return;
    if (data.status !== 'finished') return;
    const baseQs = `gameCode=${encodeURIComponent(gameCode)}${uid ? `&uid=${encodeURIComponent(uid)}` : ''}`;
    router.replace(`/game/final-leaderboard?${baseQs}`);
  }, [data, gameCode, uid, router]);

  async function onBackToGame() {
    if (fromHref) {
      router.push(fromHref);
      return;
    }

    if (!gameCode) {
      router.back();
      return;
    }

    const baseQs = `gameCode=${encodeURIComponent(gameCode)}${uid ? `&uid=${encodeURIComponent(uid)}` : ''}`;

    try {
      const state = await apiFetch<GamePublic>(`/api/game/get?gameCode=${encodeURIComponent(gameCode)}`);
      if (state?.status === 'gambit') {
        router.push(`/game/gambit?${baseQs}`);
        return;
      }
      const round = state?.currentRound && state.currentRound > 0 ? state.currentRound : 1;
      router.push(`/game/round/${round}?${baseQs}`);
    } catch {
      // If the game state can't be loaded, fall back to round 1 (better than a no-op back()).
      router.push(`/game/round/1?${baseQs}`);
    }
  }

  const qs = gameCode ? `gameCode=${encodeURIComponent(gameCode)}${uid ? `&uid=${encodeURIComponent(uid)}` : ''}` : null;

  return (
    <WineyShell maxWidthClassName="max-w-[860px]">
      <main className="pt-6">
        <div className="mx-auto w-full max-w-[420px]">
          <WineyCard className="px-5 py-5">
            <div className="text-center">
              <WineyTitle className="text-[18px]">Leaderboard</WineyTitle>
            </div>

            <LeaderboardPanel
              gameCode={gameCode}
              uid={uid}
              redirectToFinalOnFinished
              showBackToGameButton={!!data && data.status !== 'finished'}
              onBackToGame={onBackToGame}
              onData={(next) => setData(next)}
            />
          </WineyCard>
        </div>
      </main>
    </WineyShell>
  );
}
