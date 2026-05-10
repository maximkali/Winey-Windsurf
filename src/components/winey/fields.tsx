import * as React from 'react';

export function WineyInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        'w-full rounded-[var(--winey-radius-sm)] border border-[color:var(--winey-border)] bg-white px-3 py-2 text-[16px] leading-none',
        'shadow-[var(--winey-shadow-sm),inset_0_-1px_0_rgba(0,0,0,0.10)]',
        'focus:outline-none focus:ring-2 focus:ring-black/10 focus:ring-offset-2 focus:ring-offset-[color:var(--background)]',
        props.className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}

export const WineyTextarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  (props, ref) => {
    return (
      <textarea
        {...props}
        ref={ref}
        className={[
          'w-full rounded-[var(--winey-radius-sm)] border border-[color:var(--winey-border)] bg-white px-3 py-2 text-[16px]',
          'shadow-[var(--winey-shadow-sm),inset_0_-1px_0_rgba(0,0,0,0.10)]',
          'focus:outline-none focus:ring-2 focus:ring-black/10 focus:ring-offset-2 focus:ring-offset-[color:var(--background)]',
          props.className,
        ]
          .filter(Boolean)
          .join(' ')}
      />
    );
  }
);

WineyTextarea.displayName = 'WineyTextarea';

export function WineySelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const customStyle: React.CSSProperties = {
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%233d3d3d' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 0.75rem center',
    backgroundSize: '12px',
    cursor: 'pointer',
  };

  return (
    <select
      {...props}
      style={{
        ...customStyle,
        ...props.style,
      }}
      className={[
        'w-full rounded-[var(--winey-radius-sm)] border border-[color:var(--winey-border)] bg-white pl-3 pr-10 py-2.5 text-[16px] leading-none',
        'shadow-[var(--winey-shadow-sm),inset_0_-1px_0_rgba(0,0,0,0.10)]',
        'focus:outline-none focus:ring-2 focus:ring-black/10 focus:ring-offset-2 focus:ring-offset-[color:var(--background)]',
        props.className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}
