import { describe, expect, it } from 'vitest';
import { calculateMode2, generateOverlappingPairs } from './mode2';
import { lookupTier } from '../data/lookupTables';

describe('generateOverlappingPairs', () => {
  it('generates 3 overlapping pairs from a 4-digit tail (edge case)', () => {
    expect(generateOverlappingPairs('2145')).toEqual(['21', '14', '45']);
  });

  it('generates 1 pair from a 2-digit tail', () => {
    expect(generateOverlappingPairs('59')).toEqual(['59']);
  });

  it('generates 2 pairs from a 3-digit tail', () => {
    expect(generateOverlappingPairs('813')).toEqual(['81', '13']);
  });
});

describe('lookupTier — bidirectional (XY and YX)', () => {
  it('finds a pair by its listed direction', () => {
    expect(lookupTier('59')?.tier).toBe('tier1'); // listed directly
  });

  it('finds the same pair reversed even if only one direction were listed', () => {
    // 45 and 54 are both explicitly listed, but verify the reverse-check logic
    // independently by asserting both directions resolve to the same tier.
    expect(lookupTier('45')?.tier).toBe(lookupTier('54')?.tier);
    expect(lookupTier('45')?.tier).toBe('tier1');
  });

  it('tier2_5 lookup works in both directions and carries its note', () => {
    expect(lookupTier('16')).toEqual({ tier: 'tier2_5', note: 'ขยัน/ย้ำคิดย้ำทำ' });
    expect(lookupTier('61')).toEqual({ tier: 'tier2_5', note: 'ขยัน/ย้ำคิดย้ำทำ' });
  });

  it('zero-rule catches pairs with a leading zero (e.g. "02" from tail "020")', () => {
    expect(lookupTier('02')?.tier).toBe('tier4');
    expect(lookupTier('20')?.tier).toBe('tier4');
  });
});

describe('calculateMode2 — brief section 10 worked examples', () => {
  it('59 (2-digit tail from "1 กข 59") -> tier1, no bad', () => {
    const result = calculateMode2('59');
    expect(result.tier).toBe('tier1');
    expect(result.dominantPair).toBe('59');
  });

  it('21 (2-digit tail from "2 กก 21") -> tier4 (bad)', () => {
    const result = calculateMode2('21');
    expect(result.tier).toBe('tier4');
    expect(result.dominantPair).toBe('21');
  });

  it('813 -> pairs 81,13, both tier4, dominant = last pair "13"', () => {
    const result = calculateMode2('813');
    expect(result.pairsFound).toEqual(['81', '13']);
    expect(result.tier).toBe('tier4');
    expect(result.dominantPair).toBe('13');
  });

  it('555 -> pair 55 (tier1), no bad', () => {
    const result = calculateMode2('555');
    expect(result.pairsFound).toEqual(['55', '55']);
    expect(result.tier).toBe('tier1');
  });

  it('020 -> pairs 02, 20, both tier4 because of the zero rule', () => {
    const result = calculateMode2('020');
    expect(result.pairsFound).toEqual(['02', '20']);
    expect(result.tier).toBe('tier4');
    expect(result.dominantPair).toBe('20');
  });

  // Edge case explicitly requested: a plate where Mode 2 has a mix of a good pair
  // and a bad pair — the bad pair must win ("คู่เสียชนะเสมอ"), and this also doubles
  // as the 4-digit tailDigits case (3 overlapping pairs generated).
  it('5921 (4-digit tail) -> pairs 59(tier1,good), 92(tier2,good), 21(tier4,bad) -> overall bad, dominant = last pair "21"', () => {
    const result = calculateMode2('5921');
    expect(result.pairsFound).toEqual(['59', '92', '21']);
    expect(result.pairDetails.map((p) => p.tier)).toEqual(['tier1', 'tier2', 'tier4']);
    expect(result.tier).toBe('tier4');
    expect(result.dominantPair).toBe('21');
  });
});

describe('calculateMode2 — pairDetails carries meaning text for every pair found, and isDominant flags only the last position', () => {
  it('2-digit tail: 1 pairDetail entry, isDominant true, meaning matches PAIR_MEANING_TEXT', () => {
    const result = calculateMode2('59');
    expect(result.pairDetails).toEqual([
      { pair: '59', tier: 'tier1', meaning: 'สิ่งศักดิ์สิทธิ์คุ้มครองดีมาก', isDominant: true },
    ]);
  });

  it('4-digit tail 5921: only the last pairDetail ("21") is isDominant, all others false', () => {
    const result = calculateMode2('5921');
    expect(result.pairDetails.map((p) => p.isDominant)).toEqual([false, false, true]);
    expect(result.pairDetails.every((p) => typeof p.meaning === 'string' && p.meaning.length > 0)).toBe(
      true,
    );
  });

  it('isDominant is keyed by position, not by pair value — a repeated pair value earlier in the tail must not also be flagged dominant', () => {
    // "5959" -> pairs ["59", "95", "59"]: the pair value "59" appears at both index 0
    // and index 2 (the true dominant position) — only index 2 should be isDominant.
    const result = calculateMode2('5959');
    expect(result.pairsFound).toEqual(['59', '95', '59']);
    expect(result.pairDetails.map((p) => p.isDominant)).toEqual([false, false, true]);
    expect(result.dominantPair).toBe('59');
  });

  it('every pair found gets a full PairDetail entry (pair, tier, meaning, isDominant), not just the dominant one', () => {
    const result = calculateMode2('813');
    expect(result.pairDetails).toHaveLength(2);
    expect(result.pairDetails[0]).toMatchObject({ pair: '81', tier: 'tier4', isDominant: false });
    expect(result.pairDetails[1]).toMatchObject({ pair: '13', tier: 'tier4', isDominant: true });
    expect(result.pairDetails[0].meaning.length).toBeGreaterThan(0);
    expect(result.pairDetails[1].meaning.length).toBeGreaterThan(0);
  });
});
