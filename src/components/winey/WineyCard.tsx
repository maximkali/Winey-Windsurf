import * as React from 'react';

export function WineyCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={[
        'w-full rounded-[var(--winey-radius)] border border-[color:var(--winey-border)] bg-[color:var(--winey-card)] shadow-[var(--winey-shadow-sm)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}
