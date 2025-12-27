import { useMemo } from 'react';
import { formatOrdinal } from '@/lib/ordinal';

export type TastingDetailsConfig = {
  bottlesPerRound: number;
  rounds: number | null;
  bottles: number | null;
  ozPerPersonPerBottle: number | null;
  totalOzPerPerson: number | null;
  percentOfStandardBottle: number | null;
};

function alphaIdx(i: number) {
  return String.fromCharCode('A'.charCodeAt(0) + i);
}

export function TastingDetails({ tastingConfig }: { tastingConfig: TastingDetailsConfig }) {
  const bottlesPerRound = tastingConfig.bottlesPerRound;
  const slots = Math.max(1, Math.min(8, bottlesPerRound));
  const rounds = tastingConfig.rounds;
  const totalWines = tastingConfig.bottles;

  const example = useMemo(() => {
    const wines = Array.from({ length: slots }, (_, i) => `Wine ${alphaIdx(i)}`);
    const correct = wines;
    // Swap positions 2 and 3 (1-based) when possible for a simple "partially correct" example.
    const guess = [...correct];
    if (guess.length >= 3) {
      const tmp = guess[1];
      guess[1] = guess[2];
      guess[2] = tmp;
    }

    const correctByPos = new Map<number, string>();
    for (let i = 0; i < correct.length; i += 1) correctByPos.set(i, correct[i]);

    const scored = guess.map((g, i) => ({ wine: g, ok: correctByPos.get(i) === g }));
    const points = scored.reduce((acc, x) => acc + (x.ok ? 1 : 0), 0);
    return { correct, scored, points };
  }, [slots]);

  return (
    <div className="rounded-[var(--winey-radius)] border border-[color:var(--winey-border)] bg-[color:var(--winey-surface)] px-4 py-3 shadow-[var(--winey-shadow-sm)]">
      <p className="text-center text-[13px] font-semibold text-[color:var(--winey-muted-2)]">Tasting Details</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-[var(--winey-radius)] border border-[color:var(--winey-border)] bg-[color:var(--winey-card)] px-3 py-2 text-center shadow-[var(--winey-shadow-sm)]">
          <p className="text-[10px] font-semibold text-[color:var(--winey-muted)]">Wines / Round</p>
          <p className="mt-0.5 text-[16px] font-semibold text-[color:var(--winey-muted-2)]">{tastingConfig.bottlesPerRound} Wines</p>
        </div>
        <div className="rounded-[var(--winey-radius)] border border-[color:var(--winey-border)] bg-[color:var(--winey-card)] px-3 py-2 text-center shadow-[var(--winey-shadow-sm)]">
          <p className="text-[10px] font-semibold text-[color:var(--winey-muted)]">Max Pour (Per Wine)</p>
          <p className="mt-0.5 text-[16px] font-semibold text-[color:var(--winey-muted-2)]">
            {tastingConfig.ozPerPersonPerBottle === null ? ' – ' : `${tastingConfig.ozPerPersonPerBottle.toFixed(2)} Oz`}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2 text-[11px] leading-relaxed text-[color:var(--winey-muted)]">
        <p>
          In this blind tasting, you’ll sample <span className="font-semibold">{bottlesPerRound}</span> different wine{bottlesPerRound === 1 ? '' : 's'} each round
          {rounds ? (
            <>
              {' '}
              for <span className="font-semibold">{rounds}</span> round{rounds === 1 ? '' : 's'}
            </>
          ) : null}{' '}
          – <span className="font-semibold">{totalWines || ' – '}</span> wine{totalWines === 1 ? '' : 's'} total from start to finish. For each wine, pour up to{' '}
          <span className="font-semibold">{tastingConfig.ozPerPersonPerBottle === null ? ' – ' : tastingConfig.ozPerPersonPerBottle.toFixed(2)} oz</span> to ensure there’s enough for everyone. If you drink your fully allotted pours, that adds up to{' '}
          <span className="font-semibold">{tastingConfig.totalOzPerPerson === null ? ' – ' : `${tastingConfig.totalOzPerPerson.toFixed(2)} oz`}</span> per person over the full game (roughly{' '}
          <span className="font-semibold">{tastingConfig.percentOfStandardBottle === null ? ' – ' : `${tastingConfig.percentOfStandardBottle}%`}</span> of a standard 750ml bottle).
        </p>

        <p>
          After each round, write down quick notes on aroma, flavor, and finish. Then, <span className="font-semibold">rank the {tastingConfig.bottlesPerRound} wines you just tasted in that round</span> from{' '}
          <span className="font-semibold">most to least expensive</span> based on what you think they’re worth (not just your favorite). Once everyone submits their answers, the game shows the{' '}
          <span className="font-semibold">correct price order for that round</span> – without revealing labels or actual prices just yet – and updates a live leaderboard.
        </p>

        <div className="pt-1">
          <p className="text-center text-[13px] font-semibold text-[color:var(--winey-muted-2)]">Scoring</p>
          <div className="mt-1 space-y-1">
            <p>
              <span className="font-semibold">How points work:</span> your ranking has {slots} slots ({Array.from({ length: slots }, (_, i) => formatOrdinal(i + 1)).join(', ')}). You earn{' '}
              <span className="font-semibold">+1 point for each slot that matches</span> the correct price order.
            </p>
            <p>
              <span className="font-semibold">How many points:</span> <span className="font-semibold">0–{slots} per round</span>, up to{' '}
              <span className="font-semibold">{tastingConfig.rounds ? slots * tastingConfig.rounds : ' – '}</span> total.
            </p>

            <p className="pt-1">
              <span className="font-semibold">Example (Most → Least):</span>
            </p>
            <div className="pl-3 space-y-1">
              <p>
                <span className="font-semibold">Correct order:</span> {example.correct.map((w, i) => `${formatOrdinal(i + 1)} ${w}`).join(', ')}
              </p>
              <p>
                <span className="font-semibold">Your order:</span> {example.scored.map((x, i) => `${formatOrdinal(i + 1)} ${x.wine} ${x.ok ? '✅' : '❌'}`).join(', ')}
              </p>
              <p>
                <span className="font-semibold">Score:</span> <span className="font-semibold">{example.points} point{example.points === 1 ? '' : 's'}</span> (you got {example.points} slot
                {example.points === 1 ? '' : 's'} right)
              </p>
            </div>

            <p className="pt-1">
              <span className="font-semibold">Ties:</span> if multiple wines have the <span className="font-semibold">same price</span>, they’re interchangeable for the tied positions – so swapping them{' '}
              <span className="font-semibold">doesn’t</span> cost you points.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


