/**
 * ตรรกะจัดวางข้อความของภาพจำลองป้ายทะเบียน (PlateImage.tsx) — pure function ล้วน ไม่แตะ DOM
 * เพื่อเทสใน vitest ได้โดยไม่ต้องมี jsdom
 *
 * ค่าเลย์เอาต์ทั้งหมดอยู่ใน PLATE_LAYOUT ด้านล่าง วัดจากภาพถ่ายป้ายจริง 13 แผ่น (ภาพอ้างอิงเก็บไว้
 * ในเครื่องที่ ref/ ไม่อยู่ใน git) หลังแก้มุมกล้องแล้ว — ค่าที่ไม่มีภาพรองรับพอจะระบุว่า "ประมาณการ"
 *
 * ความกว้าง/ตำแหน่ง glyph ใช้ตาราง metric ที่ดึงจากไฟล์ฟอนต์ที่ฝังไว้จริง จึงคำนวณได้แม่นโดยไม่ต้อง
 * วัดใน DOM และไม่ยืด/บีบ glyph เลย (ย่อ/ขยายตามสัดส่วนเท่านั้น) — ฟอนต์ Noto Sans Thai Looped
 * (OFL) instance คงที่ 2 ตัวจากแกน wdth ของฟอนต์ต้นฉบับ ไม่ได้แก้ glyph:
 * - บรรทัดหลัก: …-PlateSubset-wdth70.woff2 (wght 800 wdth 70) — วัดจากภาพจริง: ตัวเลข wdth 80
 *   กว้างกว่าจริง ~12% อักษร ~30% ทำให้ช่องว่างระหว่างกลุ่มแคบกว่าจริง wdth 70 ลดช่องนี้ได้มาก
 * - บรรทัดจังหวัด: …-PlateSubset-wdth80.woff2 (wght 800 wdth 80) — ชื่อจังหวัดบนป้ายจริงกว้างกว่า
 *   ถ้าใช้ wdth 70 จะแคบกว่าจริง ~5% W (วัด 10/10)
 */
import type { AuctionNumberInfo, PlateInput } from '../engine/types';
import { formatPlateText, plateTextParts } from '../engine/plateText';
import { PLATE_IMAGE_DEFAULT_PROVINCE } from '../config/featureFlags';

export type PlateVariant = 'standard' | 'auction';

/** พิกัดภายใน viewBox ของป้าย */
export const PLATE_W = 440;

/**
 * ค่าเลย์เอาต์ทั้งหมดของป้าย — สัดส่วนต่อความกว้าง (W) หรือความสูง (H) ของป้าย
 * "วัด n/13" = ค่ามัธยฐานจากภาพป้ายจริงที่ใช้ได้ n แผ่น, "ประมาณการ" = ไม่มีภาพรองรับพอ (< 3)
 */
export const PLATE_LAYOUT = {
  /** กว้าง:สูง — วัด 13/13 มัธยฐาน 2.337 (ช่วง 2.21–2.43 รวมความคลาดจากมุมกล้อง) */
  aspect: 2.34,
  /** ระยะขอบซ้าย/ขวาน้อยสุดของข้อความหลัก — วัด: ต่ำสุดที่พบ 3.2% / 3.6% W (ป้าย 7 ตัวอักษร) */
  contentLeftW: 0.032,
  contentRightW: 0.036,
  /** ความสูงหมึกของตัวเลข — วัด 13/13 มัธยฐาน 41.5% H (ช่วง 38–46) ไม่ขึ้นกับจำนวนหลัก */
  digitHeightH: 0.415,
  /** ความสูงพยัญชนะไทย : ความสูงตัวเลข — วัด 13/13 มัธยฐาน 1.00 (ตัวเลข/อักษร 0.89–1.01) */
  letterToDigitHeight: 1.0,
  /** baseline ของบรรทัดหลัก (ขอบล่างตัวเลข) — วัด 13/13 มัธยฐาน 53.5% H */
  mainBaselineH: 0.535,
  /** กึ่งกลางกลุ่มหน้า (เลขหน้า+อักษร) — วัด 9/13 มัธยฐาน 24% W (อีก 4 แผ่นเป็นภาพร้านค้าที่อาจเป็นภาพจัดทำ) */
  leftGroupCenterW: 0.24,
  /** กึ่งกลางกลุ่มเลขท้าย — วัด 10/13 มัธยฐาน 72% W ทุกจำนวนหลัก (1–4) */
  tailGroupCenterW: 0.72,
  /** ช่องว่างน้อยสุดระหว่างกลุ่ม — วัด: ต่ำสุดที่พบ 5.8% W (ป้าย 7 ตัวอักษร) */
  minGroupGapW: 0.058,
  /** ระยะขอบบนน้อยสุดเมื่อต้องยกบรรทัดหลบหางอักษร — ประมาณการ */
  minTopMarginH: 0.05,
  /** ระยะห่างน้อยสุดระหว่างหางล่างอักษร (ฐ ญ ฎ ฏ ฤ ฦ) กับยอดบรรทัดจังหวัด — วัด 3/13 (ป้ายที่มี ฐ/ฎ)
   * ได้ 8.0–11.7% H ใช้ค่าต่ำสุด เพราะหางในฟอนต์นี้ยาวกว่าป้ายจริง ~2 เท่า (จริง ~5–10% H) ถ้าใช้ค่า
   * มัธยฐานตัวอักษรจะถูกย่อมากเกินไป */
  descenderClearanceH: 0.08,
  province: {
    /** ความสูงพยัญชนะ — วัด 13/13 มัธยฐาน 15.35% H (= 0.37 เท่าความสูงตัวเลข) */
    consonantHeightH: 0.1535,
    /** baseline — วัด 13/13 มัธยฐาน 88% H, กึ่งกลางแนวนอน (วัด 13/13 เยื้อง ≤ ±0.6% W ยกเว้น 1 แผ่น 2.2%) */
    baselineH: 0.88,
    /** ความกว้างสูงสุด — "กรุงเทพมหานคร" วัด 13/13 มัธยฐาน 69.4% W (ช่วง 68–76) ฟอนต์นี้กว้างกว่าจริง
     * ~7% ที่ความสูงเท่ากัน จึงจำกัดความกว้างตามค่าวัด (ตัวอักษรเตี้ยลงเล็กน้อยแทนการล้นกว้าง)
     * ชื่อจังหวัดที่ยาวกว่านี้ก็ถูกย่อให้ไม่เกินค่าเดียวกัน (ประมาณการ — ไม่มีภาพจังหวัดอื่น) */
    maxWidthW: 0.694,
  },
} as const;

export const PLATE_H = Math.round(PLATE_W / PLATE_LAYOUT.aspect);

/** metric ของฟอนต์บรรทัดหลัก wdth 70 (หน่วย em): [advance, left bearing, right bearing, yMin, yMax] */
type GlyphMetric = readonly [number, number, number, number, number];
const GLYPH_METRICS: Record<string, GlyphMetric> = {
  '0': [0.499, 0.037, 0.036, -0.010, 0.724],
  '1': [0.499, 0.044, 0.110, 0.000, 0.714],
  '2': [0.499, 0.025, 0.049, 0.000, 0.724],
  '3': [0.499, 0.033, 0.043, -0.010, 0.724],
  '4': [0.499, 0.017, 0.013, 0.000, 0.715],
  '5': [0.499, 0.050, 0.044, -0.010, 0.714],
  '6': [0.499, 0.035, 0.033, -0.010, 0.724],
  '7': [0.499, 0.036, 0.036, 0.000, 0.714],
  '8': [0.499, 0.032, 0.032, -0.010, 0.724],
  '9': [0.499, 0.032, 0.035, -0.010, 0.724],
  'ก': [0.521, 0.034, 0.053, 0.000, 0.575],
  'ข': [0.480, 0.015, 0.054, 0.000, 0.569],
  'ฃ': [0.500, 0.004, 0.054, 0.000, 0.571],
  'ค': [0.541, 0.041, 0.053, 0.000, 0.575],
  'ฅ': [0.541, 0.041, 0.053, 0.000, 0.571],
  'ฆ': [0.528, 0.010, 0.055, -0.009, 0.571],
  'ง': [0.445, 0.008, 0.049, 0.000, 0.571],
  'จ': [0.455, 0.024, 0.027, 0.000, 0.575],
  'ฉ': [0.523, 0.029, 0.030, -0.009, 0.575],
  'ช': [0.479, 0.015, 0.031, 0.000, 0.569],
  'ซ': [0.492, 0.004, 0.031, 0.000, 0.571],
  'ฌ': [0.747, 0.032, 0.055, -0.009, 0.575],
  'ญ': [0.737, 0.032, 0.055, -0.270, 0.575],
  'ฎ': [0.527, 0.014, 0.053, -0.248, 0.575],
  'ฏ': [0.527, 0.014, 0.053, -0.248, 0.575],
  'ฐ': [0.473, -0.001, 0.033, -0.322, 0.571],
  'ฑ': [0.532, 0.004, 0.054, 0.000, 0.571],
  'ฒ': [0.770, 0.034, 0.055, -0.009, 0.571],
  'ณ': [0.743, 0.032, 0.033, -0.009, 0.575],
  'ด': [0.544, 0.034, 0.053, 0.000, 0.575],
  'ต': [0.544, 0.034, 0.053, 0.000, 0.571],
  'ถ': [0.518, 0.032, 0.052, -0.009, 0.575],
  'ท': [0.548, 0.013, 0.054, 0.000, 0.571],
  'ธ': [0.470, 0.025, 0.035, 0.000, 0.571],
  'น': [0.526, 0.013, 0.033, -0.009, 0.571],
  'บ': [0.532, 0.020, 0.055, 0.000, 0.571],
  'ป': [0.532, 0.020, 0.055, 0.000, 0.760],
  'ผ': [0.546, 0.055, 0.055, 0.000, 0.571],
  'ฝ': [0.546, 0.055, 0.055, 0.000, 0.760],
  'พ': [0.604, 0.013, 0.055, 0.000, 0.571],
  'ฟ': [0.604, 0.013, 0.055, 0.000, 0.760],
  'ภ': [0.526, 0.014, 0.053, -0.009, 0.575],
  'ม': [0.526, 0.023, 0.054, -0.009, 0.571],
  'ย': [0.519, 0.036, 0.054, 0.000, 0.571],
  'ร': [0.405, 0.007, 0.038, -0.009, 0.571],
  'ฤ': [0.518, 0.032, 0.052, -0.239, 0.575],
  'ล': [0.484, 0.032, 0.053, -0.009, 0.575],
  'ฦ': [0.526, 0.014, 0.053, -0.239, 0.575],
  'ว': [0.397, 0.011, 0.053, -0.009, 0.575],
  'ศ': [0.547, 0.041, 0.005, 0.000, 0.585],
  'ษ': [0.560, 0.020, 0.015, 0.000, 0.571],
  'ส': [0.493, 0.032, 0.007, -0.009, 0.585],
  'ห': [0.548, 0.013, 0.057, 0.000, 0.571],
  'ฬ': [0.607, 0.013, 0.031, 0.000, 0.788],
  'อ': [0.498, 0.053, 0.055, 0.000, 0.575],
  'ฮ': [0.505, 0.039, 0.029, 0.000, 0.585],
  'ะ': [0.342, 0.008, 0.017, 0.014, 0.540],
  'า': [0.350, -0.001, 0.053, 0.000, 0.572],
  'ำ': [0.350, -0.237, 0.053, 0.000, 0.872],
  'เ': [0.292, 0.064, 0.015, -0.009, 0.561],
  'แ': [0.538, 0.064, 0.015, -0.009, 0.561],
  'โ': [0.306, -0.016, -0.029, -0.009, 0.932],
  'ใ': [0.306, -0.014, -0.020, -0.009, 0.933],
  'ไ': [0.303, -0.033, -0.008, -0.009, 0.933],
  'ๅ': [0.350, -0.001, 0.053, -0.239, 0.572],
  'ๆ': [0.490, 0.021, 0.052, -0.239, 0.571]
};
/** advance (em) ของฟอนต์บรรทัดจังหวัด wdth 80 — ใช้คำนวณความกว้างชื่อจังหวัดเท่านั้น */
const PROVINCE_ADVANCE_EM: Record<string, number> = {
  ก: 0.564, ข: 0.519, ฃ: 0.540, ค: 0.585, ฅ: 0.585, ฆ: 0.569, ง: 0.482, จ: 0.494,
  ฉ: 0.566, ช: 0.517, ซ: 0.531, ฌ: 0.805, ญ: 0.795, ฎ: 0.570, ฏ: 0.570, ฐ: 0.510,
  ฑ: 0.576, ฒ: 0.832, ณ: 0.801, ด: 0.588, ต: 0.588, ถ: 0.558, ท: 0.593, ธ: 0.508,
  น: 0.568, บ: 0.576, ป: 0.576, ผ: 0.592, ฝ: 0.592, พ: 0.652, ฟ: 0.652, ภ: 0.570,
  ม: 0.569, ย: 0.562, ร: 0.437, ฤ: 0.558, ล: 0.524, ฦ: 0.570, ว: 0.431, ศ: 0.590,
  ษ: 0.605, ส: 0.531, ห: 0.592, ฬ: 0.655, อ: 0.538, ฮ: 0.546, ะ: 0.369, า: 0.380,
  ำ: 0.380, เ: 0.314, แ: 0.581, โ: 0.332, ใ: 0.332, ไ: 0.323, ๅ: 0.380, ๆ: 0.527,
};
const THAI_COMBINING_MARK = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/;
/** ตัวที่ไม่อยู่ในตาราง (ไม่ควรเกิด) — เผื่อกว้างไว้ก่อนเพื่อไม่ให้ล้นกรอบ */
const UNKNOWN_GLYPH: GlyphMetric = [0.85, 0, 0, -0.33, 0.75];
/** ความสูงหมึกของตัวเลข (yMax) และพยัญชนะไทย ในฟอนต์นี้ */
const DIGIT_CAP_EM = 0.724;
const THAI_CONSONANT_EM = 0.575;
/** ขนาดฟอนต์อักษรไทย ÷ ขนาดฟอนต์ตัวเลข ให้หมึกสูงเท่ากันตาม PLATE_LAYOUT.letterToDigitHeight */
export const LETTER_FONT_RATIO = (DIGIT_CAP_EM / THAI_CONSONANT_EM) * PLATE_LAYOUT.letterToDigitHeight;

function metric(ch: string): GlyphMetric {
  return GLYPH_METRICS[ch] ?? UNKNOWN_GLYPH;
}

/** ความกว้างชื่อจังหวัด (em) ในฟอนต์บรรทัดจังหวัด — สระ/วรรณยุกต์บน-ล่างเป็น 0 */
export function provinceWidthEm(text: string): number {
  let w = 0;
  for (const ch of text) {
    if (THAI_COMBINING_MARK.test(ch)) continue;
    w += PROVINCE_ADVANCE_EM[ch] ?? UNKNOWN_GLYPH[0];
  }
  return w;
}

/** ความกว้างตาม advance (em) — สระ/วรรณยุกต์บน-ล่างเป็น 0 (combining mark) */
export function textWidthEm(text: string): number {
  let w = 0;
  for (const ch of text) {
    if (THAI_COMBINING_MARK.test(ch)) continue;
    w += metric(ch)[0];
  }
  return w;
}

/** ความกว้างหมึกจริง (em) = advance รวม − bearing ซ้ายตัวแรก − bearing ขวาตัวสุดท้าย */
export function inkWidthEm(text: string): number {
  const chars = [...text].filter((ch) => !THAI_COMBINING_MARK.test(ch));
  if (chars.length === 0) return 0;
  return textWidthEm(text) - metric(chars[0])[1] - metric(chars[chars.length - 1])[2];
}

/** ความลึกของหางล่างที่ลึกที่สุดในข้อความ (em, ค่าบวก) */
function descenderEm(text: string): number {
  let d = 0;
  for (const ch of text) d = Math.max(d, -metric(ch)[3]);
  return d;
}

/** เลือกลายป้ายจากผลตรวจเลขประมูลเดิมของระบบ (detectAuctionNumber) เท่านั้น */
export function plateVariantFor(auction: Pick<AuctionNumberInfo, 'isAuction'>): PlateVariant {
  return auction.isAuction ? 'auction' : 'standard';
}

/**
 * ชื่อจังหวัดที่จะแสดงบรรทัดล่าง: ปิดทั้งระบบเมื่อ PLATE_IMAGE_DEFAULT_PROVINCE เป็น null,
 * ไม่งั้นใช้จังหวัดที่ผู้ใช้กรอก (ถ้ามี) หรือค่าเริ่มต้น
 */
export function resolvePlateProvinceLabel(
  input: Pick<PlateInput, 'province'>,
  defaultLabel: string | null = PLATE_IMAGE_DEFAULT_PROVINCE,
): string | null {
  if (defaultLabel === null) return null;
  const typed = input.province?.trim();
  return typed ? typed : defaultLabel;
}

export interface PlateLayoutInput extends Pick<PlateInput, 'frontDigit' | 'thaiLetters' | 'tailDigits'> {
  variant: PlateVariant;
  provinceLabel?: string | null;
}

export interface PlateTextLine {
  text: string;
  x: number;
  y: number;
  fontSize: number;
}

export interface PlateLayout {
  /** เลขหน้าติดกับอักษร เช่น "9กบ" / "0ฐร" หรืออักษรล้วน "ฐร" */
  prefix: string;
  /** เลขท้าย เช่น "9999" */
  tail: string;
  /** ข้อความทะเบียนแบบเดียวกับที่แสดงทั่วเว็บ (formatPlateText) */
  plateText: string;
  provinceLabel: string | null;
  ariaLabel: string;
  /** บรรทัดบนแยกเป็นช่วง (เลขหน้า / อักษร / เลขท้าย) ทุกช่วงใช้ text-anchor="start" */
  topRuns: PlateTextLine[];
  /** ขอบหมึกของกลุ่มหน้าและกลุ่มเลขท้าย (หน่วย viewBox) — ใช้ตรวจ/ทดสอบ */
  frontGroupInk: { x0: number; x1: number };
  tailGroupInk: { x0: number; x1: number };
  /** ขนาดตัวเลข (font-size) และ baseline บรรทัดหลัก */
  digitFontSize: number;
  mainBaseline: number;
  /** ขอบล่างสุดของหมึกบรรทัดหลัก (รวมหางอักษร) */
  mainInkBottom: number;
  /** text-anchor="middle" */
  provinceLine: PlateTextLine | null;
  /** ยอดพยัญชนะของบรรทัดจังหวัด (null ถ้าไม่มีบรรทัดนี้) */
  provinceTop: number | null;
}

export function buildPlateAriaLabel(
  plateText: string,
  provinceLabel: string | null,
  variant: PlateVariant,
): string {
  const province = provinceLabel === null ? '' : ` ${provinceLabel}`;
  const kind = variant === 'auction' ? ' (ลายป้ายประมูล)' : '';
  return `ภาพจำลองป้ายทะเบียน ${plateText}${province}${kind}`;
}

export function buildPlateLayout(input: PlateLayoutInput): PlateLayout {
  const L = PLATE_LAYOUT;
  const W = PLATE_W;
  const H = PLATE_H;
  const { front, letters, tail } = plateTextParts(input);
  const prefix = front === null ? letters : `${front}${letters}`;
  const provinceRaw = input.provinceLabel?.trim();
  const provinceLabel = provinceRaw ? provinceRaw : null;
  const plateText = formatPlateText(input);

  const contentLeft = L.contentLeftW * W;
  const contentRight = W - L.contentRightW * W;
  const minGap = L.minGroupGapW * W;

  // ---- บรรทัดจังหวัด (คำนวณก่อน เพราะยอดบรรทัดนี้จำกัดหางล่างของอักษรบรรทัดหลัก) ----
  let provinceLine: PlateTextLine | null = null;
  let provinceTop: number | null = null;
  if (provinceLabel !== null) {
    const byHeight = (L.province.consonantHeightH * H) / THAI_CONSONANT_EM;
    const byWidth = (L.province.maxWidthW * W) / Math.max(provinceWidthEm(provinceLabel), 0.01);
    const size = Math.min(byHeight, byWidth);
    const baseline = L.province.baselineH * H;
    provinceLine = { text: provinceLabel, x: W / 2, y: round2(baseline), fontSize: round2(size) };
    provinceTop = baseline - THAI_CONSONANT_EM * size;
  }

  // ---- บรรทัดหลัก: ความกว้าง (em ของขนาดตัวเลข) ----
  // กลุ่มหน้า: เลขหน้า (ขนาดตัวเลข) + อักษร (ขนาด × LETTER_FONT_RATIO) ติดกันตาม advance ปกติ
  const frontAdvEm = front === null ? 0 : textWidthEm(front);
  const lettersAdvEm = textWidthEm(letters) * LETTER_FONT_RATIO;
  const firstLeftBearingEm =
    front === null ? metric(letters[0] ?? '')[1] * LETTER_FONT_RATIO : metric(front)[1];
  const lastLetter = [...letters].pop() ?? '';
  const frontInkEm = frontAdvEm + lettersAdvEm - firstLeftBearingEm - metric(lastLetter)[2] * LETTER_FONT_RATIO;
  const tailInkEm = inkWidthEm(tail);
  const descEm = descenderEm(letters) * LETTER_FONT_RATIO;

  // ขนาดตัวเลขตามค่าวัด แล้วย่อทั้งบรรทัดตามสัดส่วนเมื่อจำเป็นเท่านั้น
  let size = (L.digitHeightH * H) / DIGIT_CAP_EM;
  size = Math.min(size, (contentRight - contentLeft - minGap) / (frontInkEm + tailInkEm));

  // แนวตั้ง: baseline ตามค่าวัด — ถ้าหางอักษร (ฐ ญ ฎ ฏ ฤ ฦ) จะชนบรรทัดจังหวัด ยกบรรทัดขึ้นได้ถึง
  // ระยะขอบบนน้อยสุด แล้วจึงย่อ (ฟอนต์นี้หางยาวกว่าป้ายจริง)
  const minTop = L.minTopMarginH * H;
  let baseline: number;
  if (provinceTop !== null) {
    const limit = provinceTop - L.descenderClearanceH * H;
    if (descEm > 0) size = Math.min(size, (limit - minTop) / (DIGIT_CAP_EM + descEm));
    baseline = Math.min(L.mainBaselineH * H, limit - descEm * size);
    baseline = Math.max(baseline, minTop + DIGIT_CAP_EM * size);
  } else {
    // ไม่มีบรรทัดจังหวัด: จัดตัวเลขกึ่งกลางแนวตั้ง (ประมาณการ — ไม่มีภาพป้ายจริงกรณีนี้)
    const maxBottom = H - minTop;
    if (descEm > 0) size = Math.min(size, (maxBottom - minTop) / (DIGIT_CAP_EM + descEm));
    baseline = Math.min(H / 2 + (DIGIT_CAP_EM * size) / 2, maxBottom - descEm * size);
  }

  // แนวนอน: กลุ่มหน้าและกลุ่มท้ายอยู่กึ่งกลางโซนของตัวเอง (ตามค่าวัด) แล้วดันเข้าในกรอบ/ถ่างให้ห่าง
  // อย่างน้อย minGap — ย่อขนาดไว้แล้วข้างบน จึงจัดได้เสมอ
  const frontW = frontInkEm * size;
  const tailW = tailInkEm * size;
  let fx0 = Math.max(contentLeft, L.leftGroupCenterW * W - frontW / 2);
  let tx1 = Math.min(contentRight, L.tailGroupCenterW * W + tailW / 2);
  fx0 = Math.min(fx0, contentRight - tailW - minGap - frontW);
  tx1 = Math.max(tx1, contentLeft + frontW + minGap + tailW);
  let deficit = minGap - (tx1 - tailW - (fx0 + frontW));
  if (deficit > 0) {
    const moveLeft = Math.min(deficit / 2, fx0 - contentLeft);
    fx0 -= moveLeft;
    deficit -= moveLeft;
    const moveRight = Math.min(deficit, contentRight - tx1);
    tx1 += moveRight;
    deficit -= moveRight;
    fx0 -= Math.min(deficit, fx0 - contentLeft);
  }
  const tx0 = tx1 - tailW;

  const letterSize = size * LETTER_FONT_RATIO;
  const topY = round2(baseline);
  const topRuns: PlateTextLine[] = [];
  let x = fx0 - firstLeftBearingEm * size;
  if (front !== null) {
    topRuns.push({ text: front, x: round2(x), y: topY, fontSize: round2(size) });
    x += frontAdvEm * size;
  }
  topRuns.push({ text: letters, x: round2(x), y: topY, fontSize: round2(letterSize) });
  topRuns.push({
    text: tail,
    x: round2(tx0 - metric(tail[0] ?? '')[1] * size),
    y: topY,
    fontSize: round2(size),
  });

  return {
    prefix,
    tail,
    plateText,
    provinceLabel,
    ariaLabel: buildPlateAriaLabel(plateText, provinceLabel, input.variant),
    topRuns,
    frontGroupInk: { x0: round2(fx0), x1: round2(fx0 + frontW) },
    tailGroupInk: { x0: round2(tx0), x1: round2(tx1) },
    digitFontSize: round2(size),
    mainBaseline: topY,
    mainInkBottom: round2(baseline + descEm * size),
    provinceLine,
    provinceTop: provinceTop === null ? null : round2(provinceTop),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
