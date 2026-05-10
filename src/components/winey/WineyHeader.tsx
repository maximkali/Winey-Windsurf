import Link from 'next/link';

export function WineyHeader({ hide = false }: { hide?: boolean }) {
  if (hide) {
    return null;
  }

  return (
    <header className="w-full flex items-center justify-center pt-4 pb-2">
      <Link href="/" className="flex flex-col items-center select-none">
        <div className="flex items-center gap-1.5">
          <span className="text-[20px] leading-none">🍷</span>
          <span className="font-logo text-[28px] text-[color:var(--winey-muted-2)]">
            Winey
          </span>
        </div>
        <span className="mt-1 text-[9px] leading-[1.35] uppercase tracking-[0.12em] text-center text-[color:var(--winey-muted)] max-w-[170px]">
          The Ultimate Taste Test
        </span>
      </Link>
    </header>
  );
}
