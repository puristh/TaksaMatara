import { calculateMode1 } from './mode1';
import { calculateMode2 } from './mode2';
import { calculateMode3 } from './mode3';
import { detectAuctionNumber } from './auctionNumber';
import { detectPopularNumber } from './popularNumber';
import { combineVerdictAndBadges } from './combine';
import { calculateFavoriteMatchScore, getMatchedFavoriteDigits, hasAnyFavoriteDigit } from './favoriteMatch';
import { badPairFirst, compareByQuality } from './qualityComparator';
import { DEFAULT_RANKING_STRATEGY } from './types';
import type {
  AuctionNumberInfo,
  Badge,
  Mode1Result,
  Mode2Result,
  Mode3Result,
  PlateInput,
  PopularNumberInfo,
  RankingStrategy,
} from './types';

export type TailLength = 2 | 3 | 4;

const MODE1_SCORE: Record<'excellent' | 'good', number> = {
  excellent: 2,
  good: 1,
};

const MODE2_TIER_SCORE: Record<Mode2Result['tier'], number> = {
  tier1: 5,
  tier2: 4,
  tier2_5: 3,
  tier3: 2,
  tier4: 0,
};

const MODE3_SCORE: Record<Mode3Result['tier'], number> = {
  good: 2,
  neutral: 1,
};

/**
 * finalScore = mode1Score*100 + mode2Score*10 + mode3Score*1
 * mode1 = 'bad' -> null (คัดออกจากอันดับทันที ไม่คำนวณต่อ)
 * mode2 ที่ไม่มีคู่ match เลย (pairsFound ว่าง — ไม่เกิดขึ้นจริงกับ tailDigits 2-4 หลัก
 * แต่ยังคง handle ไว้ตามสูตร) ได้คะแนน 1, แยกจาก tier4 ("คู่เสีย"/bad) ที่ได้ 0
 */
export function calculateRankingScore(
  mode1: Mode1Result,
  mode2: Mode2Result,
  mode3: Mode3Result,
): number | null {
  if (mode1.tier === 'bad') return null;

  const mode1Score = MODE1_SCORE[mode1.tier];
  const mode2Score = mode2.pairsFound.length === 0 ? 1 : MODE2_TIER_SCORE[mode2.tier];
  const mode3Score = MODE3_SCORE[mode3.tier];

  return mode1Score * 100 + mode2Score * 10 + mode3Score * 1;
}

export interface RankingCandidate {
  tailDigits: string;
  input: PlateInput;
  mode1: Mode1Result;
  mode2: Mode2Result;
  mode3: Mode3Result;
  auction: AuctionNumberInfo;
  popular: PopularNumberInfo;
  verdict: boolean;
  badges: Badge[];
  finalScore: number;
  /** true เมื่อ mode2.tier === 'tier4' (มีคู่ Tier 4) — เป็นชั้น sort บนสุดเฉพาะ strategy 'strict' */
  hasBadPair: boolean;
  /** ผลรวมคะแนนเลขที่ชอบ (0 เมื่อไม่ได้ระบุเลขโปรด หรือเลขท้ายนี้ไม่มีเลขโปรดปนเลย) */
  favoriteMatchScore: number;
  /** เลขโปรดที่ปรากฏจริงในเลขท้ายนี้ (unique, เรียงตามลำดับความชอบ) — ใช้แสดง badge */
  matchedFavoriteDigits: string[];
}

function padTail(n: number, tailLength: TailLength): string {
  return String(n).padStart(tailLength, '0');
}

/**
 * สร้าง Top `limit` เลขท้ายที่ดีที่สุดสำหรับเลขหน้า+หมวดอักษรที่กำหนดตายตัว โดยไล่ทุกความ
 * เป็นไปได้ของเลขท้ายความยาว tailLength (00..99 / 000..999 / 0000..9999) แล้วให้คะแนนด้วย
 * calculateMode1/2/3 + detectAuctionNumber/detectPopularNumber ที่มีอยู่แล้วทั้งหมด
 * (ไม่มี logic คำนวณใหม่ในนี้) — excludeAuction และ excludePopular เป็น filter อิสระจากกัน
 * โดยสิ้นเชิง ปิดอันหนึ่งไม่กระทบอีกอัน (weight ของเลขสวยใช้แค่แสดงผล ไม่รวมกับ finalScore)
 * ป้ายที่ตลาด (Mode 1) = 'bad' ถูกตัดออกตั้งแต่ต้นในทุก strategy
 *
 * ลำดับ sort ตาม strategy (ดู RankingStrategy ใน types.ts):
 * - 'market-first' (ค่าเริ่มต้น): favoriteMatchScore desc (เมื่อมีเลขโปรด) → finalScore desc → เลขท้ายน้อยไปมาก
 *   ป้ายที่มีคู่ Tier 4 ไม่ถูกตัดออก และไม่ถูกดันไปท้ายลิสต์ — อยู่ตามคะแนน
 * - 'strict' (โหมดคัดเข้ม — ลำดับเดิม): hasBadPair (false ก่อนเสมอ) → favoriteMatchScore desc
 *   (ตัดสินภายในกลุ่ม hasBadPair เดียวกัน) → finalScore desc → เลขท้ายน้อยไปมาก
 *
 * ชั้น hasBadPair/finalScore/เลขท้าย อยู่ใน compareByQuality() (qualityComparator.ts) จุดเดียว
 * ใช้ร่วมกับหน้าเปรียบเทียบทะเบียน — ที่นี่แทรกเฉพาะชั้น favoriteMatchScore ของตัวเอง
 */
export function generateTopCandidates(
  frontDigit: number,
  letters: [string, string],
  tailLength: TailLength,
  excludeAuction: boolean,
  excludePopular: boolean,
  limit = 10,
  favoriteDigits?: (string | null)[],
  strategy: RankingStrategy = DEFAULT_RANKING_STRATEGY,
): RankingCandidate[] {
  const total = 10 ** tailLength;
  const candidates: RankingCandidate[] = [];
  const favorites = favoriteDigits ?? [];
  const useFavoriteSort = hasAnyFavoriteDigit(favorites);

  for (let n = 0; n < total; n++) {
    const tailDigits = padTail(n, tailLength);
    const input: PlateInput = { frontDigit, thaiLetters: letters, tailDigits };

    const mode1 = calculateMode1(input);
    if (mode1.tier === 'bad') continue;

    const auction = detectAuctionNumber(tailDigits);
    if (excludeAuction && auction.isAuction) continue;

    const popular = detectPopularNumber(tailDigits);
    if (excludePopular && popular.isPopular) continue;

    const mode2 = calculateMode2(tailDigits);
    const mode3 = calculateMode3(input);

    const finalScore = calculateRankingScore(mode1, mode2, mode3);
    if (finalScore === null) continue;

    const { verdict, badges } = combineVerdictAndBadges(mode1, mode2, mode3, strategy);

    const favoriteMatchScore = calculateFavoriteMatchScore(tailDigits, favorites);
    const matchedFavoriteDigits = getMatchedFavoriteDigits(tailDigits, favorites);
    const hasBadPair = mode2.tier === 'tier4';

    candidates.push({
      tailDigits,
      input,
      mode1,
      mode2,
      mode3,
      auction,
      popular,
      verdict,
      badges,
      finalScore,
      hasBadPair,
      favoriteMatchScore,
      matchedFavoriteDigits,
    });
  }

  candidates.sort((a, b) => {
    // strict: ชั้น hasBadPair อยู่เหนือเลขโปรด จึงให้ compareByQuality ตัดสินเมื่อ hasBadPair ต่างกัน
    const favoriteLayerApplies = !badPairFirst(strategy) || a.hasBadPair === b.hasBadPair;
    if (useFavoriteSort && favoriteLayerApplies && b.favoriteMatchScore !== a.favoriteMatchScore) {
      return b.favoriteMatchScore - a.favoriteMatchScore;
    }
    return compareByQuality(a, b, strategy);
  });

  return candidates.slice(0, limit);
}
