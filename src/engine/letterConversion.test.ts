import { describe, expect, it } from 'vitest';
import { lookupLetterNumber } from './letterConversion';

describe('lookupLetterNumber', () => {
  it('maps letters to the correct group number from table 3.1', () => {
    expect(lookupLetterNumber('ก')).toBe(1);
    expect(lookupLetterNumber('ข')).toBe(2);
    expect(lookupLetterNumber('ต')).toBe(3);
    expect(lookupLetterNumber('ค')).toBe(4);
    expect(lookupLetterNumber('ฉ')).toBe(5);
    expect(lookupLetterNumber('จ')).toBe(6);
    expect(lookupLetterNumber('ซ')).toBe(7);
    expect(lookupLetterNumber('ย')).toBe(8);
    expect(lookupLetterNumber('ฏ')).toBe(9);
    // last letter of a group, sanity check the reverse map covers the whole list
    expect(lookupLetterNumber('ฬ')).toBe(5);
    expect(lookupLetterNumber('ฮ')).toBe(5);
  });

  it('throws for a letter not present in table 3.1 (e.g. obsolete ฃ, ฅ)', () => {
    expect(() => lookupLetterNumber('ฃ')).toThrow();
    expect(() => lookupLetterNumber('ฅ')).toThrow();
  });
});
