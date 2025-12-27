import * as React from 'react';

type Variant = 'default' | 'outline' | 'neutral';
type Size = 'md' | 'sm';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

function cn(...classes: Array<string | undefined | null | false>) {
  return classes.filter(Boolean).join(' ');
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', type = 'button', ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center rounded-[var(--winey-radius-sm)] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)] disabled:pointer-events-none disabled:opacity-50 shadow-[var(--winey-shadow-sm)]';

    const sizes: Record<Size, string> = {
      md: 'px-4 py-2 text-sm',
      sm: 'px-3 py-1.5 text-[12px]',
    };

    const variants: Record<Variant, string> = {
      default:
        'bg-[#7a2a1d] text-white hover:bg-[#6a2419] border border-[color:var(--winey-border-strong)]',
      outline:
        'bg-[#6f7f6a] text-white hover:bg-[#64725f] border border-[color:var(--winey-border-strong)]',
      neutral:
        'bg-white text-[color:var(--winey-muted-2)] hover:bg-[color:var(--winey-surface)] border border-[color:var(--winey-border)]',
    };

    return (
      <button
        ref={ref}
        type={type}
        className={cn(base, sizes[size], variants[variant], className)}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
