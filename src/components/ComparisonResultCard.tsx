import type { ReactNode } from 'react';
import type { ComparisonResult } from '../engine/comparePlates';
import { ModeDetailPanel } from './ModeDetailPanel';
import { formatPlateText } from '../engine/plateText';
import { FEATURE_FLAGS } from '../config/featureFlags';
import type { PlateInput } from '../engine';

type DetailModeInput = Pick<PlateInput, 'frontDigit' | 'thaiLetters' | 'tailDigits'>;

interface ComparisonResultCardProps {
  result: ComparisonResult;
  /** ป้ายชื่อบนสุดของการ์ด เช่น "ทะเบียน A" (หน้าเปรียบเทียบ) หรือ "ช่อง 3" (โหมดเลขที่เล็งไว้) */
  label: string;
  isWinner: boolean;
  onViewFiveElement?: (input: DetailModeInput) => void;
  onViewAyatana6?: (input: DetailModeInput) => void;
  /** ปุ่ม/ลิงก์เพิ่มเติมใต้บรรทัดคะแนน เช่น "เช็คกับวันเกิด →" ของหน้า Batch */
  headerExtra?: ReactNode;
}

/**
 * การ์ดผลลัพธ์ของ comparePlates() หนึ่งใบ — แยกออกมาจาก ComparePage.tsx เพื่อ reuse ตรงๆ ใน
 * โหมด "เลขที่เล็งไว้" ของหน้า Batch (RankingPanel.tsx) ให้ทั้งสองหน้าแสดงผลเหมือนกันทุกประการ
 */
export function ComparisonResultCard({
  result,
  label,
  isWinner,
  onViewFiveElement,
  onViewAyatana6,
  headerExtra,
}: ComparisonResultCardProps) {
  const plateText = formatPlateText(result.input);

  return (
    <div className={`compare-column${isWinner ? ' winner' : ''}`}>
      <div className="compare-column-header">
        <div className="compare-slot-label">{label}</div>
        <div className="plate">{plateText}</div>
        <div className="compare-rank-row">
          <span className={`compare-rank-badge${isWinner ? ' best' : ''}`}>อันดับ {result.rank}</span>
          <span className={`verdict ${result.mode1.verdict ? 'v-good' : 'v-bad'}`}>
            {result.mode1.verdict ? '✓ ใช้ได้' : '✕ ไม่ควรใช้'}
          </span>
        </div>
        <div className="compare-score-line">
          คะแนนรวม: {result.finalScore}
          {result.hasBadPair && ' · พบคู่เสีย (Mode 2)'}
        </div>
        {headerExtra}
      </div>

      <ModeDetailPanel
        input={result.input}
        mode1={result.mode1}
        mode2={result.mode2}
        mode3={result.mode3}
        onViewFiveElement={onViewFiveElement}
        onViewAyatana6={onViewAyatana6}
      />

      {(FEATURE_FLAGS.ayatana6Mode || FEATURE_FLAGS.fiveElementMode) && (
        <div className="compare-supplementary">
          <div className="compare-supplementary-note">
            ข้อมูลประกอบ — ไม่มีผลต่อการตัดสินว่าใครดีกว่า
          </div>

          {FEATURE_FLAGS.ayatana6Mode && result.ayatana6 && (
            <div className="compare-supplementary-block">
              <div className="compare-supplementary-title">อายตนะ6</div>
              <div className="ayatana6-inline-title">อายตนะ6 = {result.ayatana6.digitRoot}</div>
              <div className="ayatana6-inline-meaning">{result.ayatana6.meaning}</div>
            </div>
          )}

          {FEATURE_FLAGS.fiveElementMode && result.fiveElement && (
            <div className="compare-supplementary-block">
              <div className="compare-supplementary-title">ธาตุจีน 5 ธาตุ</div>
              <div className="ayatana6-inline-title">{result.fiveElement.verdict}</div>
              <div className="ayatana6-inline-meaning">{result.fiveElement.verdictDetail}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
