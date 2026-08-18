/**
 * Player photos.
 *
 * A photo lives at `avatars/<playerId>.jpg` in a public Supabase Storage
 * bucket, so its URL is derivable from the player id alone. That is the whole
 * design: no photo_url column, no migration, nothing to keep in sync. A player
 * with no photo simply 404s, and the avatar falls back to their initials.
 *
 * A derived path means a replaced photo reuses its URL, which would normally
 * risk serving a stale one. Measured against this project, Supabase Storage
 * answers public objects with `cache-control: no-cache` however the object is
 * uploaded — so browsers revalidate every time and a new photo appears at
 * once. `version` is kept anyway, as a belt-and-braces cache bust for whoever
 * just uploaded, and because that guarantee is Supabase's rather than ours.
 *
 * Nothing in this file touches `import.meta` or the DOM — the write handler in
 * api/ imports it too, and that runs in Node.
 */

export const AVATAR_BUCKET = 'avatars';

/** The longest side of a stored photo. Avatars are never shown large. */
export const AVATAR_SIZE = 256;

export function avatarObjectPath(playerId: number): string {
  if (!Number.isInteger(playerId)) {
    throw new Error(`A player id must be an integer, got ${playerId}.`);
  }
  return `${playerId}.jpg`;
}

/**
 * The public URL of a player's photo. Public-bucket reads need no key, which
 * is why the anon key never appears here.
 */
export function avatarPublicUrl(
  supabaseUrl: string,
  playerId: number,
  version?: number,
): string {
  const base = supabaseUrl.replace(/\/+$/, '');
  const url = `${base}/storage/v1/object/public/${AVATAR_BUCKET}/${avatarObjectPath(playerId)}`;
  return version === undefined ? url : `${url}?v=${version}`;
}

/**
 * Up to two letters, for the fallback tile. Middle names are dropped so
 * "Robert De Niro" reads RN rather than RD — the last word is the surname.
 */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0]![0]!;
  const last = words.length > 1 ? words[words.length - 1]![0]! : '';
  return (first + last).toUpperCase();
}

/**
 * The largest centred square inside an image. Phone photos are portrait far
 * more often than not, and a squashed face is worse than a cropped one.
 */
export function centerCrop(
  width: number,
  height: number,
): { sx: number; sy: number; side: number } {
  const side = Math.min(width, height);
  return { sx: Math.round((width - side) / 2), sy: Math.round((height - side) / 2), side };
}

/** `data:image/jpeg;base64,...` → the raw base64 payload. Null if malformed. */
export function base64FromDataUrl(dataUrl: string): string | null {
  const match = /^data:image\/jpe?g;base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl.trim());
  return match ? match[1]! : null;
}
