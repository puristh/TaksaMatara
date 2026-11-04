import { useMemo, useState } from 'react';
import { analyzeTaksaKalakini, resolveTaksaDay } from '../engine/taksaKalakini';
import type { WednesdayPeriod } from '../engine/taksaKalakini';
import { analyzeShadowPower } from '../engine/shadowPower';
import { getDayOfWeekFromDate, isValidCalendarDate } from '../engine/dateOfWeek';
import type { WeekDay } from '../engine/dateOfWeek';
import { FEATURE_FLAGS } from '../config/featureFlags';
import type { PlateInput } from '../engine';
import { PlateWithTags } from './PlateWithTags';
import {
  frontDigitToField,
  isOptionalFrontDigitField,
  parseOptionalFrontDigit,
} from '../engine/plateText';

type DetailModeInput = Pick<PlateInput, 'frontDigit' | 'thaiLetters' | 'tailDigits'>;

interface BirthdayCompatPageProps {
  initialInput: DetailModeInput | null;
  /** ปลายทางจริง (หน้าเดี่ยวหรือ Batch ranking) ตัดสินใจโดยผู้เรียก (App.tsx) ตาม return
   * context ที่มากับลิงก์ที่พาเข้ามาหน้านี้ — หน้านี้ไม่จำเป็นต้องรู้เรื่อง context นั้นเลย
   * แค่เรียก onBack เฉยๆ (ลิงก์ "เช็คกับวันเกิด →" มีทั้งใน RankingPanel -> 'batch' และใน
   * ResultCard ของหน้าวิเคราะห์เลขเดี่ยว -> 'single'; เข้าตรงๆ จากแท็บก็ fallback เป็น 'single') */
  onBack: () => void;
  /** ข้อความปุ่มกลับ เปลี่ยนตามต้นทาง — คำนวณไว้แล้วจากฝั่งผู้เรียก */
  backLabel: string;
}

/** การ์ดภาพป้ายของทะเบียนที่กำลังวิเคราะห์ (ส่วนบนของผล) — แยกออกมาเพื่อเทสได้โดยไม่ต้องกรอกฟอร์ม */
export function BirthdayPlateCard({ input }: { input: DetailModeInput }) {
  return (
    <div className="birthday-compat-card birthday-compat-plate">
      <PlateWithTags input={input} />
    </div>
  );
}

export const THAI_LETTER_PATTERN = /^[ก-ฮ]$/;

/**
 * ค่าเริ่มต้นตอนเข้าหน้านี้ตรงๆ จากแท็บ (ไม่มี initialInput ส่งมา) ต้องว่างเปล่า เหมือนที่แก้
 * ไปแล้วใน PlateForm.tsx/RankingPanel.tsx — เฉพาะกรณีมี initialInput (มาจากลิงก์ Batch
 * ranking) เท่านั้นที่ยัง prefill ข้อมูลจริงเหมือนเดิมทุกประการ (ไม่ใช้ค่าเหล่านี้เลยในกรณีนั้น)
 */
export const BIRTHDAY_COMPAT_DEFAULTS = {
  frontDigit: '',
  letter1: '',
  letter2: '',
  tailDigits: '',
};

export interface PlateFieldValues {
  frontDigit: string;
  letter1: string;
  letter2: string;
  tailDigits: string;
}

/**
 * แยกออกมาเป็น pure function เพื่อเทสได้ตรงๆ ว่า "ถ้ามี initialInput ต้องใช้ค่าจริงเสมอ
 * ไม่ใช่ BIRTHDAY_COMPAT_DEFAULTS" — นี่คือ contract ของการ prefill จากลิงก์ Batch ranking
 * ที่ห้ามพังเด็ดขาด
 */
export function resolvePlateFieldDefaults(
  initialInput: DetailModeInput | null,
): PlateFieldValues {
  if (!initialInput) return BIRTHDAY_COMPAT_DEFAULTS;
  return {
    frontDigit: frontDigitToField(initialInput.frontDigit),
    letter1: initialInput.thaiLetters[0],
    letter2: initialInput.thaiLetters[1],
    tailDigits: initialInput.tailDigits,
  };
}

const MONTH_LABELS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

const WEEKDAY_LABEL: Record<WeekDay, string> = {
  0: 'วันอาทิตย์',
  1: 'วันจันทร์',
  2: 'วันอังคาร',
  3: 'วันพุธ',
  4: 'วันพฤหัสบดี',
  5: 'วันศุกร์',
  6: 'วันเสาร์',
};

/**
 * ถอดรหัสทะเบียนตามวันเกิด — Mode 6 (ทักษาปกรณ์/กาลกิณี) + Mode 7 (พลังเงา) ต้องมีวันเกิด
 * เจ้าของรถ ต่างจากธาตุจีน (Mode 4) และอายตนะ6 (Mode 8) ที่ไม่ต้องมี — หน้านี้มีฟอร์มกรอก
 * เลขทะเบียนของตัวเอง (ไม่พึ่ง PlateForm ที่เป็นแบบ submit-สะสมรายการ เพราะหน้านี้ต้องการ
 * live-recompute แบบเดียวกับ RankingPanel) รับ initialInput มาพรีฟิลได้จากลิงก์ภายนอก
 * (เช่นจากตาราง Batch ranking) แต่ผู้ใช้แก้ไขต่อได้อิสระหลังจากนั้น
 */
export function BirthdayCompatPage({ initialInput, onBack, backLabel }: BirthdayCompatPageProps) {
  const plateFieldDefaults = resolvePlateFieldDefaults(initialInput);
  const [frontDigit, setFrontDigit] = useState(plateFieldDefaults.frontDigit);
  const [letter1, setLetter1] = useState(plateFieldDefaults.letter1);
  const [letter2, setLetter2] = useState(plateFieldDefaults.letter2);
  const [tailDigits, setTailDigits] = useState(plateFieldDefaults.tailDigits);

  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYearBE, setBirthYearBE] = useState('');
  const [wednesdayPeriod, setWednesdayPeriod] = useState<WednesdayPeriod>('day');

  const isPlateValid =
    isOptionalFrontDigitField(frontDigit) &&
    THAI_LETTER_PATTERN.test(letter1) &&
    THAI_LETTER_PATTERN.test(letter2) &&
    /^[0-9]{2,4}$/.test(tailDigits);

  // เหมือน pattern ที่แก้ไปแล้วใน RankingPanel.tsx: ฟอร์มนี้ไม่มีปุ่ม submit (live-recompute)
  // ต้องกันไม่ให้ form-error โชว์ตั้งแต่โหลดหน้าครั้งแรกที่ยังว่างเปล่า (ค่าว่างเปล่าไม่ใช่
  // "กรอกผิด" แค่ยังไม่ได้กรอก) — เมื่อมี initialInput มาแล้ว (prefill จาก Batch ranking)
  // isPlateValid จะ true ตั้งแต่ต้นอยู่แล้วเพราะข้อมูลที่ prefill มาถูกต้องเสมอ จึงไม่กระทบ flow นั้น
  const hasStartedTypingPlate =
    frontDigit !== '' || letter1 !== '' || letter2 !== '' || tailDigits !== '';

  const dayNum = Number(birthDay);
  const monthNum = Number(birthMonth);
  const yearNum = Number(birthYearBE);
  const isDateComplete = birthDay !== '' && birthMonth !== '' && birthYearBE !== '';
  const isDateValid = isDateComplete && isValidCalendarDate(dayNum, monthNum, yearNum);

  const weekDay: WeekDay | null = useMemo(
    () => (isDateValid ? getDayOfWeekFromDate(dayNum, monthNum, yearNum) : null),
    [isDateValid, dayNum, monthNum, yearNum],
  );

  const needsWednesdayQuestion = weekDay === 3;

  const taksaDay = useMemo(() => {
    if (weekDay === null) return null;
    return resolveTaksaDay(weekDay, needsWednesdayQuestion ? wednesdayPeriod : undefined);
  }, [weekDay, needsWednesdayQuestion, wednesdayPeriod]);

  const canCompute = isPlateValid && taksaDay !== null;

  const plateInput: DetailModeInput | null = useMemo(
    () =>
      canCompute
        ? { frontDigit: parseOptionalFrontDigit(frontDigit), thaiLetters: [letter1, letter2], tailDigits }
        : null,
    [canCompute, frontDigit, letter1, letter2, tailDigits],
  );

  const taksaResult = useMemo(
    () => (plateInput && taksaDay ? analyzeTaksaKalakini(plateInput, taksaDay) : null),
    [plateInput, taksaDay],
  );

  const shadowResult = useMemo(
    () => (plateInput && taksaDay ? analyzeShadowPower(plateInput, taksaDay) : null),
    [plateInput, taksaDay],
  );

  const showTaksa = FEATURE_FLAGS.taksaKalakiniMode && taksaResult;
  const showShadow = FEATURE_FLAGS.shadowPowerMode && shadowResult;

  return (
    <div className="birthday-compat-page">
      <button type="button" className="detail-page-back-link" onClick={onBack}>
        {backLabel}
      </button>

      <div className="eyebrow birthday-compat-eyebrow">Taksa · ทักษา</div>
      <h1>ถอดรหัสทะเบียนตามวันเกิด</h1>

      <div className="birthday-compat-disclaimer">
        ระบบทักษา/พลังเงาเป็นศาสตร์สายเดียวกับเลขศาสตร์ไทย (Mode 1-3) และอายตนะ6 แต่ยังคงเป็นมุมมอง
        แยกต่างหาก อาจให้ผลไม่ตรงกับ Verdict หลัก ธาตุจีน หรืออายตนะ6 เพราะเป็นคนละหลักเกณฑ์การตีความ
      </div>

      <div className="form-card">
        <div className="form-row">
          <div className="field">
            <label htmlFor="bcFrontDigit">เลขหน้า (ถ้ามี)</label>
            <input
              id="bcFrontDigit"
              value={frontDigit}
              maxLength={1}
              placeholder="1"
              onChange={(e) => setFrontDigit(e.target.value.replace(/[^0-9]/g, ''))}
            />
          </div>
          <div className="field">
            <label htmlFor="bcLetter1">อักษร 1</label>
            <input
              id="bcLetter1"
              value={letter1}
              maxLength={1}
              placeholder="ก"
              onChange={(e) => setLetter1(e.target.value.slice(-1))}
            />
          </div>
          <div className="field">
            <label htmlFor="bcLetter2">อักษร 2</label>
            <input
              id="bcLetter2"
              value={letter2}
              maxLength={1}
              placeholder="ก"
              onChange={(e) => setLetter2(e.target.value.slice(-1))}
            />
          </div>
          <div className="field">
            <label htmlFor="bcTailDigits">เลขท้าย (2-4 หลัก)</label>
            <input
              id="bcTailDigits"
              value={tailDigits}
              maxLength={4}
              placeholder="1111"
              onChange={(e) => setTailDigits(e.target.value.replace(/[^0-9]/g, ''))}
            />
          </div>
        </div>
        {!isPlateValid && hasStartedTypingPlate && (
          <div className="form-error">
            กรอกเลขหน้า 0-9, หมวดอักษรไทย 2 ตัว, และเลขท้าย 2-4 หลักให้ครบ
          </div>
        )}

        <div className="form-row birthday-compat-date-row">
          <div className="field">
            <label htmlFor="bcDay">วันเกิด</label>
            <input
              id="bcDay"
              value={birthDay}
              maxLength={2}
              placeholder="เช่น 15"
              onChange={(e) => setBirthDay(e.target.value.replace(/[^0-9]/g, ''))}
            />
          </div>
          <div className="field">
            <label htmlFor="bcMonth">เดือนเกิด</label>
            <select id="bcMonth" value={birthMonth} onChange={(e) => setBirthMonth(e.target.value)}>
              <option value="">เลือกเดือน</option>
              {MONTH_LABELS.map((label, i) => (
                <option key={label} value={i + 1}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="bcYear">ปีเกิด (พ.ศ.)</label>
            <input
              id="bcYear"
              value={birthYearBE}
              maxLength={4}
              placeholder="เช่น 2540"
              onChange={(e) => setBirthYearBE(e.target.value.replace(/[^0-9]/g, ''))}
            />
          </div>
        </div>
        {isDateComplete && !isDateValid && (
          <div className="form-error">วันที่ไม่ถูกต้อง กรุณาตรวจสอบวัน/เดือน/ปีอีกครั้ง</div>
        )}

        {needsWednesdayQuestion && (
          <div className="birthday-compat-wednesday-row">
            <span>เกิดวันพุธ — เกิดช่วงกลางวันหรือกลางคืน?</span>
            <div className="limit-buttons">
              <button
                type="button"
                className={wednesdayPeriod === 'day' ? 'active' : ''}
                onClick={() => setWednesdayPeriod('day')}
              >
                กลางวัน (ก่อน 18:00)
              </button>
              <button
                type="button"
                className={wednesdayPeriod === 'night' ? 'active' : ''}
                onClick={() => setWednesdayPeriod('night')}
              >
                กลางคืน (หลัง 18:00)
              </button>
            </div>
          </div>
        )}

        {weekDay !== null && (
          <div className="birthday-compat-weekday-note">
            วันเกิด: {WEEKDAY_LABEL[weekDay]}
            {needsWednesdayQuestion
              ? ` (${wednesdayPeriod === 'day' ? 'กลางวัน' : 'กลางคืน'})`
              : ''}
          </div>
        )}
      </div>

      {!canCompute ? (
        <div className="birthday-compat-empty">
          กรอกเลขทะเบียนและวันเกิดให้ครบก่อนจึงจะวิเคราะห์ได้
          {needsWednesdayQuestion ? ' (รวมถึงเลือกช่วงเวลาเกิดวันพุธด้วย)' : ''}
        </div>
      ) : (
        <>
          {/* ทะเบียนที่กำลังวิเคราะห์ — ภาพป้ายแบบเดียวกับหน้าเลขเดี่ยว (หน้านี้ไม่มีช่องจังหวัด จึงใช้ค่าเริ่มต้น) */}
          {plateInput && <BirthdayPlateCard input={plateInput} />}
          {showTaksa && taksaResult && (
            <div className="birthday-compat-card">
              <div className="birthday-compat-section-title">Mode 6 · ทักษาปกรณ์/กาลกิณี</div>
              <div
                className={`birthday-compat-verdict-banner ${
                  taksaResult.hasKalakini ? 'bad' : 'good'
                }`}
              >
                {taksaResult.verdict}
              </div>
              <ul className="birthday-compat-letter-list">
                {taksaResult.letterRoles.map((l, i) => (
                  <li key={i}>
                    อักษร <span className="pair-code">{l.letter}</span> → ดาว{l.star} → บทบาท
                    &quot;{l.role}&quot; ({l.roleMeaning})
                    {l.isKalakini && <span className="birthday-compat-avoid-tag">ควรเลี่ยง</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {showShadow && shadowResult && (
            <div className="birthday-compat-card">
              <div className="birthday-compat-section-title">Mode 7 · พลังเงา</div>
              <ul className="birthday-compat-letter-list">
                {shadowResult.letters.map((l, i) => (
                  <li key={i}>
                    อักษร <span className="pair-code">{l.letter}</span> → ดาว{l.star} → บทบาท
                    &quot;{l.role}&quot; ({l.roleMeaning}) → พลัง {l.power}
                  </li>
                ))}
              </ul>
              <div className="birthday-compat-total-power">
                ผลรวมค่าพลัง: {shadowResult.totalPower}
              </div>
              <div className="birthday-compat-shadow-note">
                <strong>หมายเหตุ:</strong> มีความเชื่อของสำนักนี้ว่าผลรวมพลังเงาจะสัมพันธ์กับอายตนะ6
                เสมอ — เป็นความเชื่อของสำนักนี้เท่านั้น ยังไม่ได้พิสูจน์ทางคณิตศาสตร์อิสระ ไม่ใช่ข้อเท็จจริง
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
