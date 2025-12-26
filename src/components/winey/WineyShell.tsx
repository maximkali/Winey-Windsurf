import * as React from 'react';
import { WineyHeader } from '@/components/winey/WineyHeader';

export function WineyShell({
  children,
  maxWidthClassName = 'max-w-[560px]',
}: {
  children: React.ReactNode;
  maxWidthClassName?: string;
}) {
  return (
    <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <WineyHeader />
      <div className="px-4 pb-10">
        <div className={['mx-auto w-full', maxWidthClassName].join(' ')}>{children}</div>
      </div>
    </div>
  );
}
