import type { ReactNode } from 'react';

import { BottomNav } from './BottomNav';

/**
 * Phone-first column. On a laptop it stays a phone-width column of paper on a
 * darker ground rather than stretching a scorecard across 1400px.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full justify-center bg-paper-3">
      <div className="flex h-screen w-full max-w-phone flex-col bg-paper">
        {children}
        <BottomNav />
      </div>
    </div>
  );
}
