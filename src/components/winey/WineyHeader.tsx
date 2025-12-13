import Link from 'next/link';

export function WineyHeader() {
  return (
    <header className="w-full flex items-center justify-center pt-6 pb-3">
      <Link href="/" className="flex flex-col items-center select-none">
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none">🍷</span>
          <span className="tracking-[0.22em] font-semibold text-[18px] text-[#2b2b2b]">WINEY</span>
        </div>
        <span className="text-[10px] tracking-[0.2em] text-[#4a4a4a]">The Ultimate Taste Test</span>
      </Link>
    </header>
  );
}
