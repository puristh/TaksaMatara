import { POPULAR_PAIRS_SEED } from '../data/lookupTables';
import { generateOverlappingPairs } from './mode2';
import type { PopularNumberInfo } from './types';

const WEIGHT_BY_TAIL_LENGTH: Record<number, number> = { 2: 3, 3: 2, 4: 1 };

/**
 * ระบบที่ 2: เลขสวย — เกณฑ์แบบถ่วงน้ำหนัก ไม่ตายตัวเหมือนเลขประมูล (best-effort, seed
 * list ปรับได้ในอนาคต) แยกอิสระจาก detectAuctionNumber โดยสิ้นเชิง weight ใช้แค่
 * แสดงผล/filter เท่านั้น ห้ามเอาไปรวมกับ finalScore ของ ranking engine
 */
export function detectPopularNumber(tailDigits: string): PopularNumberInfo {
  const pairs = generateOverlappingPairs(tailDigits);
  const matchedPairs = pairs.filter((pair) => {
    const n = Number(pair);
    const reversed = Number(pair[1] + pair[0]);
    return POPULAR_PAIRS_SEED.includes(n) || POPULAR_PAIRS_SEED.includes(reversed);
  });

  if (matchedPairs.length === 0) {
    return { isPopular: false, weight: 0, matchedPairs: [] };
  }

  return { isPopular: true, weight: WEIGHT_BY_TAIL_LENGTH[tailDigits.length], matchedPairs };
}
