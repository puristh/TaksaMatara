import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RankBadge, rankTier, ScoreFigure, VerdictPill } from './RankEmphasis';
import { RankingPanel } from './RankingPanel';
import type { BatchReturnState, RankingLayout } from './RankingPanel';
import { ComparisonResultCard } from './ComparisonResultCard';
import { ResultCard } from './ResultCard';
import { comparePlates } from '../engine/comparePlates';
import { generateTopCandidates } from '../engine/ranking';
import { analyzePlate } from '../engine';
import themeCss from '../styles/theme.css?raw';

/**
 * หน้า Batch: อันดับ / verdict / คะแนนรวม แบบเด่น — แสดงผลอย่างเดียว ค่าทุกตัวมาจาก engine เดิม
 */
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

describe('ป้ายอันดับ (RankBadge)', () => {
  it('อันดับ 1/2/3 = ทอง/เงิน/ทองแดง · 4 ขึ้นไป = เทาเข้ม · aria-label "อันดับที่ N"', () => {
    for (const [rank, tier] of [[1, 'gold'], [2, 'silver'], [3, 'bronze'], [4, 'plain'], [10, 'plain'], [30, 'plain']] as const) {
      expect(rankTier(rank)).toBe(tier);
      const html = renderToStaticMarkup(createElement(RankBadge, { rank }));
      expect(html).toBe(
        `<span class="rank-badge rank-badge--${tier}" role="img" aria-label="อันดับที่ ${rank}"><span aria-hidden="true">${rank}</span></span>`,
      );
    }
  });
});

describe('Verdict pill', () => {
  it('ใช้ได้ = เขียว ✓ · ไม่ควรใช้ = แดง ✕ · aria-label บอกผล', () => {
    const good = renderToStaticMarkup(createElement(VerdictPill, { verdict: true }));
    expect(good).toContain('class="verdict-pill verdict-pill--good" role="img" aria-label="ผลประเมิน: ใช้ได้"');
    expect(good).toContain('>✓</span><span aria-hidden="true">ใช้ได้</span>');
    const bad = renderToStaticMarkup(createElement(VerdictPill, { verdict: false }));
    expect(bad).toContain('class="verdict-pill verdict-pill--bad" role="img" aria-label="ผลประเมิน: ไม่ควรใช้"');
    expect(bad).toContain('>✕</span><span aria-hidden="true">ไม่ควรใช้</span>');
  });
});

describe('คะแนนรวม (ScoreFigure)', () => {
  it('label "คะแนนรวม" อยู่เหนือตัวเลข · อันดับ 1 ใช้ขนาดใหญ่กว่า', () => {
    expect(renderToStaticMarkup(createElement(ScoreFigure, { score: 252, rank: 1 }))).toBe(
      '<span class="score-figure score-figure--top"><span class="score-figure__label">คะแนนรวม</span><span class="score-figure__value">252</span></span>',
    );
    expect(renderToStaticMarkup(createElement(ScoreFigure, { score: 241, rank: 4 }))).toBe(
      '<span class="score-figure"><span class="score-figure__label">คะแนนรวม</span><span class="score-figure__value">241</span></span>',
    );
  });
});

const state = (excludeAuction: boolean): BatchReturnState => ({
  frontDigit: '1', letter1: 'ก', letter2: 'ข', excludeAuction, excludePopular: false, rowLimit: 30, favoriteDigits: ['', '', '', ''],
});
const renderPanel = (layout: RankingLayout, restoreState: BatchReturnState) =>
  renderToStaticMarkup(
    createElement(RankingPanel as (p: { restoreState?: BatchReturnState; layout?: RankingLayout }) => ReturnType<typeof RankingPanel>, {
      restoreState,
      layout,
    }),
  );

describe('ตาราง/การ์ด Top N: อันดับ/verdict/คะแนนตรงกับ engine ทุกแถว', () => {
  for (const layout of ['table', 'cards'] as const)
    it(layout, () => {
      const html = renderPanel(layout, state(false));
      const cands = generateTopCandidates(1, ['ก', 'ข'], 2, false, false, 30, [null, null, null, null]);
      const ranks = [...html.matchAll(/aria-label="อันดับที่ (\d+)"/g)].map((m) => Number(m[1]));
      expect(ranks).toEqual(cands.map((_, i) => i + 1));
      const tiers = [...html.matchAll(/class="rank-badge rank-badge--([a-z]+)"/g)].map((m) => m[1]);
      expect(tiers).toEqual(cands.map((_, i) => rankTier(i + 1)));
      const verdicts = [...html.matchAll(/aria-label="ผลประเมิน: ([^"]+)"/g)].map((m) => m[1]);
      expect(verdicts).toEqual(cands.map((c) => (c.verdict ? 'ใช้ได้' : 'ไม่ควรใช้')));
      const scores = [...html.matchAll(/<span class="score-figure__value">(\d+)<\/span>/g)].map((m) => Number(m[1]));
      expect(scores).toEqual(cands.map((c) => c.finalScore));
      expect(count(html, /score-figure--top/g)).toBe(1);
      // พื้นไล่เฉด medal เฉพาะอันดับ 1–3
      const row = layout === 'table' ? 'ranking-row' : 'ranking-card';
      expect(count(html, new RegExp(`${row}--(gold|silver|bronze)`, 'g'))).toBe(3);
      expect(count(html, new RegExp(`${row}--plain`, 'g'))).toBe(cands.length - 3);
    });
  it('มีทั้ง verdict ใช้ได้และไม่ควรใช้ในชุดข้อมูลที่ตรวจ (ไม่ได้ตรวจแค่แบบเดียว)', () => {
    const all = [2, 3, 4].flatMap((len) => generateTopCandidates(1, ['ก', 'ข'], len as 2 | 3 | 4, false, false, 30, [null, null, null, null]));
    const target = comparePlates(['1234', '9999', '12', '15'].map((tailDigits) => ({ frontDigit: 1, thaiLetters: ['ก', 'ข'] as [string, string], tailDigits })));
    expect(new Set([...all.map((c) => c.verdict), ...target.map((r) => r.mode1.verdict)]).size).toBe(2);
  });
});

describe('โหมด "เลขที่เล็งไว้" และการ์ด #single', () => {
  const results = comparePlates(['1234', '9999', '12', '15', '5555'].map((tailDigits) => ({ frontDigit: 1, thaiLetters: ['ก', 'ข'] as [string, string], tailDigits })));
  it('เลขที่เล็งไว้ (emphasis): ป้ายอันดับตาม result.rank + verdict pill + คะแนนตัวใหญ่', () => {
    for (const r of results) {
      const html = renderToStaticMarkup(createElement(ComparisonResultCard, { result: r, label: 'ช่อง 1', isWinner: r.rank === 1, emphasis: true }));
      expect(html).toContain(`aria-label="อันดับที่ ${r.rank}"`);
      expect(html).toContain(`compare-column--${rankTier(r.rank)}`);
      expect(html).toContain(`aria-label="ผลประเมิน: ${r.mode1.verdict ? 'ใช้ได้' : 'ไม่ควรใช้'}"`);
      expect(html).toContain(`<span class="score-figure__value">${r.finalScore}</span>`);
      expect(html).not.toContain('compare-rank-badge');
    }
  });
  it('หน้าเปรียบเทียบ (ไม่ส่ง emphasis): แสดงแบบเดิม', () => {
    const html = renderToStaticMarkup(createElement(ComparisonResultCard, { result: results[0], label: 'ทะเบียน A', isWinner: true }));
    expect(html).toContain('compare-rank-badge');
    expect(html).toContain(`คะแนนรวม: ${results[0].finalScore}`);
    expect(html).not.toContain('rank-badge--');
  });
  it('การ์ด #single ใช้ verdict pill เดียวกัน', () => {
    for (const tail of ['1234', '12']) {
      const result = analyzePlate({ frontDigit: 1, thaiLetters: ['ก', 'ข'], tailDigits: tail });
      const html = renderToStaticMarkup(createElement(ResultCard, { result }));
      expect(html).toContain(`aria-label="ผลประเมิน: ${result.verdict ? 'ใช้ได้' : 'ไม่ควรใช้'}"`);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------
// contrast (WCAG 2.x) ของทุกคู่สีตัวอักษร/พื้น จากค่าใน theme.css จริง — ทั้ง Light และ Dark
// ---------------------------------------------------------------------------------------------------------
function block(selector: string): Record<string, string> {
  const start = themeCss.indexOf(selector);
  const body = themeCss.slice(themeCss.indexOf('{', start) + 1, themeCss.indexOf('}', start));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}
const LIGHT = block(':root {');
const DARK = { ...LIGHT, ...block("[data-theme='dark'] {") };
type RGB = [number, number, number];
const hex = (v: string): RGB => [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16)) as RGB;
function resolve(theme: Record<string, string>, v: string): RGB {
  const m = v.match(/^var\((--[\w-]+)\)$/);
  return m ? resolve(theme, theme[m[1]]) : hex(v);
}
const lum = (c: RGB) => {
  const [r, g, b] = c.map((x) => {
    const s = x / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a: RGB, b: RGB) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const mix = (a: RGB, b: RGB, t: number): RGB => a.map((v, i) => Math.round(v * t + b[i] * (1 - t))) as RGB;

/** คู่สีทั้งหมด: [ชื่อ, ตัวอักษร, พื้น] — พื้นแถวอันดับ 1–3 ใช้จุดที่เข้มที่สุดของไล่เฉด (ขอบซ้าย/บน) */
export function emphasisPairs(theme: Record<string, string>): [string, RGB, RGB][] {
  const c = (k: string) => resolve(theme, theme[k]);
  const tint = parseFloat(theme['--medal-tint']) / 100;
  const card = c('--card');
  const pairs: [string, RGB, RGB][] = [
    ['อันดับ 1 (ทอง)', c('--medal-gold-ink'), c('--medal-gold')],
    ['อันดับ 2 (เงิน)', c('--medal-silver-ink'), c('--medal-silver')],
    ['อันดับ 3 (ทองแดง)', c('--medal-bronze-ink'), c('--medal-bronze')],
    ['อันดับ 4+', c('--rank-plain-ink'), c('--rank-plain')],
    ['ใช้ได้', c('--verdict-good-ink'), c('--verdict-good')],
    ['ไม่ควรใช้', c('--verdict-bad-ink'), c('--verdict-bad')],
    ['คะแนน บนพื้นการ์ด', c('--navy'), card],
    ['label คะแนนรวม บนพื้นการ์ด', c('--ink-soft'), card],
  ];
  for (const [name, medal] of [['ทอง', '--medal-gold'], ['เงิน', '--medal-silver-edge'], ['ทองแดง', '--medal-bronze']] as const) {
    const bg = mix(c(medal), card, tint);
    pairs.push([`คะแนน บนพื้นแถว${name}`, c('--navy'), bg], [`label บนพื้นแถว${name}`, c('--ink-soft'), bg], [`ตัวอักษรทั่วไป บนพื้นแถว${name}`, c('--ink'), bg]);
  }
  return pairs;
}

describe('contrast ≥ 4.5:1 ทุกคู่สี (Light และ Dark)', () => {
  for (const [themeName, theme] of [['light', LIGHT], ['dark', DARK]] as const)
    it(themeName, () => {
      for (const [name, fg, bg] of emphasisPairs(theme)) expect(contrast(fg, bg), `${themeName} ${name}`).toBeGreaterThanOrEqual(4.5);
    });
  it('ค่า dark ของ prefers-color-scheme เท่ากับ [data-theme=dark] (สองบล็อกต้องตรงกัน)', () => {
    const pref = block(":root:not([data-theme='light']) {");
    for (const k of ['--rank-plain', '--medal-tint', '--card', '--navy', '--ink-soft']) expect(pref[k], k).toBe(DARK[k]);
  });
});
