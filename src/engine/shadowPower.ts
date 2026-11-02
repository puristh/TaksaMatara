/**
 * พลังเงา (Mode 7) — ต่อยอดจาก Mode 6 (taksaKalakini.ts) โดยตรง: ใช้ analyzeTaksaKalakini()
 * ตรงๆ แล้วเสริมค่าพลังตัวเลข (STAR_POWER จาก ayatana6.ts/lookupTables.ts) เข้าไปแทนที่จะ
 * บอกแค่ "กาลกิณีหรือไม่" (binary) — ไม่มี logic หาดาว/บทบาทซ้ำจาก Mode 6 เลย
 *
 * หมายเหตุสำคัญ: มีคำกล่าวอ้างจากแหล่งข้อมูลต้นทางว่า "ผลรวมพลังเงาจะสัมพันธ์กับอายตนะ6
 * เสมอ" — เป็นคำกล่าวอ้างที่ยังไม่ได้พิสูจน์ทางคณิตศาสตร์อิสระ ไฟล์นี้ไม่ได้ implement
 * หรือตรวจสอบความสัมพันธ์นั้นเลย (UI ต้องนำเสนอเป็น "ความเชื่อของสำนักนี้" เท่านั้น ไม่ใช่
 * ข้อเท็จจริง — ดู Ayatana6InfoBanner/BirthdayCompatPage.tsx)
 */
import { STAR_POWER } from '../data/lookupTables';
import { analyzeTaksaKalakini } from './taksaKalakini';
import type { PlateInput, TaksaDay, TaksaRole } from './types';

export interface ShadowPowerLetterDetail {
  letter: string;
  star: string;
  role: TaksaRole;
  roleMeaning: string;
  power: number;
  isKalakini: boolean;
}

export interface ShadowPowerResult {
  taksaDay: TaksaDay;
  letters: ShadowPowerLetterDetail[];
  totalPower: number;
}

export function analyzeShadowPower(
  input: Pick<PlateInput, 'thaiLetters'>,
  taksaDay: TaksaDay,
): ShadowPowerResult {
  const taksa = analyzeTaksaKalakini(input, taksaDay);

  const letters: ShadowPowerLetterDetail[] = taksa.letterRoles.map((l) => ({
    letter: l.letter,
    star: l.star,
    role: l.role,
    roleMeaning: l.roleMeaning,
    power: STAR_POWER[l.star],
    isKalakini: l.isKalakini,
  }));

  const totalPower = letters.reduce((sum, l) => sum + l.power, 0);

  return { taksaDay, letters, totalPower };
}
