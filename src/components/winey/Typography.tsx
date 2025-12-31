import * as React from 'react';

export function WineyTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h1
      className={[
        'winey-title text-[21px] font-semibold tracking-tight text-[color:var(--winey-title)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </h1>
  );
}

export function WineySubtitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={[
        'text-[13px] leading-snug text-[color:var(--winey-muted)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </p>
  );
}

export function WineySectionHeading({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2
      className={[
        'text-[14px] font-semibold text-[color:var(--winey-muted-2)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </h2>
  );
}
