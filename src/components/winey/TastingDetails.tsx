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
  const rounds = tastingConfig.rounds;
  const totalWines = tastingConfig.bottles;

  return (
    <div className="rounded-[var(--winey-radius)] border border-[color:var(--winey-border)] bg-white px-4 py-3 shadow-[var(--winey-shadow-sm)]">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[var(--winey-radius)] border border-[color:var(--winey-border)] bg-[color:var(--winey-surface)] px-3 py-2 text-center shadow-[var(--winey-shadow-sm)]">
          <p className="text-[12px] font-semibold text-[color:var(--winey-muted)]">Wines per Round</p>
          <p className="mt-0.5 text-[16px] font-semibold text-[color:var(--winey-muted-2)]">{tastingConfig.bottlesPerRound} Wines</p>
        </div>
        <div className="rounded-[var(--winey-radius)] border border-[color:var(--winey-border)] bg-[color:var(--winey-surface)] px-3 py-2 text-center shadow-[var(--winey-shadow-sm)]">
          <p className="text-[12px] font-semibold text-[color:var(--winey-muted)]">Max Pour per Wine</p>
          <p className="mt-0.5 text-[16px] font-semibold text-[color:var(--winey-muted-2)]">
            {tastingConfig.ozPerPersonPerBottle === null ? ' – ' : `${tastingConfig.ozPerPersonPerBottle.toFixed(2)} Oz`}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2 text-[13px] leading-relaxed text-[color:var(--winey-muted)]">
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
          <span className="font-semibold">most to least expensive</span> based on what you think they're worth (not just your favorite). Once everyone submits their answers, the game shows the{' '}
          <span className="font-semibold">correct price order for that round</span> – without revealing labels or actual prices just yet – and updates a live leaderboard.
        </p>
      </div>
    </div>
  );
}

export function ScoringDetails({ tastingConfig }: { tastingConfig: TastingDetailsConfig }) {
  const slots = Math.max(1, Math.min(8, tastingConfig.bottlesPerRound));

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
    return { correct, scored };
  }, [slots]);

  return (
    <div className="rounded-[var(--winey-radius)] border border-[color:var(--winey-border)] bg-white px-4 py-3 shadow-[var(--winey-shadow-sm)]">
      <div className="space-y-2 text-[13px] leading-relaxed text-[color:var(--winey-muted)]">
        <p>
          You'll <span className="font-semibold">rank the {slots} wines</span> each round from most to least expensive. You earn{' '}
          <span className="font-semibold">+1 point</span> for each slot that matches the correct price order, for a{' '}
          <span className="font-semibold">maximum of {slots} points per round</span>.
        </p>

        <p className="pt-1">
          <span className="font-semibold">Example (from most → least expensive):</span>
        </p>
        <div>
          {/* Responsive "table" using one markup path for mobile + desktop */}
          <div className="rounded-[var(--winey-radius)] border border-[color:var(--winey-border)] bg-white shadow-[var(--winey-shadow-sm)] overflow-hidden">
            <div className="grid [grid-template-columns:72px_minmax(0,1fr)_minmax(0,1fr)] sm:[grid-template-columns:92px_minmax(0,1fr)_minmax(0,1fr)] gap-2 bg-[color:var(--winey-surface)] px-3 sm:px-4 py-2 text-[12px] font-semibold text-[color:var(--winey-muted-2)]">
              <div>Rank</div>
              <div>Your order</div>
              <div>Correct order</div>
            </div>
            <div className="divide-y divide-[color:var(--winey-border)]">
              {example.scored.map((x, i) => {
                const correct = example.correct[i];
                const rowBg = x.ok ? 'bg-[color:var(--winey-success)]/8' : 'bg-white';
                return (
                  <div
                    key={`${x.wine}-${i}`}
                    className={`grid [grid-template-columns:72px_minmax(0,1fr)_minmax(0,1fr)] sm:[grid-template-columns:92px_minmax(0,1fr)_minmax(0,1fr)] gap-2 px-3 sm:px-4 py-2 text-[13px] ${rowBg}`}
                  >
                    <div className="font-semibold text-[color:var(--winey-muted-2)] whitespace-nowrap">{formatOrdinal(i + 1)}</div>
                    <div className="min-w-0">
                      <div
                        className={`flex min-w-0 items-baseline gap-2 ${x.ok ? 'font-semibold text-[color:var(--winey-muted-2)]' : 'text-[color:var(--winey-muted)]'}`}
                        title={x.wine}
                      >
                        <span className="min-w-0 truncate">{x.wine}</span>
                        {x.ok ? <span className="shrink-0 font-semibold text-[color:var(--winey-success)]">+1</span> : null}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <span className="block truncate text-[color:var(--winey-muted)]" title={correct}>
                        {correct}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <p className="pt-1">
          <span className="font-semibold">Ties:</span> if multiple wines have the <span className="font-semibold">same price</span>, they're interchangeable for the tied positions – so swapping them{' '}
          <span className="font-semibold">doesn't</span> cost you points.
        </p>

        <p className="pt-1">
          After the final round, be ready for some <strong>Bonus Points</strong>.
        </p>
      </div>
    </div>
  );
}
