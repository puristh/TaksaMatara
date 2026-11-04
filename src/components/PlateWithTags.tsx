import type { AuctionNumberInfo, PlateInput, PopularNumberInfo } from '../engine/types';
import { detectAuctionNumber } from '../engine/auctionNumber';
import { detectPopularNumber } from '../engine/popularNumber';
import { PlateImage } from './PlateImage';
import { plateProvinceNote, plateVariantFor, resolvePlateProvinceLabel } from './plateLayout';
import { plateCopyText } from './plateCopy';

export function popularStars(weight: number): string {
  return '★'.repeat(weight);
}

interface PlateWithTagsProps {
  input: Pick<PlateInput, 'frontDigit' | 'thaiLetters' | 'tailDigits' | 'province'>;
  /** ไม่ส่งมา = คำนวณจากเลขท้ายเอง (ฟังก์ชันเดียวกับที่ระบบใช้ทุกที่) */
  auction?: AuctionNumberInfo;
  popular?: PopularNumberInfo;
  /** 'row' = ป้ายกับแท็กอยู่ข้างกัน (การ์ดเลขเดี่ยว), 'column' = แท็กอยู่ใต้ป้าย (การ์ดแคบ/หลายใบเรียงกัน) */
  layout?: 'row' | 'column';
}

/**
 * ภาพป้าย + แท็กที่ชิปเลขทะเบียนเดิมเคยแสดง (เลขประมูล/เลขสวย/จังหวัดเมื่อปิดบรรทัดจังหวัดของภาพ)
 * ใช้ทุกที่ที่แสดงการ์ดของทะเบียนหนึ่งเลข แทนชิปเดิม — ข้อมูลในชิปต้องไม่หาย:
 * - เลขทะเบียน → ภาพป้าย (aria-label) + ปุ่มคัดลอก
 * - จังหวัดที่พิมพ์ → บนภาพป้าย หรือเป็นข้อความถ้าปิดบรรทัดจังหวัดทั้งระบบ
 * - "● เลขประมูล (หมวด)" / "เลขสวย ★" → แถวแท็ก
 */
export function PlateWithTags({ input, auction, popular, layout = 'row' }: PlateWithTagsProps) {
  const auc = auction ?? detectAuctionNumber(input.tailDigits);
  const pop = popular ?? detectPopularNumber(input.tailDigits);
  // ปิดบรรทัดจังหวัดของภาพป้ายทั้งระบบ (PLATE_IMAGE_DEFAULT_PROVINCE = null) → แสดงจังหวัดเป็นข้อความแทน
  const provinceLabel = resolvePlateProvinceLabel(input);
  const provinceNotOnImage = input.province?.trim() && provinceLabel === null ? input.province.trim() : null;
  const hasTags = auc.isAuction || pop.isPopular || provinceNotOnImage !== null;
  return (
    <div className={`card-plate-head${layout === 'column' ? ' card-plate-head--column' : ''}`}>
      <PlateImage
        frontDigit={input.frontDigit}
        thaiLetters={input.thaiLetters}
        tailDigits={input.tailDigits}
        variant={plateVariantFor(auc)}
        provinceLabel={provinceLabel}
        copyText={plateCopyText(input)}
        provinceNote={plateProvinceNote(input)}
      />
      {hasTags && (
        <div className="plate-tags">
          {provinceNotOnImage && <span className="prov">{provinceNotOnImage}</span>}
          {auc.isAuction && <span className="auction-tag">● เลขประมูล {auc.categories.join(', ')}</span>}
          {pop.isPopular && <span className="popular-tag">เลขสวย {popularStars(pop.weight)}</span>}
        </div>
      )}
    </div>
  );
}
