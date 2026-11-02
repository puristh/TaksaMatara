import { calculateMode1 } from './mode1';
import { calculateMode2 } from './mode2';
import { calculateMode3 } from './mode3';
import { detectAuctionNumber } from './auctionNumber';
import { detectPopularNumber } from './popularNumber';
import { combineVerdictAndBadges } from './combine';
import { calculateFavoriteMatchScore, getMatchedFavoriteDigits, hasAnyFavoriteDigit } from './favoriteMatch';
import { compareByQuality } from './qualityComparator';
import type {
  AuctionNumberInfo,
  Badge,
  Mode1Result,
  Mode2Result,
  Mode3Result,
  PlateInput,
  PopularNumberInfo,
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
  /** true เมื่อ mode2.tier === 'tier4' ("คู่เสีย") — ใช้เป็นชั้น sort บนสุด (มาก่อน finalScore เสมอ) */
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
 *
 * ลำดับความสำคัญของ sort (จากบนสุด/สำคัญสุด ลงมา):
 * 1. hasBadPair (mode2.tier === 'tier4', "คู่เสีย") -> false มาก่อน true เสมอ ไม่ว่า finalScore
 *    หรือ favoriteMatchScore จะสูงแค่ไหนก็ตาม เลขที่มีคู่เสียใน Mode 2 จะตกไปอยู่ท้ายลิสต์เสมอ
 *    (คนละกลุ่มกับเลขที่ไม่มีคู่เสียโดยสิ้นเชิง) — เพิ่มชั้นนี้เพราะพบว่า Mode 1 "ดีมาก" ที่มี
 *    คู่เสียใน Mode 2 เคยได้ finalScore สูงพอจะแซง Mode 1 "ดี" ที่ Mode 2 สะอาด ซึ่งไม่ตรงเจตนา
 *    ของระบบ
 * 2. favoriteMatchScore desc (ถ้ามีเลขโปรด — ตัดสินภายในแต่ละกลุ่ม hasBadPair แยกกัน ไม่ข้าม
 *    กลุ่ม) เลขโปรดสำคัญกว่าคะแนนรวม เพราะ Mode 3 (ส่วนที่เคยเป็นเหตุผลให้ finalScore ต้องมา
 *    ก่อนในเวอร์ชันก่อนหน้า) ไม่มีผลต่อการจัดอันดับแล้ว มีไว้แสดงเป็น FYI เท่านั้น
 * 3. finalScore desc (tie-break ภายในกลุ่มที่ favoriteMatchScore เท่ากันเท่านั้น)
 * 4. numeric tail asc (tie-break สุดท้าย)
 *
 * ข้อ 1, 3, 4 ด้านบน (ไม่รวมข้อ 2 favoriteMatchScore ที่เฉพาะบริบทนี้) ถูกแยกออกไปเป็น
 * compareByQuality() ใน qualityComparator.ts เพื่อ reuse กับหน้าเปรียบเทียบทะเบียน
 * (comparePlates.ts) — sort ด้านล่างแทรก favoriteMatchScore เป็นชั้นเพิ่มเติมเฉพาะของตัวเอง
 * ระหว่าง hasBadPair กับ finalScore แล้วปล่อยให้ compareByQuality() ตัดสินที่เหลือทั้งหมด
 * (รวม hasBadPair เองด้วยเมื่อ hasBadPair ต่างกันจริง — เงื่อนไข hasBadPair ตรงนี้มีไว้แค่
 * "เปิด/ปิด" ชั้น favoriteMatchScore เท่านั้น ไม่ได้ตัดสินผลลัพธ์เอง)
 *
 * Mode 3 ("ปานกลาง"/"ดี") ไม่มีผลต่อ sort priority เลยในทุกชั้น — ใช้แสดงเป็นข้อมูลประกอบ
 * (FYI badge) เท่านั้น ผ่านทาง finalScore ที่คำนวณไว้แล้วในขั้นตอนก่อนหน้า
 *
 * ถ้าไม่ระบุ favoriteDigits เลย (undefined หรือทุกตำแหน่งเป็น null) พฤติกรรม sort คือ
 * hasBadPair -> finalScore desc -> numeric asc เพราะ favoriteMatchScore เป็น 0 หมดทุกตัว
 * ไม่มีผลต่อการ tie-break เลย (ชั้น favoriteMatchScore ถูกข้ามไปโดยอัตโนมัติ)
 */
export function generateTopCandidates(
  frontDigit: number,
  letters: [string, string],
  tailLength: TailLength,
  excludeAuction: boolean,
  excludePopular: boolean,
  limit = 10,
  favoriteDigits?: (string | null)[],
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

    const { verdict, badges } = combineVerdictAndBadges(mode1, mode2, mode3);

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
    if (useFavoriteSort && a.hasBadPair === b.hasBadPair && b.favoriteMatchScore !== a.favoriteMatchScore) {
      return b.favoriteMatchScore - a.favoriteMatchScore;
    }
    return compareByQuality(a, b);
  });

  return candidates.slice(0, limit);
}
