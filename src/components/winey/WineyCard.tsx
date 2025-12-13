import * as React from 'react';

export function WineyCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={[
        'w-full rounded-[6px] border border-[#303030] bg-[#ffffff] shadow-[2px_2px_0_rgba(0,0,0,0.35)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}
