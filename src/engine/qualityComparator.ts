import { DEFAULT_RANKING_STRATEGY } from './types';
import type { RankingStrategy } from './types';

/**
 * Comparator กลาง "ใครดีกว่า" — reuse ระหว่าง Batch ranking (generateTopCandidates ใน
 * ranking.ts) และหน้าเปรียบเทียบทะเบียน (comparePlates.ts) เก็บเฉพาะชั้นที่ทั้งสองบริบท
 * ใช้ร่วมกันจริง (ชั้นเลขโปรดเป็นของ Batch ranking เท่านั้น — อยู่ใน ranking.ts)
 *
 * strategy = 'market-first' (ค่าเริ่มต้น — ตลาดนำ):
 * 1. finalScore descending
 * 2. tailDigits ตัวเลขจากน้อยไปมาก (tie-break สุดท้าย)
 *
 * strategy = 'strict' (โหมดคัดเข้ม — ลำดับเดิม):
 * 1. hasBadPair (mode2.tier === 'tier4') -> false มาก่อน true เสมอ
 * 2. finalScore descending (ภายในกลุ่ม hasBadPair เดียวกัน)
 * 3. tailDigits ตัวเลขจากน้อยไปมาก
 *
 * ถ้าต้องปรับลำดับอีก แก้ที่นี่จุดเดียว มีผลทั้ง Batch ranking และหน้าเปรียบเทียบทะเบียน
 */
export interface QualityScored {
  tailDigits: string;
  finalScore: number;
  hasBadPair: boolean;
}

/** true เมื่อ strategy นี้ใช้ hasBadPair เป็นชั้นตัดสินก่อนคะแนน (ใช้ร่วมกับการนับอันดับเสมอใน comparePlates) */
export function badPairFirst(strategy: RankingStrategy): boolean {
  return strategy === 'strict';
}

export function compareByQuality(
  a: QualityScored,
  b: QualityScored,
  strategy: RankingStrategy = DEFAULT_RANKING_STRATEGY,
): number {
  if (badPairFirst(strategy) && a.hasBadPair !== b.hasBadPair) return a.hasBadPair ? 1 : -1;
  if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
  return Number(a.tailDigits) - Number(b.tailDigits);
}
