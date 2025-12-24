import Link from 'next/link';

export function WineyHeader() {
  return (
    <header className="w-full flex items-center justify-center pt-6 pb-3">
      <Link href="/" className="flex flex-col items-center select-none">
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none">🍷</span>
          <span className="tracking-[0.22em] font-semibold text-[18px] text-[#2b2b2b]">WINEY</span>
        </div>
        <span className="mt-1 text-[9px] leading-[1.35] uppercase tracking-[0.12em] text-center text-[#4a4a4a] max-w-[170px]">
          The Ultimate Taste Test
        </span>
      </Link>
    </header>
  );
}
