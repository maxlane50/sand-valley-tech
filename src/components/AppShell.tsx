import type { ReactNode } from 'react';

import { BottomNav } from './BottomNav';

/**
 * Phone-first column. On a laptop it stays a phone-width column of paper on a
 * darker ground rather than stretching a scorecard across 1400px.
 *
 * Height is --app-h (100dvh where supported), not 100vh. On iOS Safari 100vh
 * is the viewport with the browser chrome retracted, so a 100vh column sits
 * partly under the URL bar and the bottom nav can't be reached without
 * scrolling first. --app-h is the height that is visible right now.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-app justify-center overflow-hidden bg-paper-3">
      <div className="flex h-app w-full max-w-phone flex-col bg-paper">
        {children}
        <BottomNav />
      </div>
    </div>
  );
}
