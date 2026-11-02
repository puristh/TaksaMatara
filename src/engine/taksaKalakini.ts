/**
 * ทักษาปกรณ์/กาลกิณี (Mode 6) — ต้องมีวันเกิดเจ้าของรถ ต่างจากธาตุจีน (Mode 4) และอายตนะ6
 * (Mode 8) ที่ไม่ต้องมี — ศาสตร์สายเดียวกับเลขศาสตร์/ทักษาไทย (Mode 1-3/8) แยกสำนักจาก
 * ธาตุจีน (fiveElement.ts) โดยสิ้นเชิง
 *
 * สูตร:
 * 1. อักษร 2 ตัวบนป้าย -> หาดาวเจ้าของ (reuse lookupLetterStar จาก ayatana6.ts ตรงๆ —
 *    ห้ามประกาศตารางกลุ่มอักษร 8 ดาวซ้ำ)
 * 2. หาบทบาทของดาวนั้นสำหรับวันเกิดที่คำนวณได้ (TAKSA_TABLE)
 * 3. ถ้าบทบาท = "กาลกิณี" -> อักษรนั้น "ควรเลี่ยง" สำหรับเจ้าของคนนี้
 * 4. verdict: มีอักษรใดเป็นกาลกิณี -> "ไม่แนะนำสำหรับวันเกิดนี้", ไม่มีเลย -> "เหมาะกับวันเกิดนี้"
 */
import { lookupLetterStar } from './ayatana6';
import { TAKSA_TABLE, TAKSA_ROLE_MEANING } from '../data/lookupTables';
import type { WeekDay } from './dateOfWeek';
import type { PlateInput, TaksaDay, TaksaRole } from './types';

export type WednesdayPeriod = 'day' | 'night';

const WEEKDAY_TO_TAKSA_DAY: Record<Exclude<WeekDay, 3>, TaksaDay> = {
  0: 'วันอาทิตย์',
  1: 'วันจันทร์',
  2: 'วันอังคาร',
  4: 'วันพฤหัสบดี',
  5: 'วันศุกร์',
  6: 'วันเสาร์',
};

/**
 * แปลง weekDay (จาก getDayOfWeekFromDate) เป็น TaksaDay — วันพุธ (weekDay=3) ต้องระบุ
 * wednesdayPeriod เพิ่มเพราะทักษาแยกกลางวัน/กลางคืนเป็นคนละหน่วยกัน (กาลกิณีคนละดาว)
 * วันอื่นไม่ต้องถามคำถามนี้เลย ส่ง wednesdayPeriod เป็น undefined ได้ตามปกติ
 */
export function resolveTaksaDay(weekDay: WeekDay, wednesdayPeriod?: WednesdayPeriod): TaksaDay {
  if (weekDay === 3) {
    return wednesdayPeriod === 'night' ? 'วันพุธกลางคืน' : 'วันพุธกลางวัน';
  }
  return WEEKDAY_TO_TAKSA_DAY[weekDay];
}

/**
 * reverse-lookup (ดาว -> บทบาท) สำหรับวันเกิดที่กำหนด สร้างจาก TAKSA_TABLE[taksaDay]
 * ตอนเรียกใช้ (แต่ละวันมีแค่ 8 ดาว 8 บทบาทเป็น bijection อยู่แล้วตามตารางต้นฉบับ)
 */
function buildStarToRoleMap(taksaDay: TaksaDay): Record<string, TaksaRole> {
  const roleByStar: Partial<Record<string, TaksaRole>> = {};
  const rolesForDay = TAKSA_TABLE[taksaDay];
  for (const role of Object.keys(rolesForDay) as TaksaRole[]) {
    roleByStar[rolesForDay[role]] = role;
  }
  return roleByStar as Record<string, TaksaRole>;
}

export interface TaksaLetterRole {
  letter: string;
  star: string;
  role: TaksaRole;
  roleMeaning: string;
  isKalakini: boolean;
}

export interface TaksaKalakiniResult {
  taksaDay: TaksaDay;
  letterRoles: TaksaLetterRole[];
  hasKalakini: boolean;
  verdict: string;
}

export function analyzeTaksaKalakini(
  input: Pick<PlateInput, 'thaiLetters'>,
  taksaDay: TaksaDay,
): TaksaKalakiniResult {
  const starToRole = buildStarToRoleMap(taksaDay);

  const letterRoles: TaksaLetterRole[] = input.thaiLetters.map((letter) => {
    const star = lookupLetterStar(letter);
    const role = starToRole[star];
    return {
      letter,
      star,
      role,
      roleMeaning: TAKSA_ROLE_MEANING[role],
      isKalakini: role === 'กาลกิณี',
    };
  });

  const hasKalakini = letterRoles.some((l) => l.isKalakini);

  return {
    taksaDay,
    letterRoles,
    hasKalakini,
    verdict: hasKalakini ? 'ไม่แนะนำสำหรับวันเกิดนี้' : 'เหมาะกับวันเกิดนี้',
  };
}
