import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  buildPlateLayout,
  CUSTOM_PLATE_FONT,
  CUSTOM_SHORT_TAIL_PLATE_FONT,
  mainBaselineFor,
  makePlateLayout,
  NOTO_PLATE_FONT,
  PLATE_BASE_H,
  PLATE_FONT_PROFILE,
  PLATE_H,
  PLATE_LAYOUT,
  PLATE_W,
  provinceDescentEm,
  provinceWidthEm,
  resolvePlateFontProfile,
} from './plateLayout';
import type { PlateFontProfile, PlateLayoutConfig } from './plateLayout';
import {
  NORASI_LETTER_METRICS,
  NORASI_SHORT_TAIL_LETTER_METRICS,
  NORASI_TAIL_DEPTH,
  NORASI_TAIL_TARGET,
} from './plateFontMetrics.generated';
import { PlateImage } from './PlateImage';
import { customPlateFontFaces } from './plateFontLoader';
import { PLATE_TAIL_MODE } from '../config/featureFlags';
import { THAI_PROVINCES } from '../data/thaiProvinces';

/**
 * ป้ายสูง heightScale (1.05) เท่า กว้างเท่าเดิม · ชื่อจังหวัด provinceScale (0.9) ล็อก ไม่ย่อเพราะหาง
 * ระยะระหว่างบรรทัด (เส้นฐานบรรทัดหลัก → ยอดพยัญชนะชื่อจังหวัด) = lineGapH ค่าเดียวทุกป้าย ไม่ขึ้นกับหางอักษร
 * หาง 2 แบบ: 'shortened' (ไฟล์ Norasi ตัดหาง, ค่าเริ่มต้น) / 'fit' (หางเดิม ป้ายที่มีหางย่อบรรทัดหลัก)
 * (เดิม: ป้ายสูง 1.2 / จังหวัด 0.8 / พื้นที่ที่เพิ่มอยู่ระหว่างบรรทัด — ผู้ใช้สั่งเปลี่ยนเป็นโมเดลระยะระหว่างบรรทัดคงที่)
 */
const W = PLATE_W;
const L = PLATE_LAYOUT;
const F = L.frame;
const INNER = F.innerInset + F.innerStroke / 2;
const FONTS = [CUSTOM_SHORT_TAIL_PLATE_FONT, CUSTOM_PLATE_FONT, NOTO_PLATE_FONT];
const tag = (f: PlateFontProfile) => `${f.style}/${f.tailMode}`;
const BASE = makePlateLayout(1, 1);
const EPS = 0.05;
/** LINE_GAP_H0 คู่กับ heightScale (สูตรใน plateLayout.ts): เส้นฐานที่ 103.3 หน่วยจากขอบบน */
const gapFor = (hs: number) => (Math.round(PLATE_BASE_H * hs) - 162.4) / PLATE_BASE_H;

type Case = [number | null, string, string, string, string?];
/** ชุดตรวจของงานนี้ (ผู้ใช้กำหนด) + ชื่อจังหวัดยาว/สระซ้อน */
const CHECK_SET: Case[] = [
  [2, 'ก', 'บ', '2295'], [null, 'ศ', 'ร', '91'], [null, 'ฐ', 'ร', '18'], [0, 'ฐ', 'ร', '1234'], [9, 'ญ', 'ณ', '4721'],
  [9, 'ฒ', 'ฒ', '8888'], [1, 'ก', 'ก', '1234'], [9, 'ก', 'บ', '9999'],
];
const PROVINCES = ['กรุงเทพมหานคร', 'พระนครศรีอยุธยา', 'ประจวบคีรีขันธ์', 'กำแพงเพชร'];
const ALL: Case[] = PROVINCES.flatMap((p) => CHECK_SET.map((c): Case => [c[0], c[1], c[2], c[3], p]));
const TAILED = /[ฐฎฏญฤฦ]/;
function lay([f, a, b, t, p]: Case, font: PlateFontProfile, cfg: PlateLayoutConfig = L) {
  return buildPlateLayout(
    { frontDigit: f, thaiLetters: [a, b], tailDigits: t, variant: 'standard', provinceLabel: p ?? 'กรุงเทพมหานคร' },
    font,
    cfg,
  );
}
const name = (c: Case) => `${c[0] ?? ''}${c[1]}${c[2]} ${c[3]} ${c[4] ?? 'กรุงเทพมหานคร'}`;
/** ระยะจากปลายหาง (หรือขอบล่างบรรทัดหลัก) ถึงหมึกบนสุดของชื่อจังหวัด (รวมสระบน/วรรณยุกต์) */
const tailClear = (l: ReturnType<typeof lay>) => l.provinceTop! - l.mainInkBottom;
/** ขนาดตัวเลขเมื่อไม่มีข้อจำกัดแนวตั้ง (ป้ายสูงมาก) = ขนาดเต็มตามความกว้าง */
const fullSize = (c: Case, font: PlateFontProfile) => lay(c, font, makePlateLayout(3, L.provinceScale, gapFor(3))).digitFontSize;

describe('ค่าเดียวใน PLATE_LAYOUT: heightScale / provinceScale / lineGapH', () => {
  // เดิม: heightScale 1.2, provinceScale 0.8, H 226, W/H ≈ 1.95
  it('ป้ายสูง 1.05 เท่า (2.34:1 → ~2.23:1) ชื่อจังหวัด 0.9 ระยะระหว่างบรรทัด 18.4% ของป้ายฐาน', () => {
    expect(L.heightScale).toBe(1.05);
    expect(L.provinceScale).toBe(0.9);
    expect(L.lineGapH0).toBe(0.184);
    expect(PLATE_BASE_H).toBe(188);
    expect(PLATE_H).toBe(197);
    expect(L.aspect).toBeCloseTo(2.23, 2);
    expect(L.lineGapH * L.height).toBeCloseTo(0.184 * 188, 6);
    expect(L.lineGapH0).toBeCloseTo(gapFor(L.heightScale), 3);
  });
  it('กฎที่เป็น % ความสูงแปลงเป็นระยะจริงเท่าป้ายฐาน (หน่วย viewBox)', () => {
    const real = (cfg: PlateLayoutConfig, v: number) => v * cfg.height;
    for (const k of ['safeMarginTopH', 'safeMarginBottomH', 'digitHeightH', 'minDigitHeightH', 'mainBaselineH', 'minTopMarginH', 'descenderClearanceH', 'minLineGapH'] as const)
      expect(real(L, L[k]), k).toBeCloseTo(real(BASE, BASE[k]), 6);
    expect(real(L, L.province.consonantHeightH)).toBeCloseTo(real(BASE, BASE.province.consonantHeightH) * 0.9, 6);
    expect(L.province.maxWidthW).toBeCloseTo(BASE.province.maxWidthW * 0.9, 6);
    for (const k of ['safeMarginW', 'contentLeftW', 'contentRightW', 'leftGroupCenterW', 'tailGroupCenterW', 'minGroupGapW'] as const)
      expect(L[k], k).toBe(BASE[k]);
  });
  it('ค่าเริ่มต้น: หางแบบตัดสั้น (PLATE_TAIL_MODE) และสวิตช์เลือกชุดได้ทั้งสองแบบ', () => {
    expect(PLATE_TAIL_MODE).toBe('shortened');
    expect(PLATE_FONT_PROFILE).toBe(CUSTOM_SHORT_TAIL_PLATE_FONT);
    expect(resolvePlateFontProfile('custom', 'loaded', 'fit')).toBe(CUSTOM_PLATE_FONT);
    expect(resolvePlateFontProfile('custom', 'loaded', 'shortened')).toBe(CUSTOM_SHORT_TAIL_PLATE_FONT);
    expect(resolvePlateFontProfile('custom', 'failed', 'shortened')).toBe(NOTO_PLATE_FONT);
    expect(resolvePlateFontProfile('noto', 'loaded', 'shortened')).toBe(NOTO_PLATE_FONT);
  });
});

describe('ความลึกหาง Norasi Bold (เท่าของความสูงพยัญชนะ)', () => {
  it('ไฟล์เดิม: ฐ ญ ~0.49–0.50, ฎ ฏ ฤ ฦ ~0.40 · ฑ ฒ ไม่มีหาง (ป้ายจริง 0.11–0.19)', () => {
    for (const c of 'ฐญ') expect(NORASI_TAIL_DEPTH[c][2]).toBeGreaterThan(0.48);
    for (const c of 'ฎฏฤฦ') expect(NORASI_TAIL_DEPTH[c][2]).toBeCloseTo(0.4, 1);
    for (const c of 'ฑฒ') expect(NORASI_TAIL_DEPTH[c][2]).toBeLessThan(0.02);
  });
  it('ไฟล์ตัดหาง: หางทั้ง 6 ตัวลึก 0.2 เท่า · ตัวอื่นทุกตัวและความกว้างไม่เปลี่ยน', () => {
    expect(NORASI_TAIL_TARGET).toBe(0.2);
    for (const c of 'ฐฎฏญฤฦ') {
      expect(NORASI_TAIL_DEPTH[c][3], c).toBeCloseTo(0.2, 2);
      const [a, b] = [NORASI_LETTER_METRICS[c], NORASI_SHORT_TAIL_LETTER_METRICS[c]];
      expect([b[0], b[1], b[2], b[4]], c).toEqual([a[0], a[1], a[2], a[4]]);
    }
    for (const c of Object.keys(NORASI_LETTER_METRICS))
      if (!'ฐฎฏญฤฦ'.includes(c)) expect(NORASI_SHORT_TAIL_LETTER_METRICS[c], c).toEqual(NORASI_LETTER_METRICS[c]);
  });
});

for (const font of FONTS)
  describe(`[${tag(font)}] ระยะระหว่างบรรทัดเท่ากันทุกป้าย ไม่ขึ้นกับหาง`, () => {
    for (const p of PROVINCES)
      it(`${p}: เส้นฐานบรรทัดหลักและบรรทัดจังหวัดอยู่ที่เดียวกันทุกป้าย`, () => {
        const ls = CHECK_SET.map((c) => lay([c[0], c[1], c[2], c[3], p], font));
        for (const l of ls) {
          expect(l.mainBaseline, l.plateText).toBeCloseTo(mainBaselineFor(font), 1);
          expect(l.provinceLine, l.plateText).toEqual(ls[0].provinceLine);
        }
      });
    it('ชื่อจังหวัดไม่ย่อเพราะหาง: ขนาด = 0.9 เท่าของขนาดตามค่าวัด (หรือตามความกว้าง) และหมึกล่างสุดห่างขอบล่างเท่าเดิม', () => {
      for (const c of ALL) {
        const l = lay(c, font);
        const unscaled = lay(c, font, makePlateLayout(L.heightScale, 1, L.lineGapH0)).provinceLine!;
        expect(l.provinceLine!.fontSize, name(c)).toBeCloseTo(unscaled.fontSize * 0.9, 1);
        const d = provinceDescentEm(c[4]!, font);
        expect(l.provinceLine!.y + d * l.provinceLine!.fontSize).toBeCloseTo(unscaled.y + d * unscaled.fontSize, 1);
      }
    });
    it('ป้ายที่ย่อ: ตัวเลขและอักษรย่ออัตราเดียว เส้นฐานไม่ขยับ ปลายหางห่างหมึกบนสุดของชื่อจังหวัด ≥ descenderClearanceH', () => {
      for (const c of ALL) {
        const l = lay(c, font);
        const letter = l.topRuns.find((r) => r.role === 'letter')!;
        expect(letter.fontSize / l.digitFontSize).toBeCloseTo(font.letterFontRatio, 1);
        expect(tailClear(l), name(c)).toBeGreaterThanOrEqual(L.descenderClearanceH * L.height - EPS);
        if (l.digitFontSize < fullSize(c, font) - 0.01) {
          // ย่อเพราะแนวตั้งเท่านั้น: หางชนเกณฑ์พอดี หรือยอดหมึกชนระยะปลอดภัยบนพอดี
          const byTail = Math.abs(tailClear(l) - L.descenderClearanceH * L.height) < 0.05;
          const byTop = Math.abs(l.mainInkTop - L.minTopMarginH * L.height) < 0.05;
          expect(byTail || byTop, name(c)).toBe(true);
        }
      }
    });
  });

describe('แบบ B (ตัดหาง): ตัวเลขได้ขนาดเต็มตามความกว้าง ยกเว้นหางอยู่เหนือสระบนของชื่อจังหวัดที่ผู้ใช้พิมพ์', () => {
  // ผู้ใช้ขอให้รายงานป้ายที่ยังชน: หางเทียบกับหมึกบนสุดของชื่อจังหวัดทั้งบรรทัด — ชื่อที่มีสระบนสูง (ี ำ) ทำให้ป้ายมีหางย่อ
  it('ป้ายที่ยังย่อเพราะหาง: เฉพาะชื่อจังหวัด ประจวบคีรีขันธ์ (ย่อเหลือ ~64–70%) และ กำแพงเพชร (~98%)', () => {
    const B = CUSTOM_SHORT_TAIL_PLATE_FONT;
    const shrunk = ALL.filter((c) => lay(c, B).digitFontSize < fullSize(c, B) - 0.01);
    expect(shrunk.map(name).sort()).toEqual(
      ['ฐร 18 ประจวบคีรีขันธ์', '0ฐร 1234 ประจวบคีรีขันธ์', '9ญณ 4721 ประจวบคีรีขันธ์', 'ฐร 18 กำแพงเพชร', '0ฐร 1234 กำแพงเพชร'].sort(),
    );
    for (const c of shrunk) {
      const r = lay(c, B).digitFontSize / fullSize(c, B);
      expect(r, name(c)).toBeGreaterThan(c[4] === 'กำแพงเพชร' ? 0.97 : 0.6);
    }
    // ชื่อจังหวัดค่าเริ่มต้นและพระนครศรีอยุธยา: เต็มทุกป้าย
    for (const c of ALL.filter((x) => x[4] === 'กรุงเทพมหานคร' || x[4] === 'พระนครศรีอยุธยา'))
      expect(lay(c, B).digitFontSize, name(c)).toBeCloseTo(fullSize(c, B), 2);
  });
  it('ป้ายสั้นที่ไม่มีอักษรหัวสูง (ป ฝ ฟ ฬ) ได้ตัวเลข 41.5% ของป้ายฐานกับพยัญชนะทุกตัว', () => {
    for (const ch of 'กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบผพภมยรฤลฦวศษสหอฮ') {
      const l = lay([null, ch, 'ร', '91'], CUSTOM_SHORT_TAIL_PLATE_FONT);
      expect((l.digitFontSize * CUSTOM_SHORT_TAIL_PLATE_FONT.digitCapEm) / PLATE_BASE_H, ch).toBeCloseTo(0.415, 3);
    }
  });
});

describe('แบบ A (หางเดิม): ป้ายที่มีหางย่อบรรทัดหลัก ป้ายไม่มีหางเท่าแบบ B', () => {
  it('ป้ายไม่มีหาง: ผลเท่าแบบ B ทุกค่า · ป้ายมีหาง: เล็กกว่าหรือเท่าแบบ B', () => {
    for (const c of ALL) {
      const a = lay(c, CUSTOM_PLATE_FONT);
      const b = lay(c, CUSTOM_SHORT_TAIL_PLATE_FONT);
      if (TAILED.test(c[1] + c[2])) expect(a.digitFontSize).toBeLessThanOrEqual(b.digitFontSize);
      else expect(a.topRuns, name(c)).toEqual(b.topRuns);
    }
    // ฐ ที่ 1.05: ย่อเหลือราว 34–36% ของป้ายฐาน
    const d = (lay([0, 'ฐ', 'ร', '1234'], CUSTOM_PLATE_FONT).digitFontSize * CUSTOM_PLATE_FONT.digitCapEm) / PLATE_BASE_H;
    expect(d).toBeGreaterThan(0.3);
    expect(d).toBeLessThan(0.38);
  });
});

describe('ลองค่าอื่นได้: heightScale 1.0 / 1.05 / 1.1 (lineGap ตามสูตร) อยู่ในระยะปลอดภัยทุกแบบ', () => {
  for (const hs of [1, 1.05, 1.1])
    for (const font of FONTS)
      it(`heightScale ${hs} [${tag(font)}]`, () => {
        const cfg = makePlateLayout(hs, 0.9, gapFor(hs));
        for (const c of ALL) {
          const l = lay(c, font, cfg);
          expect(l.frontGroupInk.x0 - INNER).toBeGreaterThanOrEqual(cfg.safeMarginW * W - EPS);
          expect(W - INNER - l.tailGroupInk.x1).toBeGreaterThanOrEqual(cfg.safeMarginW * W - EPS);
          expect(l.mainInkTop - INNER).toBeGreaterThanOrEqual(cfg.safeMarginTopH * cfg.height - EPS);
          const p = l.provinceLine!;
          expect(cfg.height - INNER - (p.y + font.province.lowerMarkEm * p.fontSize)).toBeGreaterThanOrEqual(
            cfg.safeMarginBottomH * cfg.height - EPS,
          );
          expect(tailClear(l)).toBeGreaterThanOrEqual(cfg.descenderClearanceH * cfg.height - EPS);
          expect(provinceWidthEm(p.text, font) * p.fontSize).toBeLessThanOrEqual(cfg.province.maxWidthW * W + EPS);
        }
      });
});

describe('ชื่อจังหวัดที่จอ 390px (ป้ายกว้าง 260px ใน #single)', () => {
  it('พยัญชนะจังหวัดของทั้ง 77 จังหวัด × ทุกป้ายในชุดตรวจ ≥ 10.5px (เกณฑ์เตือน) ทุกชุดฟอนต์', () => {
    for (const font of FONTS)
      for (const p of THAI_PROVINCES)
        for (const c of CHECK_SET) {
          const l = lay([c[0], c[1], c[2], c[3], p], font);
          expect(l.provinceLine!.fontSize * font.province.consonantEm * (260 / W), `${tag(font)} ${p}`).toBeGreaterThanOrEqual(10.5);
        }
  });
});

describe('ป้ายสูงเดิม (heightScale 1, จังหวัด 1, เส้นฐานเดิม) ให้ผลเดิมกับป้ายที่ไม่มีหางและไม่ชนขอบบน', () => {
  // เดิม: เทียบ snapshot 6c7e372 ทุกป้ายยกเว้นที่ใช้กฎ 13px — โมเดลใหม่ไม่ยกบรรทัดหลักเพราะหาง/อักษรหัวสูง และไม่ย่อจังหวัดเพราะหาง
  // จึงเทียบได้เฉพาะป้ายที่เดิมใช้เส้นฐานตามค่าวัด (53.5%) และชื่อจังหวัดไม่ถูกย่อ: 9กบ 9999 กรุงเทพมหานคร
  it('custom (หางเดิม) = snapshot 6c7e372 ของ 9กบ 9999', () => {
    const cfg0 = makePlateLayout(1, 1, 0);
    const cfg = makePlateLayout(1, 1, (mainBaselineFor(CUSTOM_PLATE_FONT, cfg0) - 0.535 * PLATE_BASE_H) / PLATE_BASE_H);
    const s = OLD_CUSTOM_SNAPSHOT[0];
    const l = lay([9, 'ก', 'บ', '9999', 'กรุงเทพมหานคร'], CUSTOM_PLATE_FONT, cfg);
    expect(l.topRuns).toEqual(s.topRuns);
    expect(l.provinceLine).toEqual(s.provinceLine);
    expect([l.mainInkTop, l.mainInkBottom, l.provinceTop]).toEqual([s.mainInkTop, s.mainInkBottom, s.provinceTop]);
  });
});

describe('PlateImage: กรอบ ลายประมูล และไฟล์ฟอนต์ตามแบบหาง', () => {
  const html = renderToStaticMarkup(
    createElement(PlateImage, { frontDigit: 9, thaiLetters: ['ก', 'บ'], tailDigits: '9999', variant: 'auction' }),
  );
  it('viewBox สูงตามสัดส่วนใหม่ และเส้นขอบนอก/ในห่างขอบเท่าเดิม', () => {
    expect(html).toContain(`viewBox="0 0 440 ${PLATE_H}"`);
    expect(html).toContain(`<rect x="${F.innerInset}" y="${F.innerInset}" width="${440 - 2 * F.innerInset}" height="${PLATE_H - 2 * F.innerInset}" rx="${F.innerRadius}"`);
    expect(html).toContain(`height="${PLATE_H - 2 * F.outerInset}" rx="${F.outerRadius}"`);
    expect(html).toContain(`border-radius:3.18% / ${Math.round((F.outerRadius / PLATE_H) * 10000) / 100}%`);
  });
  it('ลายประมูล (skyline) ไม่ถูกยืด: เลื่อนลงชิดขอบล่างเท่านั้น ไม่มี scale', () => {
    const m = html.match(/<path d="M14 200[^"]*" transform="([^"]+)"/);
    expect(m?.[1]).toBe(`translate(0 ${PLATE_H - 200})`);
  });
  it('แบบตัดหาง: คลาส --short-tail และโหลดฟอนต์ PlateNorasiShortTail (ไม่โหลด PlateNorasi)', () => {
    expect(html).toContain('plate-image__text plate-image__text--custom plate-image__text--short-tail');
    expect(customPlateFontFaces('shortened').map((f) => f[0])).toEqual(['500 40px PlateDigits', '700 40px PlateNorasiShortTail']);
    expect(customPlateFontFaces('fit').map((f) => f[0])).toEqual(['500 40px PlateDigits', '700 40px PlateNorasi']);
  });
  it('"ภาพจำลอง ไม่ใช่ป้ายจริง" และปุ่มคัดลอกเหมือนเดิม', () => {
    expect(html).toContain('<span class="plate-figure__note">ภาพจำลอง ไม่ใช่ป้ายจริง</span>');
    expect(html).toContain('aria-label="คัดลอกเลขทะเบียน 9 กบ 9999"');
  });
});

/** ผลของ buildPlateLayout ชุด custom ที่ commit 6c7e372 (ป้ายสูงเดิม ก่อนปรับสัดส่วน) */
const OLD_CUSTOM_SNAPSHOT = [{"input":[9,["ก","บ"],"9999","กรุงเทพมหานคร"],"topRuns":[{"text":"9","x":29.16,"y":100.58,"fontSize":90.53,"role":"digit"},{"text":"ก","x":77.19,"y":100.58,"fontSize":127.31,"role":"letter","scaleX":0.8},{"text":"บ","x":137.51,"y":100.58,"fontSize":127.31,"role":"letter","scaleX":0.8},{"text":"9","x":212.99,"y":100.58,"fontSize":90.53,"role":"digit"},{"text":"9","x":263.67,"y":100.58,"fontSize":90.53,"role":"digit"},{"text":"9","x":314.35,"y":100.58,"fontSize":90.53,"role":"digit"},{"text":"9","x":365.03,"y":100.58,"fontSize":90.53,"role":"digit"}],"provinceLine":{"text":"กรุงเทพมหานคร","x":220,"y":153.41,"fontSize":47.13},"mainInkTop":26.34,"mainInkBottom":100.58,"provinceTop":126.26},{"input":[null,["ฐ","ร"],"18","กรุงเทพมหานคร"],"topRuns":[{"text":"ฐ","x":56.22,"y":90.9,"fontSize":121.23,"role":"letter","scaleX":0.8},{"text":"ร","x":109.69,"y":90.9,"fontSize":121.23,"role":"letter","scaleX":0.8},{"text":"1","x":276.76,"y":90.9,"fontSize":86.21,"role":"digit"},{"text":"8","x":314.42,"y":90.9,"fontSize":86.21,"role":"digit"}],"provinceLine":{"text":"กรุงเทพมหานคร","x":220,"y":156.29,"fontSize":40.06},"mainInkTop":20.21,"mainInkBottom":125.7,"provinceTop":133.22},{"input":[0,["ญ","ณ"],"4721","พระนครศรีอยุธยา"],"topRuns":[{"text":"0","x":28.56,"y":83.29,"fontSize":76.93,"role":"digit"},{"text":"ญ","x":70.38,"y":83.29,"fontSize":108.19,"role":"letter","scaleX":0.8},{"text":"ณ","x":138.51,"y":83.29,"fontSize":108.19,"role":"letter","scaleX":0.8},{"text":"4","x":248.14,"y":83.29,"fontSize":76.93,"role":"digit"},{"text":"7","x":286.57,"y":83.29,"fontSize":76.93,"role":"digit"},{"text":"2","x":320.75,"y":83.29,"fontSize":76.93,"role":"digit"},{"text":"1","x":360.77,"y":83.29,"fontSize":76.93,"role":"digit"}],"provinceLine":{"text":"พระนครศรีอยุธยา","x":220,"y":156.83,"fontSize":38.19},"mainInkTop":20.21,"mainInkBottom":113.91,"provinceTop":121.43},{"input":[1,["ป","ฬ"],"12","แม่ฮ่องสอน"],"topRuns":[{"text":"1","x":43.78,"y":95.69,"fontSize":66.26,"role":"digit"},{"text":"ป","x":68.99,"y":95.69,"fontSize":93.18,"role":"letter","scaleX":0.8},{"text":"ฬ","x":114.26,"y":95.69,"fontSize":93.18,"role":"letter","scaleX":0.8},{"text":"1","x":286.1,"y":95.69,"fontSize":66.26,"role":"digit"},{"text":"2","x":314.96,"y":95.69,"fontSize":66.26,"role":"digit"}],"provinceLine":{"text":"แม่ฮ่องสอน","x":220,"y":153.41,"fontSize":50.1},"mainInkTop":20.21,"mainInkBottom":95.69,"provinceTop":106.97},{"input":[1,["ก","ก"],"1234","ประจวบคีรีขันธ์"],"topRuns":[{"text":"1","x":32.15,"y":95.69,"fontSize":92.05,"role":"digit"},{"text":"ก","x":64.79,"y":95.69,"fontSize":129.44,"role":"letter","scaleX":0.8},{"text":"ก","x":123.74,"y":95.69,"fontSize":129.44,"role":"letter","scaleX":0.8},{"text":"1","x":224.9,"y":95.69,"fontSize":92.05,"role":"digit"},{"text":"2","x":265,"y":95.69,"fontSize":92.05,"role":"digit"},{"text":"3","x":313.36,"y":95.69,"fontSize":92.05,"role":"digit"},{"text":"4","x":361.48,"y":95.69,"fontSize":92.05,"role":"digit"}],"provinceLine":{"text":"ประจวบคีรีขันธ์","x":220,"y":153.41,"fontSize":50.1},"mainInkTop":20.21,"mainInkBottom":95.69,"provinceTop":106.97},{"input":[0,["ฐ","ร"],"1234","ประจวบคีรีขันธ์"],"topRuns":[{"text":"0","x":43.12,"y":79.43,"fontSize":72.21,"role":"digit"},{"text":"ฐ","x":83.67,"y":79.43,"fontSize":101.55,"role":"letter","scaleX":0.8},{"text":"ร","x":128.45,"y":79.43,"fontSize":101.55,"role":"letter","scaleX":0.8},{"text":"1","x":244.7,"y":79.43,"fontSize":72.21,"role":"digit"},{"text":"2","x":276.16,"y":79.43,"fontSize":72.21,"role":"digit"},{"text":"3","x":314.1,"y":79.43,"fontSize":72.21,"role":"digit"},{"text":"4","x":351.85,"y":79.43,"fontSize":72.21,"role":"digit"}],"provinceLine":{"text":"ประจวบคีรีขันธ์","x":220,"y":155.57,"fontSize":42.59},"mainInkTop":20.21,"mainInkBottom":108.57,"provinceTop":116.09}] as const;
