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

      <div className="mt-2 space-y-2 text-left text-[13px] leading-relaxed text-[color:var(--winey-muted)]">
        <ol className="list-decimal pl-5 space-y-1.5">
          <li>
            <span className="font-semibold">Plan the rounds.</span> You’ll taste <span className="font-semibold">{bottlesPerRound}</span> wine{bottlesPerRound === 1 ? '' : 's'} per round
            {rounds ? (
              <>
                {' '}
                for <span className="font-semibold">{rounds}</span> round{rounds === 1 ? '' : 's'}
              </>
            ) : null}
            {'.'} That’s <span className="font-semibold">{totalWines || ' – '}</span> wine{totalWines === 1 ? '' : 's'} total.
          </li>
          <li>
            <span className="font-semibold">Pour consistent samples.</span> Pour up to{' '}
            <span className="font-semibold">{tastingConfig.ozPerPersonPerBottle === null ? ' – ' : tastingConfig.ozPerPersonPerBottle.toFixed(2)} oz</span> per wine so there’s enough for everyone. If you drink every pour, that’s{' '}
            <span className="font-semibold">{tastingConfig.totalOzPerPerson === null ? ' – ' : `${tastingConfig.totalOzPerPerson.toFixed(2)} oz`}</span> per person total (about{' '}
            <span className="font-semibold">{tastingConfig.percentOfStandardBottle === null ? ' – ' : `${tastingConfig.percentOfStandardBottle}%`}</span> of a standard 750ml bottle).
          </li>
          <li>
            <span className="font-semibold">Rank by price each round.</span> Jot quick notes, then <span className="font-semibold">rank the {tastingConfig.bottlesPerRound} wines</span> from{' '}
            <span className="font-semibold">most → least expensive</span> based on what you think they’re worth (not just your favorite). After everyone submits, we show the{' '}
            <span className="font-semibold">correct price order for that round</span> and update the leaderboard—without revealing labels or prices yet.
          </li>
        </ol>
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
    const points = scored.reduce((acc, x) => acc + (x.ok ? 1 : 0), 0);
    return { correct, scored, points };
  }, [slots]);

  const exampleCorrectWines = useMemo(() => {
    return example.scored.filter((x) => x.ok).map((x) => x.wine);
  }, [example]);

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
                      <span
                        className={`block truncate ${x.ok ? 'font-semibold text-[color:var(--winey-muted-2)]' : 'text-[color:var(--winey-muted)]'}`}
                        title={x.wine}
                      >
                        {x.wine}
                      </span>
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

        <p>
          <span className="font-semibold">Score:</span> <span className="font-semibold">+{example.points} point{example.points === 1 ? '' : 's'}</span> for getting{' '}
          {(() => {
            if (exampleCorrectWines.length === 0) return 'nothing';
            if (exampleCorrectWines.length === 1) return `${exampleCorrectWines[0]}`;
            if (exampleCorrectWines.length === 2) return `${exampleCorrectWines[0]} and ${exampleCorrectWines[1]}`;
            const last = exampleCorrectWines[exampleCorrectWines.length - 1];
            const rest = exampleCorrectWines.slice(0, -1);
            return `${rest.join(', ')}, and ${last}`;
          })()}{' '}
          right.
        </p>

        <p className="pt-1">
          <span className="font-semibold">Ties:</span> if multiple wines have the <span className="font-semibold">same price</span>, they're interchangeable for the tied positions – so swapping them{' '}
          <span className="font-semibold">doesn't</span> cost you points.
        </p>

        <p className="pt-1">After the final round, be ready to earn a few <strong>bonus points</strong>.</p>
      </div>
    </div>
  );
}
