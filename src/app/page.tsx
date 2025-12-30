import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { WineyShell } from '@/components/winey/WineyShell';

export default function Home() {
  return (
    <WineyShell maxWidthClassName="max-w-[980px]">
      <main className="winey-main">
        <div className="mt-5 flex flex-col items-center text-center">
          <p className="text-[18px] font-semibold text-[color:var(--winey-muted-2)]">Think you can taste a difference?</p>
          <div className="mt-4 flex items-center gap-4">
            <Link href="/host/setup">
              <Button className="min-w-[140px] px-6">Host Tasting</Button>
            </Link>
            <Link href="/player/join">
              <Button variant="outline" className="min-w-[140px] px-6">Join Tasting</Button>
            </Link>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-10 text-center md:grid-cols-4">
          <div className="mx-auto max-w-[180px]">
            <div className="text-[27px]">🍇</div>
            <p className="mt-2 text-[17px] font-semibold">Blind Tasting</p>
            <p className="mt-2 text-[13px] text-[color:var(--winey-muted)]">Try 3 to 4 mystery wines each round – no labels, just taste and instinct</p>
          </div>
          <div className="mx-auto max-w-[180px]">
            <div className="text-[27px]">🔢</div>
            <p className="mt-2 text-[17px] font-semibold">Live Ranking</p>
            <p className="mt-2 text-[13px] text-[color:var(--winey-muted)]">Think you can price them right? Stack each wine from luxe to low-end</p>
          </div>
          <div className="mx-auto max-w-[180px]">
            <div className="text-[27px]">✅</div>
            <p className="mt-2 text-[17px] font-semibold">Smart Scoring</p>
            <p className="mt-2 text-[13px] text-[color:var(--winey-muted)]">Once everyone votes, see how your picks stacked up against your friends</p>
          </div>
          <div className="mx-auto max-w-[180px]">
            <div className="text-[27px]">🏆</div>
            <p className="mt-2 text-[17px] font-semibold">Compete &amp; Win</p>
            <p className="mt-2 text-[13px] text-[color:var(--winey-muted)]">Top taster takes the crown. Bragging rights (and maybe a hangover) await</p>
          </div>
        </div>
      </main>
    </WineyShell>
  );
}
