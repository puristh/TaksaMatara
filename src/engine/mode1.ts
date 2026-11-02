import {
  MODE1_EXCELLENT,
  MODE1_GOOD,
  MODE1_BAD,
  MODE1_TIER_EXPLANATION,
  isMode1BadByZeroRule,
  lookupTier,
} from '../data/lookupTables';
import { lookupLetterNumber } from './letterConversion';
import { sumDigitsOfString } from './digitSum';
import { plateNumberDigits } from './plateText';
import type { Mode1Result, Mode1Tier, PlateInput } from './types';

/**
 * ตัดสิน tier ของผลรวม (แยกเป็นฟังก์ชัน pure ต่างหากจาก calculateMode1 เพื่อให้ทดสอบ
 * boundary total<=65 vs fallback ได้โดยตรง โดยไม่ต้องประกอบ plate จริง — total ที่มาจาก
 * plate จริงตาม input schema ปัจจุบัน (frontDigit 0-9, 2 letters, tail 2-4 หลัก) มีค่าสูงสุด
 * ที่เป็นไปได้คือ 63 ซึ่งไม่มีทางแตะช่วง fallback 66-99 ได้เลย — แต่ยังคง implement
 * fallback ไว้ตามข้อ 9 ของ brief เผื่อ input schema เปลี่ยนในอนาคต)
 *
 * priority: เช็ค MODE1_EXCELLENT / MODE1_GOOD / MODE1_BAD ก่อนเสมอ ไม่ว่า total จะอยู่
 * ในช่วง 1-65 หรือเกิน 65 — เดิมโค้ดเช็ค explicit list เฉพาะตอน total<=65 เท่านั้น ทำให้
 * ค่าที่เพิ่มเข้าไปใหม่ในช่วง 66-99 (เช่น 72, 73, 94 จากการ cross-reference เพิ่มเติม)
 * ไม่มีผลอะไรเลยเพราะโค้ด fallback ไปตาราง Tier ของ Mode 2 ทันทีโดยไม่เคยดู list พวกนี้ก่อน
 * — แก้ให้เช็ค explicit list ก่อนเต็มโดเมน แล้วค่อยแยก branch ตามช่วงสำหรับ zero-rule/fallback
 * ต่อ (ระหว่าง 1-65 ยังคงเช็ค zero-rule ก่อน fallback เหมือนเดิม, เกิน 65 fallback ตรงๆ
 * เหมือนเดิม — ไม่เปลี่ยนพฤติกรรมของช่องโหว่ที่ยังไม่มีข้อมูลเลย)
 */
export function getMode1TierFromTotal(total: number): {
  tier: Mode1Tier;
  usedFallback: boolean;
} {
  if (MODE1_EXCELLENT.includes(total)) return { tier: 'excellent', usedFallback: false };
  if (MODE1_GOOD.includes(total)) return { tier: 'good', usedFallback: false };
  if (MODE1_BAD.includes(total)) return { tier: 'bad', usedFallback: false };

  if (total <= 65) {
    if (isMode1BadByZeroRule(total)) return { tier: 'bad', usedFallback: false };
    // Assumption: ค่า 1-65 บางตัวไม่ปรากฏใน excellent/good/bad list เลย และไม่เข้ากฎเลข 0
    // — เป็นช่องโหว่ที่ brief ไม่ได้ระบุวิธีจัดการตรงๆ เนื่องจาก bad_rule ของ Mode1 ระบุไว้ว่า
    // bad list "ตรงกับตาราง Tier 10-99 เดิมด้วย" (แปลว่าตาราง 3.3 กับ 3.2 ตั้งใจให้สอดคล้องกัน)
    // จึงเลือก fallback ไปใช้ตาราง tier 10-99 (ข้อ 3.2) แบบเดียวกับ range_66_99_fallback
    // สำหรับช่องโหว่ในช่วง 1-65 ด้วย แทนที่จะเดาเป็น bad เหมารวม
    return applyTierTableFallback(total);
  }

  // range_66_99_fallback: fallback ไปใช้ตาราง tier 10-99 (ข้อ 3.2) สำหรับค่าที่ยังไม่มี
  // ข้อมูลตรงในลิสต์ explicit เลย
  return applyTierTableFallback(total);
}

function applyTierTableFallback(total: number): { tier: Mode1Tier; usedFallback: boolean } {
  // tier1/tier2/tier2_5 -> good, tier3 -> "medium" (map เป็น 'good' เพราะ Mode1Tier
  // มีแค่ excellent/good/bad และ "medium" ไม่ใช่ bad จึงยังนับเป็น verdict ใช้ได้), tier4 -> bad
  const fallback = lookupTier(String(total));
  if (!fallback) {
    // ไม่พบใน tier table เลย (เช่น total > 99 ซึ่งเกินขอบเขตตาราง) — fail-safe เป็น bad
    return { tier: 'bad', usedFallback: true };
  }
  if (fallback.tier === 'tier1' || fallback.tier === 'tier2' || fallback.tier === 'tier2_5') {
    return { tier: 'good', usedFallback: true };
  }
  if (fallback.tier === 'tier3') {
    return { tier: 'good', usedFallback: true }; // "medium" -> ไม่ใช่ bad
  }
  return { tier: 'bad', usedFallback: true }; // tier4
}

/**
 * คำอธิบายระดับ tier ของ Mode 1 สำหรับ detail panel — ใช้ fallback_66_99 เฉพาะกรณีที่
 * total ใช้ fallback ไปตาราง Tier ของ Mode 2 จริงๆ (usedFallback) ไม่งั้นใช้ข้อความตาม tier ปกติ
 */
export function getMode1Explanation(result: Pick<Mode1Result, 'tier' | 'usedFallback'>): string {
  if (result.usedFallback) return MODE1_TIER_EXPLANATION.fallback_66_99;
  return MODE1_TIER_EXPLANATION[result.tier];
}

export function calculateMode1(input: PlateInput): Mode1Result {
  const letterVal1 = lookupLetterNumber(input.thaiLetters[0]);
  const letterVal2 = lookupLetterNumber(input.thaiLetters[1]);
  // ตัวเลขบนป้าย = เลขหน้า (ถ้ามี) + เลขท้าย — ไม่มีเลขหน้าก็ไม่บวก (ไม่ใช่บวก 0)
  const plateDigitSum = sumDigitsOfString(plateNumberDigits(input).join(''));
  const total = letterVal1 + letterVal2 + plateDigitSum;

  const { tier, usedFallback } = getMode1TierFromTotal(total);

  return {
    total,
    tier,
    verdict: tier !== 'bad',
    usedFallback,
  };
}
