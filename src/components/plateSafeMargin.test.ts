import { describe, expect, it } from 'vitest';
import { buildPlateLayout, inkWidthEm, PLATE_H, PLATE_LAYOUT, PLATE_W, provinceWidthEm } from './plateLayout';
import type { PlateVariant } from './plateLayout';

/**
 * ระยะปลอดภัย (safe margin) วัดจาก "ขอบด้านในของเส้นขอบใน" ของภาพจำลอง ไม่ใช่ขอบนอกของป้าย
 * ค่าที่ใช้ตรวจมาจากไฟล์ฟอนต์โดยตรง (ไม่อ่านจากโค้ดเลย์เอาต์) เพื่อให้เทสต์เป็นอิสระจากสูตร
 */
const W = PLATE_W;
const H = PLATE_H;
const L = PLATE_LAYOUT;
const F = L.frame;
const INNER_L = F.innerInset + F.innerStroke / 2;
const INNER_R = W - INNER_L;
const INNER_T = F.innerInset + F.innerStroke / 2;
const INNER_B = H - INNER_T;
/** ฟอนต์บรรทัดจังหวัด (wdth 80): สระล่าง ุ ู ลึก 0.327 em — ลึกที่สุดในฟอนต์ */
const PROVINCE_LOWER_MARK_EM = 0.327;
const EPS = 0.05;

type Case = [front: number | null, l1: string, l2: string, tail: string, province?: string];
/** ชุดตรวจตามรายงาน + จังหวัดชื่อยาว + อักษรกว้าง/หัวสูง/มีหางที่สุด */
const CHECK_SET: Case[] = [
  [2, 'ก', 'บ', '2295'],
  [9, 'ก', 'บ', '9999'],
  [5, 'ก', 'ผ', '8888'],
  [9, 'ญ', 'ณ', '4721'],
  [1, 'ก', 'ก', '1234'],
  [0, 'ฐ', 'ร', '1234'],
  [null, 'ศ', 'ร', '91'],
  [8, 'ก', 'ก', '11'],
  [null, 'ฐ', 'ร', '18'],
  [9, 'ก', 'บ', '9999', 'พระนครศรีอยุธยา'],
  [0, 'ฐ', 'ร', '1234', 'ประจวบคีรีขันธ์'],
  [1, 'ก', 'ก', '1234', 'นครศรีธรรมราช'],
  [9, 'ฒ', 'ฒ', '8888', 'พระนครศรีอยุธยา'],
  [1, 'ฬ', 'ฬ', '1234', 'แม่ฮ่องสอน'],
  [9, 'ญ', 'ญ', '8888', 'กาฬสินธุ์'],
  [4, 'ป', 'ฟ', '4444', 'เชียงใหม่'],
];
/** ความยาวสูงสุดที่ระบบรองรับ: เลขหน้า + อักษร 2 ตัว + เลขท้าย 4 หลัก (ช่องจังหวัดเป็นข้อความอิสระ) */
const MAX_CASES: Case[] = [
  [8, 'ฒ', 'ฒ', '8888', 'พระนครศรีอยุธยา'],
  [8, 'ฌ', 'ฬ', '0000', 'พระนครศรีอยุธยา'],
  [0, 'ฐ', 'ญ', '4444', 'ประจวบคีรีขันธ์'],
  [8, 'ฒ', 'ฒ', '8888', 'จังหวัดที่ชื่อยาวมากเกินกว่าชื่อจังหวัดจริงทุกจังหวัดในประเทศ'],
];

function lay([front, l1, l2, tail, province]: Case, variant: PlateVariant) {
  return buildPlateLayout({
    frontDigit: front,
    thaiLetters: [l1, l2],
    tailDigits: tail,
    variant,
    provinceLabel: province ?? 'กรุงเทพมหานคร',
  });
}

function checkInside(c: Case, variant: PlateVariant, marginW: number, topH: number, bottomH: number) {
  const l = lay(c, variant);
  // แนวนอน
  expect(l.frontGroupInk.x0 - INNER_L).toBeGreaterThanOrEqual(marginW * W - EPS);
  expect(INNER_R - l.tailGroupInk.x1).toBeGreaterThanOrEqual(marginW * W - EPS);
  // แนวตั้ง: ยอดบรรทัดหลัก และสระล่างบรรทัดจังหวัด
  expect(l.mainInkTop - INNER_T).toBeGreaterThanOrEqual(topH * H - EPS);
  const p = l.provinceLine!;
  expect(INNER_B - (p.y + PROVINCE_LOWER_MARK_EM * p.fontSize)).toBeGreaterThanOrEqual(bottomH * H - EPS);
  // จังหวัดอยู่ในระยะปลอดภัยแนวนอนด้วย และหางบรรทัดหลักไม่ทับหมึกบนสุดของบรรทัดจังหวัด
  const pw = provinceWidthEm(p.text) * p.fontSize;
  expect(p.x - pw / 2 - INNER_L).toBeGreaterThanOrEqual(marginW * W - EPS);
  expect(l.mainInkBottom).toBeLessThan(l.provinceTop!);
  return l;
}

describe('safe margin from the inner frame line', () => {
  it('safe margins are within the requested ranges (≥ 4% W, 4–5% H) and measured from the inner line', () => {
    expect(L.safeMarginW).toBeGreaterThanOrEqual(0.04);
    expect(L.safeMarginW).toBeLessThanOrEqual(0.05);
    for (const m of [L.safeMarginTopH, L.safeMarginBottomH]) {
      expect(m).toBeGreaterThanOrEqual(0.04);
      expect(m).toBeLessThanOrEqual(0.05);
    }
    expect(L.contentLeftW * W).toBeCloseTo(INNER_L + L.safeMarginW * W, 6);
    expect(L.minTopMarginH * H).toBeCloseTo(INNER_T + L.safeMarginTopH * H, 6);
  });

  for (const variant of ['standard', 'auction'] as const)
    for (const c of [...CHECK_SET, ...MAX_CASES])
      it(`${variant}: ${c[0] ?? ''}${c[1]}${c[2]} ${c[3]} ${c[4] ?? 'กรุงเทพมหานคร'} stays inside the safe area`, () => {
        checkInside(c, variant, L.safeMarginW, L.safeMarginTopH, L.safeMarginBottomH);
      });

  it('common long plates (front + ordinary letters + 4 digits) keep digits ≥ 36% H', () => {
    for (const c of [CHECK_SET[0], CHECK_SET[1], CHECK_SET[2], CHECK_SET[4], CHECK_SET[9], CHECK_SET[11]]) {
      const l = lay(c, 'standard');
      expect((l.digitFontSize * 0.724) / H).toBeGreaterThanOrEqual(L.minDigitHeightH);
    }
  });

  it('short plates keep the measured digit size (41.5% H)', () => {
    for (const c of [CHECK_SET[6], CHECK_SET[7]]) {
      expect((lay(c, 'standard').digitFontSize * 0.724) / H).toBeCloseTo(L.digitHeightH, 3);
    }
  });

  it('long plates shrink the whole line by one ratio (tail ink width still matches font metrics)', () => {
    const l = lay(CHECK_SET[0], 'standard');
    expect(l.tailGroupInk.x1 - l.tailGroupInk.x0).toBeCloseTo(inkWidthEm('2295') * l.digitFontSize, 1);
    const sizes = l.topRuns.filter((r) => /^\d+$/.test(r.text)).map((r) => r.fontSize);
    expect(new Set(sizes).size).toBe(1);
  });

  it('tolerates ±3% text-width difference between browsers without crossing the inner line', () => {
    for (const c of [...CHECK_SET, ...MAX_CASES]) {
      const l = lay(c, 'standard');
      const fw = l.frontGroupInk.x1 - l.frontGroupInk.x0;
      const tw = l.tailGroupInk.x1 - l.tailGroupInk.x0;
      // runs วางแบบ text-anchor="start": ข้อความที่กว้างขึ้น 3% จะยื่นไปทางขวา ส่วนแคบลงไม่ล้นแน่นอน
      expect(l.tailGroupInk.x1 + 0.03 * tw).toBeLessThan(INNER_R);
      expect(l.frontGroupInk.x1 + 0.03 * fw).toBeLessThan(l.tailGroupInk.x0);
      expect(l.frontGroupInk.x0 - 0.03 * fw).toBeGreaterThan(INNER_L);
      const p = l.provinceLine!;
      const pw = provinceWidthEm(p.text) * p.fontSize * 1.03;
      expect(p.x + pw / 2).toBeLessThan(INNER_R);
    }
  });
});
