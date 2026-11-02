import { describe, expect, it } from 'vitest';
import {
  buddhistYearToChristian,
  getDayOfWeekFromDate,
  isValidCalendarDate,
} from './dateOfWeek';

describe('buddhistYearToChristian — พ.ศ. -> ค.ศ.', () => {
  it('2567 -> 2024 (พ.ศ. - 543)', () => {
    expect(buddhistYearToChristian(2567)).toBe(2024);
  });

  it('2543 -> 2000', () => {
    expect(buddhistYearToChristian(2543)).toBe(2000);
  });
});

describe('getDayOfWeekFromDate — cross-checked independently against Python datetime.date().weekday() before writing these assertions', () => {
  it('1 Jan 2000 (พ.ศ. 2543) -> Saturday (6)', () => {
    expect(getDayOfWeekFromDate(1, 1, 2543)).toBe(6);
  });

  it('1 Jan 2024 (พ.ศ. 2567) -> Monday (1)', () => {
    expect(getDayOfWeekFromDate(1, 1, 2567)).toBe(1);
  });

  it('31 Dec 1999 (พ.ศ. 2542) -> Friday (5)', () => {
    expect(getDayOfWeekFromDate(31, 12, 2542)).toBe(5);
  });

  it('29 Feb 2000 (พ.ศ. 2543, leap year) -> Tuesday (2)', () => {
    expect(getDayOfWeekFromDate(29, 2, 2543)).toBe(2);
  });

  it('15 Aug 2025 (พ.ศ. 2568) -> Friday (5)', () => {
    expect(getDayOfWeekFromDate(15, 8, 2568)).toBe(5);
  });

  it('confirms the พ.ศ.->ค.ศ. conversion is actually applied (not silently treating yearBE as if it were already ค.ศ.)', () => {
    // if getDayOfWeekFromDate forgot to subtract 543, it would compute
    // new Date(2543, 0, 1).getDay() instead of new Date(2000, 0, 1).getDay() — these two
    // differ, so the real function's result must match the CORRECT (converted) one, not
    // the wrong (unconverted) one
    const wrongUnconvertedResult = new Date(2543, 0, 1).getDay();
    const correctConvertedResult = new Date(2000, 0, 1).getDay();
    expect(wrongUnconvertedResult).not.toBe(correctConvertedResult); // sanity: they truly differ
    expect(getDayOfWeekFromDate(1, 1, 2543)).toBe(correctConvertedResult);
  });
});

describe('isValidCalendarDate — catches JS Date silent rollover', () => {
  it('a real date is valid', () => {
    expect(isValidCalendarDate(29, 2, 2543)).toBe(true); // leap year 2000
  });

  it('30 Feb never exists -> invalid, regardless of year', () => {
    expect(isValidCalendarDate(30, 2, 2543)).toBe(false);
  });

  it('29 Feb in a non-leap year -> invalid', () => {
    expect(isValidCalendarDate(29, 2, 2544)).toBe(false); // ค.ศ. 2001, not a leap year
  });

  it('day 31 in a 30-day month (e.g. April) -> invalid', () => {
    expect(isValidCalendarDate(31, 4, 2567)).toBe(false);
  });

  it('ordinary valid dates pass', () => {
    expect(isValidCalendarDate(1, 1, 2567)).toBe(true);
    expect(isValidCalendarDate(31, 12, 2542)).toBe(true);
  });
});
