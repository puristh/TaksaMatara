import type {
  AuctionNumberInfo,
  Badge,
  Mode1Result,
  Mode2Result,
  Mode3Result,
  RankingStrategy,
  TierKey,
} from './types';
import { DEFAULT_RANKING_STRATEGY } from './types';

/**
 * คู่ Tier 4 ที่พบจริงในเลขท้าย (ตามลำดับที่ปรากฏ ไม่ซ้ำ) — ใช้แสดงผลเท่านั้น
 * เช่น "1245" -> ["12"], "1212" -> ["12","21"] · ไม่มีคู่ Tier 4 -> []
 */
export function findTier4Pairs(mode2: Pick<Mode2Result, 'pairDetails'>): string[] {
  const out: string[] = [];
  for (const p of mode2.pairDetails) {
    if (p.tier === 'tier4' && !out.includes(p.pair)) out.push(p.pair);
  }
  return out;
}

/**
 * verdict ที่แสดงบนหน้าจอ (pill "ใช้ได้"/"ไม่ควรใช้") — ตัดสินจุดเดียว ทุกหน้าเรียกฟังก์ชันนี้
 * - ตลาด (Mode 1) = 'bad' → false เสมอ ทุก strategy
 * - 'strict' (โหมดคัดเข้ม): มีคู่ Tier 4 อย่างน้อยหนึ่งคู่ → false ด้วย
 * - 'market-first': มาจาก Mode 1 อย่างเดียว (เหมือนเดิม)
 * ไม่มีผลต่อคะแนน/Tier/กลุ่มตลาด/ลำดับ — ใช้แสดงผลเท่านั้น
 */
export function resolvePlateVerdict(
  mode1: Pick<Mode1Result, 'tier'>,
  mode2: Pick<Mode2Result, 'pairDetails'>,
  strategy: RankingStrategy = DEFAULT_RANKING_STRATEGY,
): boolean {
  if (mode1.tier === 'bad') return false;
  if (strategy === 'strict' && findTier4Pairs(mode2).length > 0) return false;
  return true;
}

/**
 * ข้อความเตือนคู่ Tier 4 (ข้อความเดียวที่ทุกหน้าใช้: badge ของ Batch ทั้งสองโหมด, การ์ดเปรียบเทียบ, หน้าเลขเดี่ยว)
 * - 'market-first': นุ่มนวล ไม่ใช้คำว่า เสีย/ห้าม/อัปมงคล เช่น "มีคู่เลขที่ควรพิจารณา: 12"
 * - 'strict': ถ้อยคำเดิม เช่น "พบคู่เสีย "12""
 * ไม่มีคู่ Tier 4 -> null
 */
export function pairWarningText(
  mode2: Pick<Mode2Result, 'pairDetails'>,
  strategy: RankingStrategy = DEFAULT_RANKING_STRATEGY,
): string | null {
  const pairs = findTier4Pairs(mode2);
  if (pairs.length === 0) return null;
  if (strategy === 'strict') return `พบคู่เสีย ${pairs.map((p) => `"${p}"`).join(', ')}`;
  return `มีคู่เลขที่ควรพิจารณา: ${pairs.join(', ')}`;
}

/**
 * ข้อ 5: รวมผล Verdict + Badge
 * - Mode 1 ตัดสิน verdict เสมอ ไม่มีโหมดอื่นเปลี่ยนค่านี้ได้
 * - Mode 2 มีคู่ Tier 4 -> 'market-first': badge neutral (สีกลาง) "มีคู่เลขที่ควรพิจารณา: <คู่จริงทุกคู่>"
 *                         'strict': badge warning "คู่เลขที่ปรากฏ: พบคู่เสีย "<คู่จริงทุกคู่>""
 *   ไม่มี -> badge positive
 * - Mode 3 good -> badge positive, ไม่งั้น badge neutral ("ปานกลาง")
 * verdict ดู resolvePlateVerdict (โหมดคัดเข้ม: มีคู่ Tier 4 = ไม่ควรใช้ · โหมดทั่วไป: มาจาก Mode 1)
 */
export function combineVerdictAndBadges(
  mode1: Mode1Result,
  mode2: Mode2Result,
  mode3: Mode3Result,
  strategy: RankingStrategy = DEFAULT_RANKING_STRATEGY,
): { verdict: boolean; badges: Badge[] } {
  const verdict = resolvePlateVerdict(mode1, mode2, strategy);

  const badges: Badge[] = [];

  const warning = pairWarningText(mode2, strategy);
  if (warning !== null) {
    badges.push(
      strategy === 'strict'
        ? { type: 'warning', text: `คู่เลขที่ปรากฏ: ${warning}` }
        : { type: 'neutral', text: warning },
    );
  } else {
    badges.push({
      type: 'positive',
      text: strategy === 'strict' ? 'คู่เลขที่ปรากฏ: ไม่มีคู่เสีย' : 'คู่เลขที่ปรากฏ: ไม่มีคู่ที่ควรพิจารณา',
    });
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
