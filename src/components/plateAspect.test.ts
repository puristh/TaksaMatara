import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  buildPlateLayout,
  CUSTOM_PLATE_FONT,
  makePlateLayout,
  NOTO_PLATE_FONT,
  PLATE_BASE_H,
  PLATE_H,
  PLATE_LAYOUT,
  PLATE_W,
  provinceDescentEm,
  provinceWidthEm,
} from './plateLayout';
import type { PlateFontProfile, PlateLayoutConfig } from './plateLayout';
import { PlateImage } from './PlateImage';
import { THAI_PROVINCES } from '../data/thaiProvinces';

/**
 * สัดส่วนป้ายสูงขึ้น heightScale เท่า (ผู้ใช้เลือก 1.2) กว้างเท่าเดิม — ระยะจากขอบบนถึงบรรทัดหลัก และจากชื่อจังหวัด
 * ถึงขอบล่างคงระยะจริงเดิม พื้นที่ที่เพิ่มอยู่ระหว่างเลขทะเบียนกับชื่อจังหวัด ชื่อจังหวัดย่อ provinceScale (0.8)
 */
const W = PLATE_W;
const L = PLATE_LAYOUT;
const F = L.frame;
const INNER = F.innerInset + F.innerStroke / 2;
const FONTS = [NOTO_PLATE_FONT, CUSTOM_PLATE_FONT];
const BASE = makePlateLayout(1, 1);
const EPS = 0.05;

type Case = [number | null, string, string, string, string?];
const CHECK_SET: Case[] = [
  [2, 'ก', 'บ', '2295'], [9, 'ก', 'บ', '9999'], [5, 'ก', 'ผ', '8888'], [9, 'ญ', 'ณ', '4721'], [1, 'ก', 'ก', '1234'],
  [0, 'ฐ', 'ร', '1234'], [null, 'ศ', 'ร', '91'], [8, 'ก', 'ก', '11'], [null, 'ฐ', 'ร', '18'],
  [9, 'ก', 'บ', '9999', 'พระนครศรีอยุธยา'], [1, 'ก', 'ก', '1234', 'ประจวบคีรีขันธ์'],
  [0, 'ฐ', 'ร', '1234', 'พระนครศรีอยุธยา'], [0, 'ฐ', 'ร', '1234', 'ประจวบคีรีขันธ์'], [8, 'ฒ', 'ฒ', '8888', 'พระนครศรีอยุธยา'],
];
function lay([f, a, b, t, p]: Case, font: PlateFontProfile, cfg: PlateLayoutConfig = L) {
  return buildPlateLayout(
    { frontDigit: f, thaiLetters: [a, b], tailDigits: t, variant: 'standard', provinceLabel: p ?? 'กรุงเทพมหานคร' },
    font,
    cfg,
  );
}
const name = (c: Case) => `${c[0] ?? ''}${c[1]}${c[2]} ${c[3]} ${c[4] ?? 'กรุงเทพมหานคร'}`;
/** ระยะจากหมึกล่างสุดของชื่อจังหวัด (รวมสระล่าง) ถึงขอบล่างของป้าย (หน่วย viewBox) */
function provinceBottomGap(l: ReturnType<typeof lay>, font: PlateFontProfile, cfg: PlateLayoutConfig) {
  const p = l.provinceLine!;
  return cfg.height - (p.y + provinceDescentEm(p.text, font) * p.fontSize);
}

describe('สัดส่วนป้าย: ค่าเดียว heightScale', () => {
  it('ป้ายสูง 1.2 เท่า กว้างเท่าเดิม (2.34:1 → ~1.95:1) และชื่อจังหวัด 0.8', () => {
    expect(L.heightScale).toBe(1.2);
    expect(L.provinceScale).toBe(0.8);
    expect(PLATE_BASE_H).toBe(188);
    expect(PLATE_H).toBe(226);
    expect(L.aspect).toBeCloseTo(1.95, 2);
    expect(BASE.height).toBe(188);
  });
  it('กฎที่เป็น % ความสูงแปลงเป็นระยะจริงเท่าเดิม (หน่วย viewBox) ทุกค่า', () => {
    const real = (cfg: PlateLayoutConfig, v: number) => v * cfg.height;
    for (const k of ['safeMarginTopH', 'safeMarginBottomH', 'digitHeightH', 'minDigitHeightH', 'mainBaselineH', 'minTopMarginH', 'descenderClearanceH', 'minLineGapH'] as const)
      expect(real(L, L[k]), k).toBeCloseTo(real(BASE, BASE[k]), 6);
    expect(real(L, L.province.consonantHeightH)).toBeCloseTo(real(BASE, BASE.province.consonantHeightH) * 0.8, 6);
    expect(L.province.maxWidthW).toBeCloseTo(BASE.province.maxWidthW * 0.8, 6);
    // แนวนอนไม่เปลี่ยน
    for (const k of ['safeMarginW', 'contentLeftW', 'contentRightW', 'leftGroupCenterW', 'tailGroupCenterW', 'minGroupGapW'] as const)
      expect(L[k], k).toBe(BASE[k]);
  });
});

for (const font of FONTS)
  describe(`[${font.style}] ป้ายสูง 1.2 เท่าเทียบป้ายสูงเดิม`, () => {
    for (const c of CHECK_SET)
      it(name(c), () => {
        const before = lay(c, font, BASE);
        const after = lay(c, font);
        // ตัวเลข/อักษรขนาดเท่าเดิม หรือใหญ่ขึ้นเมื่อเดิมต้องย่อเพราะพื้นที่แนวตั้ง (ไม่เกินค่าวัด 41.5% ของป้ายฐาน)
        expect(after.digitFontSize).toBeGreaterThanOrEqual(before.digitFontSize);
        expect(after.digitFontSize * font.digitCapEm).toBeLessThanOrEqual(L.digitHeightH * L.height + EPS);
        if (after.digitFontSize === before.digitFontSize && before.mainBaseline === BASE.mainBaselineH * BASE.height) {
          // ระยะจากขอบบนถึงยอดบรรทัดหลักเท่าเดิม (ระยะจริง) และตำแหน่งแนวนอนเท่าเดิม
          expect(after.mainInkTop).toBe(before.mainInkTop);
          expect(after.topRuns).toEqual(before.topRuns);
        }
        // ระยะจากหมึกล่างสุดของชื่อจังหวัดถึงขอบล่างเท่าเดิม (ป้ายที่เดิมย่อจังหวัดเพราะหางอักษร: ไม่ต่ำกว่าเดิม)
        const gapAfter = provinceBottomGap(after, font, L);
        const gapBefore = provinceBottomGap(before, font, BASE);
        if (before.provinceLine!.fontSize === lay(c, font, makePlateLayout(1, 1)).provinceLine!.fontSize && lay(c, font, BASE).mainBaseline === after.mainBaseline)
          expect(gapAfter).toBeCloseTo(gapBefore, 1);
        expect(gapAfter).toBeGreaterThanOrEqual(INNER + L.safeMarginBottomH * L.height - EPS);
        // ชื่อจังหวัด 0.8 เท่าของขนาดที่ป้ายสูงเดิมจะได้โดยไม่ย่อเพราะหาง
        const unshrunk = lay(c, font, makePlateLayout(1.2, 1)).provinceLine!.fontSize;
        expect(after.provinceLine!.fontSize).toBeCloseTo(unshrunk * 0.8, 1);
        // พื้นที่ที่เพิ่มไปอยู่ระหว่างบรรทัดหลักกับชื่อจังหวัด
        expect(after.provinceTop! - after.mainInkBottom).toBeGreaterThan(before.provinceTop! - before.mainInkBottom);
      });

    it('ป้ายยาวที่เคยต้องย่อเพราะหางอักษรหรือพื้นที่แนวตั้ง ตอนนี้ได้ตัวเลขขนาดเต็มตามความกว้าง', () => {
      for (const c of CHECK_SET) {
        const after = lay(c, font);
        // ขนาดที่ความกว้างอนุญาต (ไม่มีข้อจำกัดแนวตั้ง) = ป้ายไม่มีหางที่กว้างเท่ากัน
        const noVertical = lay(c, font, makePlateLayout(3, 0.8));
        expect(after.digitFontSize, name(c)).toBeCloseTo(noVertical.digitFontSize, 2);
      }
    });
  });

describe('ลองค่าอื่นได้ (1.15 / 1.25): ยังอยู่ในระยะปลอดภัย', () => {
  for (const hs of [1, 1.15, 1.2, 1.25])
    for (const font of FONTS)
      it(`heightScale ${hs} [${font.style}]`, () => {
        const cfg = makePlateLayout(hs);
        for (const c of CHECK_SET) {
          const l = lay(c, font, cfg);
          expect(l.frontGroupInk.x0 - INNER).toBeGreaterThanOrEqual(cfg.safeMarginW * W - EPS);
          expect(W - INNER - l.tailGroupInk.x1).toBeGreaterThanOrEqual(cfg.safeMarginW * W - EPS);
          expect(l.mainInkTop - INNER).toBeGreaterThanOrEqual(cfg.safeMarginTopH * cfg.height - EPS);
          const p = l.provinceLine!;
          expect(cfg.height - INNER - (p.y + font.province.lowerMarkEm * p.fontSize)).toBeGreaterThanOrEqual(
            cfg.safeMarginBottomH * cfg.height - EPS,
          );
          expect(l.mainInkBottom).toBeLessThan(l.provinceTop!);
          expect(provinceWidthEm(p.text, font) * p.fontSize).toBeLessThanOrEqual(cfg.province.maxWidthW * W + EPS);
        }
      });
});

describe('ชื่อจังหวัดที่จอ 390px (ป้ายกว้าง 260px ใน #single)', () => {
  it('พยัญชนะจังหวัดของทั้ง 77 จังหวัด × ทุกป้ายในชุดตรวจ ≥ 10.5px (เกณฑ์เตือน) ทั้งสองชุดฟอนต์', () => {
    for (const font of FONTS)
      for (const p of THAI_PROVINCES)
        for (const c of CHECK_SET.slice(0, 9)) {
          const l = lay([c[0], c[1], c[2], c[3], p], font);
          expect(l.provinceLine!.fontSize * font.province.consonantEm * (260 / W), `${font.style} ${p}`).toBeGreaterThanOrEqual(10.5);
        }
  });
});

describe('ชุด custom ที่ป้ายสูงเดิมได้ผลเดิม (snapshot จาก commit 6c7e372)', () => {
  it('ทุกป้ายที่ไม่ได้ใช้กฎขั้นต่ำ 13px (กฎนี้เอาออกแล้ว)', () => {
    let same = 0;
    for (const s of OLD_CUSTOM_SNAPSHOT) {
      const [f, [a, b], t, p] = s.input as unknown as [number | null, [string, string], string, string];
      const l = lay([f, a, b, t, p], CUSTOM_PLATE_FONT, BASE);
      const old = s.provinceLine.fontSize * CUSTOM_PLATE_FONT.province.consonantEm * (260 / W);
      if (old < 13.01) continue; // ป้ายนี้ถูกกฎ 13px ดันขึ้น
      expect(l.topRuns).toEqual(s.topRuns);
      expect(l.provinceLine).toEqual(s.provinceLine);
      expect([l.mainInkTop, l.mainInkBottom, l.provinceTop]).toEqual([s.mainInkTop, s.mainInkBottom, s.provinceTop]);
      same++;
    }
    expect(same).toBeGreaterThanOrEqual(5);
  });
});

describe('PlateImage: กรอบและลายประมูลตามความสูงใหม่', () => {
  const html = renderToStaticMarkup(
    createElement(PlateImage, { frontDigit: 9, thaiLetters: ['ก', 'บ'], tailDigits: '9999', variant: 'auction' }),
  );
  it('viewBox สูงตามสัดส่วนใหม่ และเส้นขอบนอก/ในห่างขอบเท่าเดิม', () => {
    expect(html).toContain(`viewBox="0 0 440 ${PLATE_H}"`);
    expect(html).toContain(`<rect x="${F.innerInset}" y="${F.innerInset}" width="${440 - 2 * F.innerInset}" height="${PLATE_H - 2 * F.innerInset}" rx="${F.innerRadius}"`);
    expect(html).toContain(`height="${PLATE_H - 2 * F.outerInset}" rx="${F.outerRadius}"`);
    // มุมโค้งของเงานอกป้ายตามสัดส่วนใหม่
    expect(html).toContain(`border-radius:3.18% / ${Math.round((F.outerRadius / PLATE_H) * 10000) / 100}%`);
  });
  it('ลายประมูล (skyline) ไม่ถูกยืด: เลื่อนลงชิดขอบล่างเท่านั้น ไม่มี scale', () => {
    const m = html.match(/<path d="M14 200[^"]*" transform="([^"]+)"/);
    expect(m?.[1]).toBe(`translate(0 ${PLATE_H - 200})`);
  });
  it('"ภาพจำลอง ไม่ใช่ป้ายจริง" และปุ่มคัดลอกเหมือนเดิม', () => {
    expect(html).toContain('<span class="plate-figure__note">ภาพจำลอง ไม่ใช่ป้ายจริง</span>');
    expect(html).toContain('aria-label="คัดลอกเลขทะเบียน 9 กบ 9999"');
  });
});

/** ผลของ buildPlateLayout ชุด custom ที่ commit 6c7e372 (ป้ายสูงเดิม ก่อนปรับสัดส่วน) */
const OLD_CUSTOM_SNAPSHOT = [{"input":[9,["ก","บ"],"9999","กรุงเทพมหานคร"],"topRuns":[{"text":"9","x":29.16,"y":100.58,"fontSize":90.53,"role":"digit"},{"text":"ก","x":77.19,"y":100.58,"fontSize":127.31,"role":"letter","scaleX":0.8},{"text":"บ","x":137.51,"y":100.58,"fontSize":127.31,"role":"letter","scaleX":0.8},{"text":"9","x":212.99,"y":100.58,"fontSize":90.53,"role":"digit"},{"text":"9","x":263.67,"y":100.58,"fontSize":90.53,"role":"digit"},{"text":"9","x":314.35,"y":100.58,"fontSize":90.53,"role":"digit"},{"text":"9","x":365.03,"y":100.58,"fontSize":90.53,"role":"digit"}],"provinceLine":{"text":"กรุงเทพมหานคร","x":220,"y":153.41,"fontSize":47.13},"mainInkTop":26.34,"mainInkBottom":100.58,"provinceTop":126.26},{"input":[null,["ฐ","ร"],"18","กรุงเทพมหานคร"],"topRuns":[{"text":"ฐ","x":56.22,"y":90.9,"fontSize":121.23,"role":"letter","scaleX":0.8},{"text":"ร","x":109.69,"y":90.9,"fontSize":121.23,"role":"letter","scaleX":0.8},{"text":"1","x":276.76,"y":90.9,"fontSize":86.21,"role":"digit"},{"text":"8","x":314.42,"y":90.9,"fontSize":86.21,"role":"digit"}],"provinceLine":{"text":"กรุงเทพมหานคร","x":220,"y":156.29,"fontSize":40.06},"mainInkTop":20.21,"mainInkBottom":125.7,"provinceTop":133.22},{"input":[0,["ญ","ณ"],"4721","พระนครศรีอยุธยา"],"topRuns":[{"text":"0","x":28.56,"y":83.29,"fontSize":76.93,"role":"digit"},{"text":"ญ","x":70.38,"y":83.29,"fontSize":108.19,"role":"letter","scaleX":0.8},{"text":"ณ","x":138.51,"y":83.29,"fontSize":108.19,"role":"letter","scaleX":0.8},{"text":"4","x":248.14,"y":83.29,"fontSize":76.93,"role":"digit"},{"text":"7","x":286.57,"y":83.29,"fontSize":76.93,"role":"digit"},{"text":"2","x":320.75,"y":83.29,"fontSize":76.93,"role":"digit"},{"text":"1","x":360.77,"y":83.29,"fontSize":76.93,"role":"digit"}],"provinceLine":{"text":"พระนครศรีอยุธยา","x":220,"y":156.83,"fontSize":38.19},"mainInkTop":20.21,"mainInkBottom":113.91,"provinceTop":121.43},{"input":[1,["ป","ฬ"],"12","แม่ฮ่องสอน"],"topRuns":[{"text":"1","x":43.78,"y":95.69,"fontSize":66.26,"role":"digit"},{"text":"ป","x":68.99,"y":95.69,"fontSize":93.18,"role":"letter","scaleX":0.8},{"text":"ฬ","x":114.26,"y":95.69,"fontSize":93.18,"role":"letter","scaleX":0.8},{"text":"1","x":286.1,"y":95.69,"fontSize":66.26,"role":"digit"},{"text":"2","x":314.96,"y":95.69,"fontSize":66.26,"role":"digit"}],"provinceLine":{"text":"แม่ฮ่องสอน","x":220,"y":153.41,"fontSize":50.1},"mainInkTop":20.21,"mainInkBottom":95.69,"provinceTop":106.97},{"input":[1,["ก","ก"],"1234","ประจวบคีรีขันธ์"],"topRuns":[{"text":"1","x":32.15,"y":95.69,"fontSize":92.05,"role":"digit"},{"text":"ก","x":64.79,"y":95.69,"fontSize":129.44,"role":"letter","scaleX":0.8},{"text":"ก","x":123.74,"y":95.69,"fontSize":129.44,"role":"letter","scaleX":0.8},{"text":"1","x":224.9,"y":95.69,"fontSize":92.05,"role":"digit"},{"text":"2","x":265,"y":95.69,"fontSize":92.05,"role":"digit"},{"text":"3","x":313.36,"y":95.69,"fontSize":92.05,"role":"digit"},{"text":"4","x":361.48,"y":95.69,"fontSize":92.05,"role":"digit"}],"provinceLine":{"text":"ประจวบคีรีขันธ์","x":220,"y":153.41,"fontSize":50.1},"mainInkTop":20.21,"mainInkBottom":95.69,"provinceTop":106.97},{"input":[0,["ฐ","ร"],"1234","ประจวบคีรีขันธ์"],"topRuns":[{"text":"0","x":43.12,"y":79.43,"fontSize":72.21,"role":"digit"},{"text":"ฐ","x":83.67,"y":79.43,"fontSize":101.55,"role":"letter","scaleX":0.8},{"text":"ร","x":128.45,"y":79.43,"fontSize":101.55,"role":"letter","scaleX":0.8},{"text":"1","x":244.7,"y":79.43,"fontSize":72.21,"role":"digit"},{"text":"2","x":276.16,"y":79.43,"fontSize":72.21,"role":"digit"},{"text":"3","x":314.1,"y":79.43,"fontSize":72.21,"role":"digit"},{"text":"4","x":351.85,"y":79.43,"fontSize":72.21,"role":"digit"}],"provinceLine":{"text":"ประจวบคีรีขันธ์","x":220,"y":155.57,"fontSize":42.59},"mainInkTop":20.21,"mainInkBottom":108.57,"provinceTop":116.09}] as const;
