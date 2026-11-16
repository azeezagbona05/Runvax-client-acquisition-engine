import { describe, it, expect } from 'vitest';
import { intent, swipeDecision, tilt } from '@/lib/career/swipe';

describe('swipeDecision', () => {
  it('a long drag counts, in the right direction', () => { expect(swipeDecision(150, 600, 340)).toBe('right'); expect(swipeDecision(-150, 600, 340)).toBe('left'); });
  it('a short, slow drag does not count', () => { expect(swipeDecision(60, 800, 340)).toBeNull(); expect(swipeDecision(-85, 900, 340)).toBeNull(); });
  it('a quick flick counts even when short, but a tiny twitch never does', () => {
    expect(swipeDecision(60, 60, 340)).toBe('right'); expect(swipeDecision(-50, 40, 340)).toBe('left'); expect(swipeDecision(20, 5, 340)).toBeNull();
  });
  it('the distance needed grows with the card width', () => { expect(swipeDecision(100, 800, 600)).toBeNull(); expect(swipeDecision(180, 800, 600)).toBe('right'); });
  it('no movement is no swipe', () => { expect(swipeDecision(0, 0, 340)).toBeNull(); });
});
describe('tilt and intent', () => {
  it('tilt is capped, and symmetric', () => { expect(tilt(1000)).toBe(14); expect(tilt(-1000)).toBe(-14); expect(tilt(36)).toBe(2); });
  it('intent runs from 0 to 1', () => { expect(intent(0, 340)).toBe(0); expect(intent(500, 340)).toBe(1); expect(intent(-60, 340)).toBeGreaterThan(0); });
});
