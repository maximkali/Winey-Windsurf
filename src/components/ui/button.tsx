import * as React from 'react';

type Variant = 'default' | 'outline';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

function cn(...classes: Array<string | undefined | null | false>) {
  return classes.filter(Boolean).join(' ');
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', type = 'button', ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center rounded-[4px] px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 disabled:pointer-events-none disabled:opacity-50 shadow-[2px_2px_0_rgba(0,0,0,0.35)]';

    const variants: Record<Variant, string> = {
      default: 'bg-[#7a2a1d] text-white hover:bg-[#6a2419] border border-[#2f2f2f]',
      outline: 'bg-[#6f7f6a] text-white hover:bg-[#64725f] border border-[#2f2f2f]',
    };

    return (
      <button
        ref={ref}
        type={type}
        className={cn(base, variants[variant], className)}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
