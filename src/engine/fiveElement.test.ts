import { describe, expect, it } from 'vitest';
import { analyzeFiveElement } from './fiveElement';

describe('analyzeFiveElement — reference example "2683" (bazi.tw worked example)', () => {
  const result = analyzeFiveElement('2683');

  it('digit elements are Fire-Water-Wood-Wood', () => {
    expect(result.digitElements.map((d) => d.elementLabel)).toEqual([
      'ไฟ (火)',
      'น้ำ (水)',
      'ไม้ (木)',
      'ไม้ (木)',
    ]);
  });

  it('2->6 = ขัดกัน (overcome_by: water overcomes fire)', () => {
    expect(result.pairs[0]).toMatchObject({ a: '2', b: '6', relation: 'overcome_by' });
    expect(result.pairs[0].relationLabel).toContain('ขัดกัน');
  });

  it('6->8 = เกื้อกัน (generates: water generates wood)', () => {
    expect(result.pairs[1]).toMatchObject({ a: '6', b: '8', relation: 'generates' });
    expect(result.pairs[1].relationLabel).toContain('เกื้อกัน');
  });

  it('8->3 = เสมอกัน (same: both wood)', () => {
    expect(result.pairs[2]).toMatchObject({ a: '8', b: '3', relation: 'same' });
    expect(result.pairs[2].relationLabel).toContain('เสมอกัน');
  });

  it('score = -1 + 1 + 0 = 0 -> neutral verdict', () => {
    expect(result.score).toBe(0);
    expect(result.verdictLevel).toBe('neutral');
    expect(result.verdict).toBe('ปานกลาง — ธาตุเสมอกัน/สมดุล ไม่ไหลลื่นแต่ก็ไม่ขัดกัน');
  });

  it('parity: 1 odd (3) + 3 even (2,6,8) -> mixed, balanced', () => {
    expect(result.parityFlag).toBe('มีทั้งเลขคี่และเลขคู่ผสมกัน — สมดุลดี');
  });

  it('head-tail: 2(fire)->3(wood), wood generates fire -> เกื้อกัน', () => {
    expect(result.headTailRelation).toBe('generated_by');
    expect(result.headTailRelationLabel).toContain('เกื้อกัน');
  });

  it('insufficientData is false for a valid 4-digit core', () => {
    expect(result.insufficientData).toBe(false);
  });
});

describe('analyzeFiveElement — uses tailDigits only, never frontDigit', () => {
  // "1 กข 59": frontDigit=1 must NOT be included in the analysis. Per the task's own
  // DIGIT_ELEMENT_KEY table (copied verbatim from the Python source): '5' -> earth
  // ("ดิน (土)"), '9' -> metal ("ทอง (金)"). This documents a discrepancy against the
  // task prose, which claimed the expected output was "น้ำ-ทอง" (water-metal) — but
  // '5' maps to earth, not water, in the very same DIGIT_ELEMENT_KEY table the task
  // provided (water is '1'/'6' only). Verified independently against the "2683"
  // reference example above (which the task confirmed is correct), so the algorithm
  // itself is trusted; the task's own prose example for this second case appears to be
  // a typo. Also confirms frontDigit=1 (which WOULD map to water) is correctly excluded
  // — if frontDigit were mistakenly included the first element would be "น้ำ", matching
  // the task's claimed (but incorrect) expectation, which is exactly the bug this test
  // guards against.
  it('"1 กข 59" -> tailDigits "59" -> Earth-Metal (not Water-Metal, and NOT starting with the frontDigit\'s Water)', () => {
    const result = analyzeFiveElement('59');
    expect(result.digitElements.map((d) => d.elementLabel)).toEqual(['ดิน (土)', 'ทอง (金)']);
  });

  it('single pair 5->9: earth generated_by metal? check actual relation (metal generates water, not earth) -> overcomes (earth overcomes... ) verified via relation cycle directly', () => {
    // earth -> metal: GENERATES[earth] = 'metal' -> a generates b -> 'generates' -> เกื้อกัน
    const result = analyzeFiveElement('59');
    expect(result.pairs[0]).toMatchObject({ a: '5', b: '9', relation: 'generates' });
    expect(result.score).toBe(1);
    expect(result.verdictLevel).toBe('excellent');
  });
});

describe('analyzeFiveElement — parity flag edge cases', () => {
  it('all-odd digits -> เลขคี่ล้วน warning', () => {
    expect(analyzeFiveElement('13').parityFlag).toContain('เลขคี่ล้วน');
  });

  it('all-even digits -> เลขคู่ล้วน warning', () => {
    expect(analyzeFiveElement('28').parityFlag).toContain('เลขคู่ล้วน');
  });
});

describe('analyzeFiveElement — defensive insufficientData branch (not reachable via real PlateInput, kept for fidelity with the Python source)', () => {
  it('a single digit -> insufficientData true, no pairs, no score-based verdict', () => {
    const result = analyzeFiveElement('5');
    expect(result.insufficientData).toBe(true);
    expect(result.digitElements).toEqual([]);
    expect(result.pairs).toEqual([]);
    expect(result.verdict).toBe('ข้อมูลไม่พอวิเคราะห์');
  });
});

describe('analyzeFiveElement — verdict boundary levels across the full score range (4-digit tail, 3 pairs)', () => {
  it('score = 3 (all-generating chain) -> excellent', () => {
    // wood(3) -> fire(2) -> earth(0/5) -> metal(4): each step generates the next
    const result = analyzeFiveElement('3204');
    expect(result.score).toBe(3);
    expect(result.verdictLevel).toBe('excellent');
  });

  it('score = -3 (all-overcoming chain) -> bad', () => {
    // wood(3) overcomes earth(0), earth overcomes water(1), water overcomes fire(2)
    const result = analyzeFiveElement('3012');
    expect(result.score).toBe(-3);
    expect(result.verdictLevel).toBe('bad');
  });
});
