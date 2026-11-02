import { DIGIT_ROOT_TABLE, MODE3_NEUTRAL_DIGITS } from '../data/lookupTables';
import { digitRoot, sumDigitsOfString } from './digitSum';
import { plateNumberDigits } from './plateText';
import type { Mode3Result, PlateInput } from './types';

export function calculateMode3(input: Pick<PlateInput, 'frontDigit' | 'tailDigits'>): Mode3Result {
  // step 1: ตัวเลขทุกตัวบนป้าย = frontDigit (ถ้ามี) + แต่ละหลักใน tailDigits (ไม่ใช้ letters)
  const rawSum = sumDigitsOfString(plateNumberDigits(input).join(''));
  // step 2: digit root
  const root = digitRoot(rawSum);
  // step 3: lookup ตาราง 3.4
  const meaning = DIGIT_ROOT_TABLE[root];

  return {
    digitRoot: root,
    meaning,
    tier: MODE3_NEUTRAL_DIGITS.includes(root) ? 'neutral' : 'good',
  };
}

/**
 * ประโยคคำอธิบายเต็มของ Mode 3 โดยใช้ทั้ง 3 คอลัมน์ที่มีอยู่แล้วใน DIGIT_ROOT_TABLE
 * (label, star, person) แทนที่จะโชว์แค่ label เฉยๆ — ใช้ em dash "—" คั่น digitRoot กับ star
 * แทนวงเล็บ เพราะ star ในตารางมีวงเล็บของตัวเองอยู่แล้ว (เช่น "ดาวศุกร์ (ศุกร์)") การครอบวงเล็บ
 * ซ้ำจะทำให้ประโยคดูวงเล็บซ้อนกัน
 */
export function formatMode3Explanation(mode3: Pick<Mode3Result, 'digitRoot' | 'meaning'>): string {
  const { meaning } = mode3;
  return `เลข ${mode3.digitRoot} — ${meaning.star}: ${meaning.label} ผู้ที่เข้ามาเกี่ยวข้องในเชิงสัญลักษณ์มักเป็น ${meaning.person}`;
}
