import type { ReactNode } from 'react';
import type { PlateInput } from '../engine';
import type { AuctionNumberInfo } from '../engine/types';
import { detectAuctionNumber } from '../engine/auctionNumber';
import { formatPlateText } from '../engine/plateText';
import { LazyMount } from './LazyMount';
import { PlateImage } from './PlateImage';
import { buildPlateAriaLabel, PLATE_H, PLATE_W, plateVariantFor, resolvePlateProvinceLabel } from './plateLayout';
import { RankBadge, rankTier, ScoreFigure, VerdictPill } from './RankEmphasis';

/**
 * หน้า Batch: ป้ายเล็กที่กดเพื่อขยาย + แถวกะทัดรัด (แสดงผลอย่างเดียว — อันดับ/verdict/คะแนนมาจาก engine เดิมทั้งหมด)
 */

type PlateFields = Pick<PlateInput, 'frontDigit' | 'thaiLetters' | 'tailDigits' | 'province'>;

/** aria-label ของปุ่มป้ายเล็ก เช่น "ดูรายละเอียดเลข 1 กข 55" */
export function plateToggleLabel(input: PlateFields): string {
  return `ดูรายละเอียดเลข ${formatPlateText(input)}`;
}

/**
 * ที่ว่างแทนภาพป้ายที่ยังไม่เข้าใกล้จอ (LazyMount) — ขนาดเท่าภาพจริง และ aria-label เหมือนภาพจริง
 * เป็น <span> (display: block) จึงอยู่ใน <button> ได้
 */
function PlatePlaceholder({ input, auction, widthPx }: { input: PlateFields; auction: AuctionNumberInfo; widthPx: number }) {
  return (
    <span
      className="plate-placeholder"
      role="img"
      aria-label={buildPlateAriaLabel(formatPlateText(input), resolvePlateProvinceLabel(input), plateVariantFor(auction))}
      style={{ width: `${widthPx}px`, aspectRatio: `${PLATE_W} / ${PLATE_H}` }}
    />
  );
}

/**
 * ป้ายทะเบียนเล็กเป็น <button> (toggle ส่วนที่ขยาย — ผลเหมือนกด "ดูรายละเอียด"): คีย์บอร์ดใช้ได้, aria-expanded,
 * aria-controls, aria-label "ดูรายละเอียดเลข …" · ภาพวาดเมื่อใกล้จอ (LazyMount) · ไม่มี caption/ปุ่มคัดลอก (อยู่ในส่วนที่ขยาย)
 */
export function PlateToggleButton({
  input,
  auction,
  widthPx,
  expanded,
  controls,
  onToggle,
}: {
  input: PlateFields;
  auction?: AuctionNumberInfo;
  widthPx: number;
  expanded: boolean;
  controls: string;
  onToggle: () => void;
}) {
  const auc = auction ?? detectAuctionNumber(input.tailDigits);
  return (
    <button
      type="button"
      className="plate-toggle"
      aria-expanded={expanded}
      aria-controls={controls}
      aria-label={plateToggleLabel(input)}
      onClick={onToggle}
    >
      <LazyMount placeholder={<PlatePlaceholder input={input} auction={auc} widthPx={widthPx} />}>
        <PlateImage
          frontDigit={input.frontDigit}
          thaiLetters={input.thaiLetters}
          tailDigits={input.tailDigits}
          variant={plateVariantFor(auc)}
          provinceLabel={resolvePlateProvinceLabel(input)}
          compactWidth={widthPx}
        />
      </LazyMount>
    </button>
  );
}

/** ปุ่ม "ดูรายละเอียด" (ข้อความ) — toggle ส่วนเดียวกับป้ายเล็ก */
export function ExpandButton({
  expanded,
  controls,
  onToggle,
  className,
}: {
  expanded: boolean;
  controls: string;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`ranking-expand-btn${expanded ? ' open' : ''}${className ? ` ${className}` : ''}`}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onToggle}
    >
      <span className="ranking-expand-icon" aria-hidden="true">
        ▸
      </span>
      <span className="ranking-expand-text">ดูรายละเอียด</span>
    </button>
  );
}

interface CompactRankRowProps {
  rank: number;
  input: PlateFields;
  auction?: AuctionNumberInfo;
  plateWidth: number;
  verdict: boolean;
  score: number;
  /** ข้อความเล็กใต้คะแนน เช่น "พบคู่เสีย (Mode 2)" (โหมดเลขที่เล็งไว้) */
  scoreNote?: ReactNode;
  /** ป้ายเล็กใต้ป้ายอันดับ เช่น "ช่อง 3" (โหมดเลขที่เล็งไว้) */
  label?: string;
  expanded: boolean;
  detailId: string;
  onToggle: () => void;
  /** เนื้อหาส่วนที่ขยาย — render เฉพาะตอนเปิด (ป้ายใหญ่ + รายละเอียดไม่ถูกวาดจนกว่าจะกด) */
  children: ReactNode;
}

/**
 * แถวกะทัดรัด 1 แถว: ป้ายอันดับ | ป้ายทะเบียนเล็ก (ปุ่ม) | verdict pill + คะแนนรวม | ปุ่ม "ดูรายละเอียด"
 * ส่วนที่ขยายอยู่ใต้แถว (id = detailId) เปิดได้หลายแถวพร้อมกัน
 */
export function CompactRankRow({
  rank,
  input,
  auction,
  plateWidth,
  verdict,
  score,
  scoreNote,
  label,
  expanded,
  detailId,
  onToggle,
  children,
}: CompactRankRowProps) {
  return (
    <li className={`rank-row rank-row--${rankTier(rank)}${expanded ? ' is-open' : ''}`} data-ranking-row="">
      <div className="rank-row-main">
        <span className="rank-row-rank">
          <RankBadge rank={rank} />
          {label && <span className="rank-row-label">{label}</span>}
        </span>
        <span className="rank-row-plate">
          <PlateToggleButton
            input={input}
            auction={auction}
            widthPx={plateWidth}
            expanded={expanded}
            controls={detailId}
            onToggle={onToggle}
          />
          {/* ข้อความเลขทะเบียนให้ค้นหา (Ctrl+F) — screen reader อ่านจากปุ่ม/ภาพแล้ว */}
          <span className="sr-only">{formatPlateText(input)}</span>
        </span>
        <span className="rank-row-side">
          <VerdictPill verdict={verdict} />
          <ScoreFigure score={score} rank={rank} note={scoreNote} />
        </span>
        <span className="rank-row-toggle">
          <ExpandButton expanded={expanded} controls={detailId} onToggle={onToggle} />
        </span>
      </div>
      <div id={detailId} className="rank-row-detail" hidden={!expanded}>
        {expanded && children}
      </div>
    </li>
  );
}
