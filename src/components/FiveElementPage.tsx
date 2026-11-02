import { useMemo } from 'react';
import { analyzeFiveElement } from '../engine/fiveElement';
import type { FiveElementVerdictLevel } from '../engine/fiveElement';
import type { PlateInput } from '../engine';
import { formatPlateText } from '../engine/plateText';

interface FiveElementPageProps {
  input: Pick<PlateInput, 'frontDigit' | 'thaiLetters' | 'tailDigits'> | null;
  /** ลิงก์กลับเด่นๆ ที่หัวหน้า — ชั้นที่ 1 ของการแก้ปัญหาปุ่ม back ของเบราว์เซอร์หลุดออกจาก
   * แอป ไม่ต้องพึ่ง nav-bar หรือปุ่ม back ของเบราว์เซอร์เลยก็กลับได้ — ปลายทางจริง (หน้าเดี่ยว
   * หรือ Batch ranking) ตัดสินใจโดยผู้เรียก (App.tsx) ตาม return context ที่มากับลิงก์ที่พาเข้ามา
   * หน้านี้ไม่จำเป็นต้องรู้เรื่อง context นั้นเลย แค่เรียก onBack เฉยๆ */
  onBack: () => void;
  /** ข้อความปุ่มกลับ เปลี่ยนตามต้นทาง เช่น "← กลับไปวิเคราะห์เลขเดี่ยว" หรือ "← กลับไปหน้า
   * Batch ranking" — คำนวณไว้แล้วจากฝั่งผู้เรียก */
  backLabel: string;
}

/** สีตาม verdictLevel — ใช้ inline style ต่อระดับแบบเดียวกับที่ ModeDetailPanel ทำกับ .tag เดิม
 * แทนการชนกับ bare class .v-good/.v-bad ที่มีอยู่แล้ว (สงวนไว้สำหรับ .verdict เดิมเท่านั้น) */
const VERDICT_COLOR: Record<FiveElementVerdictLevel, { color: string; bg: string }> = {
  excellent: { color: 'var(--good-strong)', bg: 'var(--good-strong-bg)' },
  good: { color: 'var(--good-strong)', bg: 'var(--good-bg)' },
  neutral: { color: 'var(--mid)', bg: 'var(--mid-bg)' },
  caution: { color: 'var(--bad)', bg: 'var(--bad-bg)' },
  bad: { color: 'var(--bad)', bg: 'var(--bad-bg)' },
};

/**
 * ระบบธาตุจีน 5 ธาตุ (Wu Xing) — ความเชื่อสายจีน แยกต่างหากจากเลขศาสตร์ไทย (Mode 1-3)
 * โดยสิ้นเชิง ผลลัพธ์ตรงนี้ต้องไม่ถูกนำไปรวม/มีผลต่อ Verdict หรือ Badge ของหน้าอื่นเลย
 */
export function FiveElementPage({ input, onBack, backLabel }: FiveElementPageProps) {
  const result = useMemo(() => (input ? analyzeFiveElement(input.tailDigits) : null), [input]);

  return (
    <div className="five-element-page">
      <button type="button" className="detail-page-back-link" onClick={onBack}>
        {backLabel}
      </button>

      <div className="eyebrow five-element-eyebrow">Wu Xing · 五行</div>
      <h1>มุมมองธาตุจีน 5 ธาตุ</h1>

      <div className="five-element-disclaimer">
        นี่คือความเชื่อจากสายจีน (五行) แยกต่างหากจากเลขศาสตร์ไทยที่ใช้ในหน้าอื่น อาจให้ผลไม่ตรงกัน
        เพราะเป็นคนละสำนักความเชื่อ
      </div>

      {!input || !result ? (
        <div className="five-element-empty">
          ยังไม่มีข้อมูลทะเบียนให้วิเคราะห์ — กลับไปหน้า &quot;วิเคราะห์เลขเดี่ยว&quot; หรือ
          &quot;แนะนำเลขทะเบียน (Batch)&quot; แล้วกดลิงก์ &quot;ดูมุมมองธาตุจีน 5 ธาตุ&quot;
          จากรายละเอียดการคำนวณของทะเบียนที่ต้องการก่อน
        </div>
      ) : (
        <div className="five-element-card">
          <div className="five-element-plate">
            {formatPlateText(input)}
            <span className="five-element-tail-note">
              (วิเคราะห์เฉพาะเลขท้าย &quot;{input.tailDigits}&quot; — ไม่รวมเลขหน้า/หมวดอักษร)
            </span>
          </div>

          {result.insufficientData ? (
            <p className="five-element-empty">{result.verdictDetail}</p>
          ) : (
            <>
              <div
                className="five-element-verdict-banner"
                style={{
                  background: VERDICT_COLOR[result.verdictLevel].bg,
                  borderLeftColor: VERDICT_COLOR[result.verdictLevel].color,
                }}
              >
                <div
                  className="five-element-verdict-title"
                  style={{ color: VERDICT_COLOR[result.verdictLevel].color }}
                >
                  {result.verdict}
                </div>
                <div className="five-element-verdict-detail">{result.verdictDetail}</div>
              </div>

              <div className="five-element-section">
                <div className="five-element-section-title">ธาตุของแต่ละหลัก</div>
                <div className="five-element-digits">
                  {result.digitElements.map((de, i) => (
                    <span key={i} className="five-element-digit-chip">
                      <span className="digit">{de.digit}</span>
                      <span className="element">{de.elementLabel}</span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="five-element-section">
                <div className="five-element-section-title">ความสัมพันธ์ระหว่างหลักที่ติดกัน</div>
                <ul className="five-element-pairs">
                  {result.pairs.map((p, i) => (
                    <li key={i}>
                      <span className="pair-code">{p.a}</span>
                      <span className="five-element-pair-el">({p.aElementLabel})</span>
                      {' → '}
                      <span className="pair-code">{p.b}</span>
                      <span className="five-element-pair-el">({p.bElementLabel})</span>
                      {' : '}
                      {p.relationLabel}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="five-element-section-grid">
                <div className="five-element-section">
                  <div className="five-element-section-title">ความสมดุลหยิน-หยาง</div>
                  <p>{result.parityFlag}</p>
                </div>
                <div className="five-element-section">
                  <div className="five-element-section-title">ความสัมพันธ์หัว-ท้าย</div>
                  <p>{result.headTailRelationLabel}</p>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
