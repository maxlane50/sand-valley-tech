import { NavLink } from 'react-router-dom';

/**
 * Board / Enter / Stats, as drawn in design.html. Screens that aren't built
 * yet render muted and inert rather than linking nowhere.
 */
// design.html draws three tabs. Round detail needs a way in, and the
// leaderboard's round chips are too small to be a tap target, so it gets a
// fourth. If this reads as too many, the alternative is reaching rounds from
// the Stats screen's round list instead.
const TABS = [
  { label: 'Board', to: '/', ready: true },
  { label: 'Rounds', to: '/rounds', ready: true },
  { label: 'Enter', to: '/enter', ready: true },
  { label: 'Stats', to: '/stats', ready: false },
] as const;

export function BottomNav() {
  return (
    <nav className="grid flex-none grid-cols-4 border-t-strong border-ink bg-paper-2 pb-safe">
      {TABS.map((tab) =>
        tab.ready ? (
          <NavLink
            key={tab.label}
            to={tab.to}
            end
            className={({ isActive }) =>
              [
                'flex items-center justify-center pt-3 pb-4 font-ui text-chip uppercase tracking-nav',
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
