import { describe, expect, it } from 'vitest';
import {
  buildWinnerSummary,
  createEmptySlots,
  detailInputToSlotFields,
  EMPTY_SLOT_FIELDS,
  isSlotValid,
  MAX_COMPARE_SLOTS,
  resolveInitialSlots,
  shouldAutoAdvance,
  slotLabel,
  toPlateInput,
} from './ComparePage';
import { comparePlates } from '../engine/comparePlates';

describe('ComparePage — MAX_COMPARE_SLOTS (free tier limit, raised for the paid tier later)', () => {
  it('is 2 for now', () => {
    expect(MAX_COMPARE_SLOTS).toBe(2);
  });
});

describe('createEmptySlots — the compare form is array-backed (plateInputs-style state) from day one, not two hardcoded plateA/plateB variables', () => {
  it('creates exactly the requested number of blank slots', () => {
    const slots = createEmptySlots(MAX_COMPARE_SLOTS);
    expect(slots).toHaveLength(MAX_COMPARE_SLOTS);
    expect(
      slots.every(
        (s) => s.frontDigit === '' && s.letter1 === '' && s.letter2 === '' && s.tailDigits === '',
      ),
    ).toBe(true);
  });

  it('generalizes beyond 2 — the future 5/10-slot premium tier only needs MAX_COMPARE_SLOTS raised, no rewrite of this function', () => {
    expect(createEmptySlots(5)).toHaveLength(5);
    expect(createEmptySlots(10)).toHaveLength(10);
  });

  it('returns independent objects — editing one slot must never mutate another (or the shared EMPTY_SLOT_FIELDS constant)', () => {
    const slots = createEmptySlots(2);
    slots[0].frontDigit = '1';
    expect(slots[1].frontDigit).toBe('');
    expect(EMPTY_SLOT_FIELDS.frontDigit).toBe('');
  });
});

describe('detailInputToSlotFields — converts the plate ResultCard.tsx just analyzed into this form\'s field shape', () => {
  it('maps frontDigit/thaiLetters/tailDigits to the string-based CompareSlotFields shape', () => {
    const realInput = { frontDigit: 8, thaiLetters: ['ข', 'ค'] as [string, string], tailDigits: '2683' };
    expect(detailInputToSlotFields(realInput)).toEqual({
      frontDigit: '8',
      letter1: 'ข',
      letter2: 'ค',
      tailDigits: '2683',
    });
  });

  it('frontDigit=0 (a real, valid plate digit) is not confused with an empty/falsy default', () => {
    const realInput = { frontDigit: 0, thaiLetters: ['ก', 'ข'] as [string, string], tailDigits: '00' };
    const resolved = detailInputToSlotFields(realInput);
    expect(resolved.frontDigit).toBe('0');
    expect(resolved.frontDigit).not.toBe('');
  });
});

describe('resolveInitialSlots — entering "เปรียบเทียบทะเบียน" directly from the tab (no prefill) must stay a fully empty 2-slot form, unaffected by this feature', () => {
  it('with no prefillFirstSlot arg -> identical to createEmptySlots(count)', () => {
    expect(resolveInitialSlots(MAX_COMPARE_SLOTS)).toEqual(createEmptySlots(MAX_COMPARE_SLOTS));
  });

  it('with prefillFirstSlot=null -> identical to createEmptySlots(count)', () => {
    expect(resolveInitialSlots(MAX_COMPARE_SLOTS, null)).toEqual(
      createEmptySlots(MAX_COMPARE_SLOTS),
    );
  });
});

describe('resolveInitialSlots — arriving via "เปรียบเทียบกับทะเบียนอื่น →" from ResultCard.tsx: slot 0 (ทะเบียน A) is prefilled, every other slot (ทะเบียน B) stays empty', () => {
  it('fills only index 0 with the converted plate, leaving index 1 untouched/empty', () => {
    const realInput = { frontDigit: 8, thaiLetters: ['ข', 'ค'] as [string, string], tailDigits: '2683' };
    const slots = resolveInitialSlots(MAX_COMPARE_SLOTS, realInput);

    expect(slots).toHaveLength(MAX_COMPARE_SLOTS);
    expect(slots[0]).toEqual({ frontDigit: '8', letter1: 'ข', letter2: 'ค', tailDigits: '2683' });
    expect(slots[1]).toEqual(EMPTY_SLOT_FIELDS);
  });

  it('the prefilled slot 0 is immediately isSlotValid — no need for the user to retype ทะเบียน A', () => {
    const realInput = { frontDigit: 1, thaiLetters: ['ก', 'ข'] as [string, string], tailDigits: '59' };
    const slots = resolveInitialSlots(MAX_COMPARE_SLOTS, realInput);
    expect(isSlotValid(slots[0])).toBe(true);
  });

  it('generalizes beyond 2 slots — a future 5/10-slot premium tier still only prefills index 0', () => {
    const realInput = { frontDigit: 3, thaiLetters: ['ค', 'ง'] as [string, string], tailDigits: '77' };
    const slots = resolveInitialSlots(5, realInput);
    expect(slots).toHaveLength(5);
    expect(slots[0]).toEqual({ frontDigit: '3', letter1: 'ค', letter2: 'ง', tailDigits: '77' });
    for (let i = 1; i < 5; i++) {
      expect(slots[i]).toEqual(EMPTY_SLOT_FIELDS);
    }
  });
});

describe('isSlotValid / toPlateInput', () => {
  it('a pristine (empty) slot is invalid — form must start empty, not with example data', () => {
    expect(isSlotValid({ frontDigit: '', letter1: '', letter2: '', tailDigits: '' })).toBe(false);
  });

  it('a fully filled, well-formed slot is valid and converts to the exact PlateInput shape', () => {
    const fields = { frontDigit: '8', letter1: 'ข', letter2: 'ง', tailDigits: '22' };
    expect(isSlotValid(fields)).toBe(true);
    expect(toPlateInput(fields)).toEqual({
      frontDigit: 8,
      thaiLetters: ['ข', 'ง'],
      tailDigits: '22',
    });
  });

  it('rejects a non-Thai-letter character in either letter field', () => {
    expect(isSlotValid({ frontDigit: '8', letter1: 'a', letter2: 'ง', tailDigits: '22' })).toBe(
      false,
    );
    expect(isSlotValid({ frontDigit: '8', letter1: 'ข', letter2: '1', tailDigits: '22' })).toBe(
      false,
    );
  });

  it('rejects tailDigits shorter than 2 or longer than 4', () => {
    expect(isSlotValid({ frontDigit: '8', letter1: 'ข', letter2: 'ง', tailDigits: '1' })).toBe(
      false,
    );
    expect(isSlotValid({ frontDigit: '8', letter1: 'ข', letter2: 'ง', tailDigits: '12345' })).toBe(
      false,
    );
  });
});

describe('slotLabel', () => {
  it('labels slots A, B, C, ... by index — supports up to 26 future premium-tier slots, well beyond the planned max of 10', () => {
    expect(slotLabel(0)).toBe('ทะเบียน A');
    expect(slotLabel(1)).toBe('ทะเบียน B');
    expect(slotLabel(2)).toBe('ทะเบียน C');
  });
});

describe('buildWinnerSummary', () => {
  const front = 8;

  it('names the clean plate (ทะเบียน B) as winner over a bad-pair plate (ทะเบียน A), citing the bad-pair reason', () => {
    const letters: [string, string] = ['ข', 'ง'];
    const results = comparePlates([
      { frontDigit: front, thaiLetters: letters, tailDigits: '02' }, // hasBadPair=true
      { frontDigit: front, thaiLetters: letters, tailDigits: '22' }, // hasBadPair=false, wins
    ]);
    const summary = buildWinnerSummary(results);
    expect(summary).toContain('ทะเบียน B');
    expect(summary).toContain('คู่เสีย');
  });

  it('reports a tie when both plates rank equally', () => {
    const letters: [string, string] = ['ข', 'ง'];
    const results = comparePlates([
      { frontDigit: front, thaiLetters: letters, tailDigits: '22' },
      { frontDigit: front, thaiLetters: letters, tailDigits: '22' },
    ]);
    expect(buildWinnerSummary(results)).toContain('เสมอกัน');
  });

  it('cites finalScore as the reason when neither hasBadPair nor mode1=bad separates two clean plates', () => {
    const letters: [string, string] = ['ข', 'ค'];
    const results = comparePlates([
      { frontDigit: front, thaiLetters: letters, tailDigits: '36' },
      { frontDigit: front, thaiLetters: letters, tailDigits: '45' }, // wins on finalScore alone
    ]);
    const summary = buildWinnerSummary(results);
    expect(summary).toContain('ทะเบียน B');
    expect(summary).toContain('คะแนนรวม');
  });

  it('cites the mode1=bad reason when one plate is mode1=bad and the other is not', () => {
    const letters: [string, string] = ['ข', 'ค'];
    const results = comparePlates([
      { frontDigit: front, thaiLetters: letters, tailDigits: '88' }, // mode1=bad
      { frontDigit: front, thaiLetters: letters, tailDigits: '45' },
    ]);
    const summary = buildWinnerSummary(results);
    expect(summary).toContain('ทะเบียน B');
    expect(summary).toContain('ไม่ควรใช้');
  });

  it('returns the all-tied message when every slot shares the same rank', () => {
    const letters: [string, string] = ['ข', 'ง'];
    const results = comparePlates([
      { frontDigit: front, thaiLetters: letters, tailDigits: '22' },
      { frontDigit: front, thaiLetters: letters, tailDigits: '22' },
      { frontDigit: front, thaiLetters: letters, tailDigits: '22' },
    ]);
    expect(buildWinnerSummary(results)).toContain('ทุกทะเบียนเสมอกัน');
  });
});

/**
 * เทสต์ pure function ที่ตัดสินใจว่า "ควร auto-advance focus ไปช่องถัดไปหรือยัง" — ใช้เกณฑ์
 * เดียวกับ PlateForm.tsx (ดู shouldAutoAdvance ที่นั่น) ไม่มี jsdom ให้เทสระดับ DOM/focus จริง
 * ในหน้านี้ จึงเทสที่ตรรกะล้วนๆ เหมือนกัน
 */
describe('shouldAutoAdvance — used by เลขหน้า/อักษร 1/อักษร 2 in every compare slot to jump focus to the next field once full', () => {
  it('false while the field is still empty or partially filled', () => {
    expect(shouldAutoAdvance('', 1)).toBe(false);
  });

  it('true once the field reaches maxLength', () => {
    expect(shouldAutoAdvance('8', 1)).toBe(true);
    expect(shouldAutoAdvance('ก', 1)).toBe(true);
  });
});
