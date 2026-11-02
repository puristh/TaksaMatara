import { describe, expect, it } from 'vitest';
import { calculateMode3, formatMode3Explanation } from './mode3';

describe('calculateMode3 — brief section 10 worked examples', () => {
  it('1 กข 2345 -> 1+2+3+4+5=15 -> 1+5=6 -> good (brief section 4 example)', () => {
    const result = calculateMode3({ frontDigit: 1, tailDigits: '2345' });
    expect(result.digitRoot).toBe(6);
    expect(result.tier).toBe('good');
  });

  it('1 กข 59 -> 1+5+9=15 -> 1+5=6 -> good', () => {
    const result = calculateMode3({ frontDigit: 1, tailDigits: '59' });
    expect(result.digitRoot).toBe(6);
    expect(result.tier).toBe('good');
  });

  it('2 กก 21 -> 2+2+1=5 -> good (letters are NOT used in Mode 3)', () => {
    const result = calculateMode3({ frontDigit: 2, tailDigits: '21' });
    expect(result.digitRoot).toBe(5);
    expect(result.tier).toBe('good');
  });

  it('digit roots 0, 3, 7 are neutral (not "good")', () => {
    // frontDigit 0 + tail "30" -> 0+3+0=3 -> neutral
    expect(calculateMode3({ frontDigit: 0, tailDigits: '30' }).tier).toBe('neutral');
    // frontDigit 0 + tail "70" -> 7 -> neutral
    expect(calculateMode3({ frontDigit: 0, tailDigits: '70' }).tier).toBe('neutral');
    // frontDigit 0 + tail "00" -> 0 -> neutral
    expect(calculateMode3({ frontDigit: 0, tailDigits: '00' }).tier).toBe('neutral');
  });
});

describe('formatMode3Explanation — uses all 3 DIGIT_ROOT_TABLE columns (label, star, person)', () => {
  it('digit root 6 -> sentence includes digitRoot, star, label, and person from the table verbatim', () => {
    const result = calculateMode3({ frontDigit: 1, tailDigits: '59' }); // digitRoot 6
    const sentence = formatMode3Explanation(result);
    expect(sentence).toBe(
      'เลข 6 — ดาวศุกร์ (ศุกร์): โชคลาภ ความสุข ความรัก ผู้ที่เข้ามาเกี่ยวข้องในเชิงสัญลักษณ์มักเป็น คนเจ้าเสน่ห์/ผู้อุปถัมภ์',
    );
  });

  it('every digit root 0-9 produces a non-empty sentence containing the digit root number', () => {
    for (let root = 0; root <= 9; root++) {
      const sentence = formatMode3Explanation({
        digitRoot: root,
        meaning: { label: 'x', star: 'y', person: 'z' },
      });
      expect(sentence).toContain(`เลข ${root}`);
      expect(sentence).toContain('ผู้ที่เข้ามาเกี่ยวข้องในเชิงสัญลักษณ์มักเป็น');
    }
  });
});
