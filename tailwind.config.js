/**
 * Tailwind is configured to *replace* its default theme, not extend it — so
 * there is no `bg-blue-500`, no `font-sans`, no `text-lg` to reach for by
 * accident. Every scale below resolves to a custom property in
 * src/styles/tokens.css, which is the source of truth.
 *
 * If you need a value that isn't here, add it to tokens.css first (and ask the
 * designer if it isn't in design.html).
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // `colors` is replaced wholesale: Tailwind's palette is gone.
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      paper: 'var(--paper)',
      'paper-2': 'var(--paper-2)',
      'paper-3': 'var(--paper-3)',
      'paper-shade': 'var(--paper-shade)',
      'paper-sunk': 'var(--paper-sunk)',
      ink: 'var(--ink)',
      'ink-70': 'var(--ink-70)',
      'ink-45': 'var(--ink-45)',
      'ink-25': 'var(--ink-25)',
      'ink-on-turf': 'var(--ink-on-turf)',
      rule: 'var(--rule)',
      'rule-strong': 'var(--rule-strong)',
      'rule-soft': 'var(--rule-soft)',
      turf: 'var(--turf)',
      'turf-deep': 'var(--turf-deep)',
      'leader-chip': 'var(--leader-chip)',
      fescue: 'var(--fescue)',
      sand: 'var(--sand)',
      flag: 'var(--flag)',
      water: 'var(--water)',
      'row-alt': 'var(--row-alt)',
      'row-active': 'var(--row-active)',
      'key-border': 'var(--key-border)',
      'tint-good': 'var(--tint-good)',
      'tint-bad': 'var(--tint-bad)',
    },
    fontFamily: {
      display: 'var(--font-display)',
      ui: 'var(--font-ui)',
      num: 'var(--font-num)',
    },
    fontSize: {
      tiny: 'var(--fs-tiny)',
      pico: 'var(--fs-pico)',
      nano: 'var(--fs-nano)',
      chip: 'var(--fs-chip)',
      micro: 'var(--fs-micro)',
      cell: 'var(--fs-cell)',
      strip: 'var(--fs-strip)',
      list: 'var(--fs-list)',
      body: 'var(--fs-body)',
      name: 'var(--fs-name)',
      'num-m': 'var(--fs-num-m)',
      h2: 'var(--fs-h2)',
      section: 'var(--fs-section)',
      pts: 'var(--fs-pts)',
      'name-lead': 'var(--fs-name-lead)',
      h1: 'var(--fs-h1)',
      'num-l': 'var(--fs-num-l)',
      'card-title': 'var(--fs-card-title)',
      'entry-name': 'var(--fs-entry-name)',
      'pts-lead': 'var(--fs-pts-lead)',
      page: 'var(--fs-page)',
      display: 'var(--fs-display)',
      'num-xl': 'var(--fs-num-xl)',
      'num-hero': 'var(--fs-num-hero)',
    },
    lineHeight: {
      none: 'var(--lh-none)',
      tight: 'var(--lh-tight)',
      name: 'var(--lh-name)',
      body: 'var(--lh-body)',
      meta: 'var(--lh-meta)',
    },
    letterSpacing: {
      caption: 'var(--ls-caption)',
      nav: 'var(--ls-nav)',
      'label-3': 'var(--ls-label-3)',
      'label-2': 'var(--ls-label-2)',
      label: 'var(--ls-label)',
      eyebrow: 'var(--ls-eyebrow)',
    },
    spacing: {
      0: '0px',
      hair: 'var(--gap-hair)',
      chip: 'var(--gap-chip)',
      1: 'var(--sp-1)',
      2: 'var(--sp-2)',
      3: 'var(--sp-3)',
      4: 'var(--sp-4)',
      gutter: 'var(--gutter)',
      5: 'var(--sp-5)',
      6: 'var(--sp-6)',
      7: 'var(--sp-7)',
      'hit-min': 'var(--hit-min)',
      'row-h': 'var(--row-h)',
      'key-h': 'var(--key-h)',
      'chip-w': 'var(--chip-w)',
      'cell-col': 'var(--cell-col)',
      'pos-col': 'var(--pos-col)',
      'pts-col': 'var(--pts-col)',
      'rounds-col': 'var(--rounds-col)',
      full: '100%',
    },
    borderRadius: {
      none: '0px',
      sm: 'var(--r-sm)',
      md: 'var(--r-md)',
      lg: 'var(--r-lg)',
      full: '9999px',
    },
    borderWidth: {
      0: '0px',
      DEFAULT: '1px',
      strong: '1.5px',
      2: '2px',
    },
    boxShadow: {
      card: 'var(--shadow-card)',
      none: 'none',
    },
    extend: {
      maxWidth: {
        phone: 'var(--w-phone)',
      },
      gridTemplateColumns: {
        // Leaderboard: pos | player | round chips | points
        board: 'var(--pos-col) 1fr var(--rounds-col) var(--pts-col)',
        // Score entry: hole | par/si | gross | net | points
        'card-row':
          'var(--cell-col) 1fr var(--cell-col) var(--cell-col) var(--cell-col)',
      },
    },
  },
  plugins: [],
};
