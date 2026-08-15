import type { ReactNode } from 'react';

/** Setup, empty and error states. Same paper, same rules, no new colours. */
export function Notice({
  eyebrow,
  title,
  children,
  tone = 'quiet',
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  tone?: 'quiet' | 'alert';
}) {
  return (
    <div className="border-b border-rule bg-paper-2 px-gutter py-4">
      {eyebrow ? (
        <div
          className={`font-ui text-nano font-bold uppercase tracking-eyebrow ${
            tone === 'alert' ? 'text-flag' : 'text-ink-45'
          }`}
        >
          {eyebrow}
        </div>
      ) : null}
      <div className="letterpress pt-1 font-display text-h2 leading-name text-ink">{title}</div>
      {children ? (
        <div className="pt-2 font-num text-chip leading-body text-ink-70">{children}</div>
      ) : null}
    </div>
  );
}
