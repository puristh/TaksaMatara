import { describe, expect, it } from 'vitest';
import { FONT_SCALE_LEVELS, readInitialFontScale } from './useFontScale';

/**
 * vitest ในโปรเจกต์นี้รันด้วย environment: 'node' (ไม่มี jsdom/testing-library ติดตั้งไว้ —
 * ดู vite.config.ts) จึงไม่มี `window`/`document` จริงให้ใช้ ต้อง stub `globalThis.window`
 * ชั่วคราวเองเพื่อให้ readInitialFontScale() เดินเข้า branch อ่าน localStorage จริงๆ
 * (ถ้าไม่ stub, `typeof window === 'undefined'` guard จะ short-circuit คืน 'normal' ทันที
 * โดยไม่ทดสอบ logic การ migrate ค่าเก่าเลย)
 */
function withStoredValue<T>(value: string | null, fn: () => T): T {
  const store: Record<string, string> = {};
  if (value !== null) store.fontScale = value;

  const mockLocalStorage = {
    getItem: (key: string) => (key in store ? store[key] : null),
  };

  const originalWindow = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = { localStorage: mockLocalStorage };
  try {
    return fn();
  } finally {
    if (originalWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
  }
}

describe('FONT_SCALE_LEVELS — ordering and content after the round-2 level revamp', () => {
  it('is ordered ascending 100% -> 175%, "เล็ก"/87.5%/"small" no longer exists', () => {
    expect(FONT_SCALE_LEVELS.map((l) => l.key)).toEqual([
      'normal',
      'large',
      'xlarge',
      'xxlarge',
      'xxxlarge',
    ]);
    expect(FONT_SCALE_LEVELS.map((l) => l.percent)).toEqual([100, 112.5, 125, 150, 175]);
    // เทียบผ่าน .map(...).includes(...) แทน .some((l) => l.key === 'small') ตรงๆ เพราะ
    // TS type ของ .key แคบลงจนไม่มี 'small' เหลืออยู่แล้ว (ตัดออกไปแล้วจริงๆ) ทำให้เทียบ
    // literal ตรงๆ เป็น type error — .includes() บน array ผลลัพธ์ที่ widen เป็น string[]
    // แล้วยืนยัน runtime behavior แบบเดียวกันได้โดยไม่ชนกับ type check
    const keys: string[] = FONT_SCALE_LEVELS.map((l) => l.key);
    const percents: number[] = FONT_SCALE_LEVELS.map((l) => l.percent);
    expect(keys.includes('small')).toBe(false);
    expect(percents.includes(87.5)).toBe(false);
  });

  it('100% (normal) is the first/default level, mapped to 16px', () => {
    expect(FONT_SCALE_LEVELS[0]).toMatchObject({ key: 'normal', percent: 100, px: 16 });
  });

  it('150% and 175% were added after 125%, mapped to 24px and 28px', () => {
    expect(FONT_SCALE_LEVELS[3]).toMatchObject({ key: 'xxlarge', percent: 150, px: 24 });
    expect(FONT_SCALE_LEVELS[4]).toMatchObject({ key: 'xxxlarge', percent: 175, px: 28 });
  });

  it('175% (xxxlarge) is the new maximum level (last in the array)', () => {
    const last = FONT_SCALE_LEVELS[FONT_SCALE_LEVELS.length - 1];
    expect(last.key).toBe('xxxlarge');
    expect(last.percent).toBe(175);
  });
});

describe('readInitialFontScale — migration safety for stale localStorage values', () => {
  it('no stored value at all -> normal (default)', () => {
    expect(withStoredValue(null, () => readInitialFontScale())).toBe('normal');
  });

  it('a currently-valid stored key is read back as-is', () => {
    expect(withStoredValue('xlarge', () => readInitialFontScale())).toBe('xlarge');
    expect(withStoredValue('xxxlarge', () => readInitialFontScale())).toBe('xxxlarge');
  });

  it('legacy key "small" (the removed 87.5% level from round 1) -> falls back to normal, no throw', () => {
    expect(() => withStoredValue('small', () => readInitialFontScale())).not.toThrow();
    expect(withStoredValue('small', () => readInitialFontScale())).toBe('normal');
  });

  it('legacy value "87.5" (as literally named in the task request) -> falls back to normal, no throw', () => {
    expect(() => withStoredValue('87.5', () => readInitialFontScale())).not.toThrow();
    expect(withStoredValue('87.5', () => readInitialFontScale())).toBe('normal');
  });

  it('any other unrecognized string -> falls back to normal, no throw and never gets stuck', () => {
    expect(withStoredValue('not-a-real-level', () => readInitialFontScale())).toBe('normal');
  });
});
