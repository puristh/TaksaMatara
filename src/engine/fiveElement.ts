/**
 * ธาตุจีน 5 ธาตุ (Wu Xing) — พอร์ตจาก five_element_plate.py ตรงตามต้นฉบับทุกจุด
 * (He Tu digit->element mapping, generating/overcoming cycle, relation(), scoring,
 * parity flag, head-tail relation, 5-level verdict) ยกเว้น 2 จุดที่ปรับตามระบบนี้ตั้งใจ:
 *
 * 1. ใช้เฉพาะ tailDigits เท่านั้น (ไม่รวม frontDigit เหมือน extract_digits ต้นฉบับที่ดึง
 *    ทุกตัวเลขจาก plate string) — ให้สอดคล้องกับ Mode 2 ที่มีอยู่แล้วซึ่งเป็น tail-only
 *    เหมือนกัน เพราะโครงสร้างป้ายทะเบียนไทยมีอักษร 2 ตัวคั่นกลาง ทำให้อ่านเป็นลำดับ
 *    ต่อเนื่องข้ามอักษรไม่เป็นธรรมชาติ
 * 2. ไม่ใช้ core_digits() ที่ตัดเอา 4 หลักสุดท้าย — วิเคราะห์ tailDigits ทั้งหมดตรงๆ
 *    เพราะระบบนี้กำหนดไว้แล้วว่า tailDigits ยาว 2-4 หลัก อยู่ในช่วงที่เหมาะสมอยู่แล้ว
 *
 * ระบบนี้เป็นความเชื่อสายจีน แยกต่างหากจากเลขศาสตร์ไทย (Mode 1-3) โดยสิ้นเชิง — ผลลัพธ์
 * จากไฟล์นี้ต้องไม่ถูกนำไปรวม/มีผลต่อ PlateVerdict.verdict หรือ badges เดิมเด็ดขาด
 */

export type ElementKey = 'wood' | 'fire' | 'earth' | 'metal' | 'water';

export type ElementRelation =
  | 'generates'
  | 'generated_by'
  | 'overcomes'
  | 'overcome_by'
  | 'same'
  | 'unknown';

export type FiveElementVerdictLevel = 'excellent' | 'good' | 'neutral' | 'caution' | 'bad';

const DIGIT_ELEMENT_KEY: Record<string, ElementKey> = {
  '0': 'earth',
  '5': 'earth',
  '1': 'water',
  '6': 'water',
  '2': 'fire',
  '7': 'fire',
  '3': 'wood',
  '8': 'wood',
  '4': 'metal',
  '9': 'metal',
};

const ELEMENT_THAI: Record<ElementKey, string> = {
  wood: 'ไม้ (木)',
  fire: 'ไฟ (火)',
  earth: 'ดิน (土)',
  metal: 'ทอง (金)',
  water: 'น้ำ (水)',
};

/** 相生 Generating cycle: wood -> fire -> earth -> metal -> water -> wood */
const GENERATES: Record<ElementKey, ElementKey> = {
  wood: 'fire',
  fire: 'earth',
  earth: 'metal',
  metal: 'water',
  water: 'wood',
};

/** 相剋 Overcoming cycle: wood -> earth -> water -> fire -> metal -> wood */
const OVERCOMES: Record<ElementKey, ElementKey> = {
  wood: 'earth',
  earth: 'water',
  water: 'fire',
  fire: 'metal',
  metal: 'wood',
};

const RELATION_LABEL_TH: Record<ElementRelation, string> = {
  generates: 'เกื้อกัน (相生) ✅',
  generated_by: 'เกื้อกัน (相生) ✅',
  overcomes: 'ขัดกัน (相剋) ⚠️',
  overcome_by: 'ขัดกัน (相剋) ⚠️',
  same: 'เสมอกัน (比和) ➖',
  unknown: 'ไม่ทราบ',
};

const RELATION_SCORE: Record<ElementRelation, number> = {
  generates: 1,
  generated_by: 1,
  overcomes: -1,
  overcome_by: -1,
  same: 0,
  unknown: 0,
};

/**
 * ความสัมพันธ์ธาตุจาก a ไป b — ตรงตาม relation() ในต้นฉบับ Python ทุกจุด รวมถึง
 * fallback 'unknown' ที่ไม่ควรเกิดขึ้นจริง (มีแค่ 5 ธาตุใน cycle เดียว) แต่คงไว้ตามต้นฉบับ
 */
function relation(aKey: ElementKey, bKey: ElementKey): ElementRelation {
  if (aKey === bKey) return 'same';
  if (GENERATES[aKey] === bKey) return 'generates';
  if (GENERATES[bKey] === aKey) return 'generated_by';
  if (OVERCOMES[aKey] === bKey) return 'overcomes';
  if (OVERCOMES[bKey] === aKey) return 'overcome_by';
  return 'unknown';
}

export interface DigitElement {
  digit: string;
  element: ElementKey;
  elementLabel: string;
}

export interface ElementPairResult {
  a: string;
  b: string;
  aElement: ElementKey;
  bElement: ElementKey;
  aElementLabel: string;
  bElementLabel: string;
  relation: ElementRelation;
  relationLabel: string;
}

export interface FiveElementResult {
  tailDigits: string;
  /** true เมื่อ tailDigits สั้นกว่า 2 หลัก — ไม่ควรเกิดขึ้นจริงเพราะระบบกำหนด tailDigits
   * ไว้ 2-4 หลักเสมอ แต่คงไว้ตามต้นฉบับ Python (analyze_plate เช็ค len(core) < 2) */
  insufficientData: boolean;
  digitElements: DigitElement[];
  pairs: ElementPairResult[];
  score: number;
  parityFlag: string;
  headTailRelation: ElementRelation;
  headTailRelationLabel: string;
  verdictLevel: FiveElementVerdictLevel;
  verdict: string;
  verdictDetail: string;
}

export function analyzeFiveElement(tailDigits: string): FiveElementResult {
  const core = tailDigits;

  if (core.length < 2) {
    return {
      tailDigits,
      insufficientData: true,
      digitElements: [],
      pairs: [],
      score: 0,
      parityFlag: '',
      headTailRelation: 'unknown',
      headTailRelationLabel: '',
      verdictLevel: 'neutral',
      verdict: 'ข้อมูลไม่พอวิเคราะห์',
      verdictDetail: 'ต้องมีตัวเลขอย่างน้อย 2 หลักถึงจะดูความสัมพันธ์ของธาตุได้',
    };
  }

  const digits = core.split('');

  const digitElements: DigitElement[] = digits.map((d) => {
    const element = DIGIT_ELEMENT_KEY[d];
    return { digit: d, element, elementLabel: ELEMENT_THAI[element] };
  });

  const pairs: ElementPairResult[] = [];
  let score = 0;
  for (let i = 0; i < digits.length - 1; i++) {
    const a = digits[i];
    const b = digits[i + 1];
    const aElement = DIGIT_ELEMENT_KEY[a];
    const bElement = DIGIT_ELEMENT_KEY[b];
    const rel = relation(aElement, bElement);
    score += RELATION_SCORE[rel];
    pairs.push({
      a,
      b,
      aElement,
      bElement,
      aElementLabel: ELEMENT_THAI[aElement],
      bElementLabel: ELEMENT_THAI[bElement],
      relation: rel,
      relationLabel: RELATION_LABEL_TH[rel],
    });
  }

  const odds = digits.filter((d) => Number(d) % 2 === 1).length;
  const evens = digits.length - odds;
  let parityFlag: string;
  if (odds === digits.length) {
    parityFlag = 'เลขคี่ล้วน (孤陽 ยางล้วน) — พลังงานสุดขั้ว ขาดความสมดุล';
  } else if (evens === digits.length) {
    parityFlag = 'เลขคู่ล้วน (孤陰 ยินล้วน) — พลังงานสุดขั้ว ขาดความสมดุล';
  } else {
    parityFlag = 'มีทั้งเลขคี่และเลขคู่ผสมกัน — สมดุลดี';
  }

  const headKey = DIGIT_ELEMENT_KEY[digits[0]];
  const tailKey = DIGIT_ELEMENT_KEY[digits[digits.length - 1]];
  const headTailRelation = relation(headKey, tailKey);

  // Overall verdict: n-1 คู่ทั้งหมด; score อยู่ในช่วง [-(n-1), +(n-1)]
  const nPairs = pairs.length;
  let verdictLevel: FiveElementVerdictLevel;
  let verdict: string;
  if (score >= Math.max(1, nPairs - 1)) {
    verdictLevel = 'excellent';
    verdict = 'ดีมาก — ธาตุไหลลื่นตลอดสาย';
  } else if (score > 0) {
    verdictLevel = 'good';
    verdict = 'ดี — ธาตุเกื้อกันเป็นส่วนใหญ่';
  } else if (score === 0) {
    verdictLevel = 'neutral';
    verdict = 'ปานกลาง — ธาตุเสมอกัน/สมดุล ไม่ไหลลื่นแต่ก็ไม่ขัดกัน';
  } else if (score > -nPairs) {
    verdictLevel = 'caution';
    verdict = 'ควรระวัง — มีจุดที่ธาตุขัดกัน';
  } else {
    verdictLevel = 'bad';
    verdict = 'ไม่แนะนำ — ธาตุขัดกันตลอดสาย';
  }

  const verdictDetail = `คะแนนธาตุ (สูตร: +1 ต่อคู่ที่เกื้อกัน, -1 ต่อคู่ที่ขัดกัน, 0 ต่อคู่ที่เสมอกัน) = ${score} จาก ${nPairs} คู่ที่ตรวจสอบ`;

  return {
    tailDigits,
    insufficientData: false,
    digitElements,
    pairs,
    score,
    parityFlag,
    headTailRelation,
    headTailRelationLabel: RELATION_LABEL_TH[headTailRelation],
    verdictLevel,
    verdict,
    verdictDetail,
  };
}
