import type { PlateInput } from './types';

/**
 * เลขหน้า (frontDigit) เป็น null ได้ = ทะเบียนหมวดเก่าที่ไม่มีเลขนำหน้าตัวอักษร (เช่น "ศร 91")
 * ซึ่ง "ไม่มีเลขนั้นอยู่บนป้ายเลย" ไม่ใช่เลข 0 — ทุกจุดต้องเช็คด้วย === null เท่านั้น ห้าม falsy
 * check เด็ดขาด (frontDigit 0 เป็นค่าจริงที่ต้องใช้คำนวณ)
 */

/** ตัวเลขทุกตัวบนป้าย เรียงตามตำแหน่ง: เลขหน้า (ถ้ามี) ตามด้วยเลขท้ายทีละหลัก — แหล่งเดียวที่
 * Mode 1, Mode 3, อายตนะ6 และสูตรใน ModeDetailPanel ใช้ จึงตัดเลขหน้าออกพร้อมกันทุกที่ */
export function plateNumberDigits(input: Pick<PlateInput, 'frontDigit' | 'tailDigits'>): string[] {
  const tail = input.tailDigits.split('');
  return input.frontDigit === null ? tail : [String(input.frontDigit), ...tail];
}

export interface PlateTextParts {
  /** null = ไม่มีเลขหน้า (ไม่ใช่ "0") */
  front: string | null;
  letters: string;
  tail: string;
}

/** แยกทะเบียนเป็นส่วนๆ ในรูปข้อความ — แหล่งเดียวของกติกา null-vs-0 ที่ทั้ง formatPlateText และ
 * ภาพจำลองป้าย (PlateImage) ใช้ร่วมกัน */
export function plateTextParts(
  input: Pick<PlateInput, 'frontDigit' | 'thaiLetters' | 'tailDigits'>,
): PlateTextParts {
  return {
    front: input.frontDigit === null ? null : String(input.frontDigit),
    letters: input.thaiLetters.join(''),
    tail: input.tailDigits,
  };
}

/** ข้อความทะเบียนสำหรับแสดงผล เช่น "1 กข 59" หรือ "ศร 91" (ไม่มีเลขหน้า ไม่มีช่องว่างนำหน้า) */
export function formatPlateText(
  input: Pick<PlateInput, 'frontDigit' | 'thaiLetters' | 'tailDigits'>,
): string {
  const { front, letters, tail } = plateTextParts(input);
  return front === null ? `${letters} ${tail}` : `${front} ${letters} ${tail}`;
}

/** ช่องกรอกเลขหน้าแบบไม่บังคับ: ว่าง = ไม่มีเลขหน้า, ไม่งั้นต้องเป็นเลข 0-9 หนึ่งหลัก */
export function isOptionalFrontDigitField(value: string): boolean {
  return value === '' || /^[0-9]$/.test(value);
}

/** แปลงค่าช่องกรอก (string) เป็น frontDigit — '' -> null, '0' -> 0 */
export function parseOptionalFrontDigit(value: string): number | null {
  return value === '' ? null : Number(value);
}

/** แปลง frontDigit กลับเป็นค่าช่องกรอกตอน prefill — null -> '' (ช่องว่าง), 0 -> '0' */
export function frontDigitToField(frontDigit: number | null): string {
  return frontDigit === null ? '' : String(frontDigit);
}
