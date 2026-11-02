import { getMode1Explanation } from '../engine/mode1';
import { formatMode3Explanation } from '../engine/mode3';
import { sumDigitsOfString } from '../engine/digitSum';
import { plateNumberDigits } from '../engine/plateText';
import { analyzeAyatana6 } from '../engine/ayatana6';
import type { Ayatana6Result } from '../engine/ayatana6';
import type { Mode1Result, Mode2Result, Mode3Result, PlateInput } from '../engine';
import { FEATURE_FLAGS } from '../config/featureFlags';

type DetailModeInput = Pick<PlateInput, 'frontDigit' | 'thaiLetters' | 'tailDigits'>;

/**
 * แยกออกมาเป็น pure function เพื่อเทสได้ตรงๆ ว่า "ปิด FEATURE_FLAGS.ayatana6Mode แล้วต้องไม่
 * แสดงผลอายตนะ6 เลย" (คืน null) และ "เปิด flag แล้วต้องเป็นผลจริงของทะเบียนใบนั้น ไม่ใช่
 * hardcode" — ไม่มี jsdom ให้ render component จริงตรวจ DOM ได้ (ดู pattern เดียวกันกับ
 * resolveBatchFormDefaults ใน RankingPanel.tsx และ resolvePlateFieldDefaults ใน
 * BirthdayCompatPage.tsx)
 */
export function resolveAyatana6Preview(
  input: DetailModeInput,
  ayatana6ModeEnabled: boolean,
): Ayatana6Result | null {
  return ayatana6ModeEnabled ? analyzeAyatana6(input) : null;
}

const MODE1_TIER_LABEL: Record<Mode1Result['tier'], string> = {
  excellent: 'ดีมาก',
  good: 'ดี',
  bad: 'ไม่ดี',
};

const TIER_LABEL: Record<string, string> = {
  tier1: 'Tier 1',
  tier2: 'Tier 2',
  tier2_5: 'Tier 2.5',
  tier3: 'Tier 3',
  tier4: 'Tier 4',
};

interface ModeDetailPanelProps {
  input: DetailModeInput;
  mode1: Mode1Result;
  mode2: Mode2Result;
  mode3: Mode3Result;
  /** ถ้าไม่ส่ง prop นี้มา หรือ FEATURE_FLAGS.fiveElementMode = false จะไม่แสดงลิงก์เลย */
  onViewFiveElement?: (input: DetailModeInput) => void;
  /** ถ้าไม่ส่ง prop นี้มา หรือ FEATURE_FLAGS.ayatana6Mode = false จะไม่แสดงผลลัพธ์/ลิงก์เลย */
  onViewAyatana6?: (input: DetailModeInput) => void;
}

/**
 * บรรทัดสูตรการคำนวณของ Mode 1/3 — ไม่มีเลขหน้า (frontDigit === null) สูตรจะไม่มีพจน์เลขหน้าเลย
 * เช่น "ศ+ร+9+1 = 21" ไม่ใช่ "0+ศ+ร+9+1" (แยกเป็น pure function เพื่อเทสได้โดยไม่ต้อง render)
 */
export function buildModeCalcLines(
  input: DetailModeInput,
  mode1: Pick<Mode1Result, 'total'>,
  mode3: Pick<Mode3Result, 'digitRoot'>,
): { mode1Calc: string; mode3Calc: string } {
  const plateDigits = plateNumberDigits(input);
  const tailTerms = input.tailDigits.split('');
  const mode1Terms =
    input.frontDigit === null
      ? [input.thaiLetters[0], input.thaiLetters[1], ...tailTerms]
      : [String(input.frontDigit), input.thaiLetters[0], input.thaiLetters[1], ...tailTerms];
  const mode1Calc = `${mode1Terms.join('+')} = ${mode1.total}`;

  const mode3RawSum = sumDigitsOfString(plateDigits.join(''));
  const mode3Calc =
    mode3RawSum <= 9
      ? `${plateDigits.join('+')} = ${mode3RawSum}`
      : `${plateDigits.join('+')} = ${mode3RawSum} → ${mode3.digitRoot}`;
  return { mode1Calc, mode3Calc };
}

/**
 * detail-grid ของ 3 Mode (calc, meaning เดิม, tag, explanation ใหม่) — ใช้ร่วมกันทั้งหน้า
 * วิเคราะห์เลขเดี่ยว (ResultCard) และหน้า Batch Ranking (RankingPanel) เพื่อไม่ให้ต้องเขียน
 * UI ซ้ำ — รับ `input` เพิ่มจากที่ระบุไว้ (mode1/mode2/mode3 เฉยๆ) เพราะบรรทัด "calc" ของ
 * Mode 1/3 ต้องใช้ frontDigit/thaiLetters/tailDigits ดิบมาแสดงสูตรการคำนวณ ถ้าไม่ส่ง input
 * มาด้วยจะแสดง calc เดิมไม่ได้ครบ
 */
export function ModeDetailPanel({
  input,
  mode1,
  mode2,
  mode3,
  onViewFiveElement,
  onViewAyatana6,
}: ModeDetailPanelProps) {
  const { mode1Calc, mode3Calc } = buildModeCalcLines(input, mode1, mode3);

  // คำนวณจากป้ายทะเบียนอย่างเดียว (ไม่ต้องรอวันเกิดเหมือน Mode 6/7) จึงโชว์ผลจริงได้ทันทีตรงนี้
  // โดยไม่ต้องให้ผู้ใช้กดลิงก์ไปหน้าเต็มก่อนถึงจะเห็นอะไร — คำนวณเฉพาะตอนเปิด flag เท่านั้น
  const ayatana6Result = resolveAyatana6Preview(input, FEATURE_FLAGS.ayatana6Mode);

  return (
    <>
      <div className="detail-grid">
        <div className="detail-box">
          <div className="mode-label">บทสรุปพลังเลขศาสตร์ทะเบียนรถ · Verdict หลัก</div>
          <div className="calc">{mode1Calc}</div>
          <div className="meaning">
            ผลรวม {mode1.total} อยู่ในกลุ่ม{MODE1_TIER_LABEL[mode1.tier]}
            {mode1.usedFallback && ' (ใช้ fallback จากตาราง Tier 10-99)'}
          </div>
          <span
            className="tag"
            style={
              mode1.tier === 'bad'
                ? { background: 'var(--bad-bg)', color: 'var(--bad)' }
                : { background: 'var(--good-strong-bg)', color: 'var(--good-strong)' }
            }
          >
            {MODE1_TIER_LABEL[mode1.tier]}
          </span>
          <p className="explanation">{getMode1Explanation(mode1)}</p>
        </div>

        <div className="detail-box">
          <div className="mode-label">วิเคราะห์คู่เลขที่ปรากฏ · Pattern</div>
          <div className="calc">
            คู่ที่พบ: {mode2.pairsFound.join(', ')}
            {mode2.pairsFound.length > 1 && ' (ตัวหลังสำคัญกว่า)'}
          </div>
          <div className="meaning">
            {mode2.dominantPair} = {TIER_LABEL[mode2.tier]}
            {mode2.tier === 'tier4' ? ' (ไม่ดี)' : ''}
          </div>
          <span
            className="tag"
            style={
              mode2.tier === 'tier4'
                ? { background: 'var(--bad-bg)', color: 'var(--bad)' }
                : { background: 'var(--good-bg)', color: 'var(--good-strong)' }
            }
          >
            {TIER_LABEL[mode2.tier]}
          </span>
          <div className="explanation">
            {mode2.pairDetails.some((p) => p.tier === 'tier4') && (
              <p className="explanation-lead">
                พบคู่ไม่ดีอย่างน้อย 1 คู่ — กฎ &quot;คู่เสียชนะ&quot; ทำให้การวิเคราะห์คู่เลขที่ปรากฏ
                ตัดสินเป็นไม่ดีทันที
              </p>
            )}
            <ul className="pair-meaning-list">
              {mode2.pairDetails.map((p, i) => (
                <li key={i}>
                  <span className="pair-code">{p.pair}</span>
                  {p.isDominant && <span className="dominant-badge">คู่หลัก</span>}
                  {' — '}
                  {p.meaning}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="detail-box">
          <div className="mode-label">สรุปพลังผลรวมเฉพาะชุดตัวเลข · Reduce</div>
          <div className="calc">{mode3Calc}</div>
          <div className="meaning">
            เลข {mode3.digitRoot}: {mode3.meaning.label}
          </div>
          <span
            className="tag"
            style={
              mode3.tier === 'good'
                ? { background: 'var(--good-bg)', color: 'var(--good-strong)' }
                : { background: 'var(--mid-bg)', color: 'var(--mid)' }
            }
          >
            {mode3.tier === 'good' ? 'ดี' : 'ปานกลาง'}
          </span>
          <p className="explanation">{formatMode3Explanation(mode3)}</p>
        </div>
      </div>

      {FEATURE_FLAGS.ayatana6Mode && onViewAyatana6 && ayatana6Result && (
        <div className="ayatana6-preview-row">
          <div className="ayatana6-inline-result">
            <div className="ayatana6-inline-title">อายตนะ6 = {ayatana6Result.digitRoot}</div>
            <div className="ayatana6-inline-meaning">{ayatana6Result.meaning}</div>
          </div>
          <button
            type="button"
            className="ayatana6-link"
            onClick={() => onViewAyatana6(input)}
          >
            ดูรายละเอียดอายตนะ6 →
          </button>
        </div>
      )}

      {FEATURE_FLAGS.fiveElementMode && onViewFiveElement && (
        <div className="five-element-link-row">
          <button
            type="button"
            className="five-element-link"
            onClick={() => onViewFiveElement(input)}
          >
            ดูมุมมองธาตุจีน 5 ธาตุ (ความเชื่อสายจีน แยกจากเลขศาสตร์ไทย) →
          </button>
        </div>
      )}
    </>
  );
}
