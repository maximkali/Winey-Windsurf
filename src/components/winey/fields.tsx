import * as React from 'react';

export function WineyInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        'w-full rounded-[2px] border border-[#2f2f2f] bg-white px-3 py-2 text-[14px] leading-none',
        'shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)]',
        'focus:outline-none focus:ring-2 focus:ring-[#2f2f2f]/30',
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
        'w-full rounded-[2px] border border-[#2f2f2f] bg-white px-3 py-2 text-[14px]',
        'shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)]',
        'focus:outline-none focus:ring-2 focus:ring-[#2f2f2f]/30',
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
        'w-full rounded-[2px] border border-[#2f2f2f] bg-white px-3 py-2 text-[14px] leading-none',
        'shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)]',
        'focus:outline-none focus:ring-2 focus:ring-[#2f2f2f]/30',
        props.className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}
