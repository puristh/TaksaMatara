import type { PlateInput, PlateVerdict } from '../engine';
import { ModeDetailPanel } from './ModeDetailPanel';
import type { ReturnContext } from './RankingPanel';
import { PlateImage } from './PlateImage';
import { plateVariantFor, resolvePlateProvinceLabel } from './plateLayout';
import { plateCopyText } from './plateCopy';

type DetailModeInput = Pick<PlateInput, 'frontDigit' | 'thaiLetters' | 'tailDigits'>;

/** ลิงก์ "เช็คกับวันเกิด →" จากหน้าวิเคราะห์เลขเดี่ยวต้องกลับมาหน้าเดี่ยวเสมอ — ไม่ต้องคืนค่า
 * ฟอร์มใดๆ เพราะรายการผลลัพธ์ที่สะสมไว้อยู่ใน state ของ App.tsx ไม่ได้หายไปไหน */
export const RESULT_CARD_RETURN_CONTEXT: ReturnContext = { returnTo: 'single' };

/**
 * argument ที่ปุ่ม "เช็คกับวันเกิด →" ส่งให้ onViewBirthdayCompat — ใช้ทะเบียนของใบนี้เองเสมอ
 * (ไม่ใช่ใบล่าสุด) แยกเป็น pure function เพื่อเทส data contract ได้โดยไม่ต้อง render
 */
export function buildBirthdayCompatLinkArgs(
  result: PlateVerdict,
): [DetailModeInput, ReturnContext] {
  const { frontDigit, thaiLetters, tailDigits } = result.input;
  return [{ frontDigit, thaiLetters, tailDigits }, RESULT_CARD_RETURN_CONTEXT];
}

export function popularStars(weight: number): string {
  return '★'.repeat(weight);
}

export function badgeClass(type: 'positive' | 'warning' | 'neutral'): string {
  if (type === 'positive') return 'badge b-good';
  if (type === 'warning') return 'badge b-bad';
  return 'badge b-mid';
}

export function badgeIcon(type: 'positive' | 'warning' | 'neutral'): string {
  if (type === 'positive') return '✓';
  if (type === 'warning') return '⚠';
  return '—';
}

interface ResultCardProps {
  result: PlateVerdict;
  onViewFiveElement?: (input: DetailModeInput) => void;
  onViewAyatana6?: (input: DetailModeInput) => void;
  /** ถ้าไม่ส่ง prop นี้มาจะไม่แสดงลิงก์ "เปรียบเทียบกับทะเบียนอื่น →" เลย */
  onViewCompare?: (input: DetailModeInput) => void;
  /** ถ้าไม่ส่ง prop นี้มา (ปิด flag Mode 6/7 ทั้งคู่) จะไม่แสดงลิงก์ "เช็คกับวันเกิด →" เลย */
  onViewBirthdayCompat?: (input: DetailModeInput, returnContext?: ReturnContext) => void;
}

export function ResultCard({
  result,
  onViewFiveElement,
  onViewAyatana6,
  onViewCompare,
  onViewBirthdayCompat,
}: ResultCardProps) {
  const { input, mode1, mode2, mode3, auction, popular, verdict, badges } = result;

  // ภาพป้ายแสดงจังหวัดที่ผู้ใช้พิมพ์อยู่แล้ว — ถ้าปิดบรรทัดจังหวัดของภาพป้ายทั้งระบบ
  // (PLATE_IMAGE_DEFAULT_PROVINCE = null) ให้แสดงจังหวัดเป็นข้อความแทน ไม่ให้ข้อมูลหาย
  const provinceLabel = resolvePlateProvinceLabel(input);
  const provinceNotOnImage = input.province?.trim() && provinceLabel === null ? input.province.trim() : null;
  const hasPlateTags = auction.isAuction || popular.isPopular || provinceNotOnImage !== null;

  const isAuctionConflict = auction.isAuction && mode2.tier === 'tier4';

  return (
    <div className={`card${isAuctionConflict ? ' auction-conflict' : ''}`}>
      <div className="card-top">
        <div className="card-plate-head">
          <PlateImage
            frontDigit={input.frontDigit}
            thaiLetters={input.thaiLetters}
            tailDigits={input.tailDigits}
            variant={plateVariantFor(auction)}
            provinceLabel={provinceLabel}
            copyText={plateCopyText(input)}
          />
          {/* ชิปเลขทะเบียนเดิมเอาออกเพราะซ้ำกับภาพป้าย — แท็กที่ภาพป้ายไม่มีย้ายมาอยู่ข้าง/ใต้ภาพ */}
          {hasPlateTags && (
            <div className="plate-tags">
              {provinceNotOnImage && <span className="prov">{provinceNotOnImage}</span>}
              {auction.isAuction && (
                <span className="auction-tag">● เลขประมูล {auction.categories.join(', ')}</span>
              )}
              {popular.isPopular && (
                <span className="popular-tag">เลขสวย {popularStars(popular.weight)}</span>
              )}
            </div>
          )}
        </div>
        <div className={`verdict ${verdict ? 'v-good' : 'v-bad'}`}>
          {verdict ? '✓ ใช้ได้' : '✕ ไม่ควรใช้'}
          {isAuctionConflict && ' (แสดงเพราะเปิด "แสดงเลขประมูลทั้งหมด")'}
        </div>
      </div>

      <div className="badges">
        {badges.map((badge, i) => (
          <span key={i} className={badgeClass(badge.type)}>
            {badgeIcon(badge.type)} {badge.text}
          </span>
        ))}
      </div>

      {(onViewCompare || onViewBirthdayCompat) && (
        <div className="compare-cta-row">
          {onViewCompare && (
            <button type="button" className="compare-cta-link" onClick={() => onViewCompare(input)}>
              เปรียบเทียบกับทะเบียนอื่น →
            </button>
          )}
          {onViewBirthdayCompat && (
            <button
              type="button"
              className="birthday-compat-link"
              onClick={() => onViewBirthdayCompat(...buildBirthdayCompatLinkArgs(result))}
            >
              เช็คกับวันเกิด →
            </button>
          )}
        </div>
      )}

      <details>
        <summary>ดูรายละเอียดการคำนวณ</summary>
        <ModeDetailPanel
          input={input}
          mode1={mode1}
          mode2={mode2}
          mode3={mode3}
          onViewFiveElement={onViewFiveElement}
          onViewAyatana6={onViewAyatana6}
        />
      </details>
    </div>
  );
}
