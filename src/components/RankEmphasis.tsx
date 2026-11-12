import type { ReactNode } from 'react';

/**
 * ส่วนแสดงผลที่เน้นในหน้า Batch (ตาราง/การ์ด Top N และโหมด "เลขที่เล็งไว้") — แสดงผลอย่างเดียว ไม่คำนวณอะไร
 * ค่า rank / verdict / score มาจาก engine เดิมทั้งหมด
 */

export type RankTier = 'gold' | 'silver' | 'bronze' | 'plain';

/** อันดับ 1/2/3 = ทอง/เงิน/ทองแดง · 4 ขึ้นไป = พื้นเทาเข้ม */
export function rankTier(rank: number): RankTier {
  return rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'plain';
}

/** ป้ายอันดับ (สี medal ใช้เฉพาะที่นี่และพื้นแถว/การ์ดอันดับ 1–3) — screen reader อ่าน "อันดับที่ N" */
export function RankBadge({ rank }: { rank: number }) {
  return (
    <span className={`rank-badge rank-badge--${rankTier(rank)}`} role="img" aria-label={`อันดับที่ ${rank}`}>
      <span aria-hidden="true">{rank}</span>
    </span>
  );
}

/** Verdict แบบ pill พื้นทึบ: ใช้ได้ = เขียว, ไม่ควรใช้ = แดง (ตัวอักษรเข้มทั้งคู่) */
export function VerdictPill({ verdict, extra }: { verdict: boolean; extra?: ReactNode }) {
  const text = verdict ? 'ใช้ได้' : 'ไม่ควรใช้';
  return (
    <span className="verdict-pill-wrap">
      <span
        className={`verdict-pill verdict-pill--${verdict ? 'good' : 'bad'}`}
        role="img"
        aria-label={`ผลประเมิน: ${text}`}
      >
        <span className="verdict-pill__icon" aria-hidden="true">
          {verdict ? '✓' : '✕'}
        </span>
        <span aria-hidden="true">{text}</span>
      </span>
      {extra}
    </span>
  );
}

/** คะแนนรวม: label เล็กด้านบน ตัวเลขใหญ่ (tabular-nums) — อันดับ 1 ใหญ่กว่า */
export function ScoreFigure({ score, rank, note }: { score: number; rank: number; note?: ReactNode }) {
  return (
    <span className={`score-figure${rank === 1 ? ' score-figure--top' : ''}`}>
      <span className="score-figure__label">คะแนนรวม</span>
      <span className="score-figure__value">{score}</span>
      {note}
    </span>
  );
}
