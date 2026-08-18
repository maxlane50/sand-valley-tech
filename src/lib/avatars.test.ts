import { describe, expect, it } from 'vitest';

import {
  avatarObjectPath,
  avatarPublicUrl,
  base64FromDataUrl,
  centerCrop,
  initials,
} from './avatars';

const BASE = 'https://abc.supabase.co';

describe('avatarObjectPath', () => {
  it('keys a photo on the player id alone', () => {
    expect(avatarObjectPath(8)).toBe('8.jpg');
  });

  it('refuses anything that is not an integer id', () => {
    expect(() => avatarObjectPath(1.5)).toThrow(/integer/);
    expect(() => avatarObjectPath(Number.NaN)).toThrow(/integer/);
  });
});

describe('avatarPublicUrl', () => {
  it('builds the public object URL, which needs no key', () => {
    expect(avatarPublicUrl(BASE, 8)).toBe(
      'https://abc.supabase.co/storage/v1/object/public/avatars/8.jpg',
    );
  });

  it('tolerates a trailing slash on the project URL', () => {
    expect(avatarPublicUrl(`${BASE}/`, 8)).toBe(avatarPublicUrl(BASE, 8));
  });

  it('adds a version so a fresh upload is not served from cache', () => {
    expect(avatarPublicUrl(BASE, 8, 1234)).toBe(`${avatarPublicUrl(BASE, 8)}?v=1234`);
  });
});

describe('initials', () => {
  it('takes the first and last words', () => {
    expect(initials('Ferris Bueller')).toBe('FB');
    expect(initials('Robert De Niro')).toBe('RN');
  });

  it('handles a single name', () => {
    expect(initials('Granimal')).toBe('G');
  });

  it('copes with stray whitespace and an empty name', () => {
    expect(initials('  Lane   Tech  ')).toBe('LT');
    expect(initials('   ')).toBe('?');
  });
});

describe('centerCrop', () => {
  it('takes the middle square out of a portrait photo', () => {
    expect(centerCrop(1000, 1600)).toEqual({ sx: 0, sy: 300, side: 1000 });
  });

  it('takes the middle square out of a landscape photo', () => {
    expect(centerCrop(1600, 1000)).toEqual({ sx: 300, sy: 0, side: 1000 });
  });

  it('leaves a square photo alone', () => {
    expect(centerCrop(800, 800)).toEqual({ sx: 0, sy: 0, side: 800 });
  });

  it('rounds to whole pixels on an odd difference', () => {
    const crop = centerCrop(101, 100);
    expect(Number.isInteger(crop.sx)).toBe(true);
    expect(crop.side).toBe(100);
  });
});

describe('base64FromDataUrl', () => {
  it('pulls the payload out of a JPEG data URL', () => {
    expect(base64FromDataUrl('data:image/jpeg;base64,AAEC')).toBe('AAEC');
  });

  it('rejects any other image type, so only JPEG reaches the bucket', () => {
    expect(base64FromDataUrl('data:image/png;base64,AAEC')).toBeNull();
    expect(base64FromDataUrl('data:text/html;base64,AAEC')).toBeNull();
  });

  it('rejects a payload that is not base64', () => {
    expect(base64FromDataUrl('data:image/jpeg;base64,not base64!')).toBeNull();
  });
});
