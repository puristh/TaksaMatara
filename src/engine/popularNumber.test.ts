import { describe, expect, it } from 'vitest';
import { detectPopularNumber } from './popularNumber';

describe('detectPopularNumber', () => {
  it('"98" (2-digit, direct pair) -> isPopular true, weight 3', () => {
    expect(detectPopularNumber('98')).toEqual({
      isPopular: true,
      weight: 3,
      matchedPairs: ['98'],
    });
  });

  it('3-digit tails containing a popular pair -> weight 2', () => {
    expect(detectPopularNumber('998')).toEqual({
      isPopular: true,
      weight: 2,
      matchedPairs: ['98'],
    });
    expect(detectPopularNumber('989')).toEqual({
      isPopular: true,
      weight: 2,
      matchedPairs: ['98', '89'],
    });
    expect(detectPopularNumber('898')).toEqual({
      isPopular: true,
      weight: 2,
      matchedPairs: ['89', '98'],
    });
    expect(detectPopularNumber('899')).toEqual({
      isPopular: true,
      weight: 2,
      matchedPairs: ['89'],
    });
  });

  it('"9998" (4-digit, one popular pair at the end) -> weight 1', () => {
    expect(detectPopularNumber('9998')).toEqual({
      isPopular: true,
      weight: 1,
      matchedPairs: ['98'],
    });
  });

  it('a tail with no popular pair at all -> isPopular false, weight 0, no matched pairs', () => {
    expect(detectPopularNumber('37')).toEqual({ isPopular: false, weight: 0, matchedPairs: [] });
    expect(detectPopularNumber('371')).toEqual({ isPopular: false, weight: 0, matchedPairs: [] });
    expect(detectPopularNumber('3715')).toEqual({ isPopular: false, weight: 0, matchedPairs: [] });
  });

  it('bidirectional: reversed pair also matches (e.g. "42" matches the "24" seed entry direction too)', () => {
    const result = detectPopularNumber('42');
    expect(result.isPopular).toBe(true);
    expect(result.matchedPairs).toEqual(['42']);
  });

  it('weight is purely a display/filter concern — it must not resemble a ranking finalScore component', () => {
    // sanity check that weight stays within the small documented range (1-3), not
    // some larger score-like magnitude, guarding against accidental reuse in ranking.ts
    for (const tail of ['98', '998', '9998']) {
      expect(detectPopularNumber(tail).weight).toBeLessThanOrEqual(3);
      expect(detectPopularNumber(tail).weight).toBeGreaterThanOrEqual(1);
    }
  });
});
