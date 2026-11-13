import { createElement, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CompactRankRow, ExpandButton, PlateToggleButton, plateToggleLabel } from './CompactRankRow';
import { RankingPanel, rankTargetTails, toggleExpandedKey } from './RankingPanel';
import type { BatchReturnState, RankingLayout } from './RankingPanel';
import { generateTopCandidates } from '../engine/ranking';
import { formatPlateText } from '../engine/plateText';
import { rankTier } from './RankEmphasis';

/**
 * Batch: กดป้ายเล็กหรือ "ดูรายละเอียด" เพื่อขยาย/ยุบ (ตาราง, แถวกะทัดรัด, โหมดเลขที่เล็งไว้)
 * ไม่มี DOM ในเทสต์ (ห้ามเพิ่ม dependency) จึงตรวจ 3 ชั้น:
 * 1) ตัวจัดการกด: onClick ของปุ่มป้ายเล็กและปุ่ม "ดูรายละเอียด" เรียก onToggle ตัวเดียวกัน (เรียกฟังก์ชันจริงจาก element tree)
 * 2) สถานะ: toggleExpandedKey เปิด/ปิดทีละแถว เปิดหลายแถวพร้อมกันได้
 * 3) ผลที่แสดง: RankingPanel ตอนเปิด/ปิด (initialExpanded) — aria-expanded, aria-controls ชี้ id ที่มีจริง, เนื้อหาส่วนที่ขยาย
 */
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;
type Panel = (p: {
  restoreState?: BatchReturnState;
  layout?: RankingLayout;
  initialExpanded?: string[];
  onViewBirthdayCompat?: () => void;
}) => ReturnType<typeof RankingPanel>;
const state = (extra: Partial<BatchReturnState> = {}): BatchReturnState => ({
  frontDigit: '1', letter1: 'ก', letter2: 'ข', excludeAuction: false, excludePopular: false, rowLimit: 10, favoriteDigits: ['', '', '', ''], ...extra,
});
const render = (layout: RankingLayout, initialExpanded: string[] = [], extra: Partial<BatchReturnState> = {}) =>
  renderToStaticMarkup(
    createElement(RankingPanel as Panel, {
      restoreState: state(extra),
      layout,
      initialExpanded,
    }),
  );
const cands = generateTopCandidates(1, ['ก', 'ข'], 2, false, false, 10, [null, null, null, null]);
const input = { frontDigit: 1, thaiLetters: ['ก', 'ข'] as [string, string], tailDigits: '55' };

/** หา element ทั้งหมดใน tree (ไม่ render component ลูก) */
function findAll(node: ReactNode, pred: (el: ReactElement) => boolean, out: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(node)) node.forEach((n) => findAll(n, pred, out));
  else if (isValidElement(node)) {
    if (pred(node)) out.push(node);
    findAll((node.props as { children?: ReactNode }).children, pred, out);
  }
  return out;
}

describe('ตัวจัดการกด: ป้ายเล็กและ "ดูรายละเอียด" toggle ส่วนเดียวกัน', () => {
  it('PlateToggleButton = <button> ที่ onClick เรียก onToggle · aria-expanded / aria-controls / aria-label', () => {
    for (const expanded of [false, true]) {
      const onToggle = vi.fn();
      const el = PlateToggleButton({ input, widthPx: 150, expanded, controls: 'd-55', onToggle });
      expect(el.type).toBe('button');
      expect(el.props).toMatchObject({ type: 'button', 'aria-expanded': expanded, 'aria-controls': 'd-55', 'aria-label': 'ดูรายละเอียดเลข 1 กข 55' });
      el.props.onClick();
      expect(onToggle).toHaveBeenCalledTimes(1);
    }
    expect(plateToggleLabel(input)).toBe('ดูรายละเอียดเลข 1 กข 55');
  });
  it('ExpandButton ("ดูรายละเอียด") onClick เรียก onToggle · aria-expanded / aria-controls', () => {
    const onToggle = vi.fn();
    const el = ExpandButton({ expanded: true, controls: 'd-55', onToggle });
    expect(el.props).toMatchObject({ 'aria-expanded': true, 'aria-controls': 'd-55' });
    expect(el.props.className).toBe('ranking-expand-btn open');
    el.props.onClick();
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
  it('CompactRankRow: ป้ายเล็กและ "ดูรายละเอียด" ได้ onToggle ตัวเดียวกันและชี้ส่วนขยายเดียวกัน', () => {
    const onToggle = vi.fn();
    const tree = CompactRankRow({ rank: 4, input, plateWidth: 150, verdict: true, score: 241, expanded: false, detailId: 'd-55', onToggle, children: 'x' });
    const [plate] = findAll(tree, (e) => e.type === PlateToggleButton);
    const [btn] = findAll(tree, (e) => e.type === ExpandButton);
    expect(plate.props.onToggle).toBe(onToggle);
    expect(btn.props.onToggle).toBe(onToggle);
    expect(plate.props.controls).toBe('d-55');
    expect(btn.props.controls).toBe('d-55');
    const [detail] = findAll(tree, (e) => e.props && (e.props as { id?: string }).id === 'd-55');
    expect(detail.props).toMatchObject({ className: 'rank-row-detail', hidden: true });
    expect(detail.props.children).toBe(false); // ยุบ = ไม่ render เนื้อหา (ป้ายใหญ่วาดเฉพาะตอนขยาย)
    plate.props.onToggle();
    btn.props.onToggle();
    expect(onToggle).toHaveBeenCalledTimes(2);
  });
});

describe('สถานะ: toggleExpandedKey', () => {
  it('กดครั้งแรกเปิด กดซ้ำปิด · เปิดหลายแถวพร้อมกันได้ (ไม่ใช่ accordion เดี่ยว) · ไม่แก้ set เดิม', () => {
    const s0 = new Set<string>();
    const s1 = toggleExpandedKey(s0, '55');
    const s2 = toggleExpandedKey(s1, '14');
    expect([...s2].sort()).toEqual(['14', '55']);
    const s3 = toggleExpandedKey(s2, '55');
    expect([...s3]).toEqual(['14']);
    expect(s0.size).toBe(0);
    expect([...s1]).toEqual(['55']);
  });
});

/** aria-controls ทุกตัวต้องชี้ id ที่มีอยู่ใน markup */
function expectControlsResolve(html: string) {
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const controls = [...html.matchAll(/aria-controls="([^"]+)"/g)].map((m) => m[1]);
  expect(controls.length).toBeGreaterThan(0);
  for (const c of controls) expect(ids.has(c), c).toBe(true);
}
/** ลำดับ aria-expanded ของปุ่มป้ายเล็กทุกแถว */
const plateExpanded = (html: string) => [...html.matchAll(/class="plate-toggle" aria-expanded="(true|false)"/g)].map((m) => m[1] === 'true');
const textExpanded = (html: string) => [...html.matchAll(/class="ranking-expand-btn( open)?" aria-expanded="(true|false)"/g)].map((m) => [!!m[1], m[2] === 'true']);

describe('ผลที่แสดง: แถวกะทัดรัด (จอแคบ)', () => {
  it('ยุบทั้งหมด: aria-expanded=false ทั้งป้ายเล็กและปุ่ม ส่วนขยายซ่อนและว่าง', () => {
    const html = render('compact');
    expect(plateExpanded(html)).toEqual(cands.map(() => false));
    expect(textExpanded(html)).toEqual(cands.map(() => [false, false]));
    expect(count(html, /class="rank-row-detail" hidden="">\s*<\/div>/g)).toBe(cands.length);
    expectControlsResolve(html);
  });
  it('ขยาย 2 แถว (อันดับ 1 และ 4): aria-expanded=true เฉพาะสองแถวนั้น + ป้ายใหญ่ ปุ่มคัดลอก "ภาพจำลอง…" badge ป้ายพิเศษ ลิงก์การคำนวณ เช็ควันเกิด', () => {
    const keys = [cands[0].tailDigits, cands[3].tailDigits];
    const html = renderToStaticMarkup(
      createElement(RankingPanel as Panel, {
        restoreState: state(),
        layout: 'compact',
        initialExpanded: keys,
        onViewBirthdayCompat: () => {},
      }),
    );
    const open = cands.map((c) => keys.includes(c.tailDigits));
    expect(plateExpanded(html)).toEqual(open);
    expect(textExpanded(html)).toEqual(open.map((o) => [o, o]));
    expect(count(html, /class="rank-row rank-row--[a-z]+ is-open"/g)).toBe(2);
    expect(count(html, /class="rank-row-detail" hidden=""/g)).toBe(cands.length - 2);
    expect(count(html, /class="plate-copy-btn"/g)).toBe(2);
    expect(count(html, /<span class="plate-figure__note">ภาพจำลอง ไม่ใช่ป้ายจริง<\/span>/g)).toBe(2);
    expect(count(html, /<svg class="plate-image /g)).toBe(cands.length + 2);
    expect(count(html, /class="badges-cell"/g)).toBe(2);
    // เดิม: นับ <summary>ดูรายละเอียดการคำนวณ</summary> = 2 — ผู้ใช้สั่งให้จอแคบเปิดกล่องวิเคราะห์ 3 กล่องไว้เลย (ไม่พับ)
    // จึงต้องไม่มี summary นี้ และนับกล่อง 3 Mode ที่เปิดอยู่แทน
    expect(html).not.toContain('ดูรายละเอียดการคำนวณ');
    expect(html).not.toContain('<details');
    expect(count(html, /class="detail-grid"/g)).toBe(2);
    expect(count(html, /class="detail-box"/g)).toBe(6);
    expect(count(html, /เช็คกับวันเกิด →/g)).toBe(2);
    const opened = [cands[0], cands[3]];
    expect(count(html, /class="auction-tag"/g)).toBe(opened.filter((c) => c.auction.isAuction).length);
    for (const c of opened) expect(html).toContain(`aria-label="คัดลอกเลขทะเบียน ${formatPlateText(c.input)}"`);
    expectControlsResolve(html);
  });
});

describe('ผลที่แสดง: ตาราง (จอกว้าง) — ตารางเดิม + กดป้ายเล็กเพื่อขยาย', () => {
  it('ยุบ: แถวรายละเอียดมีอยู่แต่ซ่อน (ให้ aria-controls ชี้ได้) ไม่มีเนื้อหา', () => {
    const html = render('table');
    expect(plateExpanded(html)).toEqual(cands.map(() => false));
    expect(count(html, /<tr id="[^"]+" class="ranking-detail-row" hidden=""><td colSpan="7"><\/td><\/tr>/gi)).toBe(cands.length);
    expectControlsResolve(html);
  });
  it('ขยายหลายแถว: ป้ายเล็กและปุ่ม aria-expanded=true + ป้ายใหญ่และ 3 Mode ในแถวรายละเอียด', () => {
    const keys = [cands[1].tailDigits, cands[2].tailDigits, cands[9].tailDigits];
    const html = render('table', keys);
    const open = cands.map((c) => keys.includes(c.tailDigits));
    expect(plateExpanded(html)).toEqual(open);
    expect(textExpanded(html)).toEqual(open.map((o) => [o, o]));
    expect(count(html, /class="ranking-detail-row" hidden=""/g)).toBe(cands.length - 3);
    expect(count(html, /ranking-detail-plate/g)).toBe(3);
    expect(count(html, /class="plate-copy-btn"/g)).toBe(3);
    expect(count(html, /detail-grid detail-grid--with-leading/g)).toBe(3);
    expectControlsResolve(html);
  });
});

describe('ผลที่แสดง: โหมด "เลขที่เล็งไว้"', () => {
  const tails = ['1234', '9999', '12', '15', '5555', '', '', '', '', ''];
  const ranked = rankTargetTails(1, ['ก', 'ข'], tails);
  // เดิม: render('table') ของโหมดนี้ต้องไม่มี <table (แถวกะทัดรัดทุกความกว้างจอ) — batch-target-unify: ผู้ใช้สั่งให้โหมดนี้ใช้
  // ตารางเดียวกับโหมดปกติเมื่อจอกว้าง จึงตรวจทั้งสองรูปแบบ: ตาราง (จอกว้าง) และแถวกะทัดรัด (จอแคบ)
  it('จอกว้างเป็นตารางเดียวกับโหมดปกติ / จอแคบเป็นแถวกะทัดรัด: ป้ายเล็ก (ปุ่ม) + อันดับ medal ตาม rank · ยุบอยู่ไม่มีการ์ดเต็ม', () => {
    const table = render('table', [], { targetTails: tails });
    expect(table).toContain('<table class="ranking-table">');
    expect(plateExpanded(table)).toEqual(ranked.map(() => false));
    expect([...table.matchAll(/<tr data-ranking-row="" class="ranking-row--([a-z]+)"/g)].map((m) => m[1])).toEqual(
      ranked.map((r) => rankTier(r.rank)),
    );
    expect(table).not.toContain('detail-grid');
    expectControlsResolve(table);
    const html = render('compact', [], { targetTails: tails });
    expect(html).not.toContain('<table');
    expect(plateExpanded(html)).toEqual(ranked.map(() => false));
    const toggles = [...html.matchAll(/aria-label="ดูรายละเอียดเลข ([^"]+)"/g)].map((m) => m[1]);
    expect(toggles).toEqual(ranked.map((r) => formatPlateText(r.input)));
    const tiers = [...html.matchAll(/<li class="rank-row rank-row--([a-z]+)/g)].map((m) => m[1]);
    expect(tiers).toEqual(ranked.map((r) => rankTier(r.rank)));
    expect(html).not.toContain('detail-grid');
    expectControlsResolve(html);
  });
  // ชื่อเดิม "(3 Mode + ข้อมูลประกอบ)" — batch-target-unify: ส่วนที่ขยายเหมือนโหมดปกติ จึงไม่มีบล็อก "ข้อมูลประกอบ" (อายตนะ6/ธาตุจีน) แยกแล้ว
  // (อายตนะ6 ยังอยู่ในแถว ayatana6-preview-row ของ ModeDetailPanel และลิงก์ธาตุจีนเหมือนโหมดปกติ) — expectation เดิมไม่เปลี่ยน
  it('ขยายช่องที่ 2 และ 4: ป้ายใหญ่ + คัดลอก + ลิงก์การคำนวณ (3 Mode)', () => {
    const html = render('compact', ['target-1', 'target-3'], { targetTails: tails });
    expect(plateExpanded(html)).toEqual(ranked.map((r) => r.slotIndex === 1 || r.slotIndex === 3));
    expect(count(html, /class="plate-copy-btn"/g)).toBe(2);
    // เดิม: นับ <summary>ดูรายละเอียดการคำนวณ</summary> = 2 — จอแคบเปิด 3 กล่องไว้เลยแล้ว (ทั้งสองโหมด) จึงต้องไม่มี summary
    expect(html).not.toContain('ดูรายละเอียดการคำนวณ');
    expect(count(html, /class="detail-grid"/g)).toBe(2);
    expect(count(html, /class="detail-box"/g)).toBe(6);
    expectControlsResolve(html);
  });
});

describe('อันดับ 1–3 และ 4+ ในแถวกะทัดรัด', () => {
  it('ป้ายอันดับ medal 1/2/3 · 4+ เทาเข้ม · คะแนนอันดับ 1 ตัวใหญ่สุด', () => {
    const html = render('compact');
    expect([...html.matchAll(/<li class="rank-row rank-row--([a-z]+)"/g)].map((m) => m[1])).toEqual(
      ['gold', 'silver', 'bronze', ...Array(cands.length - 3).fill('plain')],
    );
    expect([...html.matchAll(/class="rank-badge rank-badge--([a-z]+)" role="img" aria-label="อันดับที่ (\d+)"/g)].map((m) => `${m[2]}:${m[1]}`)).toEqual(
      cands.map((_, i) => `${i + 1}:${rankTier(i + 1)}`),
    );
    expect(count(html, /score-figure--top/g)).toBe(1);
  });
});
