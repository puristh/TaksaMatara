import { describe, expect, it } from 'vitest';
import { PAIR_MEANING_TEXT } from './lookupTables';

describe('PAIR_MEANING_TEXT — coverage of every pair 10-99', () => {
  it('has a defined, non-empty meaning for every two-digit number from 10 to 99', () => {
    const missing: string[] = [];
    for (let n = 10; n <= 99; n++) {
      const key = String(n);
      const meaning = PAIR_MEANING_TEXT[key];
      if (typeof meaning !== 'string' || meaning.length === 0) missing.push(key);
    }
    expect(missing).toEqual([]);
  });

  it('spot-checks a few entries against the source table verbatim', () => {
    expect(PAIR_MEANING_TEXT['59']).toBe('สิ่งศักดิ์สิทธิ์คุ้มครองดีมาก');
    expect(PAIR_MEANING_TEXT['95']).toBe('สิ่งศักดิ์สิทธิ์คุ้มครองดีมาก');
    expect(PAIR_MEANING_TEXT['11']).toBe('ทะเลาะเบาะแว้ง');
    expect(PAIR_MEANING_TEXT['99']).toBe('เลขจักรวาล พลังสูงมาก ทำดีได้ดีเร็ว ทำชั่วได้ชั่วเร็ว');
  });
});
