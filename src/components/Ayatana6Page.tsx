import { useMemo } from 'react';
import { analyzeAyatana6 } from '../engine/ayatana6';
import type { PlateInput } from '../engine';
import { formatPlateText } from '../engine/plateText';

interface Ayatana6PageProps {
  input: Pick<PlateInput, 'frontDigit' | 'thaiLetters' | 'tailDigits'> | null;
  /** ลิงก์กลับเด่นๆ ที่หัวหน้า — ชั้นที่ 1 ของการแก้ปัญหาปุ่ม back ของเบราว์เซอร์หลุดออกจาก
   * แอป ไม่ต้องพึ่ง nav-bar หรือปุ่ม back ของเบราว์เซอร์เลยก็กลับได้ — ปลายทางจริง (หน้าเดี่ยว
   * หรือ Batch ranking) ตัดสินใจโดยผู้เรียก (App.tsx) ตาม return context ที่มากับลิงก์ที่พาเข้ามา
   * หน้านี้ไม่จำเป็นต้องรู้เรื่อง context นั้นเลย แค่เรียก onBack เฉยๆ */
  onBack: () => void;
  /** ข้อความปุ่มกลับ เปลี่ยนตามต้นทาง — คำนวณไว้แล้วจากฝั่งผู้เรียก */
  backLabel: string;
}

/**
 * อายตนะ6 — ศาสตร์สายเดียวกับเลขศาสตร์/ทักษาไทย (Mode 1-3) ต่อยอดจากกัน ไม่ใช่คนละสำนัก
 * ความเชื่อแบบธาตุจีน (fiveElement.ts) ผลลัพธ์ยังคงต้องแยกส่วนแสดงผลชัดเจน ไม่ปนกับ
 * Verdict/Badge ของ Mode 1-3 เดิม แม้จะเป็นศาสตร์สายเดียวกันก็ตาม
 */
export function Ayatana6Page({ input, onBack, backLabel }: Ayatana6PageProps) {
  const result = useMemo(() => (input ? analyzeAyatana6(input) : null), [input]);

  return (
    <div className="ayatana6-page">
      <button type="button" className="detail-page-back-link" onClick={onBack}>
        {backLabel}
      </button>

      <div className="eyebrow ayatana6-eyebrow">Ayatana6 · อายตนะ6</div>
      <h1>อายตนะ6</h1>

      <div className="ayatana6-intro">
        อายตนะ6 เป็นการต่อยอดจากศาสตร์เลขศาสตร์/ทักษาไทยที่ระบบนี้ใช้อยู่แล้วในระบบเลขศาสตร์หลัก 3
        ส่วน ไม่ใช่คนละสำนักความเชื่อ — ให้ค่าพลังตัวเลขและตัวอักษรตามดาวพระเคราะห์ในสายทักษาไทย แล้วบวกเลข
        ซ้ำจนเหลือหลักเดียว (1-9) เพื่อดูมุมมองเสริมอีกชั้นหนึ่งจากเลขทะเบียนเดียวกัน
      </div>

      {!input || !result ? (
        <div className="ayatana6-empty">
          ยังไม่มีข้อมูลทะเบียนให้วิเคราะห์ — กลับไปหน้า &quot;วิเคราะห์เลขเดี่ยว&quot; หรือ
          &quot;แนะนำเลขทะเบียน (Batch)&quot; แล้วกดลิงก์ &quot;ดูมุมมองอายตนะ6&quot;
          จากรายละเอียดการคำนวณของทะเบียนที่ต้องการก่อน
        </div>
      ) : (
        <div className="ayatana6-card">
          <div className="ayatana6-plate">
            {formatPlateText(input)}
          </div>

          <div className="ayatana6-result-banner">
            <div className="ayatana6-result-title">อายตนะ6 = {result.digitRoot}</div>
            <div className="ayatana6-result-meaning">{result.meaning}</div>
          </div>

          <div className="ayatana6-section">
            <div className="ayatana6-section-title">ค่าพลังตัวเลข (เลขหน้าถ้ามี + เลขท้ายแต่ละหลัก)</div>
            <div className="ayatana6-chips">
              {result.digitPowers.map((d, i) => (
                <span key={i} className="ayatana6-chip">
                  <span className="value">{d.digit}</span>
                  <span className="power">+{d.power}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="ayatana6-section">
            <div className="ayatana6-section-title">ค่าพลังตัวอักษร (หมวดอักษร → ดาวเจ้าของ)</div>
            <div className="ayatana6-chips">
              {result.letterPowers.map((l, i) => (
                <span key={i} className="ayatana6-chip">
                  <span className="value">
                    {l.letter} <span className="ayatana6-star">({l.star})</span>
                  </span>
                  <span className="power">+{l.power}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="ayatana6-section-grid">
            <div className="ayatana6-section">
              <div className="ayatana6-section-title">ผลรวมก่อนบวกเลขซ้ำ</div>
              <p>{result.rawSum}</p>
            </div>
            <div className="ayatana6-section">
              <div className="ayatana6-section-title">ขั้นตอนบวกเลขซ้ำ (Digit Root)</div>
              <p>{result.digitRootSteps.join(' → ')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
