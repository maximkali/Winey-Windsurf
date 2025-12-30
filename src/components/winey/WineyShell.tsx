'use client';

import * as React from 'react';
import { WineyHeader } from '@/components/winey/WineyHeader';

export function WineyShell({
  children,
  maxWidthClassName = 'max-w-[560px]',
  hideHeader = false,
}: {
  children: React.ReactNode;
  maxWidthClassName?: string;
  hideHeader?: boolean;
}) {
  return (
    <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <WineyHeader hide={hideHeader} />
      <div className="px-2 pb-10 sm:px-4">
        <div className={['mx-auto w-full', maxWidthClassName].join(' ')}>{children}</div>
      </div>
    </div>
  );
}
