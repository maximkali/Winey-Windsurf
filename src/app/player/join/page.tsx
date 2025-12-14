'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { LOCAL_STORAGE_GAME_KEY, LOCAL_STORAGE_UID_KEY } from '@/utils/constants';
import { WineyShell } from '@/components/winey/WineyShell';
import { WineyCard } from '@/components/winey/WineyCard';
import { WineyInput } from '@/components/winey/fields';

type JoinResponse = {
  uid: string;
};

export default function PlayerJoinPage() {
  const router = useRouter();
  const [gameCode, setGameCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('gameCode');
    if (!fromUrl) return;
    setGameCode(fromUrl.trim().toUpperCase());
  }, []);

  async function onJoin() {
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<JoinResponse>('/api/game/join', {
        method: 'POST',
        body: JSON.stringify({ gameCode, playerName }),
      });

      window.localStorage.setItem(LOCAL_STORAGE_GAME_KEY, gameCode.trim().toUpperCase());
      window.localStorage.setItem(LOCAL_STORAGE_UID_KEY, res.uid);

      router.push('/player/lobby');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join');
    } finally {
      setLoading(false);
    }
  }

  return (
    <WineyShell maxWidthClassName="max-w-[680px]">
      <main className="pt-10">
        <div className="mx-auto w-full max-w-[520px]">
          <WineyCard className="px-8 py-8">
            <div className="text-center">
              <h1 className="text-[22px] font-semibold">Join Tasting</h1>
              <p className="mt-2 text-[12px] text-[#3d3d3d]">Enter the game code, your name, and email to join</p>
            </div>

            <div className="mt-6 space-y-4">
              <WineyInput
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                placeholder="Game Code"
                autoCapitalize="characters"
              />
              <WineyInput
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Your Name"
              />
              <WineyInput value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your Email" />
            </div>

            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

            <div className="mt-6">
              <Button className="w-full py-3" onClick={onJoin} disabled={loading}>
                {loading ? 'Joining…' : 'Join'}
              </Button>
            </div>
          </WineyCard>
        </div>
      </main>
    </WineyShell>
  );
}
