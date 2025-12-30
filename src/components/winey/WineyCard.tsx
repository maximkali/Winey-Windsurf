import * as React from 'react';

export function WineyCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={[
        'w-full',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}
