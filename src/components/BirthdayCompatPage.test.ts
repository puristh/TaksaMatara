import { describe, expect, it } from 'vitest';
import {
  BIRTHDAY_COMPAT_DEFAULTS,
  resolvePlateFieldDefaults,
  THAI_LETTER_PATTERN,
} from './BirthdayCompatPage';

describe('BirthdayCompatPage — entering directly from the tab (no initialInput) must show an empty form, not "1 กข 59"', () => {
  it('BIRTHDAY_COMPAT_DEFAULTS is all empty strings', () => {
    expect(BIRTHDAY_COMPAT_DEFAULTS.frontDigit).toBe('');
    expect(BIRTHDAY_COMPAT_DEFAULTS.letter1).toBe('');
    expect(BIRTHDAY_COMPAT_DEFAULTS.letter2).toBe('');
    expect(BIRTHDAY_COMPAT_DEFAULTS.tailDigits).toBe('');
  });

  it('resolvePlateFieldDefaults(null) -> the empty defaults (direct tab entry, no link)', () => {
    expect(resolvePlateFieldDefaults(null)).toEqual(BIRTHDAY_COMPAT_DEFAULTS);
  });

  it('the empty defaults fail the same validation rules isPlateValid uses internally — confirms no Mode 6/7 result can compute until the user actually types something', () => {
    expect(/^[0-9]$/.test(BIRTHDAY_COMPAT_DEFAULTS.frontDigit)).toBe(false);
    expect(THAI_LETTER_PATTERN.test(BIRTHDAY_COMPAT_DEFAULTS.letter1)).toBe(false);
    expect(THAI_LETTER_PATTERN.test(BIRTHDAY_COMPAT_DEFAULTS.letter2)).toBe(false);
    expect(/^[0-9]{2,4}$/.test(BIRTHDAY_COMPAT_DEFAULTS.tailDigits)).toBe(false);
  });

  it('the pristine (never-touched) default state must NOT be treated as "started typing" — otherwise the red form-error banner would show immediately on first load (same regression class already fixed in RankingPanel.tsx)', () => {
    const hasStartedTypingPlate =
      BIRTHDAY_COMPAT_DEFAULTS.frontDigit !== '' ||
      BIRTHDAY_COMPAT_DEFAULTS.letter1 !== '' ||
      BIRTHDAY_COMPAT_DEFAULTS.letter2 !== '' ||
      BIRTHDAY_COMPAT_DEFAULTS.tailDigits !== '';

    expect(hasStartedTypingPlate).toBe(false);
  });
});

describe('BirthdayCompatPage — arriving via the "เช็คกับวันเกิด →" link (initialInput provided) must still prefill the real plate — this must NOT regress', () => {
  it('resolvePlateFieldDefaults(realInput) -> the real values, never BIRTHDAY_COMPAT_DEFAULTS', () => {
    const realInput = { frontDigit: 8, thaiLetters: ['ข', 'ค'] as [string, string], tailDigits: '2683' };
    const resolved = resolvePlateFieldDefaults(realInput);

    expect(resolved).toEqual({
      frontDigit: '8',
      letter1: 'ข',
      letter2: 'ค',
      tailDigits: '2683',
    });
    expect(resolved).not.toEqual(BIRTHDAY_COMPAT_DEFAULTS);
  });

  it('a prefilled plate is immediately valid (isPlateValid-equivalent check) — so the form-error banner never flashes even for one render when arriving via the link', () => {
    const realInput = { frontDigit: 1, thaiLetters: ['ก', 'ข'] as [string, string], tailDigits: '59' };
    const resolved = resolvePlateFieldDefaults(realInput);

    const isPlateValid =
      /^[0-9]$/.test(resolved.frontDigit) &&
      THAI_LETTER_PATTERN.test(resolved.letter1) &&
      THAI_LETTER_PATTERN.test(resolved.letter2) &&
      /^[0-9]{2,4}$/.test(resolved.tailDigits);

    expect(isPlateValid).toBe(true);
  });

  it('frontDigit=0 (a real, valid plate digit) still resolves correctly and is not confused with an empty/falsy default', () => {
    const realInput = { frontDigit: 0, thaiLetters: ['ก', 'ข'] as [string, string], tailDigits: '00' };
    const resolved = resolvePlateFieldDefaults(realInput);
    expect(resolved.frontDigit).toBe('0');
    expect(resolved.frontDigit).not.toBe('');
  });
});
