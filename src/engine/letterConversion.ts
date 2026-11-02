import { LETTER_NUMBER_TABLE } from '../data/lookupTables';

/**
 * สร้าง reverse-lookup map (พยัญชนะ -> เลข) จากตาราง 3.1 ตอน init
 * ตามที่ brief กำชับ: "ไม่ต้อง hardcode รายอักษร"
 */
function buildReverseLetterMap(): Map<string, number> {
  const map = new Map<string, number>();
  for (const [numStr, letters] of Object.entries(LETTER_NUMBER_TABLE)) {
    const num = Number(numStr);
    for (const letter of letters) {
      map.set(letter, num);
    }
  }
  return map;
}

const REVERSE_LETTER_MAP = buildReverseLetterMap();

export function lookupLetterNumber(letter: string): number {
  const value = REVERSE_LETTER_MAP.get(letter);
  if (value === undefined) {
    throw new Error(`ไม่พบตัวอักษร "${letter}" ในตารางแปลงอักษรเป็นตัวเลข (ข้อ 3.1)`);
  }
  return value;
}
