import type {
  AuctionNumberInfo,
  Badge,
  Mode1Result,
  Mode2Result,
  Mode3Result,
  TierKey,
} from './types';

/**
 * ข้อ 5: รวมผล Verdict + Badge
 * - Mode 1 ตัดสิน verdict เสมอ ไม่มีโหมดอื่นเปลี่ยนค่านี้ได้
 * - Mode 2 bad -> badge warning, ไม่งั้น badge positive
 * - Mode 3 good -> badge positive, ไม่งั้น badge neutral ("ปานกลาง")
 */
export function combineVerdictAndBadges(
  mode1: Mode1Result,
  mode2: Mode2Result,
  mode3: Mode3Result,
): { verdict: boolean; badges: Badge[] } {
  const verdict = mode1.tier !== 'bad';

  const badges: Badge[] = [];

  if (mode2.tier === 'tier4') {
    badges.push({ type: 'warning', text: `คู่เลขที่ปรากฏ: พบคู่เสีย "${mode2.dominantPair}"` });
  } else {
    badges.push({ type: 'positive', text: 'คู่เลขที่ปรากฏ: ไม่มีคู่เสีย' });
  }

  if (mode3.tier === 'good') {
    badges.push({ type: 'positive', text: `ผลรวมตัวเลข: ดี (เลข ${mode3.digitRoot})` });
  } else {
    badges.push({ type: 'neutral', text: `ผลรวมตัวเลข: ปานกลาง (เลข ${mode3.digitRoot})` });
  }

  return { verdict, badges };
}

export interface AuctionConflictResolution {
  hiddenByDefault: boolean;
  extraBadge?: Badge;
}

/**
 * ข้อ 6: Auction Conflict Resolution (เดิมเป็น "VIP Conflict Resolution" ก่อนแยกระบบ
 * เลขประมูล/เลขสวยออกจากกัน — ตอนนี้ผูกกับ isAuction เท่านั้น เพราะเลขประมูลคือกลุ่มที่
 * "ต้องประมูลแยก ไม่ได้อยู่ในระบบจองปกติ" ตามความหมายเดิมของกลไกนี้ ส่วนเลขสวยยังจองได้
 * ปกติจึงไม่เข้ากลไกซ่อนนี้)
 * - ถ้าเป็นเลขประมูล และ Mode2 = bad (tier4) -> ซ่อนจากรายการหลักโดย default
 * - ถ้า showAllAuction=true -> ไม่ซ่อน + แปะ badge warning สีแดงเด่น (verdict ยังมาจาก Mode1 เหมือนเดิม)
 */
export function resolveAuctionConflict(
  auction: AuctionNumberInfo,
  mode2Tier: TierKey,
  showAllAuction: boolean,
): AuctionConflictResolution {
  const isConflict = auction.isAuction && mode2Tier === 'tier4';

  if (!isConflict) {
    return { hiddenByDefault: false };
  }

  if (!showAllAuction) {
    return { hiddenByDefault: true };
  }

  return {
    hiddenByDefault: false,
    extraBadge: { type: 'warning', text: 'WARNING: เลขประมูลติดกลุ่มเลขเสีย' },
  };
}
