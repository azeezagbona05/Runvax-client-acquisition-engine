import { describe, expect, it } from 'vitest';
import { inCountry, queryWithCountry } from '@/lib/google-places';

describe('searches stay in the chosen country', () => {
  it('adds the country to the query, once', () => {
    expect(queryWithCountry('Beauty Salons & Spas in Victoria Island', 'NG')).toBe('Beauty Salons & Spas in Victoria Island, Nigeria');
    expect(queryWithCountry('Spas in Lagos, Nigeria', 'ng')).toBe('Spas in Lagos, Nigeria');
    expect(queryWithCountry('Spas in Lagos', 'GB')).toBe('Spas in Lagos, United Kingdom');
  });
  it('leaves the query alone for a code it does not know', () => {
    expect(queryWithCountry('Spas in Lagos', 'ZZ')).toBe('Spas in Lagos');
  });
  const place = (cc?: string) => ({ addressComponents: cc ? [{ types: ['locality'], shortText: 'Victoria' }, { types: ['country', 'political'], shortText: cc, longText: 'x' }] : [] });
  it('drops places in another country and keeps the right ones', () => {
    expect(inCountry(place('NG'), 'NG')).toBe(true);
    expect(inCountry(place('ng'), 'NG')).toBe(true);
    expect(inCountry(place('US'), 'NG')).toBe(false); // Victoria, TX
    expect(inCountry(place('CA'), 'NG')).toBe(false); // Victoria, BC
  });
  it('keeps a place that has no country information rather than losing it', () => {
    expect(inCountry(place(), 'NG')).toBe(true);
    expect(inCountry({}, 'NG')).toBe(true);
    expect(inCountry(null, 'NG')).toBe(true);
  });
});
