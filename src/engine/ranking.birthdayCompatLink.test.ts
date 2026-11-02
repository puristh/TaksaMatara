import { describe, expect, it } from 'vitest';
import { generateTopCandidates } from './ranking';
import { analyzeTaksaKalakini } from './taksaKalakini';
import { analyzeShadowPower } from './shadowPower';

/**
 * เทสต์นี้ยืนยัน "data contract" ของลิงก์ "เช็คกับวันเกิด →" ในแต่ละแถวของตาราง Top N
 * (RankingPanel.tsx) — ปุ่มนั้นเรียก onViewBirthdayCompat(c.input) โดยตรง โดย c คือ
 * RankingCandidate แต่ละตัวจาก generateTopCandidates() ตรงนี้ ดังนั้นถ้า candidate.input
 * มีรูปร่าง/ค่าตรงกับที่ BirthdayCompatPage ต้องใช้ (frontDigit, thaiLetters, tailDigits
 * ตรงกับแถวที่ผู้ใช้เห็นจริงในตาราง) ก็ยืนยันได้ว่าลิงก์จะส่งข้อมูลทะเบียนที่ถูกต้องไป
 * โดยไม่ต้องพิมพ์ซ้ำ — ไม่มี jsdom/testing-library ในโปรเจกต์นี้ให้ render+click component
 * จริงได้ จึงตรวจที่ระดับ data contract แทน (ดู featureFlags.test.ts ที่ตรวจ pattern
 * เดียวกันสำหรับฟีเจอร์ก่อนหน้านี้)
 */
describe('RankingCandidate.input — the exact object the "เช็คกับวันเกิด →" link forwards to BirthdayCompatPage', () => {
  it('every candidate.input carries the same frontDigit/thaiLetters that generateTopCandidates was called with, plus its own row tailDigits — nothing gets lost or swapped between rows', () => {
    const front = 8;
    const letters: [string, string] = ['ข', 'ค'];
    const result = generateTopCandidates(front, letters, 4, false, false, 10);

    expect(result.length).toBeGreaterThan(0);
    for (const candidate of result) {
      expect(candidate.input.frontDigit).toBe(front);
      expect(candidate.input.thaiLetters).toEqual(letters);
      expect(candidate.input.tailDigits).toBe(candidate.tailDigits);
    }
  });

  it('candidate.input is directly usable as BirthdayCompatPage\'s initialInput (Pick<PlateInput, "frontDigit"|"thaiLetters"|"tailDigits">) without any transformation — feeding it straight into analyzeTaksaKalakini/analyzeShadowPower works exactly as it would from a manually-typed plate', () => {
    const result = generateTopCandidates(8, ['ข', 'ค'], 3, false, false, 5);
    expect(result.length).toBeGreaterThan(0);

    for (const candidate of result) {
      // simulate what BirthdayCompatPage does once initialInput seeds its form state and
      // the user picks a taksaDay — candidate.input must work as-is, no mapping needed
      expect(() => analyzeTaksaKalakini(candidate.input, 'วันพฤหัสบดี')).not.toThrow();
      expect(() => analyzeShadowPower(candidate.input, 'วันพฤหัสบดี')).not.toThrow();
    }
  });

  it('different rows in the same table carry distinct tailDigits in their forwarded input — clicking row N never accidentally sends row M\'s plate', () => {
    const result = generateTopCandidates(8, ['ข', 'ค'], 4, false, false, 10);
    const tailDigitsPerRow = result.map((c) => c.input.tailDigits);
    const uniqueTailDigits = new Set(tailDigitsPerRow);
    expect(uniqueTailDigits.size).toBe(tailDigitsPerRow.length);
  });
});
