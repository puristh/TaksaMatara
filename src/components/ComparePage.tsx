import { useMemo, useRef, useState } from 'react';
import { comparePlates } from '../engine/comparePlates';
import type { ComparisonResult } from '../engine/comparePlates';
import { ComparisonResultCard } from './ComparisonResultCard';
import type { PlateInput } from '../engine';
import {
  frontDigitToField,
  isOptionalFrontDigitField,
  parseOptionalFrontDigit,
} from '../engine/plateText';

export const THAI_LETTER_PATTERN = /^[ก-ฮ]$/;

/**
 * true เมื่อกรอกครบ maxLength ของช่องนั้นแล้ว — ใช้ตัดสินใจว่าควร auto-advance focus ไปช่อง
 * ถัดไปหรือยัง (เลขหน้า -> อักษร 1 -> อักษร 2 เท่านั้น เลขท้ายไม่ auto-advance ต่อ) แยกออกมาเป็น
 * pure function เพื่อเทสได้ตรงๆ โดยไม่ต้องพึ่ง jsdom/DOM จริง (เหมือน pattern เดียวกับ
 * shouldAutoAdvance ใน PlateForm.tsx)
 */
export function shouldAutoAdvance(value: string, maxLength: number): boolean {
  return value.length >= maxLength;
}

/**
 * จำนวนช่องกรอกของหน้าเปรียบเทียบทะเบียน — ตอนนี้จำกัดไว้ที่ 2 (tier ฟรี) จะเพิ่มเป็น 5/10
 * ในอนาคตสำหรับ tier พรีเมียม แค่เปลี่ยนค่านี้ค่าเดียว + ปรับ compare-grid ให้ wrap เป็นหลายแถว
 * ที่ CSS (ดู .compare-grid ใน theme.css) — state/engine ด้านล่างทั้งหมดใช้ array (slots)
 * ตั้งแต่ต้นอยู่แล้ว ไม่ผูกกับเลข 2 ตายตัวที่ไหนเลย จึงไม่ต้องแก้โค้ดส่วนอื่นเพิ่ม
 */
export const MAX_COMPARE_SLOTS = 2;

export interface CompareSlotFields {
  frontDigit: string;
  letter1: string;
  letter2: string;
  tailDigits: string;
}

export const EMPTY_SLOT_FIELDS: CompareSlotFields = {
  frontDigit: '',
  letter1: '',
  letter2: '',
  tailDigits: '',
};

/** สร้างช่องกรอกว่างเปล่า n ช่อง — ใช้ตอน mount ครั้งแรกและตอนต้องขยาย/ลดจำนวนช่องในอนาคต */
export function createEmptySlots(count: number): CompareSlotFields[] {
  return Array.from({ length: count }, () => ({ ...EMPTY_SLOT_FIELDS }));
}

type DetailModeInput = Pick<PlateInput, 'frontDigit' | 'thaiLetters' | 'tailDigits'>;

/** แปลง PlateInput ดิบ (frontDigit เป็น number) เป็น CompareSlotFields (ทุก field เป็น string
 * ตามที่ input ในฟอร์มนี้ใช้) — ใช้ตอน prefill ทะเบียน A จากปุ่ม "เปรียบเทียบกับทะเบียนอื่น →"
 * ในหน้าวิเคราะห์เลขเดี่ยว (ResultCard.tsx) */
export function detailInputToSlotFields(input: DetailModeInput): CompareSlotFields {
  return {
    frontDigit: frontDigitToField(input.frontDigit),
    letter1: input.thaiLetters[0],
    letter2: input.thaiLetters[1],
    tailDigits: input.tailDigits,
  };
}

/** ค่าเริ่มต้นของ slots ตอน mount — เหมือน createEmptySlots(count) ทุกประการ ยกเว้น slot แรก
 * (ทะเบียน A) ที่จะถูกแทนที่ด้วยค่าจริงถ้ามี prefillFirstSlot มา (มาจากลิงก์ ResultCard.tsx
 * เท่านั้นตอนนี้) — เข้าหน้านี้ตรงๆ จากแท็บ (prefillFirstSlot เป็น null/undefined) ต้องได้ผล
 * เหมือน createEmptySlots(count) เดิมทุกประการ ไม่ถูกกระทบ (ดู pattern เดียวกับ
 * resolvePlateFieldDefaults ใน BirthdayCompatPage.tsx) */
export function resolveInitialSlots(
  count: number,
  prefillFirstSlot?: DetailModeInput | null,
): CompareSlotFields[] {
  const slots = createEmptySlots(count);
  if (prefillFirstSlot) slots[0] = detailInputToSlotFields(prefillFirstSlot);
  return slots;
}

export function isSlotValid(fields: CompareSlotFields): boolean {
  return (
    isOptionalFrontDigitField(fields.frontDigit) &&
    THAI_LETTER_PATTERN.test(fields.letter1) &&
    THAI_LETTER_PATTERN.test(fields.letter2) &&
    /^[0-9]{2,4}$/.test(fields.tailDigits)
  );
}

export function toPlateInput(fields: CompareSlotFields): PlateInput {
  return {
    frontDigit: parseOptionalFrontDigit(fields.frontDigit),
    thaiLetters: [fields.letter1, fields.letter2],
    tailDigits: fields.tailDigits,
  };
}

/** ป้ายชื่อช่อง A, B, C, ... — รองรับได้ถึง 26 ช่อง เกินพอสำหรับ tier พรีเมียมสูงสุดที่วางแผนไว้ (10) */
export function slotLabel(index: number): string {
  return `ทะเบียน ${String.fromCharCode(65 + index)}`;
}

/**
 * สร้างข้อความแถบสรุปผู้ชนะ — เหตุผลเรียงตามลำดับชั้นเดียวกับที่ compareByQuality/comparePlates
 * ใช้ตัดสิน rank จริง (mode1=bad ก่อน, แล้ว hasBadPair, แล้วจึง finalScore) เพื่อให้คำอธิบายตรงกับ
 * ผลลัพธ์เสมอ ไม่ใช่เดาเอาเอง — ออกแบบให้ทำงานได้กับ N ช่องในอนาคต (ไม่ใช่ hardcode 2 ช่อง) แต่
 * ข้อความละเอียด (ระบุใบที่แพ้ตรงๆ) จะเทียบได้ชัดที่สุดตอนมี 2 ช่องอย่างที่ใช้งานจริงตอนนี้
 */
export function buildWinnerSummary(results: ComparisonResult[]): string {
  if (results.length === 0) return '';

  const bestRank = Math.min(...results.map((r) => r.rank));
  const winnerIndexes = results
    .map((_, i) => i)
    .filter((i) => results[i].rank === bestRank);

  if (winnerIndexes.length === results.length) {
    return 'ทุกทะเบียนเสมอกัน — คุณภาพเท่ากันทุกด้านตามเกณฑ์ที่ใช้ตัดสิน';
  }

  if (winnerIndexes.length > 1) {
    const names = winnerIndexes.map((i) => slotLabel(i)).join(' และ ');
    return `${names} เสมอกัน — ดีกว่าทะเบียนที่เหลือ`;
  }

  const winnerIndex = winnerIndexes[0];
  const winner = results[winnerIndex];
  const winnerName = slotLabel(winnerIndex);
  const losers = results.filter((_, i) => i !== winnerIndex);

  const loserWithBadMode1 = losers.find((l) => l.mode1.tier === 'bad');
  if (loserWithBadMode1 && winner.mode1.tier !== 'bad') {
    return `${winnerName} ดีกว่า — อีกใบอยู่ในกลุ่มบทสรุปพลังเลขศาสตร์ทะเบียนรถ "ไม่ควรใช้"`;
  }

  const loserWithBadPair = losers.find((l) => l.hasBadPair);
  if (loserWithBadPair && !winner.hasBadPair) {
    return `${winnerName} ดีกว่า — ไม่มีคู่เสีย ในขณะที่อีกใบพบคู่เสีย`;
  }

  return `${winnerName} ดีกว่า — คะแนนรวมสูงกว่า`;
}

function updateSlotAt(
  slots: CompareSlotFields[],
  index: number,
  patch: Partial<CompareSlotFields>,
): CompareSlotFields[] {
  return slots.map((s, i) => (i === index ? { ...s, ...patch } : s));
}

interface ComparePageProps {
  /** prefill เฉพาะ slot แรก (ทะเบียน A) เท่านั้น มาจากปุ่ม "เปรียบเทียบกับทะเบียนอื่น →" ใน
   * หน้าวิเคราะห์เลขเดี่ยว (ResultCard.tsx) — ทะเบียน B และ slot อื่นๆ ว่างเปล่าเสมอไม่ว่า prop
   * นี้จะมีค่าหรือไม่ ไม่ส่ง prop นี้มาเลย (เช่นเข้าจากแท็บตรงๆ) ต้องได้ฟอร์มว่างเปล่าเหมือนเดิม */
  initialFirstSlot?: DetailModeInput | null;
}

export function ComparePage({ initialFirstSlot }: ComparePageProps = {}) {
  const [slots, setSlots] = useState<CompareSlotFields[]>(() =>
    resolveInitialSlots(MAX_COMPARE_SLOTS, initialFirstSlot),
  );

  // ref แบบ array คีย์ด้วย index ของ slot (ไม่ใช่ ref แยกสองตัวสำหรับ "ทะเบียน A"/"ทะเบียน B"
  // ตรงๆ) เพื่อให้รองรับขยายเป็น 5/10 slot ในอนาคตได้โดยไม่ต้องแก้โครงสร้าง ref เลย — auto-advance
  // เฉพาะ เลขหน้า -> อักษร 1 -> อักษร 2 เท่านั้น (เลขท้ายไม่มี ref เพราะไม่ auto-advance ต่อ)
  const letter1Refs = useRef<(HTMLInputElement | null)[]>([]);
  const letter2Refs = useRef<(HTMLInputElement | null)[]>([]);

  const hasStartedTyping = slots.some(
    (s) => s.frontDigit !== '' || s.letter1 !== '' || s.letter2 !== '' || s.tailDigits !== '',
  );
  const allValid = slots.every(isSlotValid);

  const results: ComparisonResult[] | null = useMemo(() => {
    if (!allValid) return null;
    return comparePlates(slots.map(toPlateInput));
  }, [slots, allValid]);

  const winnerSummary = useMemo(() => (results ? buildWinnerSummary(results) : ''), [results]);

  return (
    <div className="compare-page">
      <div className="eyebrow">Compare</div>
      <h1>เปรียบเทียบทะเบียน</h1>
      <div className="sub">
        กรอกเลขทะเบียน {MAX_COMPARE_SLOTS} ใบเพื่อเปรียบเทียบว่าใบไหนดีกว่ากัน — ตัดสินจากบทสรุปพลัง
        เลขศาสตร์ทะเบียนรถ (Mode 1) และวิเคราะห์คู่เลขที่ปรากฏ (Mode 2) เกณฑ์เดียวกับที่ใช้ใน
        &quot;แนะนำเลขทะเบียน (Batch)&quot;
      </div>

      <div
        className="compare-grid compare-form-grid"
        style={{ gridTemplateColumns: `repeat(${slots.length}, 1fr)` }}
      >
        {slots.map((fields, i) => (
          <div className="form-card compare-slot-form" key={i}>
            <div className="compare-slot-label">{slotLabel(i)}</div>
            <div className="form-row">
              <div className="field">
                <label htmlFor={`compareFrontDigit${i}`}>เลขหน้า (ถ้ามี)</label>
                <input
                  id={`compareFrontDigit${i}`}
                  value={fields.frontDigit}
                  maxLength={1}
                  placeholder="1"
                  onChange={(e) => {
                    const next = e.target.value.replace(/[^0-9]/g, '');
                    setSlots((prev) => updateSlotAt(prev, i, { frontDigit: next }));
                    if (shouldAutoAdvance(next, 1)) letter1Refs.current[i]?.focus();
                  }}
                />
              </div>
              <div className="field">
                <label htmlFor={`compareLetter1_${i}`}>อักษร 1</label>
                <input
                  id={`compareLetter1_${i}`}
                  ref={(el) => {
                    letter1Refs.current[i] = el;
                  }}
                  value={fields.letter1}
                  maxLength={1}
                  placeholder="ก"
                  onChange={(e) => {
                    const next = e.target.value.slice(-1);
                    setSlots((prev) => updateSlotAt(prev, i, { letter1: next }));
                    if (shouldAutoAdvance(next, 1)) letter2Refs.current[i]?.focus();
                  }}
                />
              </div>
              <div className="field">
                <label htmlFor={`compareLetter2_${i}`}>อักษร 2</label>
                <input
                  id={`compareLetter2_${i}`}
                  ref={(el) => {
                    letter2Refs.current[i] = el;
                  }}
                  value={fields.letter2}
                  maxLength={1}
                  placeholder="ก"
                  // ห้ามเพิ่ม auto-advance ตรงนี้โดยเจตนา — ตามสเปก อักษร 2 พิมพ์เสร็จแล้วต้อง
                  // ปล่อยให้ผู้ใช้กด Tab เองไปช่องเลขท้าย ไม่ auto-advance ต่อ ไม่ว่า slot ไหนก็ตาม
                  // (ต่างจาก เลขหน้า/อักษร 1 ด้านบนที่ auto-advance ไปช่องถัดไปผ่าน letter1Refs/
                  // letter2Refs) — จึงไม่มี ref array สำหรับช่องเลขท้ายเลยในไฟล์นี้ด้วยเหตุผลเดียวกัน
                  onChange={(e) =>
                    setSlots((prev) => updateSlotAt(prev, i, { letter2: e.target.value.slice(-1) }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor={`compareTailDigits${i}`}>เลขท้าย (2-4 หลัก)</label>
                <input
                  id={`compareTailDigits${i}`}
                  value={fields.tailDigits}
                  maxLength={4}
                  placeholder="1111"
                  onChange={(e) =>
                    setSlots((prev) =>
                      updateSlotAt(prev, i, { tailDigits: e.target.value.replace(/[^0-9]/g, '') }),
                    )
                  }
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {!allValid ? (
        <div className="ranking-empty">
          {hasStartedTyping
            ? `กรอกเลขทะเบียนให้ครบทั้ง ${MAX_COMPARE_SLOTS} ใบ (เลขหน้า, หมวดอักษรไทย 2 ตัว, เลขท้าย 2-4 หลัก) ก่อนจึงจะเปรียบเทียบได้`
            : `กรอกเลขทะเบียนด้านบนให้ครบทั้ง ${MAX_COMPARE_SLOTS} ใบก่อนจึงจะเปรียบเทียบได้`}
        </div>
      ) : (
        results && (
          <>
            <div className="compare-winner-banner">{winnerSummary}</div>

            <div
              className="compare-grid compare-result-grid"
              style={{ gridTemplateColumns: `repeat(${results.length}, 1fr)` }}
            >
              {results.map((result, i) => (
                <ComparisonResultCard
                  key={i}
                  result={result}
                  label={slotLabel(i)}
                  isWinner={result.rank === Math.min(...results.map((r) => r.rank))}
                />
              ))}
            </div>
          </>
        )
      )}

      <div className="section-note">
        <strong>หมายเหตุ:</strong> การจัดอันดับ &quot;ใครดีกว่า&quot; ใช้เกณฑ์เดียวกับ &quot;แนะนำเลข
        ทะเบียน (Batch)&quot; คือดูคู่เสีย (Mode 2 คู่เลขที่ปรากฏ) เป็นอันดับแรก แล้วจึงดูคะแนนรวม
        (Mode 1+2+3) · อายตนะ6 และธาตุจีนแสดงไว้เป็นข้อมูลประกอบเท่านั้น ไม่มีผลต่อการจัดอันดับ
      </div>
    </div>
  );
}
