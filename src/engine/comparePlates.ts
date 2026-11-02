import { calculateMode1 } from './mode1';
import { calculateMode2 } from './mode2';
import { calculateMode3 } from './mode3';
import { calculateRankingScore } from './ranking';
import { compareByQuality } from './qualityComparator';
import type { QualityScored } from './qualityComparator';
import { analyzeAyatana6 } from './ayatana6';
import type { Ayatana6Result } from './ayatana6';
import { analyzeFiveElement } from './fiveElement';
import type { FiveElementResult } from './fiveElement';
import { FEATURE_FLAGS } from '../config/featureFlags';
import type { Mode1Result, Mode2Result, Mode3Result, PlateInput } from './types';

/**
 * finalScore ของทะเบียนที่ mode1.tier === 'bad' — calculateRankingScore() คืน null สำหรับกรณีนี้
 * (ใน ranking.ts ทะเบียนกลุ่มนี้ถูกกรองทิ้งไปเลยตั้งแต่ต้น ไม่มีทางเห็นค่า null หลุดมาถึง sort)
 * แต่หน้าเปรียบเทียบทะเบียนต้องแสดงทุกใบที่ผู้ใช้กรอกเสมอ ต่อให้ mode1=bad ก็ต้องโชว์ผลไว้เทียบ
 * จึงต้องมีค่า number ที่ต่ำกว่าคะแนนจริงที่เป็นไปได้ทุกกรณีเสมอ (คะแนนต่ำสุดของทะเบียนที่ mode1
 * ไม่ bad คือ 101 = mode1 good(100) + mode2 tier4(0) + mode3 neutral(1)) ไว้แสดงผล/tie-break
 */
const MODE1_BAD_DISPLAY_SCORE = 0;

export interface ComparisonResult {
  input: PlateInput;
  mode1: Mode1Result;
  mode2: Mode2Result;
  mode3: Mode3Result;
  /** null เมื่อ FEATURE_FLAGS.ayatana6Mode ปิดอยู่ — ข้อมูลประกอบ ไม่มีผลต่อ rank */
  ayatana6: Ayatana6Result | null;
  /** null เมื่อ FEATURE_FLAGS.fiveElementMode ปิดอยู่ — ข้อมูลประกอบ ไม่มีผลต่อ rank */
  fiveElement: FiveElementResult | null;
  finalScore: number;
  hasBadPair: boolean;
  /** 1 = ดีที่สุด, 2 = รองลงมา, ... เท่ากันได้ถ้าคุณภาพเสมอกันเป๊ะ (ดู compareByQuality) */
  rank: number;
}

interface AnalyzedPlate extends QualityScored {
  originalIndex: number;
  input: PlateInput;
  mode1: Mode1Result;
  mode2: Mode2Result;
  mode3: Mode3Result;
  ayatana6: Ayatana6Result | null;
  fiveElement: FiveElementResult | null;
}

function analyzeForComparison(input: PlateInput, originalIndex: number): AnalyzedPlate {
  const mode1 = calculateMode1(input);
  const mode2 = calculateMode2(input.tailDigits);
  const mode3 = calculateMode3(input);
  const finalScore = calculateRankingScore(mode1, mode2, mode3) ?? MODE1_BAD_DISPLAY_SCORE;
  const hasBadPair = mode2.tier === 'tier4';

  return {
    originalIndex,
    input,
    tailDigits: input.tailDigits,
    mode1,
    mode2,
    mode3,
    ayatana6: FEATURE_FLAGS.ayatana6Mode ? analyzeAyatana6(input) : null,
    fiveElement: FEATURE_FLAGS.fiveElementMode ? analyzeFiveElement(input.tailDigits) : null,
    finalScore,
    hasBadPair,
  };
}

/**
 * เปรียบเทียบทะเบียนหลายใบว่า "ใครดีกว่า" — engine กลางของหน้าเปรียบเทียบทะเบียน (แท็บที่ 4)
 * รองรับ inputs.length เท่าไหร่ก็ได้ ไม่ hardcode ว่าต้องมี 2 ใบ (UI ปัจจุบันจำกัดไว้ที่ 2 ช่อง
 * ผ่าน MAX_COMPARE_SLOTS ใน ComparePage.tsx แต่ engine นี้พร้อมขยายเป็น 5/10 ใบในอนาคตโดยไม่ต้อง
 * แก้ไฟล์นี้เลย)
 *
 * ต่างจาก generateTopCandidates() ตรงที่ไม่กรอง mode1=bad ทิ้ง — ทะเบียนทุกใบที่ผู้ใช้กรอกมาต้อง
 * ปรากฏในผลลัพธ์เสมอ (ผู้ใช้ต้องเห็นว่าทำไมใบนั้นถึงแพ้ ไม่ใช่หายไปเฉยๆ) จึงเพิ่มชั้น "mode1=bad
 * มาก่อนเสมอ" ไว้เหนือ compareByQuality อีกที (เทียบเท่า pattern เดียวกับที่ ranking.ts แทรก
 * favoriteMatchScore เป็นชั้นเฉพาะของตัวเอง) — ส่วน hasBadPair/finalScore/tie-break ที่เหลือ
 * ทั้งหมด reuse compareByQuality() ตรงๆ ไม่มี logic ซ้ำ
 *
 * อายตนะ6/ธาตุจีนคำนวณมาแสดงเป็นข้อมูลประกอบเท่านั้น — ไม่ถูกใช้ในการคำนวณ rank เลย
 */
export function comparePlates(inputs: PlateInput[]): ComparisonResult[] {
  const analyzed = inputs.map((input, i) => analyzeForComparison(input, i));

  const sortedForRank = [...analyzed].sort((a, b) => {
    const aBad = a.mode1.tier === 'bad';
    const bBad = b.mode1.tier === 'bad';
    if (aBad !== bBad) return aBad ? 1 : -1;
    return compareByQuality(a, b);
  });

  const rankByIndex = new Map<number, number>();
  let rank = 1;
  for (let i = 0; i < sortedForRank.length; i++) {
    const prev = sortedForRank[i - 1];
    const curr = sortedForRank[i];
    const tiedWithPrev =
      i > 0 &&
      (curr.mode1.tier === 'bad') === (prev.mode1.tier === 'bad') &&
      curr.hasBadPair === prev.hasBadPair &&
      curr.finalScore === prev.finalScore;
    if (i > 0 && !tiedWithPrev) rank = i + 1;
    rankByIndex.set(curr.originalIndex, rank);
  }

  return analyzed.map((plate) => ({
    input: plate.input,
    mode1: plate.mode1,
    mode2: plate.mode2,
    mode3: plate.mode3,
    ayatana6: plate.ayatana6,
    fiveElement: plate.fiveElement,
    finalScore: plate.finalScore,
    hasBadPair: plate.hasBadPair,
    rank: rankByIndex.get(plate.originalIndex)!,
  }));
}
