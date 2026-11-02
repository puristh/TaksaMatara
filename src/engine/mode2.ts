import { lookupTier, PAIR_MEANING_TEXT } from '../data/lookupTables';
import type { Mode2Result, PairDetail, TierKey } from './types';

/** fail-safe เผื่อคู่ที่ไม่มีข้อมูลใน PAIR_MEANING_TEXT (เช่น "00" ซึ่งอยู่นอกช่วง 10-99 ที่ตารางครอบคลุม) */
const FALLBACK_PAIR_MEANING = 'ไม่มีข้อมูลความหมายเฉพาะสำหรับคู่นี้ในตารางต้นฉบับ';

/** อันดับความดี มากไปน้อย ใช้เลือก "tier ที่ดีที่สุดที่เจอ" เมื่อไม่มี tier4 ปน */
const TIER_RANK: Record<Exclude<TierKey, 'tier4'>, number> = {
  tier1: 4,
  tier2: 3,
  tier2_5: 2,
  tier3: 1,
};

/** step 1: generate ทุกคู่ตัวเลขที่ทับซ้อนกันใน tailDigits เช่น "2145" -> ["21","14","45"] */
export function generateOverlappingPairs(tailDigits: string): string[] {
  const pairs: string[] = [];
  for (let i = 0; i < tailDigits.length - 1; i++) {
    pairs.push(tailDigits.slice(i, i + 2));
  }
  return pairs;
}

export function calculateMode2(tailDigits: string): Mode2Result {
  const pairsFound = generateOverlappingPairs(tailDigits);
  const lastIndex = pairsFound.length - 1;

  const pairDetails: PairDetail[] = pairsFound.map((pair, i) => {
    // lookupTier ทำ bidirectional lookup (เช็คทั้ง XY, YX) อยู่แล้วในตัวมันเอง
    const result = lookupTier(pair);
    // ไม่ควรเกิดขึ้นจริงเพราะ tier table + zero-rule ครอบคลุมทุกค่า 2 หลักแล้ว
    // แต่ fail-safe เป็น tier4 เผื่อ pair แปลกๆ ที่หลุดตาราง
    return {
      pair,
      tier: result?.tier ?? 'tier4',
      meaning: PAIR_MEANING_TEXT[pair] ?? FALLBACK_PAIR_MEANING,
      // เช็คด้วย index ล้วนๆ (ไม่ใช่ value === dominantPair) เพราะคู่ค่าเดียวกันอาจ
      // ปรากฏซ้ำหลายตำแหน่งได้ เช่น "5959" -> ["59","95","59"]
      isDominant: i === lastIndex,
    };
  });

  const hasTier4 = pairDetails.some((p) => p.tier === 'tier4');

  let tier: TierKey;
  if (hasTier4) {
    // step 3: คู่เสียชนะเสมอ
    tier = 'tier4';
  } else if (pairDetails.length === 0) {
    // ไม่ควรเกิดขึ้นจริงเพราะ tailDigits ขั้นต่ำ 2 หลัก แต่ fail-safe ไว้
    tier = 'tier4';
  } else {
    // step 4: tier ที่ดีที่สุดที่เจอ
    tier = pairDetails.reduce<TierKey>((best, p) => {
      const bestRank = TIER_RANK[best as Exclude<TierKey, 'tier4'>];
      const pRank = TIER_RANK[p.tier as Exclude<TierKey, 'tier4'>];
      return pRank > bestRank ? p.tier : best;
    }, pairDetails[0].tier);
  }

  // step 5: "ความหมายเด่น" = คู่ที่อยู่ตำแหน่งท้ายสุดของ tailDigits (ไม่กระทบ tier)
  const dominantPair = pairsFound[pairsFound.length - 1];

  return { pairsFound, pairDetails, tier, dominantPair };
}
