import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  buildPlateLayout,
  CUSTOM_PLATE_FONT,
  makePlateLayout,
  NOTO_PLATE_FONT,
  OSWALD_MEAN_DIGIT_GAP_EM,
  PLATE_FONT_PROFILE,
  PLATE_FONT_PROFILES,
  PLATE_BASE_H,
  PLATE_H,
  PLATE_LAYOUT,
  PLATE_W,
  provinceAscentEm,
  provinceWidthEm,
  resolvePlateFontProfile,
} from './plateLayout';
import type { PlateLayout, PlateTextLine } from './plateLayout';
import {
  NORASI_LETTER_METRICS,
  NORASI_PROVINCE_ADVANCE_EM,
  NORASI_PROVINCES_SHAPED,
  OSWALD_DIGIT_FLAT_EM,
  OSWALD_DIGIT_METRICS,
  OSWALD_DIGIT_PAIR_GAP_EM,
} from './plateFontMetrics.generated';
import { checkCustomPlateFonts } from './plateFontLoader';
import { PlateImage } from './PlateImage';
import { FONT_LICENSES, FontLicensesPage } from './FontLicensesPage';
import { PLATE_FONT_STYLE } from '../config/featureFlags';
import { THAI_PROVINCES } from '../data/thaiProvinces';
import themeCss from '../styles/theme.css?raw';
import appSource from '../App.tsx?raw';

const W = PLATE_W;
const H = PLATE_H;
const L = PLATE_LAYOUT;
const F = L.frame;
const INNER_L = F.innerInset + F.innerStroke / 2;
const INNER_R = W - INNER_L;
const EPS = 0.05;
const CONSONANTS = [...'กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮ'];
const COMBINING = /[ัิ-ฺ็-๎]/;

function lay(front: number | null, l1: string, l2: string, tail: string, province = 'กรุงเทพมหานคร', font = CUSTOM_PLATE_FONT, cfg = L) {
  return buildPlateLayout({ frontDigit: front, thaiLetters: [l1, l2], tailDigits: tail, variant: 'standard', provinceLabel: province }, font, cfg);
}
/** ชื่อจังหวัดที่ต่ำกว่าค่านี้ (px ที่ป้ายกว้าง 260px = #single ที่จอ 390px) ต้องแจ้งในรายงาน — ผู้ใช้กำหนด ~10.5px */
const PROVINCE_WARN_PX = 10.5;
/** ขอบหมึกของ glyph ที่วางแล้ว (หน่วย viewBox) ตาม metric ของชุดฟอนต์ที่ระบุ */
function inkBox(r: PlateTextLine, font = CUSTOM_PLATE_FONT) {
  const m = (r.role === 'letter' ? font.letters[r.text] : font.digits[r.text])!;
  const k = r.scaleX ?? 1;
  return { x0: r.x + m[1] * r.fontSize * k, x1: r.x + (m[0] - m[2]) * r.fontSize * k };
}

describe('ชุดฟอนต์ custom — ตาราง metric ครบทุกตัวที่ใช้', () => {
  it('เลข 0–9 ครบ และช่องไฟธรรมชาติครบทุกคู่ (100 คู่)', () => {
    for (const d of '0123456789') expect(OSWALD_DIGIT_METRICS[d]).toHaveLength(5);
    for (const a of '0123456789') for (const b of '0123456789') expect(typeof OSWALD_DIGIT_PAIR_GAP_EM[a + b]).toBe('number');
  });
  it('พยัญชนะไทยทุกตัวที่ช่องอักษรรับได้ (ก–ฮ) มี metric', () => {
    for (const c of CONSONANTS) expect(NORASI_LETTER_METRICS[c], c).toHaveLength(5);
  });
  it('ทุกตัวที่กินที่ในชื่อจังหวัด 77 จังหวัดมีความกว้าง และทุกชื่อมีผลจัดวางจริง', () => {
    expect(THAI_PROVINCES).toHaveLength(77);
    for (const p of THAI_PROVINCES) {
      for (const ch of p) if (!COMBINING.test(ch)) expect(NORASI_PROVINCE_ADVANCE_EM[ch], `${p}: ${ch}`).toBeGreaterThan(0);
      expect(NORASI_PROVINCES_SHAPED[p], p).toBeDefined();
    }
  });
  it('ความกว้าง/ความสูงที่คำนวณครอบคลุมผลจัดวางจริงของทุกจังหวัด (HarfBuzz)', () => {
    for (const p of THAI_PROVINCES) {
      const [, ink, ascent] = NORASI_PROVINCES_SHAPED[p];
      expect(provinceWidthEm(p, CUSTOM_PLATE_FONT), p).toBeGreaterThanOrEqual(ink);
      expect(provinceAscentEm(p, CUSTOM_PLATE_FONT), p).toBeGreaterThanOrEqual(ascent - 1e-3);
    }
  });
});

describe('ชุดฟอนต์ custom — กติกาที่เลือก', () => {
  it('ช่องว่างหมึกระหว่างเลขที่ติดกัน = ค่าธรรมชาติของคู่นั้น × 1.4', () => {
    expect(L.customFont.digitSpacing).toBe(1.4);
    for (const tail of ['1234', '9999', '4721', '1111', '7070']) {
      const l = lay(1, 'ก', 'ก', tail);
      const digits = l.topRuns.slice(-tail.length).map((r) => inkBox(r));
      for (let i = 1; i < digits.length; i++) {
        const gap = digits[i].x0 - digits[i - 1].x1;
        expect(gap / l.digitFontSize).toBeCloseTo(OSWALD_DIGIT_PAIR_GAP_EM[tail[i - 1] + tail[i]] * 1.4, 2);
      }
    }
  });
  it('อักษรไทย Norasi บีบ 0.8 เท่า พยัญชนะสูงเท่าเลขหัวแบน และ baseline เดียวกัน', () => {
    const l = lay(9, 'ก', 'บ', '9999');
    const letters = l.topRuns.filter((r) => r.role === 'letter');
    expect(letters).toHaveLength(2);
    for (const r of letters) {
      expect(r.scaleX).toBe(0.8);
      expect(r.y).toBe(l.mainBaseline);
      expect(r.fontSize * NORASI_LETTER_METRICS['ก'][4]).toBeCloseTo(l.digitFontSize * OSWALD_DIGIT_FLAT_EM, 1);
    }
    for (const r of l.topRuns.filter((x) => x.role === 'digit')) expect(r.scaleX).toBeUndefined();
  });
  it('ช่องไฟอักษรไทย (และเลขหน้า → อักษร) = ค่าเฉลี่ยช่องไฟเลข × 1.4', () => {
    const l = lay(9, 'ก', 'บ', '9999');
    const [d, a, b] = l.topRuns.slice(0, 3).map((r) => inkBox(r));
    expect((a.x0 - d.x1) / l.digitFontSize).toBeCloseTo(OSWALD_MEAN_DIGIT_GAP_EM * 1.4, 2);
    expect((b.x0 - a.x1) / l.digitFontSize).toBeCloseTo(OSWALD_MEAN_DIGIT_GAP_EM * 1.4, 2);
  });
  // เดิม: ÷ H ได้ 0.415 และ custom > noto ทุกป้าย — ป้ายสูง 1.2 เท่า: 41.5% เป็นสัดส่วนของป้ายฐาน (ระยะจริงเท่าเดิม)
  // และ "ฐร 18" ชุด noto ไม่ต้องย่อแล้ว (ได้ 41.5% เต็มเท่ากัน) จึงเปลี่ยนเป็น ≥
  it('ป้ายสั้นได้ตัวเลข 41.5% ของป้ายฐาน และป้ายยาวทั่วไปได้เท่าหรือใกล้กว่าชุด noto', () => {
    for (const [f, a, b, t] of [[null, 'ศ', 'ร', '91'], [8, 'ก', 'ก', '11'], [1, 'ก', 'ก', '1234']] as const)
      expect((lay(f, a, b, t).digitFontSize * CUSTOM_PLATE_FONT.digitCapEm) / PLATE_BASE_H).toBeCloseTo(0.415, 3);
    for (const [f, a, b, t] of [[2, 'ก', 'บ', '2295'], [9, 'ก', 'บ', '9999'], [5, 'ก', 'ผ', '8888'], [9, 'ญ', 'ณ', '4721'], [0, 'ฐ', 'ร', '1234'], [null, 'ฐ', 'ร', '18']] as const) {
      const c = (lay(f, a, b, t).digitFontSize * CUSTOM_PLATE_FONT.digitCapEm) / H;
      const n = (lay(f, a, b, t, 'กรุงเทพมหานคร', NOTO_PLATE_FONT).digitFontSize * NOTO_PLATE_FONT.digitCapEm) / H;
      expect(c).toBeGreaterThanOrEqual(n - 1e-4);
      expect(c).toBeGreaterThanOrEqual(L.minDigitHeightH);
    }
  });
  // เดิม: พยัญชนะจังหวัด ≥ 13px — ผู้ใช้ให้ย่อชื่อจังหวัดเหลือ 0.8 และเอากฎ 13px ออก ใช้เกณฑ์เตือน 10.5px แทน
  it('ชื่อจังหวัดทั้ง 77 ชื่อ: อยู่ในระยะปลอดภัย และพยัญชนะสูง ≥ 10.5px (เกณฑ์เตือน) ที่ป้ายกว้าง 260px (ขนาดจริงใน #single ที่จอ 390px)', () => {
    for (const p of THAI_PROVINCES)
      for (const [f, a, b, t] of [[9, 'ก', 'บ', '9999'], [0, 'ฐ', 'ร', '1234'], [9, 'ญ', 'ญ', '8888']] as const) {
        const l = lay(f, a, b, t, p);
        const line = l.provinceLine!;
        const pw = provinceWidthEm(p, CUSTOM_PLATE_FONT) * line.fontSize;
        expect(line.x - pw / 2, p).toBeGreaterThanOrEqual(INNER_L + L.safeMarginW * W - EPS);
        expect(l.mainInkBottom, p).toBeLessThan(l.provinceTop!);
        const consonantPx = line.fontSize * CUSTOM_PLATE_FONT.province.consonantEm * (260 / W);
        expect(consonantPx, `${p} ${f}${a}${b}`).toBeGreaterThanOrEqual(PROVINCE_WARN_PX);
      }
  });
});

describe('สวิตช์ย้อนกลับ (PLATE_FONT_STYLE) และ fallback', () => {
  it('ค่าที่ตั้งไว้คือ custom และมีทั้งสองชุดให้สลับ', () => {
    expect(PLATE_FONT_STYLE).toBe('custom');
    expect(PLATE_FONT_PROFILE).toBe(CUSTOM_PLATE_FONT);
    expect(PLATE_FONT_PROFILES.noto).toBe(NOTO_PLATE_FONT);
  });
  // เดิม: เทียบที่ป้ายปัจจุบัน — ป้ายสูง 1.2 เท่าเปลี่ยนเลย์เอาต์โดยตั้งใจ จึงเทียบที่ป้ายสูงเดิม (heightScale 1, จังหวัด 1)
  // ซึ่งต้องได้ค่าเดิมทุกตัว = การแปลงกฎ % H เป็นระยะจริงไม่เปลี่ยนผลของป้ายเดิม
  it('ชุด noto ที่ป้ายสูงเดิม (makePlateLayout(1, 1)) ให้ผลเลย์เอาต์เหมือนโค้ดก่อนมีชุด custom ทุกค่า (snapshot จาก commit cbdf8a2)', () => {
    for (const s of OLD_NOTO_SNAPSHOT) {
      const [f, [a, b], t, p] = s.input as [number | null, [string, string], string, string];
      const l: PlateLayout = lay(f, a, b, t, p, NOTO_PLATE_FONT, makePlateLayout(1, 1));
      expect(l.topRuns.map(({ text, x, y, fontSize }) => ({ text, x, y, fontSize }))).toEqual(s.topRuns);
      expect(l.provinceLine).toEqual(s.provinceLine);
      expect([l.mainInkTop, l.mainInkBottom, l.provinceTop]).toEqual([s.mainInkTop, s.mainInkBottom, s.provinceTop]);
    }
  });
  it('เลือกชุดฟอนต์: ตั้ง noto → noto · custom โหลดไม่สำเร็จ → noto · custom ระหว่างโหลด/สำเร็จ → custom', () => {
    expect(resolvePlateFontProfile('noto', 'loaded')).toBe(NOTO_PLATE_FONT);
    expect(resolvePlateFontProfile('noto', 'failed')).toBe(NOTO_PLATE_FONT);
    expect(resolvePlateFontProfile('custom', 'failed')).toBe(NOTO_PLATE_FONT);
    expect(resolvePlateFontProfile('custom', 'pending')).toBe(CUSTOM_PLATE_FONT);
    expect(resolvePlateFontProfile('custom', 'loaded')).toBe(CUSTOM_PLATE_FONT);
  });
  it('ตรวจการโหลดฟอนต์: error / ไม่พบฟอนต์ / สถานะ error → failed · ครบ → loaded', async () => {
    const face = (status: FontFaceLoadStatus) => ({ status }) as FontFace;
    expect(await checkCustomPlateFonts({ load: () => Promise.reject(new Error('network')) })).toBe('failed');
    expect(await checkCustomPlateFonts({ load: () => Promise.resolve([]) })).toBe('failed');
    expect(await checkCustomPlateFonts({ load: () => Promise.resolve([face('error')]) })).toBe('failed');
    expect(await checkCustomPlateFonts({ load: () => Promise.resolve([face('loaded')]) })).toBe('loaded');
  });
  it('ระหว่างรอ fallback (วางตามชุด custom แต่เบราว์เซอร์แสดงด้วย Noto) ข้อความยังไม่ล้นเส้นขอบใน', () => {
    for (const [f, a, b, t, p] of [[9, 'ก', 'บ', '9999', 'พระนครศรีอยุธยา'], [8, 'ฒ', 'ฒ', '8888', 'พระนครศรีอยุธยา'], [0, 'ฐ', 'ญ', '4444', 'ประจวบคีรีขันธ์'], [5, 'ก', 'ผ', '8888', 'กรุงเทพมหานคร']] as const) {
      const l = lay(f, a, b, t, p);
      for (const r of l.topRuns) {
        const box = inkBox(r, NOTO_PLATE_FONT);
        expect(box.x0).toBeGreaterThan(INNER_L);
        expect(box.x1).toBeLessThan(INNER_R);
      }
      const line = l.provinceLine!;
      expect(line.x + (provinceWidthEm(p, NOTO_PLATE_FONT) * line.fontSize) / 2).toBeLessThan(INNER_R);
    }
  });
});

describe('PlateImage กับชุด custom', () => {
  const html = renderToStaticMarkup(
    createElement(PlateImage, { frontDigit: 9, thaiLetters: ['ก', 'บ'], tailDigits: '9999', variant: 'auction', copyText: '9กบ 9999' }),
  );
  it('ข้อความใช้คลาสชุด custom และอักษรไทยบีบ 0.8 ทุกชั้นของตัวนูน (3 ชั้น × 2 ตัว)', () => {
    expect(html).toContain('plate-image__text plate-image__text--custom');
    expect((html.match(/class="plate-image__letter" transform="translate\([\d.\s-]+\) scale\(0\.8 1\)"/g) ?? []).length).toBe(6);
    expect((html.match(/class="plate-image__digit"/g) ?? []).length).toBe(15);
  });
  it('aria-label ปุ่มคัดลอก และ "ภาพจำลอง ไม่ใช่ป้ายจริง" เหมือนเดิม', () => {
    expect(html).toContain('aria-label="ภาพจำลองป้ายทะเบียน 9 กบ 9999 กรุงเทพมหานคร (ลายป้ายประมูล)"');
    expect(html).toContain('aria-label="คัดลอกเลขทะเบียน 9กบ 9999"');
    expect(html).toContain('ภาพจำลอง ไม่ใช่ป้ายจริง');
  });
});

describe('ใบอนุญาตฟอนต์', () => {
  const files = import.meta.glob('../assets/fonts/*', { query: '?url', import: 'default', eager: true });
  const texts = import.meta.glob('../assets/fonts/*.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  const exists = (f: string) => `../assets/fonts/${f}` in files;
  const read = (f: string) => texts[`../assets/fonts/${f}`];
  const tools = import.meta.glob('../../tools/plate_fonts.py', { query: '?raw', import: 'default', eager: true });
  it('ไฟล์ฟอนต์ทุกไฟล์ที่ theme.css โหลดมีไฟล์ใบอนุญาตอยู่คู่กัน', () => {
    const fonts = [...themeCss.matchAll(/url\('\.\.\/assets\/fonts\/([^']+\.woff2)'\)/g)].map((m) => m[1]);
    expect(fonts.sort()).toEqual([
      'NorasiBold-PlateSubset.woff2',
      'NotoSansThaiLooped-PlateSubset-wdth70.woff2',
      'NotoSansThaiLooped-PlateSubset-wdth80.woff2',
      'Oswald500-PlateDigits.woff2',
    ]);
    const license: Record<string, string[]> = {
      NorasiBold: ['Norasi-COPYING.txt', 'Norasi-GPL-2.txt', 'NorasiBold-PlateSubset-NOTICE.txt'],
      NotoSansThaiLooped: ['NotoSansThaiLooped-OFL.txt'],
      Oswald500: ['Oswald-OFL.txt'],
    };
    for (const f of fonts) {
      expect(exists(f), f).toBe(true);
      for (const lic of license[f.split('-')[0]]) expect(exists(lic), lic).toBe(true);
    }
  });
  it('เนื้อหาใบอนุญาต: Oswald OFL ไม่มี Reserved Font Name · Norasi GPL + font exception + ที่มา/การแก้ไข', () => {
    const ofl = read('Oswald-OFL.txt');
    expect(ofl).toContain('SIL Open Font License, Version 1.1');
    expect(ofl.split('\n')[0]).not.toMatch(/Reserved Font Name/i);
    expect(read('Norasi-COPYING.txt')).toContain('As a special exception, if you create a document which uses this font');
    expect(read('Norasi-GPL-2.txt')).toContain('GNU GENERAL PUBLIC LICENSE');
    const notice = read('NorasiBold-PlateSubset-NOTICE.txt');
    expect(notice).toContain('https://github.com/tlwg/fonts-tlwg');
    expect(notice).toContain('tools/plate_fonts.py');
    expect(Object.keys(tools)).toEqual(['../../tools/plate_fonts.py']);
  });
  it('หน้า "ใบอนุญาตฟอนต์" ลิสต์ Noto, Oswald, Norasi พร้อมใบอนุญาตและลิงก์ต้นฉบับ และมีลิงก์ท้ายทุกหน้า', () => {
    expect(FONT_LICENSES.map((f) => f.name.split(' ')[0])).toEqual(['Noto', 'Oswald', 'Norasi']);
    const page = renderToStaticMarkup(createElement(FontLicensesPage));
    for (const url of ['https://github.com/notofonts/thai', 'https://github.com/googlefonts/OswaldFont', 'https://github.com/tlwg/fonts-tlwg'])
      expect(page).toContain(`href="${url}"`);
    expect(page).toContain('SIL Open Font License 1.1');
    expect(page).toContain('GNU General Public License v2');
    expect(appSource).toMatch(/<footer className="app-footer">[\s\S]*ใบอนุญาตฟอนต์[\s\S]*<\/footer>/);
  });
});

/** ผลของ buildPlateLayout ก่อนมีชุด custom (commit cbdf8a2) — ชุด noto ต้องได้ค่าเดียวกันทุกตัว */
const OLD_NOTO_SNAPSHOT = [{"input": [9, ["ก", "บ"], "9999", "กรุงเทพมหานคร"], "topRuns": [{"text": "9", "x": 29.81, "y": 100.58, "fontSize": 95.48}, {"text": "กบ", "x": 77.46, "y": 100.58, "fontSize": 120.22}, {"text": "9999", "x": 219.9, "y": 100.58, "fontSize": 95.48}], "provinceLine": {"text": "กรุงเทพมหานคร", "x": 220, "y": 151.38, "fontSize": 49.47}, "mainInkTop": 31.45, "mainInkBottom": 100.58, "provinceTop": 122.94}, {"input": [null, ["ฐ", "ร"], "18", "กรุงเทพมหานคร"], "topRuns": [{"text": "ฐร", "x": 57.84, "y": 85.68, "fontSize": 113.86}, {"text": "18", "x": 271.13, "y": 85.68, "fontSize": 90.43}], "provinceLine": {"text": "กรุงเทพมหานคร", "x": 220, "y": 154.04, "fontSize": 42.05}, "mainInkTop": 20.21, "mainInkBottom": 122.34, "provinceTop": 129.86}, {"input": [0, ["ญ", "ณ"], "4721", "พระนครศรีอยุธยา"], "topRuns": [{"text": "0", "x": 29.76, "y": 81.01, "fontSize": 83.97}, {"text": "ญณ", "x": 71.67, "y": 81.01, "fontSize": 105.73}, {"text": "4721", "x": 248.76, "y": 81.01, "fontSize": 83.97}], "provinceLine": {"text": "พระนครศรีอยุธยา", "x": 220, "y": 154.73, "fontSize": 39.93}, "mainInkTop": 20.21, "mainInkBottom": 109.56, "provinceTop": 117.08}, {"input": [1, ["ป", "ฬ"], "12", "แม่ฮ่องสอน"], "topRuns": [{"text": "1", "x": 34.73, "y": 92.77, "fontSize": 73.13}, {"text": "ปฬ", "x": 71.22, "y": 92.77, "fontSize": 92.08}, {"text": "12", "x": 280.49, "y": 92.77, "fontSize": 73.13}], "provinceLine": {"text": "แม่ฮ่องสอน", "x": 220, "y": 151.38, "fontSize": 50.19}, "mainInkTop": 20.21, "mainInkBottom": 92.77, "provinceTop": 104.05}] as const;
