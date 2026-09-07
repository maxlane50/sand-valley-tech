import { NavLink } from 'react-router-dom';

/**
 * Board / Enter / Stats, as drawn in design.html. Screens that aren't built
 * yet render muted and inert rather than linking nowhere.
 */
// design.html draws three tabs. Round detail needs a way in, and the
// leaderboard's round chips are too small to be a tap target, so it gets a
// fourth. The tee sheet is the fifth, and the only one that is read before
// anybody has hit a shot.
//
// Five is the ceiling: "TEE TIMES" is the longest label the row can hold at
// 10px, and it clears a 360px phone with a couple of pixels to spare. A sixth
// tab means dropping to --fs-nano or moving something onto another screen.
const TABS = [
  { label: 'Board', to: '/', ready: true },
  { label: 'Rounds', to: '/rounds', ready: true },
  { label: 'Enter', to: '/enter', ready: true },
  { label: 'Stats', to: '/stats', ready: true },
  { label: 'Tee Times', to: '/tee-times', ready: true },
] as const;

export function BottomNav() {
  return (
    <nav className="grid flex-none grid-cols-5 border-t-strong border-ink bg-paper-2 pb-safe">
      {TABS.map((tab) =>
        tab.ready ? (
          <NavLink
            key={tab.label}
            to={tab.to}
            end
            className={({ isActive }) =>
              [
                'flex items-center justify-center px-1 pt-3 pb-4 text-center font-ui text-chip uppercase tracking-nav',
                isActive
                  ? 'border-b-2 border-turf font-bold text-ink'
                  : 'font-semibold text-ink-45',
              ].join(' ')
            }
          >
            {tab.label}
          </NavLink>
        ) : (
          <span
            key={tab.label}
            aria-disabled="true"
            title="Not built yet"
            className="flex items-center justify-center pt-3 pb-4 font-ui text-chip font-semibold uppercase tracking-nav text-ink-25"
          >
            {tab.label}
          </span>
        ),
      )}
    </nav>
  );
}
