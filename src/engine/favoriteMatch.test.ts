import { describe, expect, it } from 'vitest';
import {
  calculateFavoriteMatchScore,
  getMatchedFavoriteDigits,
  hasAnyFavoriteDigit,
} from './favoriteMatch';

describe('calculateFavoriteMatchScore — task worked example', () => {
  it('favoriteDigits=[8,9,null,null], tailDigits="8899" -> (4×2)+(3×2) = 14', () => {
    const score = calculateFavoriteMatchScore('8899', ['8', '9', null, null]);
    expect(score).toBe(14);
  });

  it('counts every repeated occurrence of the digit, not just presence/absence', () => {
    // '8' appears 3 times at weight 4 -> 12
    expect(calculateFavoriteMatchScore('8888', ['8', null, null, null])).toBe(16);
    expect(calculateFavoriteMatchScore('888', ['8', null, null, null])).toBe(12);
    expect(calculateFavoriteMatchScore('8', ['8', null, null, null])).toBe(4);
  });

  it('position 1 (index 0) is weighted highest (4), position 4 (index 3) lowest (1)', () => {
    expect(calculateFavoriteMatchScore('1', ['1', null, null, null])).toBe(4);
    expect(calculateFavoriteMatchScore('1', [null, '1', null, null])).toBe(3);
    expect(calculateFavoriteMatchScore('1', [null, null, '1', null])).toBe(2);
    expect(calculateFavoriteMatchScore('1', [null, null, null, '1'])).toBe(1);
  });

  it('no favorites at all (all null) -> always 0, regardless of tailDigits', () => {
    expect(calculateFavoriteMatchScore('1234', [null, null, null, null])).toBe(0);
    expect(calculateFavoriteMatchScore('9999', [null, null, null, null])).toBe(0);
  });

  it('empty favoriteDigits array -> 0, no throw', () => {
    expect(calculateFavoriteMatchScore('1234', [])).toBe(0);
  });

  it('a digit not among the favorites contributes nothing', () => {
    expect(calculateFavoriteMatchScore('234', ['9', null, null, null])).toBe(0);
  });

  it('multiple different favorites can each match within the same tail', () => {
    // '1234': '1' at pos1(4) + '2' at pos2(3) + '3' at pos3(2) + '4' at pos4(1) = 10
    expect(calculateFavoriteMatchScore('1234', ['1', '2', '3', '4'])).toBe(10);
  });

  it('an oversized favoriteDigits array (>4) does not crash — extra entries beyond index 3 are ignored', () => {
    expect(() =>
      calculateFavoriteMatchScore('12345', ['1', '2', '3', '4', '5', '6']),
    ).not.toThrow();
    // only the first 4 slots count: '1'(4)+'2'(3)+'3'(2)+'4'(1) = 10, '5' (5th slot) ignored
    expect(calculateFavoriteMatchScore('12345', ['1', '2', '3', '4', '5', '6'])).toBe(10);
  });
});

describe('getMatchedFavoriteDigits — for the "♥ เลขโปรด: ..." badge', () => {
  it('returns only the favorites that actually appear in the tail, in favorite-rank order', () => {
    expect(getMatchedFavoriteDigits('8899', ['9', '8', null, null])).toEqual(['9', '8']);
  });

  it('a favorite that does not appear in the tail is excluded', () => {
    expect(getMatchedFavoriteDigits('8899', ['8', '5', null, null])).toEqual(['8']);
  });

  it('no matches -> empty array', () => {
    expect(getMatchedFavoriteDigits('1234', ['9', null, null, null])).toEqual([]);
  });

  it('no favorites at all -> empty array', () => {
    expect(getMatchedFavoriteDigits('1234', [null, null, null, null])).toEqual([]);
  });

  it('a matched digit is listed only once even if it repeats many times in the tail', () => {
    expect(getMatchedFavoriteDigits('8888', ['8', null, null, null])).toEqual(['8']);
  });
});

describe('hasAnyFavoriteDigit', () => {
  it('true when at least one slot is non-null', () => {
    expect(hasAnyFavoriteDigit(['8', null, null, null])).toBe(true);
    expect(hasAnyFavoriteDigit([null, null, null, '3'])).toBe(true);
  });

  it('false when all slots are null', () => {
    expect(hasAnyFavoriteDigit([null, null, null, null])).toBe(false);
  });

  it('false for undefined or empty array (feature not used at all)', () => {
    expect(hasAnyFavoriteDigit(undefined)).toBe(false);
    expect(hasAnyFavoriteDigit([])).toBe(false);
  });
});
