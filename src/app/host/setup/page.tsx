'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import {
  LOCAL_STORAGE_BOTTLE_COUNT_KEY,
  LOCAL_STORAGE_BOTTLES_PER_ROUND_KEY,
  LOCAL_STORAGE_GAME_KEY,
  LOCAL_STORAGE_PLAYER_COUNT_KEY,
  LOCAL_STORAGE_ROUND_COUNT_KEY,
  LOCAL_STORAGE_UID_KEY,
} from '@/utils/constants';
import { WineyShell } from '@/components/winey/WineyShell';
import { WineyCard } from '@/components/winey/WineyCard';
import { WineyInput, WineySelect } from '@/components/winey/fields';
import { TastingDetails } from '@/components/winey/TastingDetails';
import { WineyTitle } from '@/components/winey/Typography';
import {
  defaultSetup,
  findSetup,
  getBottleOptions,
  getPlayersOptions,
  getRoundOptions,
} from '@/lib/wineySetups';

type CreateGameResponse = {
  gameCode: string;
  hostUid: string;
};

export default function HostSetupPage() {
  const router = useRouter();
  const [hostName, setHostName] = useState('');
  const [email, setEmail] = useState('');
  const initial = useMemo(() => defaultSetup(), []);
  const [players, setPlayers] = useState(String(initial.players));
  const [bottles, setBottles] = useState(String(initial.bottles));
  const [rounds, setRounds] = useState(String(initial.rounds));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const playersNum = Number(players);
  const bottlesNum = Number(bottles);
  const roundsNum = Number(rounds);

  const playersOptions = useMemo(() => getPlayersOptions(), []);
  const bottleOptions = useMemo(() => getBottleOptions(playersNum), [playersNum]);
  const roundOptions = useMemo(() => getRoundOptions(playersNum, bottlesNum), [playersNum, bottlesNum]);

  useEffect(() => {
    const p = Number(players);
    if (!Number.isFinite(p) || !playersOptions.includes(p)) setPlayers(String(playersOptions[0] ?? 20));
  }, [players, playersOptions]);

  useEffect(() => {
    const b = Number(bottles);
    if (!Number.isFinite(b) || !bottleOptions.includes(b)) setBottles(String(bottleOptions[0] ?? 20));
  }, [bottles, bottleOptions]);

  useEffect(() => {
    const r = Number(rounds);
    if (!Number.isFinite(r) || !roundOptions.includes(r)) setRounds(String(roundOptions[0] ?? 5));
  }, [rounds, roundOptions]);

  const setup = useMemo(() => {
    const s = findSetup(playersNum, bottlesNum, roundsNum);
    return s ?? defaultSetup();
  }, [playersNum, bottlesNum, roundsNum]);

  const totalOzPerPerson = useMemo(() => setup.bottles * setup.ozPerPersonPerBottle, [setup.bottles, setup.ozPerPersonPerBottle]);
  const percentOfStandardBottle = useMemo(() => {
    const standard750mlBottleOz = 25.36;
    return Math.round((totalOzPerPerson / standard750mlBottleOz) * 100);
  }, [totalOzPerPerson]);

  async function onCreate() {
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<CreateGameResponse>('/api/game/create', {
        method: 'POST',
        body: JSON.stringify({
          hostName,
          totalRounds: setup.rounds,
          players: setup.players,
          bottles: setup.bottles,
          bottlesPerRound: setup.bottlesPerRound,
          bottleEqPerPerson: setup.bottleEqPerPerson,
          ozPerPersonPerBottle: setup.ozPerPersonPerBottle,
        }),
      });

      window.localStorage.setItem(LOCAL_STORAGE_GAME_KEY, res.gameCode);
      window.localStorage.setItem(LOCAL_STORAGE_UID_KEY, res.hostUid);
      window.localStorage.setItem(LOCAL_STORAGE_BOTTLE_COUNT_KEY, bottles);
      window.localStorage.setItem(LOCAL_STORAGE_BOTTLES_PER_ROUND_KEY, String(setup.bottlesPerRound));
      window.localStorage.setItem(LOCAL_STORAGE_ROUND_COUNT_KEY, rounds);
      window.localStorage.setItem(LOCAL_STORAGE_PLAYER_COUNT_KEY, players);

      router.push(`/host/wine-list?gameCode=${encodeURIComponent(res.gameCode)}&uid=${encodeURIComponent(res.hostUid)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create game');
    } finally {
      setLoading(false);
    }
  }

  return (
    <WineyShell maxWidthClassName="max-w-[860px]">
      <main className="pt-6">
        <div className="mx-auto w-full max-w-[560px]">
          <WineyCard className="px-8 py-7">
            <div className="text-center">
              <WineyTitle className="text-[18px]">Setup Tasting</WineyTitle>
              <p className="mt-2 text-[11px] text-[#3d3d3d]">
                Choose the number of players, bottles, and rounds, then click <span className="font-semibold">Create</span>. Next, you’ll add each wine’s{' '}
                <span className="font-semibold">real label name</span>, a <span className="font-semibold">blind name</span> (a fun nickname – some people even
                name a wine after a guest – so players can talk about it without revealing what it is), and the <span className="font-semibold">price</span>.
                After that, you’ll assign wines to rounds – either <span className="font-semibold">randomly</span> or <span className="font-semibold">manually</span>.
              </p>
            </div>

            <div className="mt-5 space-y-3">
              <WineyInput value={hostName} onChange={(e) => setHostName(e.target.value)} placeholder="Your Name" />
              <WineyInput value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your Email" />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <WineySelect value={players} onChange={(e) => setPlayers(e.target.value)}>
                    {playersOptions.map((n) => (
                      <option key={n} value={String(n)}>
                        # of Players: {n}
                      </option>
                    ))}
                  </WineySelect>
                </div>
                <div>
                  <WineySelect value={bottles} onChange={(e) => setBottles(e.target.value)}>
                    {bottleOptions.map((n) => (
                      <option key={n} value={String(n)}>
                        # of Bottles: {n}
                      </option>
                    ))}
                  </WineySelect>
                </div>
              </div>

              <WineySelect value={rounds} onChange={(e) => setRounds(e.target.value)}>
                {roundOptions.map((n) => (
                  <option key={n} value={String(n)}>
                    # of Rounds: {n}
                  </option>
                ))}
              </WineySelect>
            </div>

            <div className="mt-5">
              <TastingDetails
                tastingConfig={{
                  bottlesPerRound: setup.bottlesPerRound,
                  bottles: setup.bottles,
                  rounds: setup.rounds,
                  ozPerPersonPerBottle: setup.ozPerPersonPerBottle,
                  totalOzPerPerson,
                  percentOfStandardBottle,
                }}
              />
            </div>

            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

            <div className="mt-5">
              <Button className="w-full py-3" onClick={onCreate} disabled={loading}>
                {loading ? 'Creating…' : 'Create'}
              </Button>
            </div>
          </WineyCard>
        </div>
      </main>
    </WineyShell>
  );
}
