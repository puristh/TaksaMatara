import { describe, expect, it } from 'vitest';
import { PLATE_FORM_DEFAULTS, shouldAutoAdvance, THAI_LETTER_PATTERN } from './PlateForm';

describe('PlateForm — the "วิเคราะห์เลขเดี่ยว" form must be empty on first load, not "1 กข 59"', () => {
  it('all editable field defaults are empty strings (no hardcoded example plate left behind)', () => {
    expect(PLATE_FORM_DEFAULTS.frontDigit).toBe('');
    expect(PLATE_FORM_DEFAULTS.letter1).toBe('');
    expect(PLATE_FORM_DEFAULTS.letter2).toBe('');
    expect(PLATE_FORM_DEFAULTS.tailDigits).toBe('');
    expect(PLATE_FORM_DEFAULTS.province).toBe('');
  });

  it('the empty defaults fail the same validation rules validate() uses internally — confirms nothing can be submitted/computed until the user actually types something, so no Verdict/result can show on first load', () => {
    expect(/^[0-9]$/.test(PLATE_FORM_DEFAULTS.frontDigit)).toBe(false);
    expect(THAI_LETTER_PATTERN.test(PLATE_FORM_DEFAULTS.letter1)).toBe(false);
    expect(THAI_LETTER_PATTERN.test(PLATE_FORM_DEFAULTS.letter2)).toBe(false);
    expect(/^[0-9]{2,4}$/.test(PLATE_FORM_DEFAULTS.tailDigits)).toBe(false);
  });
});

/**
 * เทสต์ pure function ที่ตัดสินใจว่า "ควร auto-advance focus ไปช่องถัดไปหรือยัง" (เลขหน้า ->
 * อักษร 1 -> อักษร 2) — ไม่มี jsdom ให้ mount input จริงแล้วเช็ค document.activeElement ได้
 * จึงเทสที่ตรรกะล้วนๆ ตรงนี้แทน (การเรียก .focus() จริงถูก wire ไว้ใน onChange ของ PlateForm
 * โดยตรง ซึ่งไม่มี unit test ระดับ DOM ให้ในปัจจุบัน)
 */
describe('shouldAutoAdvance — used by เลขหน้า/อักษร 1/อักษร 2 to jump focus to the next field once full', () => {
  it('false while the field is still empty or partially filled', () => {
    expect(shouldAutoAdvance('', 1)).toBe(false);
  });

  it('true once the field reaches maxLength', () => {
    expect(shouldAutoAdvance('8', 1)).toBe(true);
    expect(shouldAutoAdvance('ก', 1)).toBe(true);
  });

  it('generalizes to a maxLength other than 1, in case a future field needs it', () => {
    expect(shouldAutoAdvance('12', 4)).toBe(false);
    expect(shouldAutoAdvance('1234', 4)).toBe(true);
  });
});
