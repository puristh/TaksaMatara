import { describe, expect, it } from 'vitest';
import {
  buildPlateAriaLabel,
  buildPlateLayout,
  CUSTOM_PLATE_FONT,
  CUSTOM_SHORT_TAIL_PLATE_FONT,
  inkWidthEm,
  NOTO_PLATE_FONT,
  makePlateLayout,
  PLATE_BASE_H,
  PLATE_H,
  PLATE_LAYOUT,
  PLATE_W,
  plateVariantFor,
  resolvePlateProvinceLabel,
  provinceBaselineH,
  provinceDescentEm,
  provinceWidthEm,
  textWidthEm,
} from './plateLayout';
import type { PlateFontProfile, PlateLayoutInput } from './plateLayout';
import { detectAuctionNumber } from '../engine/auctionNumber';
import { formatPlateText } from '../engine/plateText';
import { PLATE_IMAGE_DEFAULT_PROVINCE } from '../config/featureFlags';

function layoutWith(
  frontDigit: number | null,
  letters: [string, string],
  tailDigits: string,
  extra: Partial<PlateLayoutInput> = {},
  font?: PlateFontProfile,
) {
  return buildPlateLayout(
    {
      frontDigit,
      thaiLetters: letters,
      tailDigits,
      variant: 'standard',
      provinceLabel: 'กรุงเทพมหานคร',
      ...extra,
    },
    font,
  );
}

const layout = layoutWith;

const BAD_TEXT = /undefined|null|NaN/;

describe('buildPlateLayout — prefix/tail composition', () => {
  it('front digit is glued to the letters ("9กบ"), tail separate', () => {
    const l = layout(9, ['ก', 'บ'], '9999');
    expect(l.prefix).toBe('9กบ');
    expect(l.tail).toBe('9999');
    expect(l.plateText).toBe('9 กบ 9999');
  });

  it('front digit 0 is shown as "0" (not treated as missing)', () => {
    const l = layout(0, ['ฐ', 'ร'], '18');
    expect(l.prefix).toBe('0ฐร');
    expect(l.plateText).toBe('0 ฐร 18');
  });

  it('no front digit (null) → letters only, no leading space, no "null"/"undefined"', () => {
    const l = layout(null, ['ฐ', 'ร'], '18');
    expect(l.prefix).toBe('ฐร');
    expect(l.tail).toBe('18');
    expect(l.plateText).toBe('ฐร 18');
    expect(l.ariaLabel).not.toMatch(BAD_TEXT);
  });

  it('"ฐร 18" (no front digit) differs from "0ฐร 18" (front digit 0)', () => {
    const none = layout(null, ['ฐ', 'ร'], '18');
    const zero = layout(0, ['ฐ', 'ร'], '18');
    expect(none.prefix).not.toBe(zero.prefix);
    expect(none.plateText).not.toBe(zero.plateText);
    expect(none.ariaLabel).not.toBe(zero.ariaLabel);
  });

  it('plateText is exactly formatPlateText (reuses the existing composition rule)', () => {
    for (const fd of [null, 0, 5]) {
      const input = { frontDigit: fd, thaiLetters: ['ก', 'ข'] as [string, string], tailDigits: '59' };
      expect(layout(fd, ['ก', 'ข'], '59').plateText).toBe(formatPlateText(input));
    }
  });

  for (const tail of ['1', '12', '123', '1234', '0059']) {
    for (const fd of [null, 0, 7]) {
      it(`tail "${tail}" with front ${String(fd)}: no stray text or whitespace`, () => {
        const l = layout(fd, ['ก', 'ข'], tail);
        expect(l.tail).toBe(tail);
        for (const t of [l.prefix, l.tail, l.plateText, l.ariaLabel]) {
          expect(t).not.toMatch(BAD_TEXT);
          expect(t).toBe(t.trim());
          expect(t).not.toMatch(/ {2}/);
        }
        expect(l.prefix).not.toMatch(/\s/);
        expect(l.tail).not.toMatch(/\s/);
      });
    }
  }
});

const W = PLATE_W;
const H = PLATE_H;
const L = PLATE_LAYOUT;
const EPS = 0.05;
/**
 * เทสต์เลย์เอาต์ด้านล่างรันกับทั้งสองชุดฟอนต์ (featureFlags.ts → PLATE_FONT_STYLE)
 * ค่าที่เดิมเขียนตายตัวตามฟอนต์ Noto (DIGIT_CAP_EM = 0.724, LETTER_FONT_RATIO, ฐานจังหวัด 0.575 em,
 * L.province.baselineH) เปลี่ยนเป็นค่าของชุดฟอนต์ที่กำลังทดสอบ — ชุด noto ได้ค่าเดิมทุกตัว
 */
// เพิ่มชุด custom แบบตัดหาง (ค่าเริ่มต้น) — กติกาเดียวกันต้องผ่านทุกชุด
const FONTS = [NOTO_PLATE_FONT, CUSTOM_PLATE_FONT, CUSTOM_SHORT_TAIL_PLATE_FONT];

/** ทุกกรณีความยาว: เลขหน้า null/0/ตัวเลข × อักษรแคบ/กว้าง/มีหาง × เลขท้าย 1–4 หลัก × มี/ไม่มีจังหวัด */
const FRONTS = [null, 0, 8] as const;
const LETTER_SETS: Array<[string, string]> = [
  ['ก', 'ก'],
  ['ร', 'ว'],
  ['ฒ', 'ฒ'],
  ['ญ', 'ณ'],
  ['ฐ', 'ร'],
  ['ฌ', 'ฬ'],
];
const TAILS = ['1', '11', '222', '9999', '0000', '1234'];
const PROVINCES = ['กรุงเทพมหานคร', 'พระนครศรีอยุธยา', null] as const;

for (const font of FONTS)
describe(`[${font.style}${font.tailMode === "shortened" ? "/short-tail" : ""}] buildPlateLayout — invariants for every length`, () => {
  const DIGIT_CAP_EM = font.digitCapEm;
  for (const fd of FRONTS)
    for (const letters of LETTER_SETS)
      for (const tail of TAILS)
        for (const prov of PROVINCES) {
          const name = `${String(fd)}|${letters.join('')}|${tail}|${String(prov)}`;
          it(name, () => {
            const l = layout(fd, letters, tail, { provinceLabel: prov }, font);
            // ไม่ล้นกรอบซ้าย/ขวา
            expect(l.frontGroupInk.x0).toBeGreaterThanOrEqual(L.contentLeftW * W - EPS);
            expect(l.tailGroupInk.x1).toBeLessThanOrEqual(W - L.contentRightW * W + EPS);
            // กลุ่มหน้าอยู่ซ้าย กลุ่มท้ายอยู่ขวา ห่างกันอย่างน้อย minGroupGap
            expect(l.tailGroupInk.x0 - l.frontGroupInk.x1).toBeGreaterThanOrEqual(L.minGroupGapW * W - EPS);
            // ความกว้างหมึกกลุ่มท้ายตรงกับ metric ของฟอนต์ (ไม่ยืดหด glyph)
            expect(l.tailGroupInk.x1 - l.tailGroupInk.x0).toBeCloseTo(inkWidthEm(tail, font) * l.digitFontSize, 0);
            // ขนาดตัวเลขไม่เกินค่าวัด, อักษรสูงเท่าตัวเลข (สัดส่วนคงที่)
            expect(l.digitFontSize * DIGIT_CAP_EM).toBeLessThanOrEqual(L.digitHeightH * H + EPS);
            const letterRun = l.topRuns.find((r) => r.role === 'letter')!;
            expect(letterRun.fontSize / l.digitFontSize).toBeCloseTo(font.letterFontRatio, 1);
            // แนวตั้ง: ไม่ล้นบน/ล่าง และหางอักษรไม่ชนบรรทัดจังหวัด
            expect(l.mainBaseline - DIGIT_CAP_EM * l.digitFontSize).toBeGreaterThanOrEqual(L.minTopMarginH * H - EPS);
            if (l.provinceTop !== null) {
              expect(l.mainInkBottom).toBeLessThanOrEqual(l.provinceTop - L.descenderClearanceH * H + EPS);
              expect(provinceWidthEm(l.provinceLine!.text, font) * l.provinceLine!.fontSize).toBeLessThanOrEqual(
                L.province.maxWidthW * W + EPS,
              );
            } else {
              expect(l.mainInkBottom).toBeLessThanOrEqual(H - L.minTopMarginH * H + EPS);
            }
            for (const r of l.topRuns) {
              expect(Number.isFinite(r.x) && Number.isFinite(r.y) && r.fontSize > 0).toBe(true);
              expect(r.text).not.toMatch(BAD_TEXT);
            }
          });
        }
});

for (const font of FONTS)
describe(`[${font.style}${font.tailMode === "shortened" ? "/short-tail" : ""}] buildPlateLayout — measured rules from real plates`, () => {
  const DIGIT_CAP_EM = font.digitCapEm;
  const layout = (
    frontDigit: number | null,
    letters: [string, string],
    tailDigits: string,
    extra: Partial<PlateLayoutInput> = {},
  ) => layoutWith(frontDigit, letters, tailDigits, extra, font);
  // เดิม: W / H ≈ 2.34 → (งานก่อน) ป้ายสูง 1.2 เท่า ≈ 1.95 → ตอนนี้ 1.05 เท่า ≈ 2.23 (ระยะระหว่างบรรทัดคงที่ หางไม่กำหนดความสูงแล้ว)
  it('aspect ratio: base plate ≈ 2.34 (measured median), drawn plate is heightScale (1.05×) taller → ≈ 2.23', () => {
    expect(W / PLATE_BASE_H).toBeCloseTo(2.34, 1);
    expect(L.heightScale).toBe(1.05);
    expect(H).toBe(Math.round(PLATE_BASE_H * 1.05));
    expect(W / H).toBeCloseTo(2.23, 1);
  });

  it('digit height is the measured 41.5% H whenever it fits — same for 1, 2, 3 and 4 tail digits', () => {
    for (const tail of ['1', '11', '222', '9999']) {
      const l = layout(1, ['ก', 'ข'], tail);
      if (tail.length < 4) expect(l.digitFontSize * DIGIT_CAP_EM).toBeCloseTo(L.digitHeightH * H, 1);
    }
    const sizes = ['1', '11', '222'].map((t) => layout(null, ['ก', 'ข'], t).digitFontSize);
    expect(new Set(sizes).size).toBe(1);
  });

  it('groups sit centered in their own zones (front ≈ 24% W, tail ≈ 72% W), or pinned to the frame when the font is too wide to center', () => {
    for (const [fd, tail] of [[8, '11'], [null, '1'], [1, '48'], [null, '92'], [null, '345']] as const) {
      const l = layout(fd, ['ก', 'ข'], tail);
      const fc = (l.frontGroupInk.x0 + l.frontGroupInk.x1) / 2;
      const tc = (l.tailGroupInk.x0 + l.tailGroupInk.x1) / 2;
      if (l.frontGroupInk.x0 > L.contentLeftW * W + EPS) expect(fc / W).toBeCloseTo(L.leftGroupCenterW, 2);
      else expect(l.frontGroupInk.x0).toBeCloseTo(L.contentLeftW * W, 1);
      expect(tc / W).toBeCloseTo(L.tailGroupCenterW, 2);
    }
    // ไม่มีเลขหน้า กลุ่มแคบพอ → อยู่กึ่งกลางโซนพอดี
    const nf = layout(null, ['ก', 'ข'], '92');
    expect((nf.frontGroupInk.x0 + nf.frontGroupInk.x1) / 2 / W).toBeCloseTo(L.leftGroupCenterW, 2);
  });

  it('"8กก 11" is left-heavy like real plates (tail stays in its zone, not stretched to the edge)', () => {
    const l = layout(8, ['ก', 'ก'], '11');
    expect(l.tailGroupInk.x1).toBeLessThan(W - L.contentRightW * W - 0.1 * W);
    expect(l.tailGroupInk.x0 - l.frontGroupInk.x1).toBeGreaterThan(0.1 * W);
  });

  it('long plates (front + 2 letters + 4 digits) use the full width with the minimum gap', () => {
    const l = layout(5, ['ก', 'ผ'], '8888');
    expect(l.frontGroupInk.x0).toBeCloseTo(L.contentLeftW * W, 0);
    expect(l.tailGroupInk.x1).toBeCloseTo(W - L.contentRightW * W, 0);
    expect(l.tailGroupInk.x0 - l.frontGroupInk.x1).toBeCloseTo(L.minGroupGapW * W, 0);
  });

  it('front digit run only when frontDigit !== null; "0" gets its own run; prefix glued to letters', () => {
    if (font.placement === 'runs') {
      expect(layout(null, ['ฐ', 'ร'], '18').topRuns.map((r) => r.text)).toEqual(['ฐร', '18']);
      expect(layout(0, ['ฐ', 'ร'], '18').topRuns.map((r) => r.text)).toEqual(['0', 'ฐร', '18']);
      const l = layout(9, ['ก', 'บ'], '9999');
      expect(l.topRuns.map((r) => r.text)).toEqual(['9', 'กบ', '9999']);
      const [f, letters] = l.topRuns;
      expect(letters.x).toBeCloseTo(f.x + textWidthEm(f.text, font) * f.fontSize, 1);
    } else {
      // ชุด custom วางทีละ glyph: ลำดับและบทบาทยังตรงกับเลขหน้า / อักษร / เลขท้าย
      expect(layout(null, ['ฐ', 'ร'], '18').topRuns.map((r) => r.text)).toEqual(['ฐ', 'ร', '1', '8']);
      expect(layout(0, ['ฐ', 'ร'], '18').topRuns.map((r) => `${r.role}:${r.text}`)).toEqual([
        'digit:0', 'letter:ฐ', 'letter:ร', 'digit:1', 'digit:8',
      ]);
      expect(layout(9, ['ก', 'บ'], '9999').topRuns.map((r) => r.text).join('')).toBe('9กบ9999');
    }
  });

  // เดิม: y / H ≈ provinceBaselineH(font) — ชื่อจังหวัดย่อ 0.8 เท่าโดยให้หมึกล่างสุดอยู่ที่เดิม baseline จึงเลื่อนลง
  // ตามความลึกหมึกล่างของชื่อนั้น (กรุงเทพมหานคร: สระ ุ) — ระยะจากขอบล่างเท่าป้ายที่ไม่ย่อจังหวัด
  it('province line: measured size × provinceScale (15.35% of base plate × 0.8), ink bottom stays put, centered', () => {
    const l = layout(1, ['ก', 'ข'], '12');
    expect(l.provinceLine!.x).toBe(W / 2);
    const d = provinceDescentEm(l.provinceLine!.text, font);
    const full = buildPlateLayout(
      { frontDigit: 1, thaiLetters: ['ก', 'ข'], tailDigits: '12', variant: 'standard', provinceLabel: 'กรุงเทพมหานคร' },
      font,
      makePlateLayout(L.heightScale, 1),
    ).provinceLine!;
    expect(l.provinceLine!.fontSize).toBeCloseTo(full.fontSize * L.provinceScale, 1);
    expect(l.provinceLine!.y + d * l.provinceLine!.fontSize).toBeCloseTo(full.y + d * full.fontSize, 1);
    expect(full.y / H).toBeCloseTo(provinceBaselineH(font), 2);
    // ความสูงไม่เกินค่าวัด และความกว้างไม่เกินค่าวัด (ตัวใดตัวหนึ่งเป็นตัวกำหนด)
    const consonantH = (l.provinceLine!.fontSize * font.province.consonantEm) / H;
    const width = (provinceWidthEm(l.provinceLine!.text, font) * l.provinceLine!.fontSize) / W;
    expect(consonantH).toBeLessThanOrEqual(L.province.consonantHeightH + 0.001);
    expect(width).toBeLessThanOrEqual(L.province.maxWidthW + 0.001);
    expect(Math.max(consonantH / L.province.consonantHeightH, width / L.province.maxWidthW)).toBeCloseTo(1, 2);
    // สำหรับ "กรุงเทพมหานคร" ตัวอักษรยังสูงใกล้ค่าวัด (ต่างไม่เกิน 10%)
    expect(consonantH / L.province.consonantHeightH).toBeGreaterThan(0.9);
  });

  // เดิม: อักษรมีหางยกบรรทัดหลักขึ้น (ป้ายสูงเดิม) — ผู้ใช้สั่งให้ระยะระหว่างบรรทัดคงที่ทุกป้าย: เส้นฐานไม่ขยับ
  // ป้ายที่หางไม่พ้นชื่อจังหวัดย่อบรรทัดหลักแทน (ทดสอบที่ป้ายสูงเดิมซึ่งหางไม่พอแน่นอน)
  it('descender letters (ฐ) keep the main baseline and shrink the main line instead of colliding with the province', () => {
    const base = makePlateLayout(1, 0.9, 0.136);
    const at = (letters: [string, string], cfg = L) =>
      buildPlateLayout({ frontDigit: null, thaiLetters: letters, tailDigits: '18', variant: 'standard', provinceLabel: 'กรุงเทพมหานคร' }, font, cfg);
    for (const cfg of [base, L]) {
      const tailed = at(['ฐ', 'ร'], cfg);
      const plain = at(['ก', 'ร'], cfg);
      expect(tailed.mainBaseline).toBe(plain.mainBaseline);
      expect(tailed.provinceLine).toEqual(plain.provinceLine);
      expect(tailed.mainInkBottom).toBeLessThanOrEqual(tailed.provinceTop! - cfg.descenderClearanceH * cfg.height + EPS);
    }
    // หางเดิมไม่พอที่ป้ายสูงเดิม → ย่อ · หางตัดสั้นพอ → ขนาดเท่าป้ายไม่มีหาง
    if (font.tailMode === 'fit') expect(at(['ฐ', 'ร'], base).digitFontSize).toBeLessThan(at(['ก', 'ร'], base).digitFontSize);
    else expect(at(['ฐ', 'ร'], base).digitFontSize).toBe(at(['ก', 'ร'], base).digitFontSize);
  });

  it('combining marks (สระบน/ล่าง) take no width', () => {
    expect(textWidthEm('กรุง')).toBeCloseTo(textWidthEm('กรง'));
  });
});

describe('plate variant — selected only via the existing detectAuctionNumber', () => {
  it('auction numbers → "auction"', () => {
    for (const tail of ['9999', '1234', '5000', '88', '777']) {
      expect(detectAuctionNumber(tail).isAuction).toBe(true);
      expect(plateVariantFor(detectAuctionNumber(tail))).toBe('auction');
    }
  });
  it('non-auction numbers → "standard" (incl. "1989" which only contains "89")', () => {
    for (const tail of ['18', '1989', '59', '4721']) {
      expect(detectAuctionNumber(tail).isAuction).toBe(false);
      expect(plateVariantFor(detectAuctionNumber(tail))).toBe('standard');
    }
  });
});

describe('aria-label', () => {
  it('uses the real plate text', () => {
    expect(layout(null, ['ฐ', 'ร'], '18').ariaLabel).toBe('ภาพจำลองป้ายทะเบียน ฐร 18 กรุงเทพมหานคร');
    expect(layout(null, ['ฐ', 'ร'], '18', { provinceLabel: null }).ariaLabel).toBe('ภาพจำลองป้ายทะเบียน ฐร 18');
  });
  it('says when it is the auction design', () => {
    expect(layout(9, ['ก', 'บ'], '9999', { variant: 'auction' }).ariaLabel).toBe(
      'ภาพจำลองป้ายทะเบียน 9 กบ 9999 กรุงเทพมหานคร (ลายป้ายประมูล)',
    );
  });
  it('contains no placeholder / intermediate values', () => {
    const label = buildPlateAriaLabel('0 ฐร 18', null, 'standard');
    expect(label).not.toMatch(BAD_TEXT);
    expect(label).not.toMatch(/\{|\}|\$|prefix|tail/);
  });
});

describe('province line', () => {
  it('provinceLabel null → no province line', () => {
    expect(layout(1, ['ก', 'ข'], '12', { provinceLabel: null }).provinceLine).toBeNull();
  });
  it('blank province label → no province line (no empty text)', () => {
    expect(layout(1, ['ก', 'ข'], '12', { provinceLabel: '  ' }).provinceLine).toBeNull();
  });
  it('default constant is กรุงเทพมหานคร', () => {
    expect(PLATE_IMAGE_DEFAULT_PROVINCE).toBe('กรุงเทพมหานคร');
  });
  it('resolvePlateProvinceLabel: typed province wins, default otherwise, null default turns the line off', () => {
    expect(resolvePlateProvinceLabel({}, 'กรุงเทพมหานคร')).toBe('กรุงเทพมหานคร');
    expect(resolvePlateProvinceLabel({ province: ' เชียงใหม่ ' }, 'กรุงเทพมหานคร')).toBe('เชียงใหม่');
    expect(resolvePlateProvinceLabel({ province: 'เชียงใหม่' }, null)).toBeNull();
  });
});
