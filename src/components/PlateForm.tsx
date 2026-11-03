import { useRef, useState, type FormEvent } from 'react';
import { provincePlaceholder } from './plateLayout';
import type { PlateInput } from '../engine';
import { isOptionalFrontDigitField, parseOptionalFrontDigit } from '../engine/plateText';

interface PlateFormProps {
  onSubmit: (input: PlateInput) => void;
}

export const THAI_LETTER_PATTERN = /^[ก-ฮ]$/;

/**
 * true เมื่อกรอกครบ maxLength ของช่องนั้นแล้ว — ใช้ตัดสินใจว่าควร auto-advance focus ไปช่อง
 * ถัดไปหรือยัง (เลขหน้า -> อักษร 1 -> อักษร 2 เท่านั้น เลขท้ายไม่ auto-advance ต่อ) แยกออกมาเป็น
 * pure function เพื่อเทสได้ตรงๆ โดยไม่ต้องพึ่ง jsdom/DOM จริง
 */
export function shouldAutoAdvance(value: string, maxLength: number): boolean {
  return value.length >= maxLength;
}

/**
 * ฟอร์มต้องว่างเปล่าตอนโหลดหน้าครั้งแรก (ไม่ใช่ '1 กข 59' ที่ฝังไว้เดิม เพราะทำให้ผู้ใช้ใหม่
 * งงว่าเป็นตัวอย่างหรือข้อมูลจริง) — export ไว้แยกเพื่อเทสได้ตรงๆ ว่าไม่มีค่า default หลุดกลับมา
 */
export const PLATE_FORM_DEFAULTS = {
  frontDigit: '',
  letter1: '',
  letter2: '',
  tailDigits: '',
  province: '',
};

export type PlateFormFields = typeof PLATE_FORM_DEFAULTS;

/**
 * ตรวจฟอร์มตอนกด "วิเคราะห์ทะเบียน" — แยกเป็น pure function เพื่อเทสได้โดยไม่ต้อง render
 * เลขหน้าไม่บังคับ (ทะเบียนหมวดเก่าเช่น "ศร 91" ไม่มีเลขหน้า): ว่าง -> frontDigit null
 * ไม่ใช่ 0 ส่วนอักษร 2 ตัวและเลขท้ายยังบังคับเหมือนเดิม
 */
export function validatePlateForm(
  fields: PlateFormFields,
): { input: PlateInput; error: null } | { input: null; error: string } {
  if (!isOptionalFrontDigitField(fields.frontDigit)) {
    return { input: null, error: 'เลขนำหน้าต้องเป็นตัวเลข 0-9 หนึ่งหลัก (หรือเว้นว่างถ้าไม่มี)' };
  }
  if (!THAI_LETTER_PATTERN.test(fields.letter1) || !THAI_LETTER_PATTERN.test(fields.letter2)) {
    return { input: null, error: 'หมวดอักษรต้องเป็นพยัญชนะไทย 2 ตัว' };
  }
  if (!/^[0-9]{2,4}$/.test(fields.tailDigits)) {
    return { input: null, error: 'เลขท้ายต้องเป็นตัวเลข 2-4 หลัก' };
  }
  return {
    input: {
      frontDigit: parseOptionalFrontDigit(fields.frontDigit),
      thaiLetters: [fields.letter1, fields.letter2],
      tailDigits: fields.tailDigits,
      province: fields.province.trim() || undefined,
    },
    error: null,
  };
}

export function PlateForm({ onSubmit }: PlateFormProps) {
  const [frontDigit, setFrontDigit] = useState(PLATE_FORM_DEFAULTS.frontDigit);
  const [letter1, setLetter1] = useState(PLATE_FORM_DEFAULTS.letter1);
  const [letter2, setLetter2] = useState(PLATE_FORM_DEFAULTS.letter2);
  const [tailDigits, setTailDigits] = useState(PLATE_FORM_DEFAULTS.tailDigits);
  const [province, setProvince] = useState(PLATE_FORM_DEFAULTS.province);
  const [error, setError] = useState<string | null>(null);

  const letter1Ref = useRef<HTMLInputElement>(null);
  const letter2Ref = useRef<HTMLInputElement>(null);

  const validate = (): PlateInput | null => {
    const result = validatePlateForm({ frontDigit, letter1, letter2, tailDigits, province });
    setError(result.error);
    return result.input;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const input = validate();
    if (input) onSubmit(input);
  };

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <div className="form-row">
        <div className="field">
          <label htmlFor="frontDigit">เลขหน้า (ถ้ามี)</label>
          <input
            id="frontDigit"
            value={frontDigit}
            maxLength={1}
            placeholder="1"
            onChange={(e) => {
              const next = e.target.value.replace(/[^0-9]/g, '');
              setFrontDigit(next);
              if (shouldAutoAdvance(next, 1)) letter1Ref.current?.focus();
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="letter1">อักษร 1</label>
          <input
            id="letter1"
            ref={letter1Ref}
            value={letter1}
            maxLength={1}
            placeholder="ก"
            onChange={(e) => {
              const next = e.target.value.slice(-1);
              setLetter1(next);
              if (shouldAutoAdvance(next, 1)) letter2Ref.current?.focus();
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="letter2">อักษร 2</label>
          <input
            id="letter2"
            ref={letter2Ref}
            value={letter2}
            maxLength={1}
            placeholder="ก"
            // ห้ามเพิ่ม auto-advance ตรงนี้โดยเจตนา — ตามสเปก อักษร 2 พิมพ์เสร็จแล้วต้องปล่อยให้
            // ผู้ใช้กด Tab เองไปช่องเลขท้าย ไม่ auto-advance ต่อ (ต่างจาก เลขหน้า/อักษร 1 ด้านบน
            // ที่ auto-advance ไปช่องถัดไป) — ไม่มี ref ของช่องเลขท้ายในไฟล์นี้เลยด้วยเหตุผลเดียวกัน
            onChange={(e) => setLetter2(e.target.value.slice(-1))}
          />
        </div>
        <div className="field">
          <label htmlFor="tailDigits">เลขท้าย (2-4 หลัก)</label>
          <input
            id="tailDigits"
            value={tailDigits}
            maxLength={4}
            placeholder="1111"
            onChange={(e) => setTailDigits(e.target.value.replace(/[^0-9]/g, ''))}
          />
        </div>
        <div className="field wide">
          <label htmlFor="province">จังหวัด (ไม่บังคับ)</label>
          <input
            id="province"
            className="province-input"
            value={province}
            placeholder={provincePlaceholder()}
            onChange={(e) => setProvince(e.target.value)}
          />
        </div>
        <button type="submit">วิเคราะห์ทะเบียน</button>
      </div>
      {error && <div className="form-error">{error}</div>}
    </form>
  );
}
