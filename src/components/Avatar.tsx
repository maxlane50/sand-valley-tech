import { useEffect, useState } from 'react';

import { avatarPublicUrl, initials } from '../lib/avatars';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim();

type Size = 'stat' | 'row' | 'lead';

const BOX: Record<Size, string> = {
  stat: 'h-avatar-stat w-avatar-stat',
  row: 'h-avatar-row w-avatar-row',
  lead: 'h-avatar-lead w-avatar-lead',
};

const LABEL: Record<Size, string> = {
  stat: 'text-tiny',
  row: 'text-nano',
  lead: 'text-micro',
};

/**
 * A player's photo, or their initials.
 *
 * There is no "has a photo" flag anywhere — the URL is derived from the player
 * id, and a player without one simply 404s. That keeps the whole feature to a
 * storage bucket with no schema change, at the cost of this component owning
 * the fallback. Since most players will have no photo until someone gets round
 * to it, the initials tile is the common case and is styled as a real state
 * rather than a broken image.
 *
 * `version` busts the CDN cache for whoever just uploaded; everyone else picks
 * the new photo up when its max-age expires.
 */
export function Avatar({
  playerId,
  name,
  size = 'row',
  tone = 'light',
  version,
}: {
  playerId: number;
  name: string;
  size?: Size;
  /** `dark` sits on the champion block, where paper-on-ink is inverted. */
  tone?: 'light' | 'dark';
  version?: number;
}) {
  const [failed, setFailed] = useState(false);

  // A new upload has to clear the failure from when there was no photo.
  useEffect(() => setFailed(false), [version]);

  const src = SUPABASE_URL ? avatarPublicUrl(SUPABASE_URL, playerId, version) : null;

  return (
    <div
      className={[
        BOX[size],
        'flex flex-none items-center justify-center overflow-hidden rounded-full',
        tone === 'dark' ? 'bg-leader-chip text-fescue' : 'bg-paper-2 text-ink-45',
      ].join(' ')}
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className={`font-ui ${LABEL[size]} font-bold uppercase tracking-nav`}
        >
          {initials(name)}
        </span>
      )}
    </div>
  );
}
