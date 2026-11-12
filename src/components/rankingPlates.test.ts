import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { chooseRankingLayout, RANKING_ROW_PLATE_WIDTH, RANKING_TABLE_MIN_REM, RANKING_WIDE_MAX_PX, RankingPanel } from './RankingPanel';
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
      expect(count(html, /<td class="plate-cell"><figure class="plate-figure plate-figure--compact" style="--plate-max-width:176px"><svg class="plate-image /g)).toBe(n);
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

describe('การ์ด (จอแคบ): ต่อทะเบียน = อันดับ คะแนน Verdict ภาพป้ายขนาดเต็ม + ปุ่มคัดลอก แท็ก Badge ปุ่ม', () => {
  for (const n of [10, 20, 30] as const)
    it(`จำนวนแถว ${n}`, () => {
      const html = render(n, 'cards');
      const cands = expected(n);
      expect(html).not.toContain('<table');
      // เดิม: class="ranking-card" — การ์ดมี class medal เพิ่ม (batch-emphasis)
      expect(count(html, /<li class="ranking-card ranking-card--[a-z]+" data-ranking-row="">/g)).toBe(n);
      expect(count(html, /<svg class="plate-image /g)).toBe(n);
      expect(count(html, /plate-figure--compact/g)).toBe(0);
      expect(count(html, /class="plate-copy-btn"/g)).toBe(n);
      expect(count(html, /ภาพจำลอง ไม่ใช่ป้ายจริง/g)).toBe(n);
      expect(count(html, /class="ranking-expand-btn"/g)).toBe(n);
      // เดิม: "อันดับ N" ใน .ranking-card-rank และ <b class="score-cell"> — ตอนนี้เป็น RankBadge / ScoreFigure (batch-emphasis)
      const ranks = [...html.matchAll(/role="img" aria-label="อันดับที่ (\d+)"/g)].map((m) => Number(m[1]));
      expect(ranks).toEqual(cands.map((_, i) => i + 1));
      const scores = [...html.matchAll(/<span class="score-figure__value">(\d+)<\/span>/g)].map((m) => Number(m[1]));
      expect(scores).toEqual(cands.map((c) => c.finalScore));
      const labels = [...html.matchAll(/aria-label="คัดลอกเลขทะเบียน ([^"]+)"/g)].map((m) => m[1]);
      // ไม่ได้พิมพ์จังหวัด → คัดลอกเลขทะเบียนอย่างเดียว (plateCopyText เดิม)
      expect(labels).toEqual(cands.map((c) => formatPlateText(c.input)));
      // เดิม: class="verdict v-…" — verdict pill (batch-emphasis)
      expect(count(html, /class="verdict-pill verdict-pill--(good|bad)"/g)).toBe(n);
      expect(count(html, /class="auction-tag"/g)).toBe(cands.filter((c) => c.auction.isAuction).length);
    });
});

describe('เลือกตาราง/การ์ดตามความกว้างพื้นที่ผลลัพธ์ (rem)', () => {
  // เดิม: 52rem, กรอบแอป 840px = ตาราง — batch-emphasis ทำให้ตารางกว้างขึ้น (ต้องการ 55.9rem) ผู้ใช้ให้ขยับจุดสลับขึ้นแทนการย่อเนื้อหา
  // พื้นที่ผลลัพธ์แบบตารางกว้างได้ถึง RANKING_WIDE_MAX_PX (1040px) ตามความกว้างจอ − 57px
  it(`ตารางเมื่อกว้าง ≥ ${RANKING_TABLE_MIN_REM}rem: จอ ≥ ~961px ตัวอักษร 100% = ตาราง · จอ 872/820/768/390px และตัวอักษร ≥ 150% = การ์ด`, () => {
    const area = (vw: number) => Math.max(840 > vw - 40 ? vw - 40 : 840, Math.min(RANKING_WIDE_MAX_PX, vw - 57));
    expect(chooseRankingLayout(area(1650), 16)).toBe('table');
    expect(chooseRankingLayout(area(1280), 16)).toBe('table');
    expect(chooseRankingLayout(area(1024), 16)).toBe('table');
    expect(chooseRankingLayout(area(961), 16)).toBe('table');
    expect(chooseRankingLayout(area(940), 16)).toBe('cards');
    expect(chooseRankingLayout(area(872), 16)).toBe('cards');
    expect(chooseRankingLayout(area(820), 16)).toBe('cards');
    expect(chooseRankingLayout(area(768), 16)).toBe('cards');
    expect(chooseRankingLayout(area(390), 16)).toBe('cards');
    expect(chooseRankingLayout(area(1650), 18)).toBe('table'); // ตัวอักษร 112.5% จอ ≥ ~1074px
    expect(chooseRankingLayout(area(1280), 18)).toBe('table'); // ตารางต้องการ 969px ≤ 1040px
    expect(chooseRankingLayout(area(1024), 18)).toBe('cards');
    expect(chooseRankingLayout(area(1650), 24)).toBe('cards'); // 150%
    expect(chooseRankingLayout(area(1650), 28)).toBe('cards'); // 175%
  });
});

describe('PlateImage compactWidth', () => {
  const input = { frontDigit: 1, thaiLetters: ['ก', 'ข'] as [string, string], tailDigits: '1234', variant: 'standard' as const, provinceLabel: 'กรุงเทพมหานคร' };
  it(`ซ่อนบรรทัดจังหวัดเมื่อพยัญชนะจังหวัดจะต่ำกว่า ${COMPACT_MIN_PROVINCE_PX}px: แสดงที่ ${RANKING_ROW_PLATE_WIDTH}px, ซ่อนที่ 120px`, () => {
    expect(compactProvinceVisible(input, RANKING_ROW_PLATE_WIDTH)).toBe(true);
    expect(compactProvinceVisible(input, 120)).toBe(false);
    const px = (w: number) => buildPlateLayout(input).provinceLine!.fontSize * PLATE_FONT_PROFILE.province.consonantEm * (w / 440);
    expect(px(RANKING_ROW_PLATE_WIDTH)).toBeGreaterThanOrEqual(9);
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
