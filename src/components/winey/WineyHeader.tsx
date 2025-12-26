import Link from 'next/link';

export function WineyHeader() {
  return (
    <header className="w-full flex items-center justify-center pt-6 pb-3">
      <Link href="/" className="flex flex-col items-center select-none">
        <div className="flex items-center gap-2">
          <span className="text-[18px] sm:text-[20px] leading-none">🍷</span>
          <span className="tracking-[0.22em] font-semibold text-[16px] sm:text-[18px] text-[color:var(--winey-muted-2)]">
            WINEY
          </span>
        </div>
        <span className="mt-1 text-[10px] leading-[1.35] uppercase tracking-[0.12em] text-center text-[color:var(--winey-muted)] max-w-[170px]">
          The Ultimate Taste Test
        </span>
      </Link>
    </header>
  );
}
