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

  // Catch-up behavior: if the game advanced (e.g., currentRound=3), route everyone to the latest closed round reveal (round 2).
  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    async function tick() {
      if (!gameCode) return;
      if (inFlight) return;
      try {
        inFlight = true;
        const state = await apiFetch<GamePublic>(`/api/game/get?gameCode=${encodeURIComponent(gameCode)}`);
        if (cancelled) return;
        const baseQs = `gameCode=${encodeURIComponent(gameCode)}${uid ? `&uid=${encodeURIComponent(uid)}` : ''}`;

        if (state?.status === 'finished') {
          router.replace(`/game/final-leaderboard?${baseQs}`);
          return;
        }
        if (state?.status === 'gambit') {
          router.replace(`/game/gambit?${baseQs}`);
          return;
        }
        const currentRound = state?.currentRound && state.currentRound > 0 ? state.currentRound : 1;
        const latestClosedRound = Math.max(0, currentRound - 1);
        if (latestClosedRound >= 1) {
          router.replace(`/game/reveal/${latestClosedRound}?${baseQs}`);
        }
      } catch {
        // ignore; don't block leaderboard if state can't be fetched
      } finally {
        inFlight = false;
      }
    }

    tick();
    const pollId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void tick();
    }, 1000);
    function onFocus() {
      void tick();
    }
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') void tick();
    }
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cancelled = true;
      window.clearInterval(pollId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
    };
  }, [gameCode, router, uid]);

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
