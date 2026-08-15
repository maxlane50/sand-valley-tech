import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/** True when the viewer has asked the system for reduced motion. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function cssMs(name: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (raw.endsWith('ms')) return Number.parseFloat(raw) || fallback;
  if (raw.endsWith('s')) return (Number.parseFloat(raw) || fallback / 1000) * 1000;
  return fallback;
}

/**
 * FLIP reordering.
 *
 * Rows are laid out by the browser as usual; this measures where each one was
 * before the update and where it landed after, then plays the difference back
 * as a transform. Nothing about layout changes, so the animation cannot drift
 * out of sync with the real positions.
 *
 * Returns a callback ref to attach to each row, keyed by something stable —
 * player id, not array index.
 */
export function useFlipReorder<K extends string | number>(): (
  key: K,
) => (element: HTMLElement | null) => void {
  const nodes = useRef(new Map<K, HTMLElement>());
  const previousTops = useRef(new Map<K, number>());
  const hasRendered = useRef(false);

  const register = useCallback(
    (key: K) => (element: HTMLElement | null) => {
      if (element) nodes.current.set(key, element);
      else nodes.current.delete(key);
    },
    [],
  );

  useLayoutEffect(() => {
    const reduce = prefersReducedMotion();
    const nextTops = new Map<K, number>();
    const duration = cssMs('--dur-reorder', 520);
    const easing =
      getComputedStyle(document.documentElement)
        .getPropertyValue('--ease-settle')
        .trim() || 'ease-out';

    let index = 0;
    for (const [key, element] of nodes.current) {
      // offsetTop is relative to the shared offset parent, so it is unaffected
      // by how far the list is scrolled.
      const top = element.offsetTop;
      nextTops.set(key, top);

      if (reduce) {
        index += 1;
        continue;
      }

      if (!hasRendered.current) {
        // First paint: deal the rows in, top to bottom.
        element.animate(
          [
            { opacity: 0, transform: 'translateY(8px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          { duration: 380, delay: index * 45, easing, fill: 'backwards' },
        );
      } else {
        const previous = previousTops.current.get(key);
        if (previous !== undefined && previous !== top) {
          element.animate(
            [
              { transform: `translateY(${previous - top}px)` },
              { transform: 'translateY(0)' },
            ],
            { duration, easing },
          );
        }
      }
      index += 1;
    }

    previousTops.current = nextTops;
    hasRendered.current = true;
  });

  return register;
}

/**
 * Counts a figure up to its target, and re-animates from the old value to the
 * new one whenever the target changes — so a total that moves after a card is
 * entered visibly climbs rather than snapping.
 */
export function useCountUp(target: number): number {
  const [display, setDisplay] = useState(() => (prefersReducedMotion() ? target : 0));
  const from = useRef(prefersReducedMotion() ? target : 0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      from.current = target;
      setDisplay(target);
      return;
    }

    const start = from.current;
    if (start === target) return;

    const duration = cssMs('--dur-count', 700);
    const startedAt = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      // Ease out cubic: quick off the mark, settles gently.
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(start + (target - start) * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        from.current = target;
      }
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      from.current = target;
    };
  }, [target]);

  return display;
}
