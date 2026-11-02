import { describe, expect, it } from 'vitest';
import { analyzePlate } from './analyzePlate';
import { calculateMode1 } from './mode1';
import { calculateMode2 } from './mode2';
import { calculateMode3 } from './mode3';
import { analyzeAyatana6 } from './ayatana6';
import { comparePlates } from './comparePlates';
import {
  formatPlateText,
  frontDigitToField,
  isOptionalFrontDigitField,
  parseOptionalFrontDigit,
  plateNumberDigits,
} from './plateText';
import type { PlateInput } from './types';
import { validatePlateForm, PLATE_FORM_DEFAULTS } from '../components/PlateForm';
import { buildModeCalcLines } from '../components/ModeDetailPanel';
import { buildBirthdayCompatLinkArgs } from '../components/ResultCard';
import { resolvePlateFieldDefaults } from '../components/BirthdayCompatPage';
import {
  isSlotValid,
  MAX_COMPARE_SLOTS,
  resolveInitialSlots,
  toPlateInput,
} from '../components/ComparePage';

/**
 * ทะเบียนหมวดเก่าที่ไม่มีเลขหน้า (frontDigit === null) เช่น "ศร 91" — "ไม่มีเลขหน้า" ต้องไม่ถูก
 * ตีความเป็นเลข 0 ทั้งในข้อความที่แสดงและในค่าที่ส่งต่อ ส่วนผลรวมของ Mode 1/3/อายตนะ6 นั้น
 * "ไม่บวกเลขหน้า" กับ "บวก 0" ให้ตัวเลขเท่ากันโดยคณิตศาสตร์ (และ DIGIT_POWER['0'] = 0) จึงเทส
 * ความต่างเฉพาะจุดที่ต่างกันจริง (รายการตัวเลขบนป้าย, ข้อความทะเบียน, ค่า prefill)
 */
const SORN_91: PlateInput = { frontDigit: null, thaiLetters: ['ศ', 'ร'], tailDigits: '91' };
const ZERO_SORN_91: PlateInput = { frontDigit: 0, thaiLetters: ['ศ', 'ร'], tailDigits: '91' };

describe('"ศร 91" (no front digit) — hand-calculated against the real formulas', () => {
  it('Mode 1: ศ(7) + ร(4) + 9 + 1 = 21 -> MODE1_BAD -> ไม่ควรใช้', () => {
    const m1 = calculateMode1(SORN_91);
    expect(m1.total).toBe(21);
    expect(m1.tier).toBe('bad');
    expect(m1.verdict).toBe(false);
  });

  it('Mode 2: scans tail only -> single pair "91", identical with or without a front digit', () => {
    const m2 = calculateMode2(SORN_91.tailDigits);
    expect(m2.pairsFound).toEqual(['91']);
    expect(m2.dominantPair).toBe('91');
    expect(analyzePlate(SORN_91).mode2).toEqual(analyzePlate({ ...SORN_91, frontDigit: 7 }).mode2);
  });

  it('Mode 3: 9 + 1 = 10 -> digit root 1 -> good', () => {
    const m3 = calculateMode3(SORN_91);
    expect(m3.digitRoot).toBe(1);
    expect(m3.tier).toBe('good');
  });

  it('Ayatana6: 9(108) + 1(6) + ศ/ศุกร์(21) + ร/ราหู(12) = 147 -> 12 -> 3, digit list has no front digit', () => {
    const a = analyzeAyatana6(SORN_91);
    expect(a.digitPowers.map((d) => d.digit)).toEqual(['9', '1']);
    expect(a.rawSum).toBe(147);
    expect(a.digitRootSteps).toEqual([147, 12, 3]);
    expect(a.digitRoot).toBe(3);
  });

  it('analyzePlate runs end to end without crashing and keeps frontDigit null', () => {
    const r = analyzePlate(SORN_91);
    expect(r.input.frontDigit).toBeNull();
    expect(r.mode1.total).toBe(21);
    expect(r.mode3.digitRoot).toBe(1);
  });
});

describe('null front digit vs front digit 0', () => {
  it('plate digits differ: null -> tail only, 0 -> "0" is really on the plate', () => {
    expect(plateNumberDigits(SORN_91)).toEqual(['9', '1']);
    expect(plateNumberDigits(ZERO_SORN_91)).toEqual(['0', '9', '1']);
  });

  it('sums are equal by arithmetic (adding nothing == adding 0), so no score is skewed either way', () => {
    expect(calculateMode1(SORN_91).total).toBe(calculateMode1(ZERO_SORN_91).total);
    expect(calculateMode3(SORN_91).digitRoot).toBe(calculateMode3(ZERO_SORN_91).digitRoot);
    expect(analyzeAyatana6(SORN_91).rawSum).toBe(analyzeAyatana6(ZERO_SORN_91).rawSum);
    expect(analyzeAyatana6(ZERO_SORN_91).digitPowers.map((d) => d.digit)).toEqual(['0', '9', '1']);
  });

  it('front digit 0 still computes exactly as before (0 + ศ + ร + 9 + 1 = 21, root of 0+9+1 = 1)', () => {
    expect(calculateMode1(ZERO_SORN_91).total).toBe(21);
    expect(calculateMode3(ZERO_SORN_91).digitRoot).toBe(1);
  });

  it('a non-zero front digit is still added (1 ศร 91 -> 22 / root 2) — confirms null is not silently dropping real digits', () => {
    const one = { ...SORN_91, frontDigit: 1 };
    expect(calculateMode1(one).total).toBe(22);
    expect(calculateMode3(one).digitRoot).toBe(2);
  });
});

describe('formatPlateText', () => {
  it('no front digit -> "ศร 91" with no undefined/null/leading 0/leading space', () => {
    const text = formatPlateText(SORN_91);
    expect(text).toBe('ศร 91');
    expect(text).not.toMatch(/undefined|null|^0|^\s/);
  });

  it('front digit 0 -> "0 ศร 91", so the two plates never look identical', () => {
    expect(formatPlateText(ZERO_SORN_91)).toBe('0 ศร 91');
    expect(formatPlateText(ZERO_SORN_91)).not.toBe(formatPlateText(SORN_91));
  });
});

describe('field <-> frontDigit conversion (no falsy checks)', () => {
  it('"" <-> null, "0" <-> 0', () => {
    expect(parseOptionalFrontDigit('')).toBeNull();
    expect(parseOptionalFrontDigit('0')).toBe(0);
    expect(frontDigitToField(null)).toBe('');
    expect(frontDigitToField(0)).toBe('0');
  });

  it('isOptionalFrontDigitField accepts empty or one digit only', () => {
    expect(isOptionalFrontDigitField('')).toBe(true);
    expect(isOptionalFrontDigitField('0')).toBe(true);
    expect(isOptionalFrontDigitField('12')).toBe(false);
    expect(isOptionalFrontDigitField('a')).toBe(false);
  });
});

describe('PlateForm validatePlateForm — front digit optional, letters/tail still required', () => {
  const base = { ...PLATE_FORM_DEFAULTS, letter1: 'ศ', letter2: 'ร', tailDigits: '91' };

  it('empty front digit -> no error, frontDigit null', () => {
    const r = validatePlateForm(base);
    expect(r.error).toBeNull();
    expect(r.input?.frontDigit).toBeNull();
  });

  it('front digit "0" -> frontDigit 0, not null', () => {
    expect(validatePlateForm({ ...base, frontDigit: '0' }).input?.frontDigit).toBe(0);
  });

  it('letters and tail are still required', () => {
    expect(validatePlateForm({ ...base, letter2: '' }).error).toBe('หมวดอักษรต้องเป็นพยัญชนะไทย 2 ตัว');
    expect(validatePlateForm({ ...base, tailDigits: '9' }).error).toBe('เลขท้ายต้องเป็นตัวเลข 2-4 หลัก');
  });

  it('pristine empty form still cannot be submitted', () => {
    expect(validatePlateForm(PLATE_FORM_DEFAULTS).input).toBeNull();
  });
});

describe('links out of the single-plate page with a plate that has no front digit', () => {
  it('"เช็คกับวันเกิด →" forwards frontDigit null, and Tab 3 prefills an empty front field (not "0")', () => {
    const [input, ctx] = buildBirthdayCompatLinkArgs(analyzePlate(SORN_91));
    expect(input.frontDigit).toBeNull();
    expect(ctx).toEqual({ returnTo: 'single' });
    expect(resolvePlateFieldDefaults(input)).toEqual({
      frontDigit: '',
      letter1: 'ศ',
      letter2: 'ร',
      tailDigits: '91',
    });
  });

  it('"เปรียบเทียบกับทะเบียนอื่น →" prefills slot A with an empty front field, which is still a valid slot that round-trips to null', () => {
    const slots = resolveInitialSlots(MAX_COMPARE_SLOTS, analyzePlate(SORN_91).input);
    expect(slots[0].frontDigit).toBe('');
    expect(isSlotValid(slots[0])).toBe(true);
    expect(toPlateInput(slots[0]).frontDigit).toBeNull();
  });

  it('comparePlates handles a mix of with/without front digit', () => {
    const results = comparePlates([SORN_91, { ...SORN_91, frontDigit: 1 }]);
    expect(results.map((r) => r.mode1.total)).toEqual([21, 22]);
    expect(results[0].ayatana6?.digitPowers.map((d) => d.digit)).toEqual(['9', '1']);
  });
});

describe('ModeDetailPanel formula lines', () => {
  it('no front digit -> no front term at all', () => {
    const r = analyzePlate(SORN_91);
    expect(buildModeCalcLines(r.input, r.mode1, r.mode3)).toEqual({
      mode1Calc: 'ศ+ร+9+1 = 21',
      mode3Calc: '9+1 = 10 → 1',
    });
  });

  it('front digit 0 keeps its "0" term exactly as before', () => {
    const r = analyzePlate(ZERO_SORN_91);
    expect(buildModeCalcLines(r.input, r.mode1, r.mode3)).toEqual({
      mode1Calc: '0+ศ+ร+9+1 = 21',
      mode3Calc: '0+9+1 = 10 → 1',
    });
  });
});
