import { describe, expect, it } from 'vitest';
import { analyzeAyatana6, lookupLetterStar } from './ayatana6';
import { digitRoot } from './digitSum';

describe('digitRoot formula — "จิดาภา" worked example from the source (formula check only, unrelated to plates)', () => {
  it('55 -> 5+5=10 -> 1+0=1', () => {
    expect(digitRoot(55)).toBe(1);
  });
});

describe('lookupLetterStar — reverse lookup built from STAR_LETTERS', () => {
  it('finds the owning star for letters across different star groups', () => {
    expect(lookupLetterStar('ก')).toBe('จันทร์');
    expect(lookupLetterStar('ข')).toBe('จันทร์');
    expect(lookupLetterStar('อ')).toBe('อาทิตย์');
    expect(lookupLetterStar('ย')).toBe('ราหู');
    expect(lookupLetterStar('ศ')).toBe('ศุกร์');
  });

  it('throws a clear error for a letter outside the 8-star table (matches lookupLetterNumber\'s fail-loud convention in letterConversion.ts)', () => {
    expect(() => lookupLetterStar('ฃ')).toThrow(/ไม่พบตัวอักษร/);
  });
});

describe('analyzeAyatana6 — real plate cases (hand-verified against the formula before writing assertions)', () => {
  it('"1 กข 59" (Mode 1\'s own brief-section-10 example plate) -> digit root 1', () => {
    // digit powers: '1'=6, '5'=19, '9'=108 -> 133
    // letter powers: ก->จันทร์(15), ข->จันทร์(15) -> 30
    // rawSum = 163 -> digitRoot(163) = 1+6+3=10 -> 1+0=1
    const result = analyzeAyatana6({ frontDigit: 1, thaiLetters: ['ก', 'ข'], tailDigits: '59' });
    expect(result.digitPowers).toEqual([
      { digit: '1', power: 6 },
      { digit: '5', power: 19 },
      { digit: '9', power: 108 },
    ]);
    expect(result.letterPowers).toEqual([
      { letter: 'ก', star: 'จันทร์', power: 15 },
      { letter: 'ข', star: 'จันทร์', power: 15 },
    ]);
    expect(result.rawSum).toBe(163);
    expect(result.digitRootSteps).toEqual([163, 10, 1]);
    expect(result.digitRoot).toBe(1);
    expect(result.meaning).toContain('พลังผู้นำ');
  });

  it('"5 ขค 555" (analyzePlate.test.ts\'s own auction-number example plate) -> digit root 7', () => {
    // digit powers: '5'=19 (x4, front+3 tail digits) -> 76
    // letter powers: ข->จันทร์(15), ค->จันทร์(15) -> 30
    // rawSum = 106 -> digitRoot(106) = 1+0+6=7
    const result = analyzeAyatana6({ frontDigit: 5, thaiLetters: ['ข', 'ค'], tailDigits: '555' });
    expect(result.rawSum).toBe(106);
    expect(result.digitRoot).toBe(7);
    expect(result.meaning).toContain('พลังนักคิด');
  });

  it('"8 ขค 2145" (4-digit tail) -> digit root 9, includes digit \'9\' special-case power 108 elsewhere unaffected', () => {
    // digit powers: '8'=12,'2'=15,'1'=6,'4'=17,'5'=19 -> 69
    // letter powers: 30 (same letters as above)
    // rawSum = 99 -> digitRoot(99) = 9+9=18 -> 1+8=9
    const result = analyzeAyatana6({ frontDigit: 8, thaiLetters: ['ข', 'ค'], tailDigits: '2145' });
    expect(result.rawSum).toBe(99);
    expect(result.digitRoot).toBe(9);
    expect(result.meaning).toContain('พลังสูงสุด');
  });

  it('digit "9" uses the special-case power 108, not a derived/sequential value', () => {
    const result = analyzeAyatana6({ frontDigit: 9, thaiLetters: ['อ', 'อ'], tailDigits: '00' });
    const nineDigit = result.digitPowers.find((d) => d.digit === '9');
    expect(nineDigit).toEqual({ digit: '9', power: 108 });
  });
});
