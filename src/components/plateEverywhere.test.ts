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
    expect(html).toContain('target-results-list');
    expectPlateCards(html, 3);
    expect(html).toContain('● เลขประมูล');
  });

  it('Batch ตาราง ranking: แถวยังเป็นข้อความ (ภาพย่อทำให้ตารางเลื่อนแนวนอนมากขึ้น) — ภาพเต็มอยู่ในแถวที่กดดูรายละเอียด', () => {
    const restoreState: BatchReturnState = {
      frontDigit: '1', letter1: 'ก', letter2: 'ข', excludeAuction: false, excludePopular: false, rowLimit: 10, favoriteDigits: ['', '', ''],
    };
    const html = renderToStaticMarkup(createElement(RankingPanel as (p: { restoreState?: BatchReturnState }) => ReturnType<typeof RankingPanel>, { restoreState }));
    expect(count(html, /<td class="plate-cell">[^<]+<\/td>/g)).toBe(10);
    expect(count(html, /<svg class="plate-image /g)).toBe(0);
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
