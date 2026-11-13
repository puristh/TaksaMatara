import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  candidateRowData,
  chooseRankingLayout,
  RANKING_TABLE_MIN_REM,
  RANKING_TABLE_MIN_REM_WITH_BAD_VERDICT,
  RankingPanel,
  rankTargetTails,
  tableMinRemFor,
  targetRowData,
} from './RankingPanel';
import type { BatchReturnState, RankingLayout } from './RankingPanel';
import { generateTopCandidates } from '../engine/ranking';
import { combineVerdictAndBadges } from '../engine/combine';

/**
 * batch-target-unify: โหมด "เลขที่เล็งไว้" ใช้ตัวแสดงผลชุดเดียวกับโหมดปกติ (RankResultRows)
 * - เลขเดียวกัน → markup ของแถวและส่วนที่ขยายเหมือนกันทุกตัวอักษร ต่างกันเฉพาะ "ช่อง N" (และ id ที่ aria-controls ชี้)
 *   ทั้งตาราง (จอกว้าง) และแถวกะทัดรัด (จอแคบ)
 * - badge ทั้งสอง (คู่เลขที่ปรากฏ / ผลรวมตัวเลข) และลิงก์ "เช็คกับวันเกิด →" อยู่ในแถวตารางของทั้งสองโหมด
 * - ข้อมูลแถวโหมดเลขที่เล็งไว้ (targetRowData) เท่ากับข้อมูลของ generateTopCandidates สำหรับเลขเดียวกันทุกช่อง (ไม่เดาค่า)
 */
type Panel = (p: {
  restoreState?: BatchReturnState;
  layout?: RankingLayout;
  initialExpanded?: string[];
  onViewBirthdayCompat?: () => void;
  onViewFiveElement?: () => void;
  onViewAyatana6?: () => void;
}) => ReturnType<typeof RankingPanel>;

const FRONT = 1;
const LETTERS: [string, string] = ['ก', 'ข'];
const base: BatchReturnState = {
  frontDigit: String(FRONT), letter1: LETTERS[0], letter2: LETTERS[1], excludeAuction: false, excludePopular: false,
  rowLimit: 30, favoriteDigits: ['', '', '', ''], // Top 30: มีเลขประมูล เลขสวย และเลขธรรมดาครบ (Top 10 ไม่มีเลขสวย)
};
const noop = () => {};
const render = (layout: RankingLayout, extra: Partial<BatchReturnState>, initialExpanded: string[] = []) =>
  renderToStaticMarkup(
    createElement(RankingPanel as Panel, {
      restoreState: { ...base, ...extra },
      layout,
      initialExpanded,
      onViewBirthdayCompat: noop,
      onViewFiveElement: noop,
      onViewAyatana6: noop,
    }),
  );
const targetTails = (tail: string) => [tail, '', '', '', '', '', '', '', '', ''];

/** แถว (+ ส่วนที่ขยาย) ทีละแถวตามลำดับ */
function rowsOf(html: string, layout: RankingLayout): string[] {
  if (layout === 'table') {
    return [...html.matchAll(/<tr data-ranking-row[\s\S]*?<\/tr><tr id="[^"]*" class="ranking-detail-row"[\s\S]*?<\/td><\/tr>/g)].map((m) => m[0]);
  }
  const list = html.slice(html.indexOf('<ol class="rank-rows">'), html.lastIndexOf('</ol>'));
  return list.split('<li class="rank-row ').slice(1);
}
/** ตัด "ช่อง N" และ id (ต่างกันตามโหมดโดยตั้งใจ: "<tab>-<เลขท้าย>" กับ "target-<ช่อง>") */
const strip = (row: string) =>
  row
    .replace(/<span class="rank-row-label">ช่อง \d+<\/span>/g, '')
    .replace(/ (id|aria-controls)="[^"]*"/g, ' $1="X"')
    .replace(/url\(#[^)]*\)/g, 'url(#X)'); // id ภายใน SVG ป้าย (useId) ต่างกันทุกครั้งที่ render
/** อันดับต่างกันได้ (Top N นับ 1..N, เลขที่เล็งไว้ช่องเดียวเป็นอันดับ 1) — ใช้เทียบแถวที่ 2 ขึ้นไป */
const stripRank = (row: string) =>
  strip(row)
    .replace(/(rank-badge|rank-row|ranking-row)--[a-z]+/g, '$1--T')
    .replace(/อันดับที่ \d+"><span aria-hidden="true">\d+/g, 'อันดับที่ N"><span aria-hidden="true">N')
    .replace(/ score-figure--top/g, '');

const cands = generateTopCandidates(FRONT, LETTERS, 2, false, false, 30, [null, null, null, null]);

describe.each<RankingLayout>(['table', 'compact'])('สองโหมดใช้ตัวแสดงผลเดียวกัน (%s)', (layout) => {
  for (const expanded of [false, true]) {
    it(`เลขเดียวกัน → แถว${expanded ? ' + ส่วนที่ขยาย' : ''} markup เหมือนกัน ต่างกันเฉพาะ "ช่อง N"`, () => {
      const normalRows = rowsOf(render(layout, {}, expanded ? cands.map((c) => c.tailDigits) : []), layout);
      expect(normalRows).toHaveLength(cands.length);
      cands.forEach((c, i) => {
        const targetHtml = render(layout, { targetTails: targetTails(c.tailDigits) }, expanded ? ['target-0'] : []);
        const [targetRow] = rowsOf(targetHtml, layout);
        expect(targetRow).toContain('<span class="rank-row-label">ช่อง 1</span>');
        expect(normalRows[i]).not.toContain('rank-row-label');
        // อันดับ 1 ทั้งคู่ → เทียบทั้งแถวตรงตัว · แถวอื่นเทียบโดยตัดเลขอันดับ (สี medal ตามอันดับ)
        if (i === 0) expect(strip(targetRow)).toBe(strip(normalRows[i]));
        else expect(stripRank(targetRow)).toBe(stripRank(normalRows[i]));
      });
      if (expanded) {
        // ส่วนที่ขยาย: ตาราง = ป้ายใหญ่ + คัดลอก + 3 กล่องวิเคราะห์เปิดอยู่ · แถวกะทัดรัด = เหมือนโหมดปกติ (ป้ายใหญ่ + badge + การคำนวณ + เช็กวันเกิด)
        const [t] = rowsOf(render(layout, { targetTails: targetTails(cands[0].tailDigits) }, ['target-0']), layout);
        expect(t).toContain('class="plate-copy-btn"');
        expect((t.match(/class="detail-box"/g) ?? []).length).toBe(3);
        if (layout === 'table') expect(t).toContain('detail-grid detail-grid--with-leading');
        else expect(t).toContain('rank-row-detail-actions');
        expect(t).not.toContain('compare-supplementary');
      }
    });
  }
  it('ชุดเลขที่เทียบมีทั้งเลขประมูล เลขสวย และเลขธรรมดา (ครอบคลุมคอลัมน์ป้ายพิเศษ)', () => {
    expect(cands.some((c) => c.auction.isAuction)).toBe(true);
    expect(cands.some((c) => c.popular.isPopular)).toBe(true);
    expect(cands.some((c) => !c.auction.isAuction && !c.popular.isPopular)).toBe(true);
  });
});

describe('badge และลิงก์เช็กวันเกิดในแถวตาราง ทั้งสองโหมด', () => {
  const tails = ['1234', '9999', '12', '15', '5555'];
  const cases: [string, Partial<BatchReturnState>, number][] = [
    ['โหมดปกติ', {}, cands.length],
    ['โหมดเลขที่เล็งไว้', { targetTails: [...tails, '', '', '', '', ''] }, tails.length],
  ];
  it.each(cases)('%s: ทุกแถวมี badge คู่เลขที่ปรากฏ + ผลรวมตัวเลข + "เช็คกับวันเกิด →" + "ดูรายละเอียด"', (_n, extra, n) => {
    const rows = rowsOf(render('table', extra), 'table');
    expect(rows).toHaveLength(n);
    for (const row of rows) {
      expect(row).toMatch(/class="badge b-(good|bad)">[✓⚠] คู่เลขที่ปรากฏ: /);
      expect(row).toMatch(/class="badge b-(good|mid)">[✓—] ผลรวมตัวเลข: /);
      expect(row).toContain('class="birthday-compat-link">เช็คกับวันเกิด →</button>');
      expect(row).toContain('<span class="ranking-expand-text">ดูรายละเอียด</span>');
    }
  });
  it('"พบคู่เสีย (Mode 2)" ไม่ซ้ำกับ badge: เงื่อนไขเดียวกัน (hasBadPair ⇔ mode2.tier4 ⇔ badge คำเตือนคู่เลข)', () => {
    const ranked = rankTargetTails(FRONT, LETTERS, [...tails, '', '', '', '', '']);
    expect(ranked.some((r) => r.hasBadPair)).toBe(true);
    for (const r of ranked) {
      const warn = combineVerdictAndBadges(r.mode1, r.mode2, r.mode3).badges.some((b) => b.type === 'warning');
      expect(warn).toBe(r.hasBadPair);
      expect(r.hasBadPair).toBe(r.mode2.tier === 'tier4');
    }
    const html = render('table', { targetTails: [...tails, '', '', '', '', ''] });
    expect(html).not.toContain('พบคู่เสีย (Mode 2)');
  });
});

describe('ข้อมูลแถวโหมดเลขที่เล็งไว้ครบและตรงกับโหมดปกติ', () => {
  it.each([2, 3, 4] as const)('เลขท้าย %i หลัก: targetRowData เท่ากับ candidateRowData ของเลขเดียวกันทุกช่อง (ยกเว้น key/อันดับ/ช่อง)', (len) => {
    const top = generateTopCandidates(FRONT, LETTERS, len, false, false, 30, [null, null, null, null]);
    for (const c of top) {
      const [r] = rankTargetTails(FRONT, LETTERS, targetTails(c.tailDigits));
      const t = targetRowData(r, 'd');
      const n = candidateRowData(c, 0, 'd');
      expect({ ...t, key: '', label: undefined }).toEqual({ ...n, key: '' });
    }
  });
  it('เลขที่โหมดปกติคัดออก (verdict ไม่ควรใช้ / คู่เสีย) ก็มี badge ครบ 2 ตัวจาก engine ตัวเดียวกัน', () => {
    const ranked = rankTargetTails(FRONT, LETTERS, ['1234', '9999', '12', '15', '5555', '', '', '', '', '']);
    expect(ranked.some((r) => !r.mode1.verdict)).toBe(true);
    for (const r of ranked) {
      const t = targetRowData(r, 'd');
      expect(t.badges).toHaveLength(2);
      expect(t.verdict).toBe(r.mode1.verdict);
      expect(t.finalScore).toBe(r.finalScore);
      expect(t.rank).toBe(r.rank);
      expect(t.matchedFavoriteDigits).toEqual([]);
    }
  });
});

describe('จุดสลับตาราง/แถวกะทัดรัดตามแถวที่แสดง', () => {
  const area = (vw: number) => Math.min(vw - 57, 1040); // .ranking-wide = min(1040px, 100vw - 57px)
  it('ทุกแถว "ใช้ได้" (โหมดปกติเสมอ และโหมดเลขที่เล็งไว้ส่วนใหญ่): ตารางตั้งแต่ 961px เหมือนเดิม', () => {
    const minRem = tableMinRemFor([{ verdict: true }, { verdict: true }]);
    expect(minRem).toBe(RANKING_TABLE_MIN_REM);
    expect(chooseRankingLayout(area(961), 16, minRem)).toBe('table');
    expect(chooseRankingLayout(area(960), 16, minRem)).toBe('compact');
  });
  it('มีแถว "ไม่ควรใช้" (เฉพาะโหมดเลขที่เล็งไว้): pill กว้างขึ้น 25px ตารางหนักสุด 910px + กรอบ → ตารางตั้งแต่ 985px', () => {
    const minRem = tableMinRemFor([{ verdict: true }, { verdict: false }]);
    expect(minRem).toBe(RANKING_TABLE_MIN_REM_WITH_BAD_VERDICT);
    expect(chooseRankingLayout(area(985), 16, minRem)).toBe('table');
    expect(chooseRankingLayout(area(984), 16, minRem)).toBe('compact');
    expect(chooseRankingLayout(area(1280), 16, minRem)).toBe('table');
    // engine: โหมดปกติไม่มีแถว "ไม่ควรใช้" เลย จึงไม่โดนเงื่อนไขนี้
    for (const len of [2, 3, 4] as const) {
      expect(generateTopCandidates(FRONT, LETTERS, len, false, false, 30, [null, null, null, null]).every((c) => c.verdict)).toBe(true);
    }
  });
});

describe('จอแคบ: ส่วนที่ขยายเปิดกล่องวิเคราะห์ 3 กล่องไว้เลย ทั้งสองโหมด', () => {
  const normal = generateTopCandidates(FRONT, LETTERS, 2, false, false, 30, [null, null, null, null]);
  const pick = [normal[0], normal[4]];
  const target = rankTargetTails(FRONT, LETTERS, [pick[0].tailDigits, pick[1].tailDigits, '', '', '', '', '', '', '', '']);
  const cases: [string, string][] = [
    ['โหมดปกติ', render('compact', {}, pick.map((c) => c.tailDigits))],
    ['โหมดเลขที่เล็งไว้', render('compact', { targetTails: target.map((r) => r.input.tailDigits).concat(Array(8).fill('')) }, ['target-0', 'target-1'])],
  ];
  for (const [name, html] of cases) {
    it(`${name}: 2 แถวที่ขยายมีกล่อง 3 Mode เปิดอยู่ (ไม่มี <details>/"ดูรายละเอียดการคำนวณ") และลิงก์เช็ควันเกิดอยู่หลังกล่อง`, () => {
      expect(html).not.toContain('<details');
      expect(html).not.toContain('ดูรายละเอียดการคำนวณ');
      const opened = rowsOf(html, 'compact').filter((r) => r.includes('is-open'));
      expect(opened).toHaveLength(2);
      for (const r of opened) {
        expect(r.match(/class="detail-box"/g)).toHaveLength(3);
        expect(r.indexOf('class="badges-cell"')).toBeLessThan(r.indexOf('class="detail-grid"'));
        expect(r.indexOf('class="detail-grid"')).toBeLessThan(r.indexOf('เช็คกับวันเกิด →'));
      }
    });
  }
});
