/**
 * Comparator กลาง "ใครดีกว่า" — reuse ระหว่าง Batch ranking (generateTopCandidates ใน
 * ranking.ts) และหน้าเปรียบเทียบทะเบียน (comparePlates.ts) เก็บเฉพาะ 3 ชั้นที่ทั้งสองบริบท
 * ใช้ร่วมกันจริง (ตัดข้อ 2 favoriteMatchScore ออก เพราะเป็น layer เฉพาะของ Batch ranking
 * เท่านั้น — ไม่เกี่ยวกับหน้าเปรียบเทียบทะเบียนเลย):
 *
 * 1. hasBadPair (mode2.tier === 'tier4', "คู่เสีย") -> false มาก่อน true เสมอ
 * 2. finalScore descending (tie-break ภายในกลุ่ม hasBadPair เดียวกัน)
 * 3. tailDigits ตัวเลขจากน้อยไปมาก (tie-break สุดท้าย)
 *
 * ถ้าในอนาคตต้องปรับ priority ของ hasBadPair/finalScore อีก แก้ที่นี่จุดเดียว มีผลทั้ง
 * Batch ranking และหน้าเปรียบเทียบทะเบียนโดยอัตโนมัติ ไม่ต้องแก้ 2 ที่แบบที่เคยเกิดปัญหา
 * ซ้ำมาหลายรอบก่อนหน้านี้
 */
export interface QualityScored {
  tailDigits: string;
  finalScore: number;
  hasBadPair: boolean;
}

export function compareByQuality(a: QualityScored, b: QualityScored): number {
  if (a.hasBadPair !== b.hasBadPair) return a.hasBadPair ? 1 : -1;
  if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
  return Number(a.tailDigits) - Number(b.tailDigits);
}
