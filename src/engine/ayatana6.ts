/**
 * อายตนะ6 — ศาสตร์สายเดียวกับเลขศาสตร์/ทักษาไทยที่ Mode 1-3 ใช้อยู่แล้ว (ไม่ใช่คนละสำนัก
 * ความเชื่อแบบธาตุจีนใน fiveElement.ts) ไม่ต้องใช้วันเกิดเจ้าของ ทำงานจากป้ายทะเบียนอย่างเดียว
 *
 * สูตร:
 * 1. เลขหน้า + เลขท้ายแต่ละหลัก -> แปลงเป็นค่าพลังตาม DIGIT_POWER
 * 2. อักษร 2 ตัว -> หาดาวเจ้าของ (STAR_LETTERS) -> แปลงเป็นค่าพลังตาม STAR_POWER
 * 3. รวมทุกค่า (ตัวเลขทั้งหมด + อักษรทั้ง 2 ตัว) เข้าด้วยกัน
 * 4. บวกเลขซ้ำ (digit root) จนเหลือหลักเดียว — reuse digitRoot() จาก digitSum.ts ตรงๆ
 *    (ฟังก์ชันเดียวกับที่ Mode 1/3 ใช้อยู่แล้ว ไม่เขียน logic บวกเลขซ้ำใหม่)
 * 5. Lookup ความหมายจาก AYATANA6_MEANING
 *
 * ในทางปฏิบัติผลรวมจาก step 3 ไม่มีทางเป็น 0 ได้เลย (อักษร 2 ตัวรวมกันมีค่าพลังขั้นต่ำ
 * 6+6=12 อยู่แล้วจากดาวอาทิตย์ซึ่งเป็นค่าต่ำสุดในตาราง) digitRoot() จึงคืนค่า 1-9 เสมอ
 * ตรงตามที่สูตรต้องการ แม้ digitRoot() เองจะรองรับ 0 ได้ในทางทฤษฎีก็ตาม
 */
import { STAR_LETTERS, STAR_POWER, DIGIT_POWER, AYATANA6_MEANING } from '../data/lookupTables';
import { plateNumberDigits } from './plateText';
import { digitRootSteps } from './digitSum';
import type { PlateInput } from './types';

/** สร้าง reverse-lookup (พยัญชนะ -> ดาวเจ้าของ) จาก STAR_LETTERS ตอน init เหมือน
 * buildReverseLetterMap ใน letterConversion.ts */
function buildReverseStarMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const [star, letters] of Object.entries(STAR_LETTERS)) {
    for (const letter of letters) {
      map.set(letter, star);
    }
  }
  return map;
}

const REVERSE_STAR_MAP = buildReverseStarMap();

export function lookupLetterStar(letter: string): string {
  const star = REVERSE_STAR_MAP.get(letter);
  if (star === undefined) {
    throw new Error(`ไม่พบตัวอักษร "${letter}" ในตารางกลุ่มอักษร 8 ดาวของอายตนะ6`);
  }
  return star;
}

export interface Ayatana6DigitPower {
  digit: string;
  power: number;
}

export interface Ayatana6LetterPower {
  letter: string;
  star: string;
  power: number;
}

export interface Ayatana6Result {
  digitPowers: Ayatana6DigitPower[];
  letterPowers: Ayatana6LetterPower[];
  rawSum: number;
  /** ลำดับขั้นตอนการบวกเลขซ้ำ เช่น [163, 10, 1] — steps[steps.length-1] คือ digitRoot */
  digitRootSteps: number[];
  digitRoot: number;
  meaning: string;
}

export function analyzeAyatana6(
  input: Pick<PlateInput, 'frontDigit' | 'thaiLetters' | 'tailDigits'>,
): Ayatana6Result {
  const digitChars = plateNumberDigits(input);
  const digitPowers: Ayatana6DigitPower[] = digitChars.map((digit) => ({
    digit,
    power: DIGIT_POWER[digit],
  }));

  const letterPowers: Ayatana6LetterPower[] = input.thaiLetters.map((letter) => {
    const star = lookupLetterStar(letter);
    return { letter, star, power: STAR_POWER[star] };
  });

  const rawSum =
    digitPowers.reduce((sum, d) => sum + d.power, 0) +
    letterPowers.reduce((sum, l) => sum + l.power, 0);

  const steps = digitRootSteps(rawSum);
  const root = steps[steps.length - 1];

  return {
    digitPowers,
    letterPowers,
    rawSum,
    digitRootSteps: steps,
    digitRoot: root,
    meaning: AYATANA6_MEANING[root],
  };
}
