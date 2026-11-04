/**
 * ตรรกะจัดวางข้อความของภาพจำลองป้ายทะเบียน (PlateImage.tsx) — pure function ล้วน ไม่แตะ DOM
 * เพื่อเทสใน vitest ได้โดยไม่ต้องมี jsdom
 *
 * ค่าเลย์เอาต์ทั้งหมดอยู่ใน PLATE_LAYOUT ด้านล่าง วัดจากภาพถ่ายป้ายจริง 13 แผ่น (ภาพอ้างอิงเก็บไว้
 * ในเครื่องที่ ref/ ไม่อยู่ใน git) หลังแก้มุมกล้องแล้ว — ค่าที่ไม่มีภาพรองรับพอจะระบุว่า "ประมาณการ"
 *
 * ความกว้าง/ตำแหน่ง glyph ใช้ตาราง metric ที่ดึงจากไฟล์ฟอนต์ที่ฝังไว้จริง จึงคำนวณได้แม่นโดยไม่ต้อง
 * วัดใน DOM — ฟอนต์มี 2 ชุด สลับด้วย PLATE_FONT_STYLE (config/featureFlags.ts):
 *
 * ชุด "custom" (ค่าปัจจุบัน) — วางทีละ glyph ตาราง metric สร้างด้วย tools/plate_fonts.py
 * (plateFontMetrics.generated.ts) ไม่ได้แก้ glyph ในไฟล์ฟอนต์:
 * - ตัวเลข: Oswald 500 (OFL) ช่องว่างหมึกระหว่างเลขที่ติดกัน = ค่าตามธรรมชาติของคู่นั้น (รวม kerning) × 1.4
 * - อักษรไทยบรรทัดหลัก: Norasi Bold (GPL-2+ with font exception) พยัญชนะสูงเท่าเลขหัวแบน baseline เดียวกัน
 *   บีบแนวนอน 0.8 เท่าด้วย transform ใน SVG
 * - ชื่อจังหวัด: Norasi Bold ไม่บีบ
 *
 * ชุด "noto" (เดิม) — ฟอนต์ Noto Sans Thai Looped (OFL) instance คงที่ 2 ตัวจากแกน wdth ไม่ได้แก้ glyph
 * วางเป็นข้อความต่อกลุ่ม (ผลเหมือนก่อนมีชุด custom ทุกประการ):
 * - บรรทัดหลัก: …-PlateSubset-wdth70.woff2 (wght 800 wdth 70) — วัดจากภาพจริง: ตัวเลข wdth 80
 *   กว้างกว่าจริง ~12% อักษร ~30% ทำให้ช่องว่างระหว่างกลุ่มแคบกว่าจริง wdth 70 ลดช่องนี้ได้มาก
 * - บรรทัดจังหวัด: …-PlateSubset-wdth80.woff2 (wght 800 wdth 80) — ชื่อจังหวัดบนป้ายจริงกว้างกว่า
 *   ถ้าใช้ wdth 70 จะแคบกว่าจริง ~5% W (วัด 10/10)
 */
import type { AuctionNumberInfo, PlateInput } from '../engine/types';
import { formatPlateText, plateTextParts } from '../engine/plateText';
import { PLATE_FONT_STYLE, PLATE_IMAGE_DEFAULT_PROVINCE } from '../config/featureFlags';
import {
  NORASI_LETTER_METRICS,
  NORASI_PROVINCE_ADVANCE_EM,
  NORASI_PROVINCE_VERTICAL,
  OSWALD_DIGIT_FLAT_EM,
  OSWALD_DIGIT_METRICS,
  OSWALD_DIGIT_PAIR_GAP_EM,
} from './plateFontMetrics.generated';

export type PlateVariant = 'standard' | 'auction';

/** พิกัดภายใน viewBox ของป้าย */
export const PLATE_W = 440;

/**
 * กรอบป้าย (หน่วย viewBox, กว้าง PLATE_W) — PlateImage.tsx วาดเส้นขอบตามค่านี้ ระยะปลอดภัยของข้อความ
 * วัดจาก "ขอบด้านในของเส้นขอบใน" (innerInset + innerStroke / 2) ไม่ใช่ขอบนอกของป้าย
 */
const PLATE_FRAME = {
  outerInset: 3,
  outerStroke: 4,
  outerRadius: 14,
  innerInset: 11,
  innerStroke: 1.5,
  innerRadius: 8,
} as const;
const ASPECT = 2.34;
export const PLATE_H = Math.round(PLATE_W / ASPECT);
/** ขอบด้านในของเส้นขอบใน (หน่วย viewBox) */
const FRAME_INNER_EDGE = PLATE_FRAME.innerInset + PLATE_FRAME.innerStroke / 2;
const SAFE_MARGIN_W = 0.048;
const SAFE_MARGIN_TOP_H = 0.045;
const SAFE_MARGIN_BOTTOM_H = 0.045;
const PROVINCE_CONSONANT_HEIGHT_H = 0.1535;

/**
 * ค่าเลย์เอาต์ทั้งหมดของป้าย — สัดส่วนต่อความกว้าง (W) หรือความสูง (H) ของป้าย
 * "วัด n/13" = ค่ามัธยฐานจากภาพป้ายจริงที่ใช้ได้ n แผ่น, "ประมาณการ" = ไม่มีภาพรองรับพอ (< 3)
 * "สบายตา" = เลือกให้อ่านสบาย ไม่ได้มาจากป้ายจริง (ป้ายจริงแน่นกว่าและไม่มีเส้นขอบใน)
 */
export const PLATE_LAYOUT = {
  /** กว้าง:สูง — วัด 13/13 มัธยฐาน 2.337 (ช่วง 2.21–2.43 รวมความคลาดจากมุมกล้อง) */
  aspect: ASPECT,
  /** เส้นขอบนอก/ใน (หน่วย viewBox) — PlateImage.tsx วาดตามค่านี้ */
  frame: PLATE_FRAME,
  /**
   * ระยะปลอดภัยแนวนอน 4.8% W ต่อด้าน วัดจากขอบในของเส้นขอบใน — สบายตา
   * ป้ายจริงไม่มีเส้นขอบใน และข้อความป้ายยาว (เลขท้าย 4 หลัก) ห่างขอบนอกป้ายเพียง 3.2–8.9% W
   * (วัด 4/13: 5กผ 8888 3.2/3.6, 4กพ 9998 4.1/4.3, สต 8888 5.1/4.4, ชถ 8088 8.9/7.5) — ถ้ายึดค่านี้
   * ข้อความจะทับ/แตะเส้นขอบในของภาพจำลอง จึงเลือกความสบายตาแทน
   */
  safeMarginW: SAFE_MARGIN_W,
  /** ระยะปลอดภัยบน (ยอดหมึกบรรทัดหลัก) / ล่าง (สระล่างของบรรทัดจังหวัด) จากขอบในของเส้นขอบใน — สบายตา
   * (ป้ายจริงยาว 4/13 จากขอบนอก: บน 4.4–10.3% H, ล่าง 4.2–11.7% H) */
  safeMarginTopH: SAFE_MARGIN_TOP_H,
  safeMarginBottomH: SAFE_MARGIN_BOTTOM_H,
  /** ขอบซ้าย/ขวาของพื้นที่ข้อความหลัก (จากขอบนอก) = ขอบในของเส้นขอบใน + safeMarginW (= 7.47% W) */
  contentLeftW: FRAME_INNER_EDGE / PLATE_W + SAFE_MARGIN_W,
  contentRightW: FRAME_INNER_EDGE / PLATE_W + SAFE_MARGIN_W,
  /** ความสูงหมึกของตัวเลข — วัด 13/13 มัธยฐาน 41.5% H (ช่วง 38–46) ไม่ขึ้นกับจำนวนหลัก */
  digitHeightH: 0.415,
  /** ความสูงหมึกของตัวเลขขั้นต่ำเป้าหมายเมื่อต้องย่อป้ายยาว — ต่ำกว่าช่วงที่วัดได้ (38–46%) เล็กน้อย
   * อักษรพยัญชนะทั่วไป + เลขหน้า + เลขท้าย 4 หลักอยู่เหนือค่านี้ อักษรกว้างพิเศษ/มีหางอาจต่ำกว่า (ดูเทสต์) */
  minDigitHeightH: 0.36,
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
  /** ยอดหมึกบรรทัดหลักสูงสุด (จากขอบนอก) = ขอบในของเส้นขอบใน + safeMarginTopH */
  minTopMarginH: FRAME_INNER_EDGE / PLATE_H + SAFE_MARGIN_TOP_H,
  /** ระยะห่างน้อยสุดระหว่างหางล่างอักษร (ฐ ญ ฎ ฏ ฤ ฦ) กับหมึกบนสุดของบรรทัดจังหวัด — ป้ายจริงวัด 3/13
   * ได้ 8.0–11.7% H แต่หางในฟอนต์นี้ยาวกว่าจริง ~2 เท่าและเป็นชิ้นแยก ถ้าใช้ 8% ร่วมกับระยะปลอดภัย
   * ตัวเลขจะเหลือ ~30% H จึงใช้ 4% H — สบายตา/ประมาณการ */
  descenderClearanceH: 0.04,
  /** ระยะห่างน้อยสุดระหว่างขอบล่างบรรทัดหลัก (ไม่มีหาง) กับหมึกบนสุดของบรรทัดจังหวัด (รวมสระบน/วรรณยุกต์)
   * — ป้ายจริง 15.0–19.9% H (วัด 13/13) แต่ระยะปลอดภัยบน-ล่างกินพื้นที่ไป ใช้ 6% H ที่ยังแยกบรรทัดชัด
   * — สบายตา/ประมาณการ */
  minLineGapH: 0.06,
  province: {
    /** ความสูงพยัญชนะ — วัด 13/13 มัธยฐาน 15.35% H (= 0.37 เท่าความสูงตัวเลข) */
    consonantHeightH: PROVINCE_CONSONANT_HEIGHT_H,
    /**
     * baseline — ป้ายจริงวัด 13/13 มัธยฐาน 88% H แต่ที่ 88% สระล่าง (ุ ของ "กรุง") ทับเส้นขอบในของภาพจำลอง
     * จึงยกขึ้นให้หมึกล่างที่ลึกที่สุดของฟอนต์จังหวัด (Noto 0.327 em, Norasi 0.287 em) ที่ขนาดเต็มอยู่เหนือ
     * ระยะปลอดภัยล่างพอดี (Noto ≈ 80.5% H, Norasi ≈ 81.6% H) — ค่าขึ้นกับฟอนต์ จึงคำนวณใน provinceBaselineH()
     * ใช้ค่าเดียวทุกชื่อจังหวัด กึ่งกลางแนวนอน (วัด 13/13 เยื้อง ≤ ±0.6% W ยกเว้น 1 แผ่น 2.2%)
     */
    /** ความกว้างสูงสุด — "กรุงเทพมหานคร" วัด 13/13 มัธยฐาน 69.4% W (ช่วง 68–76) ฟอนต์นี้กว้างกว่าจริง
     * ~7% ที่ความสูงเท่ากัน จึงจำกัดความกว้างตามค่าวัด (ตัวอักษรเตี้ยลงเล็กน้อยแทนการล้นกว้าง)
     * ชื่อจังหวัดที่ยาวกว่านี้ก็ถูกย่อให้ไม่เกินค่าเดียวกัน (ประมาณการ — ไม่มีภาพจังหวัดอื่น)
     * ขอบเหลือ (100 − 69.4) / 2 = 15.3% W จากขอบนอก จึงอยู่ในระยะปลอดภัยเสมอ */
    maxWidthW: 0.694,
    /** ป้ายที่อักษรมีหาง (ฐ ญ ฎ ฏ ฤ ฦ): ย่อชื่อจังหวัดได้ไม่ต่ำกว่า 85% ของขนาดปกติ เพื่อคืนพื้นที่แนวตั้งให้ตัวเลข
     * ได้ใกล้ minDigitHeightH — ย่อเท่าที่จำเป็นเท่านั้น และ baseline เลื่อนลงตามความลึกสระล่างที่เล็กลง
     * — สบายตา (ที่จอ 390px พยัญชนะจังหวัดยังสูง ≥ 14px) */
    descenderShrinkMin: 0.85,
  },
  /** ฟอนต์ชุด custom (เลือกจากแกลเลอรีฟอนต์) — ค่าที่ผู้ใช้กำหนด ไม่ได้มาจากป้ายจริง */
  customFont: {
    /** ช่องว่างหมึกระหว่างเลขที่ติดกัน = ค่าตามธรรมชาติของคู่นั้นใน Oswald 500 × ค่านี้ */
    digitSpacing: 1.4,
    /** บีบความกว้างพยัญชนะไทยบรรทัดหลัก (transform: scale แนวนอน ทุกชั้นของตัวนูนใช้ค่าเดียวกัน) */
    letterScaleX: 0.8,
  },
} as const;


/** ชุด noto: metric ของฟอนต์บรรทัดหลัก Noto wdth 70 (หน่วย em): [advance, left bearing, right bearing, yMin, yMax] */
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
/** ชุด noto: advance (em) ของฟอนต์บรรทัดจังหวัด Noto wdth 80 — ใช้คำนวณความกว้างชื่อจังหวัดเท่านั้น */
const PROVINCE_ADVANCE_EM: Record<string, number> = {
  ก: 0.564, ข: 0.519, ฃ: 0.540, ค: 0.585, ฅ: 0.585, ฆ: 0.569, ง: 0.482, จ: 0.494,
  ฉ: 0.566, ช: 0.517, ซ: 0.531, ฌ: 0.805, ญ: 0.795, ฎ: 0.570, ฏ: 0.570, ฐ: 0.510,
  ฑ: 0.576, ฒ: 0.832, ณ: 0.801, ด: 0.588, ต: 0.588, ถ: 0.558, ท: 0.593, ธ: 0.508,
  น: 0.568, บ: 0.576, ป: 0.576, ผ: 0.592, ฝ: 0.592, พ: 0.652, ฟ: 0.652, ภ: 0.570,
  ม: 0.569, ย: 0.562, ร: 0.437, ฤ: 0.558, ล: 0.524, ฦ: 0.570, ว: 0.431, ศ: 0.590,
  ษ: 0.605, ส: 0.531, ห: 0.592, ฬ: 0.655, อ: 0.538, ฮ: 0.546, ะ: 0.369, า: 0.380,
  ำ: 0.380, เ: 0.314, แ: 0.581, โ: 0.332, ใ: 0.332, ไ: 0.323, ๅ: 0.380, ๆ: 0.527,
};
const THAI_COMBINING_MARK = /[ัิ-ฺ็-๎]/;
/** ตัวที่ไม่อยู่ในตาราง (ไม่ควรเกิด) — เผื่อกว้างไว้ก่อนเพื่อไม่ให้ล้นกรอบ */
const UNKNOWN_GLYPH: GlyphMetric = [0.85, 0, 0, -0.33, 0.75];
const TALL_CONSONANT = /[ปฝฟฬ]/;
const LEADING_VOWEL = /[โใไ]/;
const UPPER_VOWEL = /[ัิ-ื็ํ]/;
const TONE_MARK = /[่-์]/;
const UPPER_MARK = /[ัิ-ื็-๎]/;
const LOWER_MARK = /[ุ-ฺ]/;

export type PlateFontStyle = 'custom' | 'noto';

/** ชุดฟอนต์ของภาพป้าย: ตาราง metric + กติกาการวางที่ขึ้นกับฟอนต์ (หน่วย em) */
export interface PlateFontProfile {
  style: PlateFontStyle;
  /** 'runs' = ข้อความต่อกลุ่ม ช่องไฟตามฟอนต์ (Noto เดิม) · 'glyphs' = วางทีละตัว ช่องไฟ/บีบตามกติกาด้านล่าง */
  placement: 'runs' | 'glyphs';
  digits: Record<string, GlyphMetric>;
  letters: Record<string, GlyphMetric>;
  /** ยอดหมึกสูงสุดของตัวเลข — ความสูงตัวเลข (digitHeightH) และระยะปลอดภัยบนวัดจากค่านี้ */
  digitCapEm: number;
  /** ขนาดฟอนต์อักษรไทย ÷ ขนาดฟอนต์ตัวเลข ให้พยัญชนะสูงเท่าตัวเลข */
  letterFontRatio: number;
  /** บีบแนวนอนของอักษรไทยบรรทัดหลัก (1 = ไม่บีบ) */
  letterScaleX: number;
  /** glyphs: ช่องว่างหมึกระหว่างเลขสองตัวที่ติดกัน (em ของขนาดตัวเลข) */
  digitGapEm: (left: string, right: string) => number;
  /** glyphs: ช่องว่างหมึกระหว่างอักษรไทย และระหว่างเลขหน้ากับอักษรตัวแรก (em ของขนาดตัวเลข) */
  letterGapEm: number;
  province: {
    advance: Record<string, number>;
    /** ความสูงพยัญชนะ */
    consonantEm: number;
    /** หมึกล่างลึกสุด (สระล่าง/หางพยัญชนะ) */
    lowerMarkEm: number;
    /** สระบน/วรรณยุกต์ 1 ชั้นบนพยัญชนะทั่วไป */
    upperMarkEm: number;
    /** วรรณยุกต์ซ้อนบนสระบน หรือเครื่องหมายบนอักษรหัวสูง */
    stackedMarkEm: number;
    /** โ ใ ไ */
    leadingVowelEm: number;
    /** ป ฝ ฟ ฬ */
    tallConsonantEm: number;
    /** ำ (นิคหิตอยู่บน) — ไม่มี = ไม่นับ (พฤติกรรมเดิมของชุด noto) */
    saraAmEm?: number;
    /** ยอดพยัญชนะทั่วไปที่สูงที่สุด (เช่น ช ฮ สูงกว่า ก) — มีค่า = นับความสูงพยัญชนะรายตัวจาก letters
     * (ฟอนต์จังหวัดต้องเป็นฟอนต์เดียวกับอักษรบรรทัดหลัก) · ไม่มี = ใช้ consonantEm (พฤติกรรมเดิมของชุด noto) */
    consonantTopEm?: number;
  };
  /** ป้ายที่อักษรมีหาง: ความสูงตัวเลขเป้าหมายที่ยอมย่อชื่อจังหวัด (ไม่ต่ำกว่า descenderShrinkMin) เพื่อให้ได้ */
  descenderTargetH: number;
  /** ป้ายที่อักษรมีหาง: ห้ามย่อพยัญชนะจังหวัดต่ำกว่าค่านี้ (สัดส่วนของ H) — ไม่มี = ไม่จำกัด (ชุด noto เดิม) */
  provinceMinConsonantH?: number;
}

/** ชุดเดิม: Noto Sans Thai Looped ทั้งหมด — ค่าทุกตัวเหมือนก่อนมีชุด custom */
export const NOTO_PLATE_FONT: PlateFontProfile = {
  style: 'noto',
  placement: 'runs',
  digits: GLYPH_METRICS,
  letters: GLYPH_METRICS,
  digitCapEm: 0.724,
  letterFontRatio: (0.724 / 0.575) * PLATE_LAYOUT.letterToDigitHeight,
  letterScaleX: 1,
  digitGapEm: () => 0,
  letterGapEm: 0,
  province: {
    advance: PROVINCE_ADVANCE_EM,
    consonantEm: 0.575,
    lowerMarkEm: 0.327, // สระล่าง ุ ู — ลึกกว่าหางพยัญชนะทุกตัว (ฐ 0.322, ญ 0.270)
    upperMarkEm: 0.943, // สระบน/วรรณยุกต์ 0.858–0.943 (สูงสุด = ไม้ไต่คู้)
    stackedMarkEm: 1.2, // ประมาณการเผื่อไว้ (ตรวจกับภาพเรนเดอร์)
    leadingVowelEm: 0.933,
    tallConsonantEm: 0.788, // ป ฝ ฟ 0.760, ฬ 0.788
  },
  descenderTargetH: PLATE_LAYOUT.minDigitHeightH,
};

const DIGIT_GAPS = Object.values(OSWALD_DIGIT_PAIR_GAP_EM);
/** ช่องว่างหมึกตามธรรมชาติเฉลี่ยของเลขที่ติดกันทุกคู่ (100 คู่) ใน Oswald 500 */
export const OSWALD_MEAN_DIGIT_GAP_EM = DIGIT_GAPS.reduce((a, b) => a + b, 0) / DIGIT_GAPS.length;

/**
 * ชุด custom: เลข Oswald 500 + อักษร/จังหวัด Norasi Bold (ตาราง metric จาก tools/plate_fonts.py)
 * - ช่องไฟเลข: ช่องว่างหมึกของแต่ละคู่ × digitSpacing (คงจังหวะช่องไฟที่ผู้ออกแบบฟอนต์ตั้งไว้ เช่น 1 กับ 7 ห่างต่างกัน)
 * - ช่องไฟอักษรไทย (และเลขหน้า → อักษร): ค่าเฉลี่ยช่องไฟเลขหลังคูณแล้ว — ช่องว่างหมึกเท่าช่องไฟเลขโดยเฉลี่ย
 *   ให้ทั้งบรรทัดมีจังหวะเดียวกัน (ช่องไฟธรรมชาติของ Norasi ที่บีบ 0.8 แล้วยังกว้างกว่าเลขราว 20%)
 * - พยัญชนะสูงเท่าเลขหัวแบน (1 4 7) baseline เดียวกัน · ความสูงตัวเลขวัดจากยอดเลขหัวมน (overshoot)
 * - ป้ายที่อักษรมีหาง: ยอมย่อชื่อจังหวัด (ไม่ต่ำกว่า 85%) เพื่อให้ตัวเลขใกล้ 41.5% H มากที่สุด
 */
export const CUSTOM_PLATE_FONT: PlateFontProfile = {
  style: 'custom',
  placement: 'glyphs',
  digits: OSWALD_DIGIT_METRICS,
  letters: NORASI_LETTER_METRICS,
  digitCapEm: Math.max(...Object.values(OSWALD_DIGIT_METRICS).map((m) => m[4])),
  letterFontRatio: (OSWALD_DIGIT_FLAT_EM / NORASI_PROVINCE_VERTICAL.consonantEm) * PLATE_LAYOUT.letterToDigitHeight,
  letterScaleX: PLATE_LAYOUT.customFont.letterScaleX,
  digitGapEm: (left, right) =>
    (OSWALD_DIGIT_PAIR_GAP_EM[left + right] ?? OSWALD_MEAN_DIGIT_GAP_EM) * PLATE_LAYOUT.customFont.digitSpacing,
  letterGapEm: OSWALD_MEAN_DIGIT_GAP_EM * PLATE_LAYOUT.customFont.digitSpacing,
  province: { advance: NORASI_PROVINCE_ADVANCE_EM, ...NORASI_PROVINCE_VERTICAL },
  descenderTargetH: PLATE_LAYOUT.digitHeightH,
  // 13px ที่ป้ายกว้าง 260px (ขนาดภาพป้ายใน #single ที่จอ 390px) = 13 / (260 / 2.34) ≈ 11.7% H
  // ไม่มีกฎนี้ "พระนครศรีอยุธยา" บนป้ายอักษรมีหาง (เช่น 0ฐร) เหลือ 12.5px
  provinceMinConsonantH: 13 / (260 / PLATE_LAYOUT.aspect),
};

export const PLATE_FONT_PROFILES: Record<PlateFontStyle, PlateFontProfile> = {
  custom: CUSTOM_PLATE_FONT,
  noto: NOTO_PLATE_FONT,
};

/** ชุดฟอนต์ที่ตั้งไว้ใน featureFlags.ts (PlateImage อาจถอยไปชุด noto เองถ้าฟอนต์ custom โหลดไม่สำเร็จ) */
export const PLATE_FONT_PROFILE: PlateFontProfile = PLATE_FONT_PROFILES[PLATE_FONT_STYLE];

/** ชุดฟอนต์ที่ใช้จริง: ตั้งเป็น noto หรือฟอนต์ custom โหลดไม่สำเร็จ → noto */
export function resolvePlateFontProfile(
  style: PlateFontStyle,
  customFontStatus: 'pending' | 'loaded' | 'failed',
): PlateFontProfile {
  return style === 'noto' || customFontStatus === 'failed' ? NOTO_PLATE_FONT : CUSTOM_PLATE_FONT;
}

function digitMetric(ch: string, font: PlateFontProfile): GlyphMetric {
  return font.digits[ch] ?? font.letters[ch] ?? UNKNOWN_GLYPH;
}
function letterMetric(ch: string, font: PlateFontProfile): GlyphMetric {
  return font.letters[ch] ?? UNKNOWN_GLYPH;
}
function inkEm(m: GlyphMetric): number {
  return m[0] - m[1] - m[2];
}

/** ความกว้างชื่อจังหวัด (em) ในฟอนต์บรรทัดจังหวัด — สระ/วรรณยุกต์บน-ล่างเป็น 0 */
export function provinceWidthEm(text: string, font: PlateFontProfile = PLATE_FONT_PROFILE): number {
  let w = 0;
  for (const ch of text) {
    if (THAI_COMBINING_MARK.test(ch)) continue;
    w += font.province.advance[ch] ?? UNKNOWN_GLYPH[0];
  }
  return w;
}

/** ความกว้างตาม advance (em) — สระ/วรรณยุกต์บน-ล่างเป็น 0 (combining mark) */
export function textWidthEm(text: string, font: PlateFontProfile = PLATE_FONT_PROFILE): number {
  let w = 0;
  for (const ch of text) {
    if (THAI_COMBINING_MARK.test(ch)) continue;
    w += digitMetric(ch, font)[0];
  }
  return w;
}

/**
 * ความกว้างหมึกจริงของเลข (em ของขนาดตัวเลข)
 * - runs: advance รวม − bearing ซ้ายตัวแรก − bearing ขวาตัวสุดท้าย
 * - glyphs: หมึกแต่ละตัวรวมกัน + ช่องไฟระหว่างคู่ (digitGapEm)
 */
export function inkWidthEm(text: string, font: PlateFontProfile = PLATE_FONT_PROFILE): number {
  const chars = [...text].filter((ch) => !THAI_COMBINING_MARK.test(ch));
  if (chars.length === 0) return 0;
  if (font.placement === 'glyphs') {
    let w = 0;
    chars.forEach((ch, i) => {
      w += inkEm(digitMetric(ch, font));
      if (i > 0) w += font.digitGapEm(chars[i - 1], ch);
    });
    return w;
  }
  return textWidthEm(text, font) - digitMetric(chars[0], font)[1] - digitMetric(chars[chars.length - 1], font)[2];
}

/** ความกว้างหมึกของกลุ่มหน้า (เลขหน้า + อักษร) หน่วย em ของขนาดตัวเลข */
export function frontGroupInkEm(front: string | null, letters: string, font: PlateFontProfile = PLATE_FONT_PROFILE): number {
  const R = font.letterFontRatio;
  const chars = [...letters];
  if (font.placement === 'glyphs') {
    let w = 0;
    chars.forEach((ch, i) => {
      w += inkEm(letterMetric(ch, font)) * R * font.letterScaleX;
      if (i > 0) w += font.letterGapEm;
    });
    if (front !== null) w += inkEm(digitMetric(front, font)) + font.letterGapEm;
    return w;
  }
  const frontAdvEm = front === null ? 0 : textWidthEm(front, font);
  const lettersAdvEm = chars.reduce((a, ch) => a + letterMetric(ch, font)[0], 0) * R;
  const firstLeftBearingEm = front === null ? letterMetric(chars[0] ?? '', font)[1] * R : digitMetric(front, font)[1];
  const lastLetter = chars[chars.length - 1] ?? '';
  return frontAdvEm + lettersAdvEm - firstLeftBearingEm - letterMetric(lastLetter, font)[2] * R;
}

/** ความลึกของหางล่างที่ลึกที่สุดในข้อความ (em, ค่าบวก) */
function descenderEm(text: string, font: PlateFontProfile): number {
  let d = 0;
  for (const ch of text) d = Math.max(d, -letterMetric(ch, font)[3]);
  return d;
}

/** ยอดหมึกสูงสุดในข้อความ (em) ตาม yMax ของ glyph — อักษรหัวสูง ป ฝ ฟ ฬ สูงกว่าตัวเลข */
function ascenderEm(text: string, font: PlateFontProfile): number {
  let a = 0;
  for (const ch of text) a = Math.max(a, letterMetric(ch, font)[4]);
  return a;
}

/** baseline ของบรรทัดจังหวัด (สัดส่วนของ H): หมึกล่างที่ลึกที่สุดของฟอนต์ที่ขนาดเต็มชิดระยะปลอดภัยล่างพอดี */
export function provinceBaselineH(font: PlateFontProfile = PLATE_FONT_PROFILE): number {
  return (
    1 -
    FRAME_INNER_EDGE / PLATE_H -
    SAFE_MARGIN_BOTTOM_H -
    (font.province.lowerMarkEm * PROVINCE_CONSONANT_HEIGHT_H) / font.province.consonantEm
  );
}

/** ยอดหมึกสูงสุดของชื่อจังหวัด (em) รวมสระบน/วรรณยุกต์ */
export function provinceAscentEm(text: string, font: PlateFontProfile = PLATE_FONT_PROFILE): number {
  const P = font.province;
  let a = P.consonantEm;
  let prev = '';
  let base = '';
  for (const ch of text) {
    if (TALL_CONSONANT.test(ch)) a = Math.max(a, P.tallConsonantEm);
    if (LEADING_VOWEL.test(ch)) a = Math.max(a, P.leadingVowelEm);
    // ชุด custom: พยัญชนะบางตัวหัวสูงกว่า ก เล็กน้อย (ช ซ ศ ส ฮ) — บรรทัดจังหวัดกับอักษรบรรทัดหลักเป็นฟอนต์เดียวกัน
    // (Norasi Bold) จึงใช้ yMax จากตาราง letters ได้ตรงตัว (ไม่เกิน consonantTopEm)
    if (P.consonantTopEm !== undefined && !TALL_CONSONANT.test(ch) && font.letters[ch]) {
      a = Math.max(a, Math.min(font.letters[ch][4], P.consonantTopEm));
    }
    if (ch === '\u0E33' && P.saraAmEm !== undefined) {
      a = Math.max(a, TONE_MARK.test(prev) ? P.stackedMarkEm : P.saraAmEm);
    }
    if (UPPER_MARK.test(ch)) {
      const stacked = (TONE_MARK.test(ch) && UPPER_VOWEL.test(prev)) || TALL_CONSONANT.test(base);
      a = Math.max(a, stacked ? P.stackedMarkEm : P.upperMarkEm);
    } else if (!LOWER_MARK.test(ch)) {
      base = ch;
    }
    prev = ch;
  }
  return a;
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

/** placeholder ของช่อง "จังหวัด (ไม่บังคับ)" — บอกค่าเริ่มต้นที่ภาพป้ายจะใช้ (ไม่ใช่ค่าของช่อง)
 * ไม่มี placeholder เมื่อปิดบรรทัดจังหวัดทั้งระบบ (PLATE_IMAGE_DEFAULT_PROVINCE = null) */
export function provincePlaceholder(
  defaultLabel: string | null = PLATE_IMAGE_DEFAULT_PROVINCE,
): string | undefined {
  return defaultLabel === null ? undefined : `ค่าเริ่มต้น: ${defaultLabel}`;
}

/** ข้อความเล็กใต้ภาพป้ายเมื่อจังหวัดบนภาพเป็นค่าเริ่มต้น (ผู้ใช้ไม่ได้พิมพ์เอง) — null = ไม่แสดง */
export function plateProvinceNote(
  input: Pick<PlateInput, 'province'>,
  defaultLabel: string | null = PLATE_IMAGE_DEFAULT_PROVINCE,
): string | null {
  if (defaultLabel === null) return null;
  return input.province?.trim() ? null : 'จังหวัดในภาพ: ค่าเริ่มต้น';
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
  /** บรรทัดหลัก: ตัวเลขหรืออักษรไทย (เลือกฟอนต์ตามนี้) — บรรทัดจังหวัดไม่มีค่านี้ */
  role?: 'digit' | 'letter';
  /** บีบ/ขยายแนวนอน (transform: scale(scaleX 1)) — ไม่มี = 1 */
  scaleX?: number;
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
  /** ชุดฟอนต์ที่ใช้คำนวณ — PlateImage เลือก font-family ตามนี้ */
  fontStyle: PlateFontStyle;
  /** บรรทัดบน — noto: แยกเป็นช่วง (เลขหน้า / อักษร / เลขท้าย) · custom: ทีละ glyph · ทุกช่วงใช้ text-anchor="start" */
  topRuns: PlateTextLine[];
  /** ขอบหมึกของกลุ่มหน้าและกลุ่มเลขท้าย (หน่วย viewBox) — ใช้ตรวจ/ทดสอบ */
  frontGroupInk: { x0: number; x1: number };
  tailGroupInk: { x0: number; x1: number };
  /** ขนาดตัวเลข (font-size) และ baseline บรรทัดหลัก */
  digitFontSize: number;
  /** ขนาดฟอนต์อักษรไทยบรรทัดหลัก */
  letterFontSize: number;
  mainBaseline: number;
  /** ขอบล่างสุดของหมึกบรรทัดหลัก (รวมหางอักษร) */
  /** ยอดหมึกบรรทัดหลัก (รวมอักษรหัวสูง ป ฝ ฟ ฬ) */
  mainInkTop: number;
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

export function buildPlateLayout(input: PlateLayoutInput, font: PlateFontProfile = PLATE_FONT_PROFILE): PlateLayout {
  const L = PLATE_LAYOUT;
  const W = PLATE_W;
  const H = PLATE_H;
  const P = font.province;
  const R = font.letterFontRatio;
  const CAP = font.digitCapEm;
  const { front, letters, tail } = plateTextParts(input);
  const prefix = front === null ? letters : `${front}${letters}`;
  const provinceRaw = input.provinceLabel?.trim();
  const provinceLabel = provinceRaw ? provinceRaw : null;
  const plateText = formatPlateText(input);

  const contentLeft = L.contentLeftW * W;
  const contentRight = W - L.contentRightW * W;
  const minGap = L.minGroupGapW * W;

  // ---- บรรทัดหลัก: ความกว้าง (em ของขนาดตัวเลข) ----
  // กลุ่มหน้า: เลขหน้า (ขนาดตัวเลข) + อักษร (ขนาด × letterFontRatio)
  const frontInkEm = frontGroupInkEm(front, letters, font);
  const tailInkEm = inkWidthEm(tail, font);
  const descEm = descenderEm(letters, font) * R;

  // ขนาดตัวเลขตามค่าวัด แล้วย่อทั้งบรรทัดด้วยอัตราส่วนเดียวเมื่อกว้างเกินพื้นที่ในระยะปลอดภัยเท่านั้น
  let size = (L.digitHeightH * H) / CAP;
  size = Math.min(size, (contentRight - contentLeft - minGap) / (frontInkEm + tailInkEm));
  const minTop = L.minTopMarginH * H;
  const topEm = Math.max(CAP, ascenderEm(letters, font) * R);

  // ---- บรรทัดจังหวัด (ยอดหมึกบรรทัดนี้จำกัดขอบล่างของบรรทัดหลัก) ----
  // ปกติ baseline คงที่ (หมึกล่างที่ลึกที่สุดที่ขนาดเต็มอยู่เหนือระยะปลอดภัยล่างพอดี)
  // provinceTop = หมึกบนสุดรวมสระบน/วรรณยุกต์
  let provinceLine: PlateTextLine | null = null;
  let provinceTop: number | null = null;
  if (provinceLabel !== null) {
    const byHeight = (L.province.consonantHeightH * H) / P.consonantEm;
    const byWidth = (L.province.maxWidthW * W) / Math.max(provinceWidthEm(provinceLabel, font), 0.01);
    let pSize = Math.min(byHeight, byWidth);
    let pBaseline = provinceBaselineH(font) * H;
    const ascEm = provinceAscentEm(provinceLabel, font);
    if (descEm > 0) {
      // อักษรมีหาง: ย่อจังหวัดเท่าที่จำเป็นให้ตัวเลขได้ขนาดเป้าหมาย (ไม่เกินที่ความกว้างอนุญาต) แล้ววาง baseline
      // ให้หมึกล่างที่ลึกที่สุดชิดระยะปลอดภัยล่างตามขนาดใหม่
      const safeBottom = pBaseline + P.lowerMarkEm * byHeight;
      const target = Math.min(size, (font.descenderTargetH * H) / CAP);
      const needTop = minTop + target * (topEm + descEm) + L.descenderClearanceH * H;
      const fit = (safeBottom - needTop) / (P.lowerMarkEm + ascEm);
      const floor = Math.max(
        pSize * L.province.descenderShrinkMin,
        font.provinceMinConsonantH === undefined ? 0 : (font.provinceMinConsonantH * H) / P.consonantEm,
      );
      const shrunk = Math.min(pSize, Math.max(fit, floor));
      if (shrunk < pSize) {
        pSize = shrunk;
        pBaseline = safeBottom - P.lowerMarkEm * pSize;
      }
    }
    provinceLine = { text: provinceLabel, x: W / 2, y: round2(pBaseline), fontSize: round2(pSize) };
    provinceTop = pBaseline - ascEm * pSize;
  }

  // แนวตั้ง: baseline ตามค่าวัด — ยอดหมึก (รวมอักษรหัวสูง ป ฝ ฟ ฬ) ต้องไม่ล้ำระยะปลอดภัยบน และขอบล่าง
  // (รวมหาง ฐ ญ ฎ ฏ ฤ ฦ) ต้องห่างหมึกบนสุดของบรรทัดจังหวัด — ถ้าไม่พอ ยกบรรทัดขึ้นถึงระยะปลอดภัยบน แล้วจึงย่อ
  const limit =
    provinceTop !== null
      ? provinceTop - (descEm > 0 ? L.descenderClearanceH : L.minLineGapH) * H
      : H - minTop; // ไม่มีบรรทัดจังหวัด: ระยะปลอดภัยล่างเท่าด้านบน (ประมาณการ)
  size = Math.min(size, (limit - minTop) / (topEm + descEm));
  let baseline =
    provinceTop !== null
      ? L.mainBaselineH * H
      : // ไม่มีบรรทัดจังหวัด: จัดตัวเลขกึ่งกลางแนวตั้ง (ประมาณการ — ไม่มีภาพป้ายจริงกรณีนี้)
        H / 2 + (CAP * size) / 2;
  baseline = Math.min(baseline, limit - descEm * size);
  baseline = Math.max(baseline, minTop + topEm * size);

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

  const letterSize = size * R;
  const topY = round2(baseline);
  const topRuns: PlateTextLine[] =
    font.placement === 'glyphs'
      ? placeGlyphs(front, letters, tail, fx0, tx0, size, topY, font)
      : placeRuns(front, letters, tail, fx0, tx0, size, topY, font);

  return {
    prefix,
    tail,
    plateText,
    provinceLabel,
    ariaLabel: buildPlateAriaLabel(plateText, provinceLabel, input.variant),
    fontStyle: font.style,
    topRuns,
    frontGroupInk: { x0: round2(fx0), x1: round2(fx0 + frontW) },
    tailGroupInk: { x0: round2(tx0), x1: round2(tx1) },
    digitFontSize: round2(size),
    letterFontSize: round2(letterSize),
    mainBaseline: topY,
    mainInkTop: round2(baseline - topEm * size),
    mainInkBottom: round2(baseline + descEm * size),
    provinceLine,
    provinceTop: provinceTop === null ? null : round2(provinceTop),
  };
}

/** ชุด noto: ข้อความต่อกลุ่ม (เลขหน้า / อักษร / เลขท้าย) ช่องไฟตามฟอนต์ */
function placeRuns(
  front: string | null,
  letters: string,
  tail: string,
  fx0: number,
  tx0: number,
  size: number,
  y: number,
  font: PlateFontProfile,
): PlateTextLine[] {
  const R = font.letterFontRatio;
  const runs: PlateTextLine[] = [];
  const firstLeftBearingEm = front === null ? letterMetric(letters[0] ?? '', font)[1] * R : digitMetric(front, font)[1];
  let x = fx0 - firstLeftBearingEm * size;
  if (front !== null) {
    runs.push({ text: front, x: round2(x), y, fontSize: round2(size), role: 'digit' });
    x += textWidthEm(front, font) * size;
  }
  runs.push({ text: letters, x: round2(x), y, fontSize: round2(size * R), role: 'letter' });
  runs.push({ text: tail, x: round2(tx0 - digitMetric(tail[0] ?? '', font)[1] * size), y, fontSize: round2(size), role: 'digit' });
  return runs;
}

/** ชุด custom: วางทีละ glyph ตามขอบหมึก — ช่องไฟเลข digitGapEm, อักษร letterGapEm, อักษรบีบ letterScaleX */
function placeGlyphs(
  front: string | null,
  letters: string,
  tail: string,
  fx0: number,
  tx0: number,
  size: number,
  y: number,
  font: PlateFontProfile,
): PlateTextLine[] {
  const runs: PlateTextLine[] = [];
  const letterSize = size * font.letterFontRatio;
  const sx = font.letterScaleX;
  /** วาง glyph ให้ขอบหมึกซ้ายอยู่ที่ inkX แล้วคืนค่าความกว้างหมึก */
  const put = (ch: string, role: 'digit' | 'letter', inkX: number): number => {
    const m = role === 'digit' ? digitMetric(ch, font) : letterMetric(ch, font);
    const fs = role === 'digit' ? size : letterSize;
    const k = role === 'digit' ? 1 : sx;
    runs.push({
      text: ch,
      x: round2(inkX - m[1] * fs * k),
      y,
      fontSize: round2(fs),
      role,
      ...(k !== 1 ? { scaleX: k } : {}),
    });
    return inkEm(m) * fs * k;
  };
  let x = fx0;
  if (front !== null) x += put(front, 'digit', x) + font.letterGapEm * size;
  [...letters].forEach((ch, i) => {
    if (i > 0) x += font.letterGapEm * size;
    x += put(ch, 'letter', x);
  });
  x = tx0;
  const digits = [...tail];
  digits.forEach((ch, i) => {
    if (i > 0) x += font.digitGapEm(digits[i - 1], ch) * size;
    x += put(ch, 'digit', x);
  });
  return runs;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
