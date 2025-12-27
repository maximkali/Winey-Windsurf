'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { WineyCard } from '@/components/winey/WineyCard';
import { WineyShell } from '@/components/winey/WineyShell';
import { WineyTitle } from '@/components/winey/Typography';
import { apiFetch } from '@/lib/api';
import { useUrlBackedIdentity } from '@/utils/hooks';
import { ManagePlayersPanel } from '@/components/game/ManagePlayersPanel';

export default function ManagePlayersPage() {
  const router = useRouter();
  const { gameCode, uid } = useUrlBackedIdentity();

  const [state, setState] = useState<{ status?: string; currentRound?: number | null } | null>(null);

  const qs = useMemo(() => {
    if (!gameCode) return null;
    return `gameCode=${encodeURIComponent(gameCode)}${uid ? `&uid=${encodeURIComponent(uid)}` : ''}`;
  }, [gameCode, uid]);

  const [fromHref] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const from = params.get('from');
    return from && from.startsWith('/') ? from : null;
  });

  function onBackToGame() {
    if (!gameCode) {
      router.back();
      return;
    }

    // If we came from a specific round, prefer returning there.
    if (fromHref && fromHref.startsWith('/game/round/')) {
      router.push(fromHref);
      return;
    }

    const status = state?.status;
    if (!status) {
      // Populate a best-effort state so Back to Game is correct even if this page was opened via deep link.
      apiFetch<{ status?: string; currentRound?: number | null }>(`/api/game/get?gameCode=${encodeURIComponent(gameCode)}`)
        .then((s) => setState(s))
        .catch(() => null);
    }

    if (status === 'gambit') {
      if (qs) router.push(`/game/gambit?${qs}`);
      else router.push(`/game/gambit?gameCode=${encodeURIComponent(gameCode)}`);
      return;
    }

    const round = state?.currentRound ?? 1;
    if (qs) router.push(`/game/round/${round}?${qs}`);
    else router.push(`/game/round/${round}?gameCode=${encodeURIComponent(gameCode)}`);
  }

  return (
    <WineyShell maxWidthClassName="max-w-[860px]">
      <main className="winey-main">
        <div className="winey-stack">
          <WineyCard className="winey-card-pad">
            <div className="text-center">
              <WineyTitle>Manage Players</WineyTitle>
            </div>
            <ManagePlayersPanel
              variant="page"
              gameCode={gameCode}
              uid={uid}
              showBackToGameButton
              onBackToGame={onBackToGame}
            />
          </WineyCard>
        </div>
      </main>
    </WineyShell>
  );
}


