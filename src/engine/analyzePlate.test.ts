import { describe, expect, it } from 'vitest';
import { analyzePlate } from './analyzePlate';

describe('analyzePlate — brief section 10, cases 1, 3, 4 (match the brief exactly)', () => {
  it('case 1: "1 กข 59" -> verdict ใช้ได้, badges [positive, positive]', () => {
    const result = analyzePlate({ frontDigit: 1, thaiLetters: ['ก', 'ข'], tailDigits: '59' });
    expect(result.mode1.total).toBe(18);
    expect(result.verdict).toBe(true);
    expect(result.badges).toEqual([
      { type: 'positive', text: 'คู่เลขที่ปรากฏ: ไม่มีคู่เสีย' },
      { type: 'positive', text: 'ผลรวมตัวเลข: ดี (เลข 6)' },
    ]);
    expect(result.hiddenByDefault).toBe(false);
  });

  it('case 3: "3 ขค 813" -> verdict ไม่ควรใช้, badges [warning "13", positive]', () => {
    const result = analyzePlate({ frontDigit: 3, thaiLetters: ['ข', 'ค'], tailDigits: '813' });
    expect(result.mode1.total).toBe(21);
    expect(result.verdict).toBe(false);
    expect(result.badges).toEqual([
      { type: 'warning', text: 'คู่เลขที่ปรากฏ: พบคู่เสีย "13"' },
      { type: 'positive', text: 'ผลรวมตัวเลข: ดี (เลข 6)' },
    ]);
  });

  it('case 4: "5 ขค 555" -> auction number (เลขตอง) but Mode2 is not bad -> shows normally, no toggle needed', () => {
    const result = analyzePlate({ frontDigit: 5, thaiLetters: ['ข', 'ค'], tailDigits: '555' });
    expect(result.auction.isAuction).toBe(true);
    expect(result.auction.categories).toContain('เลขตอง');
    expect(result.mode2.tier).toBe('tier1');
    expect(result.verdict).toBe(true);
    expect(result.hiddenByDefault).toBe(false);
    expect(result.badges).toEqual([
      { type: 'positive', text: 'คู่เลขที่ปรากฏ: ไม่มีคู่เสีย' },
      { type: 'positive', text: 'ผลรวมตัวเลข: ดี (เลข 2)' },
    ]);
  });
});

describe('analyzePlate — documented discrepancies vs. brief section 10', () => {
  // See detailed reasoning in mode1.test.ts. Both source docs claim total=6; the
  // algorithm + lookup tables (the canonical source) produce 7, which is "bad".
  it('case 2 (corrected): "2 กก 21" -> total 7 -> verdict ไม่ควรใช้ (brief incorrectly says total=6, ใช้ได้)', () => {
    const result = analyzePlate({ frontDigit: 2, thaiLetters: ['ก', 'ก'], tailDigits: '21' });
    expect(result.mode1.total).toBe(7);
    expect(result.verdict).toBe(false);
    expect(result.badges).toEqual([
      { type: 'warning', text: 'คู่เลขที่ปรากฏ: พบคู่เสีย "21"' },
      { type: 'positive', text: 'ผลรวมตัวเลข: ดี (เลข 5)' },
    ]);
  });

  // See detailed reasoning in auctionNumber.test.ts / popularNumber.test.ts. "020" is
  // not a whole-tail auction pattern (not tong, not an ascending run) and its pairs
  // "02"/"20" aren't in the popular-pairs seed list either, so both isAuction=false
  // and isPopular=false here, and the auction-hide mechanism never engages for this
  // plate. Separately, Mode 1's own total (12) is "bad" per the brief's own table, so
  // the verdict is "ไม่ควรใช้" regardless — the mockup's card 5 shows a green "ใช้ได้"
  // pill, which also contradicts the brief's own consensus table for this plate.
  it('case 5 (corrected): "2 งจ 020" -> not an auction number under exact-pattern matching, Mode1 total=12 is bad -> verdict ไม่ควรใช้, shown normally (not hidden) with a Mode2 warning badge', () => {
    const result = analyzePlate({ frontDigit: 2, thaiLetters: ['ง', 'จ'], tailDigits: '020' });
    expect(result.mode1.total).toBe(12);
    expect(result.verdict).toBe(false);
    expect(result.auction.isAuction).toBe(false);
    expect(result.mode2.tier).toBe('tier4');
    expect(result.hiddenByDefault).toBe(false);
    expect(result.badges[0]).toEqual({ type: 'warning', text: 'คู่เลขที่ปรากฏ: พบคู่เสีย "20"' });
  });
});

describe('analyzePlate — auction conflict resolution (section 6), using a plate that genuinely triggers it', () => {
  // "1 กข 111": auction number via เลขตอง (111), and Mode2 pair "11" is tier4 (bad).
  // This is a real auction/tier4 collision, unlike brief case 5 which doesn't actually
  // trigger the auction rules under exact-pattern matching (see above).
  const input = { frontDigit: 1 as const, thaiLetters: ['ก', 'ข'] as [string, string], tailDigits: '111' };

  it('default (showAllAuction=false): hidden from the main list, verdict still computed from Mode 1', () => {
    const result = analyzePlate(input);
    expect(result.auction.isAuction).toBe(true);
    expect(result.mode2.tier).toBe('tier4');
    expect(result.hiddenByDefault).toBe(true);
    expect(result.verdict).toBe(false); // mode1 total = 7 -> bad, unaffected by the auction toggle
  });

  it('showAllAuction=true: not hidden, gets an extra red WARNING badge, verdict unchanged', () => {
    const result = analyzePlate(input, { showAllAuction: true });
    expect(result.hiddenByDefault).toBe(false);
    expect(result.verdict).toBe(false);
    expect(result.badges.at(-1)).toEqual({
      type: 'warning',
      text: 'WARNING: เลขประมูลติดกลุ่มเลขเสีย',
    });
  });
});
