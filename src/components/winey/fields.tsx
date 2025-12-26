import * as React from 'react';

export function WineyInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        'w-full rounded-[var(--winey-radius-sm)] border border-[color:var(--winey-border)] bg-white px-3 py-2 text-[14px] leading-none',
        'shadow-[inset_0_-1px_0_rgba(0,0,0,0.10)]',
        'focus:outline-none focus:ring-2 focus:ring-black/10 focus:ring-offset-2 focus:ring-offset-[color:var(--background)]',
        props.className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}

export function WineyTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={[
        'w-full rounded-[var(--winey-radius-sm)] border border-[color:var(--winey-border)] bg-white px-3 py-2 text-[14px]',
        'shadow-[inset_0_-1px_0_rgba(0,0,0,0.10)]',
        'focus:outline-none focus:ring-2 focus:ring-black/10 focus:ring-offset-2 focus:ring-offset-[color:var(--background)]',
        props.className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}

export function WineySelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={[
        'w-full rounded-[var(--winey-radius-sm)] border border-[color:var(--winey-border)] bg-white px-3 py-2 text-[14px] leading-none',
        'shadow-[inset_0_-1px_0_rgba(0,0,0,0.10)]',
        'focus:outline-none focus:ring-2 focus:ring-black/10 focus:ring-offset-2 focus:ring-offset-[color:var(--background)]',
        props.className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}
