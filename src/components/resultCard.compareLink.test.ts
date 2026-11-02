import { describe, expect, it } from 'vitest';
import { analyzePlate } from '../engine';
import { detailInputToSlotFields, EMPTY_SLOT_FIELDS, MAX_COMPARE_SLOTS, resolveInitialSlots } from './ComparePage';

/**
 * เทสต์ data contract ของปุ่ม "เปรียบเทียบกับทะเบียนอื่น →" ในหน้าวิเคราะห์เลขเดี่ยว
 * (ResultCard.tsx) — ปุ่มนั้นเรียก onViewCompare(input) โดย input คือ result.input ตรงๆ ที่มา
 * จาก analyzePlate() (ดู ResultCard.tsx) ซึ่ง App.tsx (handleViewCompare) ส่งต่อให้ ComparePage
 * เป็น initialFirstSlot ตรงนี้จำลอง flow เต็มโดยไม่ต้อง render component จริง (ไม่มี jsdom ใน
 * โปรเจกต์นี้ — ดู pattern เดียวกันใน ranking.birthdayCompatLink.test.ts)
 */
describe('ResultCard.tsx "เปรียบเทียบกับทะเบียนอื่น →" -> App.tsx handleViewCompare -> ComparePage.initialFirstSlot', () => {
  it('the plate ResultCard just analyzed lands exactly in slot 0 (ทะเบียน A), with ทะเบียน B left empty', () => {
    const submittedInput = { frontDigit: 8, thaiLetters: ['ข', 'ค'] as [string, string], tailDigits: '2683' };
    const result = analyzePlate(submittedInput);

    // exactly what ResultCard.tsx's button click does: onViewCompare(result.input)
    const forwardedInput = result.input;
    expect(forwardedInput).toEqual(submittedInput);

    // exactly what ComparePage does on mount with that value as initialFirstSlot
    const slots = resolveInitialSlots(MAX_COMPARE_SLOTS, forwardedInput);

    expect(slots[0]).toEqual(detailInputToSlotFields(submittedInput));
    expect(slots[0]).toEqual({ frontDigit: '8', letter1: 'ข', letter2: 'ค', tailDigits: '2683' });
    expect(slots[1]).toEqual(EMPTY_SLOT_FIELDS);
  });

  it('never mixes up two different analyzed plates — clicking the link on card N forwards card N\'s own input, not another card\'s', () => {
    const inputA = { frontDigit: 1, thaiLetters: ['ก', 'ข'] as [string, string], tailDigits: '11' };
    const inputB = { frontDigit: 9, thaiLetters: ['ฮ', 'ฬ'] as [string, string], tailDigits: '99' };

    const resultA = analyzePlate(inputA);
    const resultB = analyzePlate(inputB);

    const slotsFromA = resolveInitialSlots(MAX_COMPARE_SLOTS, resultA.input);
    const slotsFromB = resolveInitialSlots(MAX_COMPARE_SLOTS, resultB.input);

    expect(slotsFromA[0]).toEqual({ frontDigit: '1', letter1: 'ก', letter2: 'ข', tailDigits: '11' });
    expect(slotsFromB[0]).toEqual({ frontDigit: '9', letter1: 'ฮ', letter2: 'ฬ', tailDigits: '99' });
  });

  it('entering the Compare tab directly (no ResultCard link involved) must still yield a fully empty form — this feature must not regress that path', () => {
    const slots = resolveInitialSlots(MAX_COMPARE_SLOTS, null);
    expect(slots[0]).toEqual(EMPTY_SLOT_FIELDS);
    expect(slots[1]).toEqual(EMPTY_SLOT_FIELDS);
  });
});
