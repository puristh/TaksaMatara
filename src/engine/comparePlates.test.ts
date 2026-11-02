import { describe, expect, it, vi } from 'vitest';

/**
 * Mock analyzeAyatana6/analyzeFiveElement ให้ตอบตรงข้ามกับผลจริงของ Mode 1-3 เจตนา
 * ให้ทะเบียนที่ hasBadPair=true (ควรแพ้) ได้ผลอายตนะ6/ธาตุจีนที่ "ดี" และทะเบียนที่สะอาด
 * (ควรชนะ) ได้ผล "แย่" แทน — ถ้า comparePlates() ยังตัดสิน rank ตาม Mode 1-3 เท่านั้น (ไม่แตะ
 * อายตนะ6/ธาตุจีนเลย) rank ต้องไม่เปลี่ยนแม้ mock จะขัดกันขนาดนี้
 */
vi.mock('./ayatana6', () => ({
  analyzeAyatana6: (input: { tailDigits: string }) => ({
    digitPowers: [],
    letterPowers: [],
    rawSum: 0,
    digitRootSteps: [0],
    digitRoot: input.tailDigits === '02' ? 9 : 1,
    meaning: input.tailDigits === '02' ? 'ดีมาก (mocked, ขัดกับ Mode 1-3)' : 'แย่มาก (mocked, ขัดกับ Mode 1-3)',
  }),
}));

vi.mock('./fiveElement', () => ({
  analyzeFiveElement: (tailDigits: string) => ({
    tailDigits,
    insufficientData: false,
    digitElements: [],
    pairs: [],
    score: tailDigits === '02' ? 3 : -3,
    parityFlag: '',
    headTailRelation: 'generates',
    headTailRelationLabel: '',
    verdictLevel: tailDigits === '02' ? 'excellent' : 'bad',
    verdict: tailDigits === '02' ? 'ดีมาก (mocked, ขัดกับ Mode 1-3)' : 'ไม่แนะนำ (mocked, ขัดกับ Mode 1-3)',
    verdictDetail: '',
  }),
}));

import { comparePlates } from './comparePlates';

describe('comparePlates — front=8, letters=[ข,ง]: "22" (finalScore=121, hasBadPair=false) vs "02" (finalScore=202, hasBadPair=true)', () => {
  const front = 8;
  const letters: [string, string] = ['ข', 'ง'];

  it('ranks the clean plate ("22") above the bad-pair plate ("02") despite its lower finalScore — matches compareByQuality/hasBadPair priority', () => {
    const results = comparePlates([
      { frontDigit: front, thaiLetters: letters, tailDigits: '02' },
      { frontDigit: front, thaiLetters: letters, tailDigits: '22' },
    ]);
    const r02 = results[0];
    const r22 = results[1];
    expect(r22.hasBadPair).toBe(false);
    expect(r02.hasBadPair).toBe(true);
    expect(r22.finalScore).toBe(121);
    expect(r02.finalScore).toBe(202);
    expect(r22.rank).toBe(1);
    expect(r02.rank).toBe(2);
  });

  it('preserves input order in the returned array (rank annotates each slot, it does not reorder them) — slot 0 is still "02", slot 1 is still "22"', () => {
    const results = comparePlates([
      { frontDigit: front, thaiLetters: letters, tailDigits: '02' },
      { frontDigit: front, thaiLetters: letters, tailDigits: '22' },
    ]);
    expect(results[0].input.tailDigits).toBe('02');
    expect(results[1].input.tailDigits).toBe('22');
  });

  it('identical plates tie: both get rank 1', () => {
    const results = comparePlates([
      { frontDigit: front, thaiLetters: letters, tailDigits: '22' },
      { frontDigit: front, thaiLetters: letters, tailDigits: '22' },
    ]);
    expect(results[0].rank).toBe(1);
    expect(results[1].rank).toBe(1);
  });

  it('ayatana6/fiveElement never influence rank, even mocked to flatly contradict Mode 1-3 (favoring "02", the plate that should lose)', () => {
    const results = comparePlates([
      { frontDigit: front, thaiLetters: letters, tailDigits: '02' },
      { frontDigit: front, thaiLetters: letters, tailDigits: '22' },
    ]);
    const r02 = results[0];
    const r22 = results[1];
    // sanity: the mocks really are wired up and really do contradict Mode 1-3
    expect(r02.ayatana6?.digitRoot).toBe(9);
    expect(r22.ayatana6?.digitRoot).toBe(1);
    expect(r02.fiveElement?.verdictLevel).toBe('excellent');
    expect(r22.fiveElement?.verdictLevel).toBe('bad');
    // yet rank still follows Mode 1-3 (hasBadPair) only — "22" (clean) still wins
    expect(r22.rank).toBeLessThan(r02.rank);
  });
});

describe('comparePlates — mode1=bad handling (a case ranking.ts never has to deal with, since it pre-filters mode1=bad candidates entirely)', () => {
  const front = 8;
  const letters: [string, string] = ['ข', 'ค'];

  it('front=8, letters=[ข,ค]: "88" (mode1=bad) always ranks below "45" (mode1=excellent, clean, finalScore=252), regardless of Mode 2/3', () => {
    const results = comparePlates([
      { frontDigit: front, thaiLetters: letters, tailDigits: '88' },
      { frontDigit: front, thaiLetters: letters, tailDigits: '45' },
    ]);
    const r88 = results[0];
    const r45 = results[1];
    expect(r88.mode1.tier).toBe('bad');
    expect(r45.mode1.tier).not.toBe('bad');
    expect(r45.rank).toBe(1);
    expect(r88.rank).toBe(2);
  });

  it('a mode1=bad plate still gets a numeric finalScore (not null) so the UI always has something to display', () => {
    const results = comparePlates([
      { frontDigit: front, thaiLetters: letters, tailDigits: '88' },
      { frontDigit: front, thaiLetters: letters, tailDigits: '45' },
    ]);
    expect(typeof results[0].finalScore).toBe('number');
    expect(Number.isNaN(results[0].finalScore)).toBe(false);
  });
});

describe('comparePlates — two clean (hasBadPair=false), mode1-valid plates: finalScore is the deciding factor', () => {
  const front = 8;
  const letters: [string, string] = ['ข', 'ค'];

  it('front=8, letters=[ข,ค]: "45" (finalScore=252) outranks "36" (finalScore=242) — both clean, both mode1=excellent', () => {
    const results = comparePlates([
      { frontDigit: front, thaiLetters: letters, tailDigits: '36' },
      { frontDigit: front, thaiLetters: letters, tailDigits: '45' },
    ]);
    const r36 = results[0];
    const r45 = results[1];
    expect(r36.hasBadPair).toBe(false);
    expect(r45.hasBadPair).toBe(false);
    expect(r36.mode1.tier).toBe('excellent');
    expect(r45.mode1.tier).toBe('excellent');
    expect(r45.finalScore).toBe(252);
    expect(r36.finalScore).toBe(242);
    expect(r45.rank).toBe(1);
    expect(r36.rank).toBe(2);
  });
});

describe('comparePlates — scales beyond 2 inputs without special-casing (architecture check for the future 5/10-slot premium tier)', () => {
  it('accepts 3 inputs and ranks all of them consistently (competition-style ranking: ties share a rank, the next distinct group skips ahead)', () => {
    const front = 8;
    const letters: [string, string] = ['ข', 'ง'];
    const results = comparePlates([
      { frontDigit: front, thaiLetters: letters, tailDigits: '02' }, // hasBadPair=true, score 202
      { frontDigit: front, thaiLetters: letters, tailDigits: '22' }, // hasBadPair=false, score 121
      { frontDigit: front, thaiLetters: letters, tailDigits: '22' }, // duplicate of slot 1 — ties with it
    ]);
    expect(results).toHaveLength(3);
    expect(results[1].rank).toBe(1);
    expect(results[2].rank).toBe(1);
    expect(results[0].rank).toBe(3);
  });
});
