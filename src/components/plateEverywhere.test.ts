import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { analyzePlate, comparePlates } from '../engine';
import type { PlateInput } from '../engine';
import { ResultCard } from './ResultCard';
import { ComparisonResultCard } from './ComparisonResultCard';
import { RankingPanel } from './RankingPanel';
import type { BatchReturnState } from './RankingPanel';
import { BirthdayPlateCard } from './BirthdayCompatPage';
import birthdaySource from './BirthdayCompatPage.tsx?raw';
import rankingSource from './RankingPanel.tsx?raw';

// ทุกที่ที่แสดงการ์ดของทะเบียนหนึ่งเลขต้องมีภาพป้าย (PlateImage) + ปุ่มคัดลอก + "ภาพจำลอง ไม่ใช่ป้ายจริง"
// และไม่มีชิปเลขทะเบียนแบบเก่า (div.plate) — แท็กเลขประมูล/เลขสวยต้องยังอยู่ (ข้อมูลในชิปห้ามหาย)
const AUCTION: PlateInput = { frontDigit: 9, thaiLetters: ['ก', 'บ'], tailDigits: '9999' };
const POPULAR: PlateInput = { frontDigit: 2, thaiLetters: ['ก', 'บ'], tailDigits: '2295' };

function count(html: string, re: RegExp): number {
  return (html.match(re) ?? []).length;
}
function expectPlateCards(html: string, n: number) {
  expect(count(html, /<svg class="plate-image /g)).toBe(n);
  expect(count(html, /class="plate-copy-btn"/g)).toBe(n);
  expect(count(html, /ภาพจำลอง ไม่ใช่ป้ายจริง/g)).toBe(n);
  expect(html).not.toMatch(/class="plate"/); // ชิปเก่า
}

describe('ภาพป้ายทุกที่ที่เป็นการ์ดของทะเบียน', () => {
  it('การ์ดเลขเดี่ยว (#single): ภาพป้าย + แท็กเลขประมูล', () => {
    const html = renderToStaticMarkup(createElement(ResultCard, { result: analyzePlate(AUCTION) }));
    expectPlateCards(html, 1);
    expect(html).toContain('aria-label="ภาพจำลองป้ายทะเบียน 9 กบ 9999 กรุงเทพมหานคร (ลายป้ายประมูล)"');
    expect(html).toContain('● เลขประมูล');
  });

  it('การ์ดหน้าเปรียบเทียบ: ภาพป้ายทุกใบ + แท็กเลขประมูล/เลขสวยแบบเดียวกับ #single', () => {
    const results = comparePlates([AUCTION, POPULAR]);
    const html = results.map((r, i) => renderToStaticMarkup(createElement(ComparisonResultCard, { result: r, label: `ทะเบียน ${i}`, isWinner: false }))).join('');
    expectPlateCards(html, 2);
    expect(html).toContain('● เลขประมูล');
    expect(html).toContain('เลขสวย ★');
    // แท็กตรงกับการ์ดเลขเดี่ยวของเลขเดียวกัน
    const single = renderToStaticMarkup(createElement(ResultCard, { result: analyzePlate(POPULAR) }));
    expect(html).toContain(single.match(/<span class="popular-tag">[^<]*<\/span>/)![0]);
  });

  it('Batch โหมด "เลขที่เล็งไว้": การ์ดทุกช่องมีภาพป้าย ไม่มีชิปเก่า', () => {
    const restoreState: BatchReturnState = {
      frontDigit: '9', letter1: 'ก', letter2: 'บ', excludeAuction: false, excludePopular: false, rowLimit: 10,
      favoriteDigits: ['', '', ''], targetTails: ['9999', '2295', '1234', '', '', '', '', '', '', ''],
    };
    const html = renderToStaticMarkup(createElement(RankingPanel as (p: { restoreState?: BatchReturnState }) => ReturnType<typeof RankingPanel>, { restoreState }));
    // เดิม: การ์ดเต็มทุกช่อง (expectPlateCards 3 ใบ + แท็กเลขประมูล) — batch-emphasis รอบ 2: แถวกะทัดรัด ป้ายเล็กทุกช่อง
    // ป้ายใหญ่ + ปุ่มคัดลอก + "ภาพจำลอง…" + แท็กอยู่ในส่วนที่ขยาย (เปิดไว้ทุกช่องแล้วต้องครบเหมือนเดิม)
    expect(html).toContain('target-results-list');
    expect(count(html, /<svg class="plate-image /g)).toBe(3);
    expect(count(html, /plate-figure--compact/g)).toBe(3);
    expect(html).not.toMatch(/class="plate"/);
    const open = renderToStaticMarkup(
      createElement(RankingPanel as (p: { restoreState?: BatchReturnState; initialExpanded?: string[] }) => ReturnType<typeof RankingPanel>, {
        restoreState,
        initialExpanded: ['target-0', 'target-1', 'target-2'],
      }),
    );
    expect(count(open, /<svg class="plate-image /g)).toBe(6); // ป้ายเล็ก 3 + ป้ายใหญ่ 3
    expect(count(open, /class="plate-copy-btn"/g)).toBe(3);
    expect(count(open, /ภาพจำลอง ไม่ใช่ป้ายจริง<\/span>/g)).toBe(3);
    expect(open).toContain('● เลขประมูล');
  });

  // เดิม: แถวยังเป็นข้อความ ไม่มีภาพป้าย (ภาพย่อ 120px ทำให้ตารางเลื่อนแนวนอนมากขึ้น) — ผู้ใช้สั่งให้แสดงภาพป้ายในตาราง:
  // จอกว้างเป็นภาพย่อ + ข้อความ sr-only, จอแคบเป็นการ์ด (ตรวจละเอียดใน RankingPanel.test.ts)
  it('Batch ตาราง ranking: ทุกแถวมีภาพป้ายย่อ + ข้อความเลขทะเบียน sr-only — ภาพเต็มอยู่ในแถวที่กดดูรายละเอียด', () => {
    const restoreState: BatchReturnState = {
      frontDigit: '1', letter1: 'ก', letter2: 'ข', excludeAuction: false, excludePopular: false, rowLimit: 10, favoriteDigits: ['', '', ''],
    };
    const html = renderToStaticMarkup(createElement(RankingPanel as (p: { restoreState?: BatchReturnState }) => ReturnType<typeof RankingPanel>, { restoreState }));
    // เดิม: <td class="plate-cell"><figure class="plate-figure plate-figure--compact" — ป้ายเล็กเป็นปุ่มขยาย (batch-emphasis รอบ 2)
    expect(count(html, /<td class="plate-cell"><button type="button" class="plate-toggle"[^>]*><span class="plate-figure plate-figure--compact"/g)).toBe(10);
    expect(count(html, /<svg class="plate-image /g)).toBe(10);
    expect(count(html, /<span class="sr-only">1 กข \d+<\/span>/g)).toBe(10);
    const detailRow = rankingSource.slice(rankingSource.indexOf('ranking-detail-row'));
    expect(detailRow).toMatch(/<PlateImage[\s\S]*?className="ranking-detail-plate"/);
  });

  it('หน้าเช็ควันเกิด: ผลมีการ์ดภาพป้าย + แท็ก', () => {
    const html = renderToStaticMarkup(createElement(BirthdayPlateCard, { input: { frontDigit: 1, thaiLetters: ['ก', 'ข'], tailDigits: '8888' } }));
    expectPlateCards(html, 1);
    expect(html).toContain('● เลขประมูล');
    // การ์ดนี้อยู่ในส่วนผลลัพธ์ (หลังตรวจว่ากรอกครบ) ก่อนการ์ด Mode 6/7
    const results = birthdaySource.slice(birthdaySource.indexOf('{!canCompute ? ('));
    expect(results.indexOf('<BirthdayPlateCard')).toBeGreaterThan(0);
    expect(results.indexOf('<BirthdayPlateCard')).toBeLessThan(results.indexOf('Mode 6 · ทักษาปกรณ์'));
  });
});
