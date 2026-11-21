import { describe, expect, it } from 'vitest';
import { compareByQuality } from './qualityComparator';
import type { QualityScored } from './qualityComparator';

function item(overrides: Partial<QualityScored>): QualityScored {
  return { tailDigits: '00', finalScore: 0, hasBadPair: false, ...overrides };
}

describe('compareByQuality', () => {
  it('[strict] hasBadPair=false always sorts before hasBadPair=true, regardless of finalScore', () => {
    const clean = item({ tailDigits: '99', finalScore: 1, hasBadPair: false });
    const bad = item({ tailDigits: '00', finalScore: 999, hasBadPair: true });
    // [fix/ranking-market-first] ลำดับเดิม = โหมดคัดเข้ม → ส่ง 'strict', expectation คงเดิม
    expect(compareByQuality(clean, bad, 'strict')).toBeLessThan(0);
    expect(compareByQuality(bad, clean, 'strict')).toBeGreaterThan(0);
  });

  it('within the same hasBadPair group, higher finalScore sorts first', () => {
    const higher = item({ tailDigits: '11', finalScore: 200 });
    const lower = item({ tailDigits: '22', finalScore: 100 });
    expect(compareByQuality(higher, lower)).toBeLessThan(0);
    expect(compareByQuality(lower, higher)).toBeGreaterThan(0);
  });

  it('ties (same hasBadPair, same finalScore) break by tailDigits ascending, numerically', () => {
    const a = item({ tailDigits: '05', finalScore: 100 });
    const b = item({ tailDigits: '12', finalScore: 100 });
    expect(compareByQuality(a, b)).toBeLessThan(0);
    expect(compareByQuality(b, a)).toBeGreaterThan(0);
  });

  it('numeric tie-break compares as numbers, not strings — "09" < "10"', () => {
    const a = item({ tailDigits: '09', finalScore: 50 });
    const b = item({ tailDigits: '10', finalScore: 50 });
    expect(compareByQuality(a, b)).toBeLessThan(0);
  });

  it('fully identical items compare equal (0)', () => {
    const a = item({ tailDigits: '42', finalScore: 150, hasBadPair: false });
    const b = item({ tailDigits: '42', finalScore: 150, hasBadPair: false });
    expect(compareByQuality(a, b)).toBe(0);
  });

  it('[strict] sorting a mixed array: hasBadPair=false group entirely before hasBadPair=true group, each sorted by finalScore desc then tailDigits asc', () => {
    const items: QualityScored[] = [
      item({ tailDigits: '50', finalScore: 100, hasBadPair: true }),
      item({ tailDigits: '10', finalScore: 300, hasBadPair: false }),
      item({ tailDigits: '20', finalScore: 300, hasBadPair: false }),
      item({ tailDigits: '05', finalScore: 400, hasBadPair: true }),
      item({ tailDigits: '99', finalScore: 50, hasBadPair: false }),
    ];
    // [fix/ranking-market-first] ลำดับเดิม = โหมดคัดเข้ม → ส่ง 'strict', expectation คงเดิม
    const sorted = [...items].sort((a, b) => compareByQuality(a, b, 'strict'));
    expect(sorted.map((i) => i.tailDigits)).toEqual(['10', '20', '99', '05', '50']);
  });

  it('[market-first, ค่าเริ่มต้น] ไม่มีชั้น hasBadPair: คะแนนสูงกว่าชนะเสมอ แม้มีคู่ Tier 4', () => {
    const clean = item({ tailDigits: '99', finalScore: 1, hasBadPair: false });
    const bad = item({ tailDigits: '00', finalScore: 999, hasBadPair: true });
    expect(compareByQuality(bad, clean)).toBeLessThan(0);
    expect(compareByQuality(bad, clean, 'market-first')).toBeLessThan(0);
    expect(compareByQuality(clean, bad)).toBeGreaterThan(0);
  });

  it('[market-first] เรียงอาร์เรย์ผสม: คะแนนมาก→น้อย แล้วเลขท้ายน้อย→มาก ไม่แยกกลุ่มคู่ Tier 4', () => {
    const items: QualityScored[] = [
      item({ tailDigits: '50', finalScore: 100, hasBadPair: true }),
      item({ tailDigits: '10', finalScore: 300, hasBadPair: false }),
      item({ tailDigits: '20', finalScore: 300, hasBadPair: false }),
      item({ tailDigits: '05', finalScore: 400, hasBadPair: true }),
      item({ tailDigits: '99', finalScore: 50, hasBadPair: false }),
    ];
    const sorted = [...items].sort((a, b) => compareByQuality(a, b));
    expect(sorted.map((i) => i.tailDigits)).toEqual(['05', '10', '20', '50', '99']);
  });
});
