'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { WineyCard } from '@/components/winey/WineyCard';
import { WineyShell } from '@/components/winey/WineyShell';
import { WineyTextarea } from '@/components/winey/fields';
import { apiFetch } from '@/lib/api';
import { useUrlBackedIdentity } from '@/utils/hooks';

export default function GambitPage() {
  const [step, setStep] = useState(1);
  const [wineNicknames, setWineNicknames] = useState<string[]>([]);
  const [bottlesPerRound, setBottlesPerRound] = useState(4);

  const { gameCode } = useUrlBackedIdentity();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!gameCode) return;
      try {
        const game = await apiFetch<{ currentRound: number }>(`/api/game/get?gameCode=${encodeURIComponent(gameCode)}`);
        const round = await apiFetch<{ wineNicknames: string[]; bottlesPerRound: number }>(
          `/api/round/get?gameCode=${encodeURIComponent(gameCode)}&roundId=${encodeURIComponent(String(game.currentRound))}`
        );
        if (cancelled) return;
        setWineNicknames(round.wineNicknames ?? []);
        setBottlesPerRound(round.bottlesPerRound ?? 4);
      } catch {
        if (cancelled) return;
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [gameCode]);

  return (
    <WineyShell maxWidthClassName="max-w-[860px]">
      <main className="pt-6">
        <div className="mx-auto w-full max-w-[420px]">
          <WineyCard className="px-5 py-5">
            <div className="text-center">
              <p className="text-[13px] font-semibold text-[#b08a3c]">Sommelier&apos;s Gambit {step} / 3</p>
              {step === 1 ? (
                <p className="mt-1 text-[11px] text-[#3d3d3d]">Pick the most expensive wine (+5 points)</p>
              ) : step === 2 ? (
                <p className="mt-1 text-[11px] text-[#3d3d3d]">Pick the least expensive wine (+5 points)</p>
              ) : (
                <p className="mt-1 text-[11px] text-[#3d3d3d]">What is your guess for the average wine price?</p>
              )}
            </div>

            <div className="mt-4 space-y-3">
              {Array.from({ length: bottlesPerRound }, (_, idx) => idx + 1).map((n) => (
                <div key={n} className="rounded-[4px] border border-[#2f2f2f] bg-[#e9e5dd] p-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold">{wineNicknames[n - 1] || 'Nickname'}</p>
                    <span className="rounded-[4px] border border-[#2f2f2f] bg-white px-2 py-[2px] text-[10px] font-semibold">$$$$</span>
                  </div>
                  <WineyTextarea className="mt-2 min-h-[72px]" />
                </div>
              ))}
            </div>

            <div className="mt-4">
              {step === 1 ? (
                <Button className="w-full py-3" onClick={() => setStep(2)}>
                  Next
                </Button>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setStep((s) => Math.max(1, s - 1))}
                    className="rounded-[4px] border border-[#2f2f2f] bg-white px-4 py-2 text-sm font-semibold shadow-[2px_2px_0_rgba(0,0,0,0.35)]"
                  >
                    Previous Page
                  </button>
                  {step < 3 ? (
                    <Button className="w-full py-3" onClick={() => setStep(3)}>
                      Next
                    </Button>
                  ) : (
                    <Button className="w-full py-3">(Admin) Close Round &amp; Proceed</Button>
                  )}
                </div>
              )}
            </div>

            <div className="mt-3 text-center">
              <Link
                href={`/game/round/1?gameCode=${encodeURIComponent(gameCode ?? '')}`}
                className="text-[11px] text-blue-700 underline"
              >
                Return to Round
              </Link>
            </div>
          </WineyCard>
        </div>
      </main>
    </WineyShell>
  );
}
