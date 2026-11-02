import { describe, expect, it } from 'vitest';
import { compareByQuality } from './qualityComparator';
import type { QualityScored } from './qualityComparator';

function item(overrides: Partial<QualityScored>): QualityScored {
  return { tailDigits: '00', finalScore: 0, hasBadPair: false, ...overrides };
}

describe('compareByQuality', () => {
  it('hasBadPair=false always sorts before hasBadPair=true, regardless of finalScore', () => {
    const clean = item({ tailDigits: '99', finalScore: 1, hasBadPair: false });
    const bad = item({ tailDigits: '00', finalScore: 999, hasBadPair: true });
    expect(compareByQuality(clean, bad)).toBeLessThan(0);
    expect(compareByQuality(bad, clean)).toBeGreaterThan(0);
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

  it('sorting a mixed array: hasBadPair=false group entirely before hasBadPair=true group, each sorted by finalScore desc then tailDigits asc', () => {
    const items: QualityScored[] = [
      item({ tailDigits: '50', finalScore: 100, hasBadPair: true }),
      item({ tailDigits: '10', finalScore: 300, hasBadPair: false }),
      item({ tailDigits: '20', finalScore: 300, hasBadPair: false }),
      item({ tailDigits: '05', finalScore: 400, hasBadPair: true }),
      item({ tailDigits: '99', finalScore: 50, hasBadPair: false }),
    ];
    const sorted = [...items].sort(compareByQuality);
    expect(sorted.map((i) => i.tailDigits)).toEqual(['10', '20', '99', '05', '50']);
  });
});
