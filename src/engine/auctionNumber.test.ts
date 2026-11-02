import { describe, expect, it } from 'vitest';
import { detectAuctionNumber } from './auctionNumber';

describe('detectAuctionNumber — tailLength 2', () => {
  it('เลขคู่/เลขเบิ้ล: both digits identical (11, 99)', () => {
    expect(detectAuctionNumber('11')).toEqual({ isAuction: true, categories: ['เลขคู่/เลขเบิ้ล'] });
    expect(detectAuctionNumber('99')).toEqual({ isAuction: true, categories: ['เลขคู่/เลขเบิ้ล'] });
  });

  it('a plain 2-digit tail is not an auction number', () => {
    expect(detectAuctionNumber('37')).toEqual({ isAuction: false, categories: [] });
  });
});

describe('detectAuctionNumber — tailLength 3', () => {
  it('เลขตอง: all 3 digits identical (555, 999)', () => {
    expect(detectAuctionNumber('555').categories).toContain('เลขตอง');
    expect(detectAuctionNumber('999').isAuction).toBe(true);
  });

  it('เลขเรียง: ascending run only (123, 789), not descending', () => {
    expect(detectAuctionNumber('123').categories).toContain('เลขเรียง');
    expect(detectAuctionNumber('789').categories).toContain('เลขเรียง');
    expect(detectAuctionNumber('321').isAuction).toBe(false); // descending doesn't count
  });

  it('a plain 3-digit tail is not an auction number', () => {
    expect(detectAuctionNumber('482')).toEqual({ isAuction: false, categories: [] });
  });

  it('exact whole-tail match only — a "good" pair embedded elsewhere does not trigger false positive (regression for the original bug report)', () => {
    // 3-digit case analogue: "189" is not tong, not an ascending run
    expect(detectAuctionNumber('189')).toEqual({ isAuction: false, categories: [] });
  });
});

describe('detectAuctionNumber — tailLength 4', () => {
  it('เลข4ตัวเหมือน: all 4 digits identical (1111, 9999)', () => {
    expect(detectAuctionNumber('1111')).toEqual({ isAuction: true, categories: ['เลข4ตัวเหมือน'] });
    expect(detectAuctionNumber('9999').categories).toContain('เลข4ตัวเหมือน');
  });

  it('เลขหลักพัน: X000 pattern (1000..9000)', () => {
    expect(detectAuctionNumber('1000')).toEqual({ isAuction: true, categories: ['เลขหลักพัน'] });
    expect(detectAuctionNumber('9000').categories).toContain('เลขหลักพัน');
    // 0000 is เลข4ตัวเหมือน, not เลขหลักพัน (X must be 1-9)
    expect(detectAuctionNumber('0000')).toEqual({ isAuction: true, categories: ['เลข4ตัวเหมือน'] });
  });

  it('เลขเรียง: ascending run of 4 (1234..6789)', () => {
    expect(detectAuctionNumber('1234').categories).toContain('เลขเรียง');
    expect(detectAuctionNumber('6789').categories).toContain('เลขเรียง');
  });

  it('เลขคู่เหมือน (XXYY): 1122, 5566', () => {
    expect(detectAuctionNumber('1122')).toEqual({
      isAuction: true,
      categories: ['เลขคู่เหมือน (XXYY)'],
    });
    expect(detectAuctionNumber('5566').categories).toEqual(['เลขคู่เหมือน (XXYY)']);
  });

  it('เลขสลับ (XYXY): 7878, 1313', () => {
    expect(detectAuctionNumber('7878')).toEqual({ isAuction: true, categories: ['เลขสลับ (XYXY)'] });
    expect(detectAuctionNumber('1313').categories).toEqual(['เลขสลับ (XYXY)']);
  });

  it('เลขหาม/เลขหาบ (XYYX): 8338, 9009, 9889', () => {
    expect(detectAuctionNumber('8338')).toEqual({
      isAuction: true,
      categories: ['เลขหาม/เลขหาบ (XYYX)'],
    });
    expect(detectAuctionNumber('9009').categories).toEqual(['เลขหาม/เลขหาบ (XYYX)']);
    expect(detectAuctionNumber('9889').categories).toEqual(['เลขหาม/เลขหาบ (XYYX)']);
  });

  // Explicitly requested regression test: 8899 must classify as XXYY only, never XYYX,
  // because d[0]!==d[3] (8!==9) so the XYYX condition (d[0]===d[3]) never matches —
  // the two patterns can't overlap by construction, but this locks the exact outcome in.
  it('8899 -> XXYY only, never XYYX (explicit regression case from the task)', () => {
    const result = detectAuctionNumber('8899');
    expect(result.categories).toEqual(['เลขคู่เหมือน (XXYY)']);
    expect(result.categories).not.toContain('เลขหาม/เลขหาบ (XYYX)');
  });

  it('1111 matches only one category even though it could conceptually overlap with XXYY/XYXY/XYYX (all require d[0]!==d[2] or d[0]!==d[1], which 1111 fails)', () => {
    expect(detectAuctionNumber('1111').categories).toEqual(['เลข4ตัวเหมือน']);
  });

  it('a plain 4-digit tail is not an auction number', () => {
    expect(detectAuctionNumber('4827')).toEqual({ isAuction: false, categories: [] });
  });

  it('exact whole-tail match only — "1989" (89 embedded in the middle) is NOT an auction number (regression for the original false-positive bug report)', () => {
    const result = detectAuctionNumber('1989');
    expect(result.isAuction).toBe(false);
    expect(result.categories).toEqual([]);
  });
});
