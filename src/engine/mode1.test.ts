import { describe, expect, it } from 'vitest';
import { calculateMode1, getMode1Explanation, getMode1TierFromTotal } from './mode1';

describe('calculateMode1 — brief section 10 worked examples', () => {
  it('1 กข 59 -> total 18 -> good -> verdict ใช้ได้ (matches brief exactly)', () => {
    const result = calculateMode1({ frontDigit: 1, thaiLetters: ['ก', 'ข'], tailDigits: '59' });
    expect(result.total).toBe(18);
    expect(result.tier).toBe('good');
    expect(result.verdict).toBe(true);
  });

  it('3 ขค 813 -> total 21 -> bad -> verdict ไม่ควรใช้ (matches brief exactly)', () => {
    const result = calculateMode1({ frontDigit: 3, thaiLetters: ['ข', 'ค'], tailDigits: '813' });
    expect(result.total).toBe(21);
    expect(result.tier).toBe('bad');
    expect(result.verdict).toBe(false);
  });

  // NOTE (discrepancy vs. brief section 10, case 2 / mockup card 2):
  // The brief claims "2 กก 21" totals 6. Recomputing the algorithm literally:
  // frontDigit(2) + letterVal('ก'=1) + letterVal('ก'=1) + tailDigitSum('2'+'1'=3) = 7, not 6.
  // Both source docs (IMPLEMENTATION_BRIEF.md section 10 AND the mockup's card-2 detail
  // box ".calc" text) repeat this same arithmetic error, so it isn't a one-off typo.
  // The lookup tables (section 3) and the step-by-step algorithm (section 4) are the
  // canonical, unambiguous source of truth, so this test asserts the mathematically
  // correct value (7 -> bad -> verdict ไม่ควรใช้) rather than the brief's example output.
  it('2 กก 21 -> total 7 (not 6 as brief states) -> bad -> verdict ไม่ควรใช้', () => {
    const result = calculateMode1({ frontDigit: 2, thaiLetters: ['ก', 'ก'], tailDigits: '21' });
    expect(result.total).toBe(7);
    expect(result.tier).toBe('bad');
    expect(result.verdict).toBe(false);
  });

  it('เลขหน้า = 0 ยังคำนวณได้ปกติ (edge case)', () => {
    // 0 + ก(1) + ข(2) + 5 + 9 = 17 -> bad list
    const result = calculateMode1({ frontDigit: 0, thaiLetters: ['ก', 'ข'], tailDigits: '59' });
    expect(result.total).toBe(17);
    expect(result.tier).toBe('bad');
    expect(result.verdict).toBe(false);
  });
});

describe('getMode1TierFromTotal — boundary between consensus table (<=65) and fallback (66-99)', () => {
  it('total = 65 (last value inside the consensus table) -> excellent, no fallback', () => {
    const result = getMode1TierFromTotal(65);
    expect(result.tier).toBe('excellent');
    expect(result.usedFallback).toBe(false);
  });

  it('total = 66 (first value past the consensus table) -> falls back to tier table 3.2 (tier3="medium" -> good)', () => {
    const result = getMode1TierFromTotal(66);
    expect(result.usedFallback).toBe(true);
    expect(result.tier).toBe('good');
  });

  it('total = 67 falls back and lands in tier4 -> bad', () => {
    const result = getMode1TierFromTotal(67);
    expect(result.usedFallback).toBe(true);
    expect(result.tier).toBe('bad');
  });

  // UPDATED (cross-reference research round 2, berded.in.th verified 2-3x per number):
  // 57 used to be an unlisted gap that fell back to the Mode 2 tier table for its
  // classification (still landing on "bad" via tier4_explicit, but via fallback). It's
  // now explicitly in MODE1_BAD, so usedFallback flips to false — same tier, more
  // direct/authoritative source.
  it('total = 57 is now explicitly in MODE1_BAD (no longer a gap) -> bad, no fallback needed', () => {
    const result = getMode1TierFromTotal(57);
    expect(result.usedFallback).toBe(false);
    expect(result.tier).toBe('bad');
  });

  // UPDATED (cross-reference research round 2): 10 was previously misclassified as
  // "good" — moved to MODE1_BAD. It's still a zero-rule number either way, but now the
  // explicit list and the zero-rule agree (previously the explicit "good" entry won
  // over the zero-rule; now there's no more conflict to resolve for 10 specifically).
  it('multiples of 10 within 1-65 are bad via bad_rule / explicit list (10, 20, 30 all bad)', () => {
    expect(getMode1TierFromTotal(10).tier).toBe('bad');
    expect(getMode1TierFromTotal(20).tier).toBe('bad');
    expect(getMode1TierFromTotal(30).tier).toBe('bad');
  });
});

describe('getMode1TierFromTotal — Consensus table fixes from cross-reference research round 2 (berded.in.th verified 2-3x per number)', () => {
  it('10 and 49 moved from MODE1_GOOD to MODE1_BAD (were misclassified) -> now bad, no fallback', () => {
    expect(getMode1TierFromTotal(10)).toEqual({ tier: 'bad', usedFallback: false });
    expect(getMode1TierFromTotal(49)).toEqual({ tier: 'bad', usedFallback: false });
  });

  it('72 added to MODE1_GOOD (previously an unfilled gap in the 66-99 range that fell back to the Mode 2 tier table) -> now good directly, no fallback', () => {
    expect(getMode1TierFromTotal(72)).toEqual({ tier: 'good', usedFallback: false });
  });

  it('39 was already correctly in MODE1_GOOD before this round of research (verified, not actually a gap as initially assumed) -> stays good', () => {
    expect(getMode1TierFromTotal(39)).toEqual({ tier: 'good', usedFallback: false });
  });

  it('57, 58, 61, 62 added to MODE1_BAD (previously unfilled gaps in 1-65 that fell back to the Mode 2 tier table) -> now bad directly, no fallback', () => {
    for (const n of [57, 58, 61, 62]) {
      expect(getMode1TierFromTotal(n)).toEqual({ tier: 'bad', usedFallback: false });
    }
  });

  it('73 and 94 added to MODE1_BAD (previously unfilled gaps in the 66-99 range that fell back to the Mode 2 tier table) -> now bad directly, no fallback', () => {
    expect(getMode1TierFromTotal(73)).toEqual({ tier: 'bad', usedFallback: false });
    expect(getMode1TierFromTotal(94)).toEqual({ tier: 'bad', usedFallback: false });
  });

  it('17 was already correctly in MODE1_BAD before this round of research (verified, not actually a gap as initially assumed) -> stays bad', () => {
    expect(getMode1TierFromTotal(17)).toEqual({ tier: 'bad', usedFallback: false });
  });

  it('27 is untouched — confirmed correct in MODE1_BAD already, matches the new research exactly', () => {
    expect(getMode1TierFromTotal(27)).toEqual({ tier: 'bad', usedFallback: false });
  });

  it('explicit-list priority now applies across the FULL domain, not just <=65 — regression guard for the priority-order bug this round fixed (72/73/94 would previously have been silently ignored by the explicit lists since total>65 skipped straight to fallback)', () => {
    // sanity: these three are only meaningful if the function actually consults the
    // explicit lists for total>65 instead of jumping straight to applyTierTableFallback
    expect(getMode1TierFromTotal(72).usedFallback).toBe(false);
    expect(getMode1TierFromTotal(73).usedFallback).toBe(false);
    expect(getMode1TierFromTotal(94).usedFallback).toBe(false);
  });
});

describe('getMode1TierFromTotal — bad_rule ("เลขที่มีเลข 0 ประกอบ") must never override an explicit excellent/good list entry', () => {
  // bad_rule ("เลขทุกตัวที่มีเลข 0 ประกอบ") is only a classifier for numbers that
  // AREN'T already in one of the 3 explicit lists (excellent/good/bad) — it exists to
  // catch multiples of 10 that have no explicit entry (e.g. 60), not to override 40/50
  // which the brief itself lists under "excellent" explicitly. getMode1TierFromTotal
  // already checks MODE1_EXCELLENT / MODE1_GOOD / MODE1_BAD in that order, before ever
  // consulting isMode1BadByZeroRule — this suite locks that ordering in as a regression
  // test so a future refactor can't accidentally reorder the checks and make 40/50 "bad".
  it('40 and 50 -> excellent (explicit list wins over the "contains a 0" rule)', () => {
    expect(getMode1TierFromTotal(40)).toEqual({ tier: 'excellent', usedFallback: false });
    expect(getMode1TierFromTotal(50)).toEqual({ tier: 'excellent', usedFallback: false });
  });

  it('single-digit totals in the excellent list (4,5,6,9) also match the zero-rule (floor(n/10)===0) but must stay excellent', () => {
    for (const n of [4, 5, 6, 9]) {
      expect(getMode1TierFromTotal(n)).toEqual({ tier: 'excellent', usedFallback: false });
    }
  });

  // UPDATED (cross-reference research round 2): 10 was removed from this "stays good"
  // group because it moved to MODE1_BAD — see the round-2 fixes describe block below.
  // Only 2 and 8 remain as genuine "good list wins over zero-rule" examples.
  it('single-digit totals in the good list (2,8) also match the zero-rule but must stay good', () => {
    for (const n of [2, 8]) {
      expect(getMode1TierFromTotal(n)).toEqual({ tier: 'good', usedFallback: false });
    }
  });

  it('zero-rule totals that are ALSO explicitly in the bad list (3,7,10,20,30) stay bad — same outcome either way, kept for completeness', () => {
    for (const n of [3, 7, 10, 20, 30]) {
      expect(getMode1TierFromTotal(n)).toEqual({ tier: 'bad', usedFallback: false });
    }
  });

  it('a zero-rule total with NO explicit entry anywhere (e.g. 60) genuinely falls to bad via bad_rule', () => {
    expect(getMode1TierFromTotal(60)).toEqual({ tier: 'bad', usedFallback: false });
  });

  it('end-to-end: a plate whose total is exactly 40 comes out excellent, not bad', () => {
    // frontDigit(9) + ฏ(9) + ฏ(9) + tail "8+5"=13 -> total 40
    const result = calculateMode1({ frontDigit: 9, thaiLetters: ['ฏ', 'ฏ'], tailDigits: '85' });
    expect(result.total).toBe(40);
    expect(result.tier).toBe('excellent');
    expect(result.verdict).toBe(true);
  });
});

describe('getMode1Explanation — picks fallback_66_99 text only when usedFallback is true, otherwise the tier text', () => {
  it('excellent/good/bad without fallback -> the matching plain tier explanation', () => {
    expect(getMode1Explanation({ tier: 'excellent', usedFallback: false })).toContain('ดีมาก');
    expect(getMode1Explanation({ tier: 'good', usedFallback: false })).toContain('ดี/ปานกลาง');
    expect(getMode1Explanation({ tier: 'bad', usedFallback: false })).toContain('ไม่ดี');
  });

  it('usedFallback=true -> always the fallback_66_99 explanation, regardless of the resulting tier', () => {
    const goodViaFallback = getMode1Explanation({ tier: 'good', usedFallback: true });
    const badViaFallback = getMode1Explanation({ tier: 'bad', usedFallback: true });
    expect(goodViaFallback).toBe(badViaFallback);
    expect(goodViaFallback).toContain('66-99');
  });
});
