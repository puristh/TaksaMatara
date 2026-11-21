import { createElement } from 'react';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RankingPanel, rankTargetTails } from './RankingPanel';
import type { BatchReturnState, RankingLayout } from './RankingPanel';
import { ComparisonResultCard } from './ComparisonResultCard';
import { ResultCard } from './ResultCard';
import { dominantPairLine, ModeDetailPanel, tier4LeadText } from './ModeDetailPanel';
import { RankingStrategyContext, StrictModeIndicator } from './RankingStrategyContext';
import { generateTopCandidates } from '../engine/ranking';
import { comparePlates } from '../engine/comparePlates';
import { combineVerdictAndBadges, findTier4Pairs, pairWarningText, resolvePlateVerdict } from '../engine/combine';
import { analyzePlate } from '../engine/analyzePlate';
import { calculateMode1, getMode1TierFromTotal } from '../engine/mode1';
import { calculateMode2 } from '../engine/mode2';
import { calculateMode3 } from '../engine/mode3';
import { LETTER_NUMBER_TABLE } from '../data/lookupTables';
import type { PlateInput, RankingStrategy } from '../engine/types';
import {
  parseStrictParam,
  resolveRankingStrategy,
  STRICT_STORAGE_KEY,
  urlWithoutStrictParam,
} from '../config/rankingStrategy';
import appSource from '../App.tsx?raw';
import mainSource from '../main.tsx?raw';

/**
 * fix/ranking-market-first
 * - โหมดทั่วไป (ค่าเริ่มต้น 'market-first'): เลขที่เล็งไว้/เลขโปรด → คะแนนรวม → เลขท้าย · ไม่มีชั้น "ไม่มีคู่ Tier 4 ขึ้นก่อน"
 * - โหมดคัดเข้ม ('strict', ซ่อน): ลำดับเดิม
 * - คำเตือนคู่ Tier 4 ระบุคู่จริง · "คู่หลัก" แสดง Tier ของคู่นั้นเอง
 */

const BANNED = /เสีย|ห้าม|อัปมงคล/;
const plate = (tailDigits: string, frontDigit: number | null = 1, thaiLetters: [string, string] = ['ก', 'ข']): PlateInput => ({
  frontDigit,
  thaiLetters,
  tailDigits,
});
const modesOf = (input: PlateInput) => ({
  mode1: calculateMode1(input),
  mode2: calculateMode2(input.tailDigits),
  mode3: calculateMode3(input),
});
const withStrategy = (strategy: RankingStrategy, el: ReactElement) =>
  renderToStaticMarkup(createElement(RankingStrategyContext.Provider, { value: strategy }, el));

// ---------------------------------------------------------------------------------------------------------
describe('ส่วน 4: badge คู่ Tier 4 ระบุคู่จริง และ "คู่หลัก" แสดง Tier ของคู่นั้นเอง', () => {
  it('1 กข 1245: คู่ 12 = Tier 4 (24 = Tier 2, 45 = Tier 1) → badge ชี้ 12 ไม่ใช่ 45 ทั้งสองโหมด', () => {
    const m = modesOf(plate('1245'));
    expect(m.mode2.pairDetails.map((p) => `${p.pair}:${p.tier}`)).toEqual(['12:tier4', '24:tier2', '45:tier1']);
    expect(findTier4Pairs(m.mode2)).toEqual(['12']);
    const general = combineVerdictAndBadges(m.mode1, m.mode2, m.mode3).badges[0];
    expect(general).toEqual({ type: 'neutral', text: 'มีคู่เลขที่ควรพิจารณา: 12' });
    const strict = combineVerdictAndBadges(m.mode1, m.mode2, m.mode3, 'strict').badges[0];
    expect(strict).toEqual({ type: 'warning', text: 'คู่เลขที่ปรากฏ: พบคู่เสีย "12"' });
    expect(general.text).not.toContain('45');
    expect(strict.text).not.toContain('45');
  });

  it('หลายคู่ Tier 4: แสดงทุกคู่ตามลำดับที่พบ ไม่ซ้ำ ("1234" → 12, 23, 34 · "1212" → 12, 21)', () => {
    expect(pairWarningText(calculateMode2('1234'))).toBe('มีคู่เลขที่ควรพิจารณา: 12, 34');
    expect(findTier4Pairs(calculateMode2('1234'))).toEqual(['12', '34']); // 23 = Tier 2.5
    expect(pairWarningText(calculateMode2('1212'), 'strict')).toBe('พบคู่เสีย "12", "21"');
    expect(pairWarningText(calculateMode2('4559'))).toBeNull();
  });

  it('"4516": คู่หลัก 16 = Tier 2.5 (Tier ของคู่ 16 เอง) แม้ Tier รวมของเลขท้าย = Tier 1', () => {
    const m = modesOf(plate('4516'));
    expect(m.mode2.tier).toBe('tier1');
    expect(m.mode2.pairDetails.at(-1)).toMatchObject({ pair: '16', tier: 'tier2_5', isDominant: true });
    expect(dominantPairLine(m.mode2)).toBe('16 = Tier 2.5');
    const html = renderToStaticMarkup(createElement(ModeDetailPanel, { input: plate('4516'), ...m }));
    expect(html).toContain('<div class="meaning">16 = Tier 2.5</div>');
    expect(html).not.toContain('16 = Tier 1');
    // ป้าย tag ยังแสดง Tier รวม (ผลตัดสินของกล่อง Pattern ไม่เปลี่ยน)
    expect(html).toMatch(/class="tag"[^>]*>Tier 1<\/span>/);
  });

  it('คู่หลักเป็น Tier 4 → ต่อท้าย "(ไม่ดี)" · คู่หลักดีแต่มีคู่อื่น Tier 4 → ไม่ต่อท้าย ("1245": 45 = Tier 1)', () => {
    expect(dominantPairLine(calculateMode2('4512'))).toBe('12 = Tier 4 (ไม่ดี)');
    expect(dominantPairLine(calculateMode2('1245'))).toBe('45 = Tier 1');
  });
});

// ---------------------------------------------------------------------------------------------------------
describe('ส่วน 5: ผลรวมตัวอักษร+หลัก 2–63 อยู่ในกลุ่ม ดีมาก/ดี/ไม่ดี ครบ', () => {
  it('ช่วงที่เกิดได้จริงคือ 2–63 (คำนวณจากตารางค่าอักษรจริง)', () => {
    const letterValues = Object.entries(LETTER_NUMBER_TABLE)
      .filter(([, letters]) => letters.length > 0)
      .map(([value]) => Number(value));
    const minLetter = Math.min(...letterValues);
    const maxLetter = Math.max(...letterValues);
    // ต่ำสุด: อักษรค่าน้อยสุด 2 ตัว + เลขท้าย "00" (ไม่มีเลขหน้า หรือเลขหน้า 0) · สูงสุด: เลขหน้า 9 + อักษรค่ามากสุด 2 ตัว + "9999"
    expect(minLetter * 2).toBe(2);
    expect(9 + maxLetter * 2 + 36).toBe(63);
    // ยืนยันด้วย engine จริง: ป้ายต่ำสุด/สูงสุด
    const lo = LETTER_NUMBER_TABLE[String(minLetter)][0];
    const hi = LETTER_NUMBER_TABLE[String(maxLetter)][0];
    expect(calculateMode1(plate('00', null, [lo, lo])).total).toBe(2);
    expect(calculateMode1(plate('00', 0, [lo, lo])).total).toBe(2);
    expect(calculateMode1(plate('9999', 9, [hi, hi])).total).toBe(63);
  });

  it('ทุกค่า 2–63 มีกลุ่ม (ไม่มีค่าใดตกไปใช้ fallback จากตาราง Tier คู่เลข)', () => {
    const missing: number[] = [];
    const fallback: number[] = [];
    for (let total = 2; total <= 63; total++) {
      const r = getMode1TierFromTotal(total);
      if (!['excellent', 'good', 'bad'].includes(r.tier)) missing.push(total);
      if (r.usedFallback) fallback.push(total);
    }
    expect(missing).toEqual([]);
    expect(fallback).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------
describe('ส่วน 1/2/5: ตลาด "ดีมาก"+มีคู่ Tier 4 เทียบกับ ตลาด "ดี"+คู่เลขดีสุด (1 กข 01 vs 1 กข 45)', () => {
  // 1 กข 01: ผลรวม 1+1+2+0+1 = 5 ดีมาก (200) · คู่ 01 Tier 4 (0) · Reduce 2 ดี (2) = 202
  // 1 กข 45: ผลรวม 1+1+2+4+5 = 13 ดี (100) · คู่ 45 Tier 1 (50) · Reduce 1 ดี (2) = 152
  it('ข้อมูลตั้งต้นตรงตาม engine จริง', () => {
    const r = comparePlates([plate('01'), plate('45')]);
    expect(r.map((x) => [x.mode1.total, x.mode1.tier, x.mode2.tier, x.finalScore, x.hasBadPair])).toEqual([
      [5, 'excellent', 'tier4', 202, true],
      [13, 'good', 'tier1', 152, false],
    ]);
  });

  it('โหมดทั่วไป: 01 อยู่เหนือ 45 (Top N, เลขที่เล็งไว้, หน้าเปรียบเทียบ)', () => {
    const top = generateTopCandidates(1, ['ก', 'ข'], 2, false, false, 200);
    const idx = (t: string) => top.findIndex((c) => c.tailDigits === t);
    expect(idx('01')).toBeGreaterThanOrEqual(0);
    expect(idx('01')).toBeLessThan(idx('45'));
    expect(rankTargetTails(1, ['ก', 'ข'], ['45', '01']).map((x) => x.input.tailDigits)).toEqual(['01', '45']);
    expect(comparePlates([plate('01'), plate('45')]).map((x) => x.rank)).toEqual([1, 2]);
  });

  it('โหมดคัดเข้ม: กลับกัน — 45 อยู่เหนือ 01', () => {
    const top = generateTopCandidates(1, ['ก', 'ข'], 2, false, false, 200, undefined, 'strict');
    const idx = (t: string) => top.findIndex((c) => c.tailDigits === t);
    expect(idx('45')).toBeLessThan(idx('01'));
    expect(rankTargetTails(1, ['ก', 'ข'], ['01', '45'], 'strict').map((x) => x.input.tailDigits)).toEqual(['45', '01']);
    expect(comparePlates([plate('01'), plate('45')], 'strict').map((x) => x.rank)).toEqual([2, 1]);
  });

  it('โหมดทั่วไป: Top N เรียงคะแนนรวมมาก→น้อย แล้วเลขท้ายน้อย→มาก ล้วน ๆ ป้ายที่มีคู่ Tier 4 ยังอยู่ในรายการ', () => {
    for (const len of [2, 3, 4] as const) {
      const top = generateTopCandidates(1, ['ก', 'ข'], len, false, false, 200);
      for (let i = 1; i < top.length; i++) {
        const [a, b] = [top[i - 1], top[i]];
        expect(a.finalScore > b.finalScore || (a.finalScore === b.finalScore && Number(a.tailDigits) < Number(b.tailDigits))).toBe(true);
      }
      expect(top.every((c) => c.mode1.tier !== 'bad')).toBe(true);
    }
    expect(generateTopCandidates(1, ['ก', 'ข'], 2, false, false, 200).some((c) => c.hasBadPair)).toBe(true);
  });

  it('โหมดทั่วไป + เลขโปรด: เลขโปรดมาก่อนคะแนนรวมทุกป้าย (ไม่แยกกลุ่มคู่ Tier 4)', () => {
    const top = generateTopCandidates(1, ['ก', 'ข'], 2, false, false, 200, ['1', null, null, null]);
    for (let i = 1; i < top.length; i++) {
      const [a, b] = [top[i - 1], top[i]];
      expect(a.favoriteMatchScore).toBeGreaterThanOrEqual(b.favoriteMatchScore);
      if (a.favoriteMatchScore === b.favoriteMatchScore) expect(a.finalScore).toBeGreaterThanOrEqual(b.finalScore);
    }
    // มีป้ายคู่ Tier 4 ที่ขึ้นก่อนป้ายไม่มีคู่ Tier 4 เพราะเลขโปรดมากกว่า
    const firstClean = top.findIndex((c) => !c.hasBadPair);
    expect(top.slice(0, firstClean).some((c) => c.hasBadPair)).toBe(true);
  });

  it('ตลาด "ไม่ดี" ยังถูกตัดออกจาก Top N และได้ 0 + อยู่ท้ายสุดในหน้าเปรียบเทียบ ทั้งสองโหมด', () => {
    for (const s of ['market-first', 'strict'] as const) {
      expect(generateTopCandidates(1, ['ก', 'ข'], 3, false, false, 1000, undefined, s).every((c) => c.mode1.tier !== 'bad')).toBe(true);
      // 1 กข 12: ผลรวม 7 = ไม่ดี
      const r = comparePlates([plate('12'), plate('01')], s);
      expect(r[0].mode1.tier).toBe('bad');
      expect(r[0].finalScore).toBe(0);
      expect(r.map((x) => x.rank)).toEqual([2, 1]);
    }
  });

  it('สูตรคะแนนไม่เปลี่ยน: finalScore เท่ากันทุกตัวทั้งสองโหมด (เปลี่ยนแค่ลำดับ)', () => {
    const a = generateTopCandidates(1, ['ก', 'ข'], 3, false, false, 1000);
    const b = generateTopCandidates(1, ['ก', 'ข'], 3, false, false, 1000, undefined, 'strict');
    const score = (xs: typeof a) => new Map(xs.map((c) => [c.tailDigits, c.finalScore]));
    expect(score(a)).toEqual(score(b));
  });
});

// ---------------------------------------------------------------------------------------------------------
describe('ส่วน 3: คำเตือนนุ่มนวลข้อความเดียวกันทุกหน้า (โหมดทั่วไป) · ถ้อยคำเดิมในโหมดคัดเข้ม', () => {
  const base: BatchReturnState = {
    frontDigit: '1', letter1: 'ก', letter2: 'ข', excludeAuction: false, excludePopular: false,
    rowLimit: 30, favoriteDigits: ['', '', '', ''],
  };
  const targets = ['01', '1245', '45', '', '', '', '', '', '', ''];
  const panel = (strategy: RankingStrategy, layout: RankingLayout, extra: Partial<BatchReturnState>, initialExpanded: string[]) =>
    withStrategy(
      strategy,
      createElement(RankingPanel as (p: Record<string, unknown>) => ReturnType<typeof RankingPanel>, {
        restoreState: { ...base, ...extra },
        layout,
        initialExpanded,
        onViewBirthdayCompat: () => {},
      }),
    );
  // Top 30 ของ 1 กข 2 หลักมีป้ายคู่ Tier 4 ("00"/"01"…) — ขยายแถวทั้งหมดที่เป็นไปได้
  const topTails = generateTopCandidates(1, ['ก', 'ข'], 2, false, false, 30).map((c) => c.tailDigits);
  const targetKeys = targets.map((_, i) => `target-${i}`);

  const pages = (strategy: RankingStrategy) => ({
    'Top N ตาราง+แถวขยาย': panel(strategy, 'table', {}, topTails),
    'Top N แถวกะทัดรัด+ขยาย': panel(strategy, 'compact', {}, topTails),
    'เลขที่เล็งไว้ ตาราง+แถวขยาย': panel(strategy, 'table', { targetTails: targets }, targetKeys),
    'เลขที่เล็งไว้ แถวกะทัดรัด+ขยาย': panel(strategy, 'compact', { targetTails: targets }, targetKeys),
    'หน้าเปรียบเทียบ (การ์ด)': withStrategy(
      strategy,
      createElement(ComparisonResultCard, { result: comparePlates([plate('1245')], strategy)[0], label: 'ทะเบียน A', isWinner: true }),
    ),
    'หน้าเลขเดี่ยว': withStrategy(strategy, createElement(ResultCard, { result: analyzePlate(plate('1245'), { strategy }) })),
  });

  it('โหมดทั่วไป: ทุกหน้ามี "มีคู่เลขที่ควรพิจารณา:" และไม่มีคำว่า เสีย/ห้าม/อัปมงคล ในข้อความเตือน/badge/คำนำ', () => {
    for (const [name, html] of Object.entries(pages('market-first'))) {
      expect(html, name).toContain('มีคู่เลขที่ควรพิจารณา: ');
      expect(html, name).not.toContain('พบคู่เสีย');
      expect(html, name).not.toContain('ไม่มีคู่เสีย');
      expect(html, name).not.toContain('คู่เสียชนะ');
      expect(html, name).not.toContain('b-bad');
      expect(html, name).not.toContain('โหมดคัดเข้ม');
    }
  });

  it('โหมดทั่วไป: ข้อความเตือนของ 1245 เหมือนกันทุกหน้า (ข้อความเดียว "มีคู่เลขที่ควรพิจารณา: 12")', () => {
    const p = pages('market-first');
    for (const name of ['เลขที่เล็งไว้ ตาราง+แถวขยาย', 'เลขที่เล็งไว้ แถวกะทัดรัด+ขยาย', 'หน้าเปรียบเทียบ (การ์ด)', 'หน้าเลขเดี่ยว'] as const) {
      expect(p[name], name).toContain('มีคู่เลขที่ควรพิจารณา: 12');
    }
  });

  it('โหมดทั่วไป: ข้อความที่ระบบสร้างเอง (badge/คำเตือน/คำนำ) ไม่มีคำต้องห้าม — ไม่รวมคำแปลคู่เลขจากตารางต้นฉบับ', () => {
    for (const tail of ['01', '1245', '1234', '1212', '0000', '45']) {
      const m = modesOf(plate(tail));
      for (const b of combineVerdictAndBadges(m.mode1, m.mode2, m.mode3).badges) expect(b.text, tail).not.toMatch(BANNED);
      const w = pairWarningText(m.mode2);
      if (w) expect(w).not.toMatch(BANNED);
      const pairs = findTier4Pairs(m.mode2);
      if (pairs.length) expect(tier4LeadText(pairs, 'market-first')).not.toMatch(BANNED);
    }
  });

  it('โหมดคัดเข้ม: ถ้อยคำเดิม (badge แดง "พบคู่เสีย", คำนำ "คู่เสียชนะ") ระบุคู่จริง', () => {
    const p = pages('strict');
    expect(p['หน้าเลขเดี่ยว']).toContain('คู่เลขที่ปรากฏ: พบคู่เสีย &quot;12&quot;');
    expect(p['หน้าเลขเดี่ยว']).toContain('b-bad');
    expect(p['หน้าเปรียบเทียบ (การ์ด)']).toContain('· พบคู่เสีย &quot;12&quot;');
    expect(p['เลขที่เล็งไว้ ตาราง+แถวขยาย']).toContain('คู่เสียชนะ');
    expect(p['เลขที่เล็งไว้ ตาราง+แถวขยาย']).not.toContain('มีคู่เลขที่ควรพิจารณา');
  });
});

// ---------------------------------------------------------------------------------------------------------
describe('ส่วน 2: เปิด/ปิดโหมดคัดเข้มด้วยพารามิเตอร์ + localStorage (ซ่อน ไม่ใช่ความปลอดภัย)', () => {
  const memoryStorage = (initial: Record<string, string> = {}) => {
    const data = new Map(Object.entries(initial));
    return {
      data,
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    };
  };
  const throwing = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
    removeItem: () => {
      throw new Error('blocked');
    },
  };

  it('parseStrictParam: 1 = เปิด, 0 = ปิด, อื่น ๆ/ไม่มี = null', () => {
    expect(parseStrictParam('?strict=1')).toBe(true);
    expect(parseStrictParam('?a=b&strict=0')).toBe(false);
    expect(parseStrictParam('?strict=yes')).toBeNull();
    expect(parseStrictParam('')).toBeNull();
  });

  it('?strict=1 → strict และจำไว้ · ครั้งถัดไปไม่มีพารามิเตอร์ก็ยัง strict · ?strict=0 → ปิดและลบค่าที่จำ', () => {
    const st = memoryStorage();
    expect(resolveRankingStrategy('', st)).toBe('market-first');
    expect(resolveRankingStrategy('?strict=1', st)).toBe('strict');
    expect(st.data.get(STRICT_STORAGE_KEY)).toBe('strict');
    expect(resolveRankingStrategy('', st)).toBe('strict');
    expect(resolveRankingStrategy('?strict=0', st)).toBe('market-first');
    expect(st.data.has(STRICT_STORAGE_KEY)).toBe(false);
    expect(resolveRankingStrategy('', st)).toBe('market-first');
  });

  it('ค่าที่จำไว้ผิดรูปแบบ = ค่าเริ่มต้น · storage ใช้ไม่ได้ (throw/null) ไม่ throw ออกมา', () => {
    expect(resolveRankingStrategy('', memoryStorage({ [STRICT_STORAGE_KEY]: 'STRICT' }))).toBe('market-first');
    expect(resolveRankingStrategy('', throwing)).toBe('market-first');
    expect(resolveRankingStrategy('?strict=1', throwing)).toBe('strict');
    expect(resolveRankingStrategy('?strict=0', throwing)).toBe('market-first');
    expect(resolveRankingStrategy('?strict=1', null)).toBe('strict');
  });

  it('ตัด ?strict ออกจากแถบที่อยู่ โดยคงพารามิเตอร์อื่นและ hash', () => {
    expect(urlWithoutStrictParam('/', '?strict=1', '#batch')).toBe('/#batch');
    expect(urlWithoutStrictParam('/app/', '?x=1&strict=0', '#compare')).toBe('/app/?x=1#compare');
    expect(urlWithoutStrictParam('/', '?x=1', '#batch')).toBeNull();
    expect(urlWithoutStrictParam('/', '', '')).toBeNull();
  });

  it('ป้าย "โหมดคัดเข้ม" แสดงเฉพาะตอนเปิด · โหมดปกติไม่ render อะไรเลย', () => {
    expect(renderToStaticMarkup(createElement(StrictModeIndicator, { strategy: 'strict' }))).toBe(
      '<span class="strict-mode-pill">โหมดคัดเข้ม</span>',
    );
    expect(renderToStaticMarkup(createElement(StrictModeIndicator, { strategy: 'market-first' }))).toBe('');
  });

  it('หน้าปกติไม่มีปุ่ม/ลิงก์/ข้อความที่บอกว่ามีโหมดนี้ (App/main ไม่มีลิงก์ ?strict และไม่มีคำว่า คัดเข้ม นอกจากคอมเมนต์)', () => {
    const codeOnly = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    for (const src of [appSource, mainSource]) {
      expect(codeOnly(src)).not.toMatch(/strict=|คัดเข้ม/);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------
describe('โหมดคัดเข้ม: ป้ายที่มีคู่ Tier 4 แสดง verdict "ไม่ควรใช้" · โหมดทั่วไปไม่เปลี่ยน', () => {
  const base: BatchReturnState = {
    frontDigit: '1', letter1: 'ก', letter2: 'ข', excludeAuction: false, excludePopular: false,
    rowLimit: 30, favoriteDigits: ['', '', '', ''],
  };
  const targets = ['1245', '45', '', '', '', '', '', '', '', ''];
  const panel = (strategy: RankingStrategy, layout: RankingLayout) =>
    withStrategy(
      strategy,
      createElement(RankingPanel as (p: Record<string, unknown>) => ReturnType<typeof RankingPanel>, {
        restoreState: { ...base, targetTails: targets },
        layout,
        initialExpanded: ['target-0', 'target-1'],
        onViewBirthdayCompat: () => {},
      }),
    );
  const pill = (html: string) => [...html.matchAll(/aria-label="ผลประเมิน: ([^"]+)"/g)].map((m) => m[1]);
  const single = (s: RankingStrategy, tail: string) =>
    withStrategy(s, createElement(ResultCard, { result: analyzePlate(plate(tail), { strategy: s }) }));
  const card = (s: RankingStrategy, tail: string) =>
    withStrategy(
      s,
      createElement(ComparisonResultCard, { result: comparePlates([plate(tail)], s)[0], label: 'ทะเบียน A', isWinner: true }),
    );

  it('engine: 1 กข 1245 (ตลาด 16 ดี, มีคู่ 12) = ไม่ควรใช้ ในโหมดคัดเข้ม · ใช้ได้ ในโหมดทั่วไป · 45 = ใช้ได้ ทั้งสองโหมด', () => {
    const m1245 = modesOf(plate('1245'));
    const m45 = modesOf(plate('45'));
    expect(m1245.mode1.tier).toBe('good');
    expect(combineVerdictAndBadges(m1245.mode1, m1245.mode2, m1245.mode3, 'strict').verdict).toBe(false);
    expect(combineVerdictAndBadges(m1245.mode1, m1245.mode2, m1245.mode3).verdict).toBe(true);
    expect(combineVerdictAndBadges(m45.mode1, m45.mode2, m45.mode3, 'strict').verdict).toBe(true);
    expect(combineVerdictAndBadges(m45.mode1, m45.mode2, m45.mode3).verdict).toBe(true);
    expect(resolvePlateVerdict(m1245.mode1, m1245.mode2, 'strict')).toBe(false);
    expect(analyzePlate(plate('1245'), { strategy: 'strict' }).verdict).toBe(false);
    expect(analyzePlate(plate('1245')).verdict).toBe(true);
  });

  it('ตลาด "ไม่ดี" คงเดิม (ไม่ควรใช้) ทั้งสองโหมด มีหรือไม่มีคู่ Tier 4 ก็ตาม (1 กข 12 = ผลรวม 7, 1 กข 4516 = ผลรวม 20)', () => {
    for (const s of ['market-first', 'strict'] as const) {
      for (const tail of ['12', '4516']) {
        const m = modesOf(plate(tail));
        expect(m.mode1.tier).toBe('bad');
        expect(resolvePlateVerdict(m.mode1, m.mode2, s)).toBe(false);
      }
    }
  });

  it('Top N โหมดคัดเข้ม: verdict ของทุกแถว = ไม่มีคู่ Tier 4 · โหมดทั่วไป: ใช้ได้ทุกแถว (ตลาดไม่ดีถูกตัดออกแล้ว)', () => {
    const strict = generateTopCandidates(1, ['ก', 'ข'], 2, false, false, 200, undefined, 'strict');
    expect(strict.some((c) => c.hasBadPair)).toBe(true);
    for (const c of strict) expect(c.verdict).toBe(!c.hasBadPair);
    expect(generateTopCandidates(1, ['ก', 'ข'], 2, false, false, 200).every((c) => c.verdict)).toBe(true);
  });

  it('คะแนนและลำดับไม่เปลี่ยน: โหมดคัดเข้มยังเรียง 45 (152) เหนือ 1245 (102) และคะแนนเท่าเดิม', () => {
    const r = rankTargetTails(1, ['ก', 'ข'], targets, 'strict');
    expect(r.map((x) => [x.input.tailDigits, x.finalScore, x.rank])).toEqual([
      ['45', 152, 1],
      ['1245', 102, 2],
    ]);
  });

  it('ทุกหน้า โหมดคัดเข้ม: 1245 = ไม่ควรใช้, 45 = ใช้ได้ (Batch เลขที่เล็งไว้ ตาราง/แถวกะทัดรัด+แถวขยาย, หน้าเลขเดี่ยว, หน้าเปรียบเทียบ)', () => {
    // ลำดับในหน้า Batch: 45 ก่อน 1245
    expect(pill(panel('strict', 'table'))).toEqual(['ใช้ได้', 'ไม่ควรใช้']);
    expect(pill(panel('strict', 'compact'))).toEqual(['ใช้ได้', 'ไม่ควรใช้']);
    expect(single('strict', '1245')).toContain('aria-label="ผลประเมิน: ไม่ควรใช้"');
    expect(single('strict', '45')).toContain('aria-label="ผลประเมิน: ใช้ได้"');
    expect(card('strict', '1245')).toContain('<span class="verdict v-bad">✕ ไม่ควรใช้</span>');
    expect(card('strict', '45')).toContain('<span class="verdict v-good">✓ ใช้ได้</span>');
  });

  it('ทุกหน้า โหมดทั่วไป: 1245 ไม่มีคำว่า "ไม่ควรใช้" และยังมีข้อความสีกลาง "มีคู่เลขที่ควรพิจารณา: 12"', () => {
    for (const html of [panel('market-first', 'table'), panel('market-first', 'compact'), single('market-first', '1245'), card('market-first', '1245')]) {
      expect(html).not.toContain('ไม่ควรใช้');
      // ตรวจเฉพาะถ้อยคำคู่เลข — คำอธิบายกลุ่มตลาด "ดี" จากตารางต้นฉบับมีคำว่า "ไม่มีข้อเสียเด่นชัด" อยู่แล้ว (ไม่ใช่คำเตือน)
      expect(html).not.toContain('คู่เสีย');
      expect(html).toContain('มีคู่เลขที่ควรพิจารณา: 12');
    }
    expect(pill(panel('market-first', 'table'))).toEqual(['ใช้ได้', 'ใช้ได้']);
  });
});
