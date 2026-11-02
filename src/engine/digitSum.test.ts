import { describe, expect, it } from 'vitest';
import { digitRoot, digitRootSteps, sumDigitsOfString } from './digitSum';

describe('digitRootSteps — trace of each reduction step', () => {
  it('163 -> [163, 10, 1] (matches the "1 กข 59" Ayatana6 example)', () => {
    expect(digitRootSteps(163)).toEqual([163, 10, 1]);
  });

  it('55 -> [55, 10, 1] (matches the "จิดาภา" formula example)', () => {
    expect(digitRootSteps(55)).toEqual([55, 10, 1]);
  });

  it('a single-digit input needs no reduction -> array of length 1', () => {
    expect(digitRootSteps(7)).toEqual([7]);
  });

  it('0 -> [0], no infinite loop', () => {
    expect(digitRootSteps(0)).toEqual([0]);
  });

  it('the last element of digitRootSteps always equals digitRoot() for the same input', () => {
    for (const n of [0, 7, 55, 106, 163, 99, 999]) {
      const steps = digitRootSteps(n);
      expect(steps[steps.length - 1]).toBe(digitRoot(n));
    }
  });
});

describe('sumDigitsOfString — sanity (already exercised indirectly by mode1/mode3 tests)', () => {
  it('sums each character as a digit', () => {
    expect(sumDigitsOfString('163')).toBe(10);
    expect(sumDigitsOfString('059')).toBe(14);
  });
});
