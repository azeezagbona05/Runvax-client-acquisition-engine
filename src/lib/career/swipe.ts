/** Swipe gesture rules, kept pure so they can be tested exactly. */
export type SwipeDir = 'left' | 'right';

/** A swipe counts when it is dragged far enough, or flicked quickly. Vertical-only movement never counts (the page keeps scrolling). */
export function swipeDecision(dx: number, dtMs: number, width: number): SwipeDir | null {
  const far = Math.max(90, width * 0.28);
  const speed = Math.abs(dx) / Math.max(1, dtMs);                      // px per ms
  if (Math.abs(dx) >= far || (Math.abs(dx) >= 40 && speed >= 0.6)) return dx > 0 ? 'right' : 'left';
  return null;
}

/** How far to rotate a card that is dragged dx pixels (a little tilt, capped). */
export const tilt = (dx: number) => Math.max(-14, Math.min(14, dx / 18));

/** How strongly to show the "apply" / "skip" badge while dragging, 0 to 1. */
export const intent = (dx: number, width: number) => Math.min(1, Math.abs(dx) / Math.max(120, width * 0.3));
