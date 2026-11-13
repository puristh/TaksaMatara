import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  chooseRankingLayout,
  compactPlateWidth,
  RANKING_ROW_PLATE_WIDTH,
  RANKING_ROW_PLATE_WIDTH_NARROW,
  RANKING_TABLE_MIN_REM,
  RANKING_WIDE_MAX_PX,
  RankingPanel,
} from './RankingPanel';
import type { BatchReturnState, RankingLayout, RowLimit } from './RankingPanel';
import { generateTopCandidates } from '../engine/ranking';
import { formatPlateText } from '../engine/plateText';
import { PlateImage } from './PlateImage';
import {
  buildPlateLayout,
  compactProvinceVisible,
  COMPACT_MIN_PROVINCE_PX,
  lineGapForHeightScale,
  makePlateLayout,
  PLATE_BASE_H,
  PLATE_FONT_PROFILE,
  PLATE_LAYOUT,
} from './plateLayout';

/**
 * Batch (ranking Top N): ภาพป้ายในผลลัพธ์ตั้งแต่ในตาราง — จอกว้าง = ตาราง + ภาพป้ายย่อ, จอแคบ/ตัวอักษรใหญ่ = การ์ด
 * เลขทะเบียน/คะแนน/อันดับต้องมาจาก generateTopCandidates เดิมทุกค่า (ไม่แตะโลจิกคำนวณ)
 */
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;
const state = (rowLimit: RowLimit): BatchReturnState => ({
  frontDigit: '1', letter1: 'ก', letter2: 'ข', excludeAuction: false, excludePopular: false, rowLimit, favoriteDigits: ['', '', '', ''],
});
const render = (rowLimit: RowLimit, layout: RankingLayout) =>
  renderToStaticMarkup(
    createElement(RankingPanel as (p: { restoreState?: BatchReturnState; layout?: RankingLayout }) => ReturnType<typeof RankingPanel>, {
      restoreState: state(rowLimit),
      layout,
    }),
  );
const expected = (rowLimit: RowLimit) => generateTopCandidates(1, ['ก', 'ข'], 2, false, false, rowLimit, [null, null, null, null]);

describe('ตาราง (จอกว้าง): ทุกแถวมีภาพป้ายย่อ + ข้อความ sr-only', () => {
  for (const n of [10, 20, 30] as const)
    it(`จำนวนแถว ${n}: ภาพป้ายย่อ ${n} ภาพ ข้อความ sr-only ${n} แถว ลำดับ/คะแนนเท่าเดิม`, () => {
      const html = render(n, 'table');
      const cands = expected(n);
      // เดิม: /<tr data-ranking-row="">/ — แถวมี class medal เพิ่ม (batch-emphasis)
      expect(count(html, /<tr data-ranking-row="" class="ranking-row--/g)).toBe(n);
      // เดิม: <td class="plate-cell"><figure … --plate-max-width:176px> — batch-emphasis รอบ 2: ป้ายเล็กเป็นปุ่มขยาย (<button> ใส่ <figure> ไม่ได้ → <span>)
      // และกว้าง 150px เท่ากับแถวกะทัดรัด (ผู้ใช้กำหนด ~150px)
      expect(
        count(
          html,
          /<td class="plate-cell"><button type="button" class="plate-toggle" aria-expanded="false" aria-controls="[^"]+" aria-label="ดูรายละเอียดเลข [^"]+"><span class="plate-figure plate-figure--compact" style="--plate-max-width:150px"><svg class="plate-image /g,
        ),
      ).toBe(n);
      // sr-only ตามลำดับเดียวกับ engine และ aria-label ของภาพเหมือนภาพขนาดปกติ (มีชื่อจังหวัด)
      const srTexts = [...html.matchAll(/<span class="sr-only">([^<]+)<\/span>/g)].map((m) => m[1]);
      expect(srTexts).toEqual(cands.map((c) => formatPlateText(c.input)));
      for (const c of cands) expect(html).toContain(`aria-label="ภาพจำลองป้ายทะเบียน ${formatPlateText(c.input)} กรุงเทพมหานคร`);
      // เดิม: ตัวเลขตรงใน <td class="score-cell"> / <td class="rank"> — ตอนนี้เป็น ScoreFigure / RankBadge (batch-emphasis)
      const scores = [...html.matchAll(/<span class="score-figure__value">(\d+)<\/span>/g)].map((m) => Number(m[1]));
      expect(scores).toEqual(cands.map((c) => c.finalScore));
      const ranks = [...html.matchAll(/role="img" aria-label="อันดับที่ (\d+)"/g)].map((m) => Number(m[1]));
      expect(ranks).toEqual(cands.map((_, i) => i + 1));
    });
  it('ไม่มี caption/ปุ่มคัดลอกในแถว · มีประโยค "ภาพป้ายเป็นภาพจำลอง ไม่ใช่ป้ายจริง" ครั้งเดียวเหนือตาราง (มองเห็นได้ ไม่ใช่ sr-only)', () => {
    const html = render(10, 'table');
    expect(count(html, /plate-figure__caption/g)).toBe(0);
    expect(count(html, /plate-copy-btn/g)).toBe(0);
    expect(count(html, /<p class="ranking-plate-note">ภาพป้ายเป็นภาพจำลอง ไม่ใช่ป้ายจริง<\/p>/g)).toBe(1);
    expect(html.indexOf('ranking-plate-note')).toBeLessThan(html.indexOf('<table class="ranking-table">'));
  });
  it('เลขประมูลยังเป็นลายป้ายประมูลในภาพย่อ', () => {
    const html = render(30, 'table');
    const auctions = expected(30).filter((c) => c.auction.isAuction).length;
    expect(auctions).toBeGreaterThan(0);
    expect(count(html, /<svg class="plate-image plate-image--auction"/g)).toBe(auctions);
  });
});

// เดิม: describe "การ์ด (จอแคบ)" — การ์ดมีภาพป้ายขนาดเต็ม + ปุ่มคัดลอก + "ภาพจำลอง…" + badge ทุกใบ
// batch-emphasis รอบ 2: ผู้ใช้สั่งเปลี่ยนการ์ดสูงเป็นแถวกะทัดรัด (ป้ายเล็ก) — ป้ายใหญ่/ปุ่มคัดลอก/badge/ป้ายพิเศษย้ายไปส่วนที่ขยาย
describe('แถวกะทัดรัด (จอแคบ): อันดับ | ป้ายเล็ก (ปุ่ม) | verdict | คะแนน — รายละเอียดอยู่ในส่วนที่ขยาย', () => {
  for (const n of [10, 20, 30] as const)
    it(`จำนวนแถว ${n}`, () => {
      const html = render(n, 'compact');
      const cands = expected(n);
      expect(html).not.toContain('<table');
      expect(count(html, /<li class="rank-row rank-row--[a-z]+" data-ranking-row="">/g)).toBe(n);
      expect(count(html, /<svg class="plate-image /g)).toBe(n);
      expect(count(html, /<button type="button" class="plate-toggle" aria-expanded="false"[^>]*><span class="plate-figure plate-figure--compact" style="--plate-max-width:150px">/g)).toBe(n);
      // ยุบอยู่: ไม่มีป้ายใหญ่/ปุ่มคัดลอก/badge/ป้ายพิเศษในแถว — ประโยค "ภาพจำลอง" ครั้งเดียวเหนือรายการ
      expect(count(html, /class="plate-copy-btn"/g)).toBe(0);
      expect(count(html, /class="badges-cell"/g)).toBe(0);
      expect(count(html, /class="auction-tag"/g)).toBe(0);
      expect(count(html, /ภาพป้ายเป็นภาพจำลอง ไม่ใช่ป้ายจริง/g)).toBe(1);
      expect(count(html, /class="ranking-expand-btn"/g)).toBe(n);
      expect(count(html, /<div id="[^"]+" class="rank-row-detail" hidden="">\s*<\/div>/g)).toBe(n);
      const ranks = [...html.matchAll(/role="img" aria-label="อันดับที่ (\d+)"/g)].map((m) => Number(m[1]));
      expect(ranks).toEqual(cands.map((_, i) => i + 1));
      const scores = [...html.matchAll(/<span class="score-figure__value">(\d+)<\/span>/g)].map((m) => Number(m[1]));
      expect(scores).toEqual(cands.map((c) => c.finalScore));
      const toggles = [...html.matchAll(/aria-label="ดูรายละเอียดเลข ([^"]+)"/g)].map((m) => m[1]);
      expect(toggles).toEqual(cands.map((c) => formatPlateText(c.input)));
      const srTexts = [...html.matchAll(/<span class="sr-only">([^<]+)<\/span>/g)].map((m) => m[1]);
      expect(srTexts).toEqual(cands.map((c) => formatPlateText(c.input)));
      expect(count(html, /class="verdict-pill verdict-pill--(good|bad)"/g)).toBe(n);
      expect(count(html, /class="plate-image plate-image--auction"/g)).toBe(cands.filter((c) => c.auction.isAuction).length);
    });
  it(`ป้ายเล็ก: ${RANKING_ROW_PLATE_WIDTH}px ทุกความกว้าง (ตารางด้วย) ยกเว้นจอแคบ (< 480px) ${RANKING_ROW_PLATE_WIDTH_NARROW}px`, () => {
    expect(RANKING_ROW_PLATE_WIDTH).toBe(150);
    expect(compactPlateWidth(780)).toBe(150); // จอ 820px
    expect(compactPlateWidth(728)).toBe(150); // จอ 768px
    expect(compactPlateWidth(350)).toBe(124); // จอ 390px
    expect(RANKING_ROW_PLATE_WIDTH_NARROW).toBeGreaterThanOrEqual(120);
    expect(RANKING_ROW_PLATE_WIDTH_NARROW).toBeLessThanOrEqual(130);
  });
});

describe('เลือกตาราง/การ์ดตามความกว้างพื้นที่ผลลัพธ์ (rem)', () => {
  // เดิม: 52rem, กรอบแอป 840px = ตาราง — batch-emphasis ทำให้ตารางกว้างขึ้น (ต้องการ 55.9rem) ผู้ใช้ให้ขยับจุดสลับขึ้นแทนการย่อเนื้อหา
  // พื้นที่ผลลัพธ์แบบตารางกว้างได้ถึง RANKING_WIDE_MAX_PX (1040px) ตามความกว้างจอ − 57px
  // เดิม (batch-emphasis รอบ 2): 56.5rem — จอ 961px = ตาราง, ตัวอักษร 112.5% จอ 1280/1650px = ตาราง
  // รอบ 3 (type scale #batch): badge 15px ไม่ตัดบรรทัด ตารางต้องการ 59.75rem → เคยขยับเป็น 60rem (จอ 961px = แถวกะทัดรัด)
  // รอบ 4: ข้อความผลลัพธ์กลับขนาดเดียวกับส่วนบนของหน้า + ป้ายอันดับ/verdict 80% → ตารางกว้างสุด 871px + กรอบ = 55.4rem
  // จึงกลับมา 56.5rem: จอ 961px = ตารางอีกครั้ง (961 ตาราง / 960 แถวกะทัดรัด), ตัวอักษร 112.5% จอ 1280/1650px = ตาราง
  it(`ตารางเมื่อกว้าง ≥ ${RANKING_TABLE_MIN_REM}rem: จอ ≥ ~961px ตัวอักษร 100% = ตาราง · จอ 960/872/820/768/390px และตัวอักษร ≥ 150% = แถวกะทัดรัด`, () => {
    const area = (vw: number) => Math.max(840 > vw - 40 ? vw - 40 : 840, Math.min(RANKING_WIDE_MAX_PX, vw - 57));
    expect(chooseRankingLayout(area(1650), 16)).toBe('table');
    expect(chooseRankingLayout(area(1280), 16)).toBe('table');
    expect(chooseRankingLayout(area(1024), 16)).toBe('table');
    expect(chooseRankingLayout(area(961), 16)).toBe('table');
    expect(chooseRankingLayout(area(960), 16)).toBe('compact');
    expect(chooseRankingLayout(area(940), 16)).toBe('compact');
    expect(chooseRankingLayout(area(872), 16)).toBe('compact');
    expect(chooseRankingLayout(area(820), 16)).toBe('compact');
    expect(chooseRankingLayout(area(768), 16)).toBe('compact');
    expect(chooseRankingLayout(area(390), 16)).toBe('compact');
    expect(chooseRankingLayout(area(1650), 18)).toBe('table'); // ตัวอักษร 112.5% จอ ≥ ~1074px
    expect(chooseRankingLayout(area(1280), 18)).toBe('table'); // ตารางต้องการ 1017px ≤ 1040px
    expect(chooseRankingLayout(area(1024), 18)).toBe('compact');
    expect(chooseRankingLayout(area(1650), 24)).toBe('compact'); // 150%
    expect(chooseRankingLayout(area(1650), 28)).toBe('compact'); // 175%
  });
});

describe('PlateImage compactWidth', () => {
  const input = { frontDigit: 1, thaiLetters: ['ก', 'ข'] as [string, string], tailDigits: '1234', variant: 'standard' as const, provinceLabel: 'กรุงเทพมหานคร' };
  // เดิม: แสดงที่ RANKING_ROW_PLATE_WIDTH (176px) — ป้ายเล็กเปลี่ยนเป็น 150px (batch-emphasis รอบ 2) จึงระบุ 176px ตรง ๆ
  // และเพิ่มว่า 150/124px ซ่อนจังหวัด (พยัญชนะจะต่ำกว่า 9px)
  it(`ซ่อนบรรทัดจังหวัดเมื่อพยัญชนะจังหวัดจะต่ำกว่า ${COMPACT_MIN_PROVINCE_PX}px: แสดงที่ 176px, ซ่อนที่ ${RANKING_ROW_PLATE_WIDTH}/${RANKING_ROW_PLATE_WIDTH_NARROW}/120px`, () => {
    expect(compactProvinceVisible(input, 176)).toBe(true);
    expect(compactProvinceVisible(input, RANKING_ROW_PLATE_WIDTH)).toBe(false);
    expect(compactProvinceVisible(input, RANKING_ROW_PLATE_WIDTH_NARROW)).toBe(false);
    expect(compactProvinceVisible(input, 120)).toBe(false);
    const px = (w: number) => buildPlateLayout(input).provinceLine!.fontSize * PLATE_FONT_PROFILE.province.consonantEm * (w / 440);
    expect(px(176)).toBeGreaterThanOrEqual(9);
    expect(px(RANKING_ROW_PLATE_WIDTH)).toBeLessThan(9);
    expect(px(120)).toBeLessThan(9);
  });
  it('ภาพย่อที่ซ่อนจังหวัด: aria-label ยังมีชื่อจังหวัด และไม่มีข้อความจังหวัดบนภาพ', () => {
    const html = renderToStaticMarkup(createElement(PlateImage, { frontDigit: 1, thaiLetters: ['ก', 'ข'], tailDigits: '1234', variant: 'standard', compactWidth: 120 }));
    expect(html).toContain('aria-label="ภาพจำลองป้ายทะเบียน 1 กข 1234 กรุงเทพมหานคร"');
    expect(html).not.toContain('plate-image__province');
    expect(html).not.toContain('plate-figure__caption');
    const full = renderToStaticMarkup(createElement(PlateImage, { frontDigit: 1, thaiLetters: ['ก', 'ข'], tailDigits: '1234', variant: 'standard' }));
    expect(full).toContain('plate-image__province');
    expect(full).toContain('ภาพจำลอง ไม่ใช่ป้ายจริง');
  });
});

describe('LINE_GAP_H0 คำนวณจาก heightScale อัตโนมัติ', () => {
  it('1.05 → 0.184 ตรงค่าเดิมทุกค่า (PLATE_LAYOUT เท่ากับค่าที่ตั้งด้วยมือเดิมทุก key)', () => {
    expect(lineGapForHeightScale(1.05)).toBe(0.184);
    expect(PLATE_LAYOUT).toEqual(makePlateLayout(1.05, 0.9, 0.184));
  });
  it('1.0 / 1.1: ความสูงที่ลด/เพิ่มไปอยู่ที่ระยะระหว่างบรรทัดทั้งหมด (= (H − 162.4) ÷ 188)', () => {
    expect(lineGapForHeightScale(1.0)).toBeCloseTo(0.184 - 9 / PLATE_BASE_H, 10);
    expect(lineGapForHeightScale(1.1)).toBeCloseTo(0.184 + 10 / PLATE_BASE_H, 10);
    for (const hs of [1.0, 1.1]) {
      const H = Math.round(PLATE_BASE_H * hs);
      expect(lineGapForHeightScale(hs)).toBeCloseTo((H - 162.4) / PLATE_BASE_H, 4);
      // เส้นฐานบรรทัดหลักอยู่ที่ระยะจริงเดียวกับป้าย 1.05 (ไม่ขยับตามความสูง)
      const l = buildPlateLayout({ frontDigit: 2, thaiLetters: ['ก', 'บ'], tailDigits: '2295', variant: 'standard', provinceLabel: 'กรุงเทพมหานคร' }, PLATE_FONT_PROFILE, makePlateLayout(hs));
      const ref = buildPlateLayout({ frontDigit: 2, thaiLetters: ['ก', 'บ'], tailDigits: '2295', variant: 'standard', provinceLabel: 'กรุงเทพมหานคร' });
      expect(l.mainBaseline).toBeCloseTo(ref.mainBaseline, 1);
      expect(makePlateLayout(hs).lineGapH0).toBe(lineGapForHeightScale(hs));
    }
  });
});
