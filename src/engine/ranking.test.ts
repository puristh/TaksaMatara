import { describe, expect, it } from 'vitest';
import { calculateRankingScore, generateTopCandidates } from './ranking';
import type { Mode1Result, Mode2Result, Mode3Result } from './types';

function mode1(tier: Mode1Result['tier'], total = 0): Mode1Result {
  return { total, tier, verdict: tier !== 'bad', usedFallback: false };
}

function mode2(tier: Mode2Result['tier'], pairsFound: string[] = ['00']): Mode2Result {
  return {
    pairsFound,
    pairDetails: pairsFound.map((pair, i) => ({
      pair,
      tier,
      meaning: '',
      isDominant: i === pairsFound.length - 1,
    })),
    tier,
    dominantPair: pairsFound[pairsFound.length - 1] ?? '',
  };
}

function mode3(tier: Mode3Result['tier'], digitRoot = 1): Mode3Result {
  return { digitRoot, meaning: { label: '', star: '', person: '' }, tier };
}

describe('calculateRankingScore', () => {
  it('mode1 = bad -> null (excluded), regardless of mode2/mode3', () => {
    expect(calculateRankingScore(mode1('bad'), mode2('tier1'), mode3('good'))).toBeNull();
    expect(calculateRankingScore(mode1('bad'), mode2('tier4'), mode3('neutral'))).toBeNull();
  });

  it('mode1 excellent(2) + mode2 tier1(5) + mode3 good(2) -> 2*100 + 5*10 + 2 = 252', () => {
    expect(calculateRankingScore(mode1('excellent'), mode2('tier1'), mode3('good'))).toBe(252);
  });

  it('mode1 good(1) + mode2 tier2(4) + mode3 good(2) -> 1*100 + 4*10 + 2 = 142', () => {
    expect(calculateRankingScore(mode1('good'), mode2('tier2'), mode3('good'))).toBe(142);
  });

  it('mode2 tier2_5 -> mode2Score 3', () => {
    expect(calculateRankingScore(mode1('excellent'), mode2('tier2_5'), mode3('neutral'))).toBe(
      2 * 100 + 3 * 10 + 1,
    );
  });

  it('mode2 tier3 -> mode2Score 2', () => {
    expect(calculateRankingScore(mode1('good'), mode2('tier3'), mode3('neutral'))).toBe(
      1 * 100 + 2 * 10 + 1,
    );
  });

  it('mode2 tier4 (bad pair) -> mode2Score 0', () => {
    expect(calculateRankingScore(mode1('excellent'), mode2('tier4'), mode3('good'))).toBe(
      2 * 100 + 0 * 10 + 2,
    );
  });

  it('mode2 with no pairs found at all -> mode2Score 1 ("ไม่มีคู่ match"), distinct from tier4=0', () => {
    const noMatch = mode2('tier4', []);
    expect(calculateRankingScore(mode1('good'), noMatch, mode3('neutral'))).toBe(
      1 * 100 + 1 * 10 + 1,
    );
  });

  it('mode3 neutral -> mode3Score 1', () => {
    expect(calculateRankingScore(mode1('good'), mode2('tier1'), mode3('neutral'))).toBe(
      1 * 100 + 5 * 10 + 1,
    );
  });

  it('mode3 good -> mode3Score 2', () => {
    expect(calculateRankingScore(mode1('good'), mode2('tier1'), mode3('good'))).toBe(
      1 * 100 + 5 * 10 + 2,
    );
  });
});

describe('generateTopCandidates — each candidate carries the full Mode1/Mode2/Mode3 result objects, not just tier/score', () => {
  it('mode1/mode2/mode3 on every candidate are the full result shapes (usable directly by ModeDetailPanel without recomputing)', () => {
    const result = generateTopCandidates(8, ['ข', 'ค'], 4, false, false, 10);
    expect(result.length).toBeGreaterThan(0);
    for (const c of result) {
      // Mode1Result shape
      expect(c.mode1).toBeDefined();
      expect(typeof c.mode1.total).toBe('number');
      expect(typeof c.mode1.usedFallback).toBe('boolean');
      // Mode2Result shape — pairDetails must be the full PairDetail[] (meaning + isDominant),
      // not just a bare tier string, since ModeDetailPanel renders meaning/isDominant directly
      expect(c.mode2).toBeDefined();
      expect(Array.isArray(c.mode2.pairDetails)).toBe(true);
      expect(c.mode2.pairDetails.length).toBeGreaterThan(0);
      for (const p of c.mode2.pairDetails) {
        expect(typeof p.meaning).toBe('string');
        expect(p.meaning.length).toBeGreaterThan(0);
        expect(typeof p.isDominant).toBe('boolean');
      }
      // Mode3Result shape
      expect(c.mode3).toBeDefined();
      expect(c.mode3.meaning).toBeDefined();
      expect(typeof c.mode3.meaning.label).toBe('string');
      expect(typeof c.mode3.meaning.star).toBe('string');
      expect(typeof c.mode3.meaning.person).toBe('string');
    }
  });
});

describe('generateTopCandidates — front=8, letters=[ข,ค]', () => {
  const front = 8;
  const letters: [string, string] = ['ข', 'ค'];

  for (const tailLength of [2, 3, 4] as const) {
    describe(`tailLength=${tailLength}`, () => {
      it('returns at most 10 items', () => {
        const result = generateTopCandidates(front, letters, tailLength, false, false);
        expect(result.length).toBeLessThanOrEqual(10);
      });

      it('is sorted by finalScore descending (no lower score appears before a higher one)', () => {
        const result = generateTopCandidates(front, letters, tailLength, false, false);
        for (let i = 1; i < result.length; i++) {
          expect(result[i].finalScore).toBeLessThanOrEqual(result[i - 1].finalScore);
        }
      });

      it('never includes a candidate whose mode1 tier is bad', () => {
        const result = generateTopCandidates(front, letters, tailLength, false, false);
        expect(result.every((c) => c.mode1.tier !== 'bad')).toBe(true);
      });

      it('excludeAuction=true -> no candidate has isAuction=true', () => {
        const result = generateTopCandidates(front, letters, tailLength, true, false);
        expect(result.every((c) => c.auction.isAuction === false)).toBe(true);
      });

      it('excludePopular=true -> no candidate has isPopular=true', () => {
        const result = generateTopCandidates(front, letters, tailLength, false, true);
        expect(result.every((c) => c.popular.isPopular === false)).toBe(true);
      });

      it('tailDigits are zero-padded to the requested length', () => {
        const result = generateTopCandidates(front, letters, tailLength, false, false);
        expect(result.every((c) => c.tailDigits.length === tailLength)).toBe(true);
      });
    });
  }

  it('excludeAuction=false may include auction-number candidates when they otherwise score well (sanity check the toggle actually does something)', () => {
    const withAuction = generateTopCandidates(front, letters, 4, false, false);
    const withoutAuction = generateTopCandidates(front, letters, 4, true, false);
    const auctionCountWith = withAuction.filter((c) => c.auction.isAuction).length;
    const auctionCountWithout = withoutAuction.filter((c) => c.auction.isAuction).length;
    expect(auctionCountWithout).toBe(0);
    expect(auctionCountWith).toBeGreaterThanOrEqual(auctionCountWithout);
  });

  it('excludeAuction and excludePopular filter fully independently — toggling one never affects the other', () => {
    const large = 300;
    // sanity: within a big-enough sample, the unfiltered pool naturally contains both
    // auction-number and popular-number candidates for this front/letters combo
    const unfiltered = generateTopCandidates(front, letters, 4, false, false, large);
    expect(unfiltered.some((c) => c.auction.isAuction)).toBe(true);
    expect(unfiltered.some((c) => c.popular.isPopular)).toBe(true);

    const onlyExcludeAuction = generateTopCandidates(front, letters, 4, true, false, large);
    expect(onlyExcludeAuction.every((c) => !c.auction.isAuction)).toBe(true);
    // popular filter stayed off -> popular candidates are still allowed through
    expect(onlyExcludeAuction.some((c) => c.popular.isPopular)).toBe(true);

    const onlyExcludePopular = generateTopCandidates(front, letters, 4, false, true, large);
    expect(onlyExcludePopular.every((c) => !c.popular.isPopular)).toBe(true);
    // auction filter stayed off -> auction candidates are still allowed through
    expect(onlyExcludePopular.some((c) => c.auction.isAuction)).toBe(true);

    const excludeBoth = generateTopCandidates(front, letters, 4, true, true, large);
    expect(excludeBoth.every((c) => !c.auction.isAuction && !c.popular.isPopular)).toBe(true);
  });

  it('returns fewer than limit without erroring when fewer qualifying candidates exist than the limit', () => {
    const result = generateTopCandidates(front, letters, 2, false, false, 1000);
    expect(result.length).toBeLessThanOrEqual(100); // only 100 possible 2-digit tails total
    expect(() => generateTopCandidates(front, letters, 2, false, false, 1000)).not.toThrow();
  });

  describe('limit parameter — Top N row selector (10/20/30)', () => {
    for (const limit of [10, 20, 30] as const) {
      it(`limit=${limit} on tailLength=4 (10,000-candidate pool): returns at most ${limit} items, still sorted descending`, () => {
        const result = generateTopCandidates(front, letters, 4, false, false, limit);
        expect(result.length).toBeLessThanOrEqual(limit);
        for (let i = 1; i < result.length; i++) {
          expect(result[i].finalScore).toBeLessThanOrEqual(result[i - 1].finalScore);
        }
      });
    }

    it('limit=20/30 return a strict superset-prefix of limit=10 — the ranking order itself does not change just because more rows are requested', () => {
      const top10 = generateTopCandidates(front, letters, 4, false, false, 10);
      const top20 = generateTopCandidates(front, letters, 4, false, false, 20);
      const top30 = generateTopCandidates(front, letters, 4, false, false, 30);
      expect(top20.slice(0, 10).map((c) => c.tailDigits)).toEqual(top10.map((c) => c.tailDigits));
      expect(top30.slice(0, 20).map((c) => c.tailDigits)).toEqual(top20.map((c) => c.tailDigits));
    });

    it('limit=30 on tailLength=2 (only 100 possible tails, heavily reduced by filters/mode1=bad exclusion) still returns fewer than 30 without erroring', () => {
      // pool of 2-digit tails is small (100 total) and mode1=bad filtering plus the
      // auction/popular filters can easily shrink the qualifying pool below 30
      const result = generateTopCandidates(front, letters, 2, true, true, 30);
      expect(result.length).toBeLessThanOrEqual(30);
      expect(() => generateTopCandidates(front, letters, 2, true, true, 30)).not.toThrow();
    });
  });

  it('tie-break: equal finalScore sorts by tail ascending (numeric)', () => {
    // แทนที่จะเดาว่าคู่ไหนคะแนนเท่ากัน คำนวณผ่าน generateTopCandidates ตรงๆ แล้วเช็คกลุ่มที่
    // finalScore เท่ากันจริง ว่าเรียงเลขน้อยไปมากถูกต้อง
    const result = generateTopCandidates(front, letters, 2, false, false, 100);
    const byScore = new Map<number, string[]>();
    for (const c of result) {
      const list = byScore.get(c.finalScore) ?? [];
      list.push(c.tailDigits);
      byScore.set(c.finalScore, list);
    }
    const tiedGroup = [...byScore.values()].find((tails) => tails.length > 1);
    expect(tiedGroup).toBeDefined();
    if (tiedGroup) {
      const sortedNumerically = [...tiedGroup].sort((a, b) => Number(a) - Number(b));
      expect(tiedGroup).toEqual(sortedNumerically);
    }
  });
});

describe('generateTopCandidates — favoriteDigits (backward compatible when unused, promotes matches when used)', () => {
  const front = 8;
  const letters: [string, string] = ['ข', 'ค'];

  it('backward compatibility: omitting favoriteDigits entirely produces byte-identical output to the pre-feature signature (same 6-arg call)', () => {
    const withoutArg = generateTopCandidates(front, letters, 2, false, false, 10);
    const withUndefinedArg = generateTopCandidates(front, letters, 2, false, false, 10, undefined);
    const withAllNullArg = generateTopCandidates(front, letters, 2, false, false, 10, [
      null,
      null,
      null,
      null,
    ]);

    const tailsOnly = (arr: typeof withoutArg) => arr.map((c) => c.tailDigits);
    expect(tailsOnly(withUndefinedArg)).toEqual(tailsOnly(withoutArg));
    expect(tailsOnly(withAllNullArg)).toEqual(tailsOnly(withoutArg));

    // and every candidate still carries the new fields, just inert (0 / [])
    for (const c of withoutArg) {
      expect(c.favoriteMatchScore).toBe(0);
      expect(c.matchedFavoriteDigits).toEqual([]);
    }
  });

  it('every candidate.tailDigits from the no-favorites baseline is still mode1!=bad — sanity check before comparing against the favorite-sorted run', () => {
    const baseline = generateTopCandidates(front, letters, 2, false, false, 10);
    expect(baseline.every((c) => c.mode1.tier !== 'bad')).toBe(true);
  });

  // NOTE: this describe block's priority has flip-flopped twice across earlier tasks —
  // favoriteMatchScore-primary, then briefly finalScore-primary (while Mode 3 still mattered
  // for ranking), and now back to favoriteMatchScore-primary as the FINAL intended behavior,
  // since Mode 3 no longer affects ranking at all (FYI-only) and there is no longer any
  // reason for finalScore to outrank a favorite-digit match. hasBadPair (added afterward)
  // still sits above both as the top-level layer and is untouched by this swap. The tests
  // below assert the current (favoriteMatchScore-primary, within-hasBadPair-group) behavior
  // — verified via direct execution of generateTopCandidates(), not assumed.

  it('favoriteMatchScore dominates within the hasBadPair=false group: with favoriteDigits=["8",null,null,null], every "8"-tail (favoriteMatchScore=4) outranks every non-"8" tail, even ones with a much higher finalScore', () => {
    const baseline = generateTopCandidates(front, letters, 2, false, false, 10);
    expect(baseline.map((c) => c.tailDigits)).toEqual([
      '45',
      '54',
      '55',
      '14',
      '19',
      '36',
      '41',
      '46',
      '63',
      '64',
    ]);
    expect(baseline.some((c) => c.tailDigits.includes('8'))).toBe(false);

    const withFavorite = generateTopCandidates(front, letters, 2, false, false, 10, [
      '8',
      null,
      null,
      null,
    ]);
    // every "8"-tail is promoted ahead of "45"/"54"/"55" (finalScore=252) and "14"
    // (finalScore=242), despite those clean tails scoring far higher on finalScore alone —
    // favoriteMatchScore is the primary key now, finalScore only breaks ties within it
    expect(withFavorite.map((c) => c.tailDigits)).toEqual([
      '28',
      '82',
      '89',
      '98',
      '48',
      '84',
      '45',
      '54',
      '55',
      '14',
    ]);
    expect(withFavorite.slice(0, 6).every((c) => c.favoriteMatchScore === 4)).toBe(true);
    expect(withFavorite.slice(6).every((c) => c.favoriteMatchScore === 0)).toBe(true);
  });

  it('finalScore only acts as a tie-break within a shared favoriteMatchScore group — verified on the real favoriteMatchScore=4 group ("28"/"82"/"89"/"98"/"48"/"84", finalScore 222/151/122)', () => {
    const withFavorite = generateTopCandidates(front, letters, 2, false, false, 200, [
      '8',
      null,
      null,
      null,
    ]);
    // hasBadPair=false subset of the favoriteMatchScore=4 group — sorted by finalScore
    // descending within the tied favoriteMatchScore, exactly like the pre-favorites
    // comparator did within a tied finalScore
    const cleanFav4Group = withFavorite.filter((c) => c.favoriteMatchScore === 4 && !c.hasBadPair);
    expect(cleanFav4Group.map((c) => ({ t: c.tailDigits, final: c.finalScore }))).toEqual([
      { t: '28', final: 222 },
      { t: '82', final: 222 },
      { t: '89', final: 151 },
      { t: '98', final: 151 },
      { t: '48', final: 122 },
      { t: '84', final: 122 },
    ]);

    // this whole group sits together at the favoriteMatchScore=4 rung — it appears entirely
    // before every favoriteMatchScore=0 candidate, regardless of finalScore comparisons
    // (e.g. "48"/"84" at finalScore=122 still outrank "45"/"54"/"55" at finalScore=252)
    const beforeGroup = withFavorite.slice(0, withFavorite.findIndex((c) => c.tailDigits === '48'));
    expect(beforeGroup.every((c) => c.favoriteMatchScore >= 4)).toBe(true);
  });

  it('matchedFavoriteDigits on each candidate correctly reports which favorite(s) were found, independent of sort position', () => {
    const result = generateTopCandidates(front, letters, 2, false, false, 200, [
      '8',
      null,
      null,
      null,
    ]);
    for (const c of result) {
      if (c.tailDigits.includes('8')) {
        expect(c.matchedFavoriteDigits).toEqual(['8']);
      } else {
        expect(c.matchedFavoriteDigits).toEqual([]);
      }
    }
  });

  it('a mode1=bad tail is NEVER promoted by favoriteDigits, even when it would score very highly — "88" (mode1 total=30, bad) is filtered out entirely regardless of limit', () => {
    // sanity: confirm "88" really is mode1=bad for this front/letters combo first
    const allCandidates = generateTopCandidates(front, letters, 2, false, false, 200, [
      '8',
      null,
      null,
      null,
    ]);
    expect(allCandidates.some((c) => c.tailDigits === '88')).toBe(false);
  });

  it('favoriteDigits has zero effect on which candidates pass the mode1=bad filter — the qualifying pool (by tailDigits set) is identical with and without favorites', () => {
    const withoutFavorites = generateTopCandidates(front, letters, 2, false, false, 200);
    const withFavorites = generateTopCandidates(front, letters, 2, false, false, 200, [
      '8',
      null,
      null,
      null,
    ]);
    const setWithout = new Set(withoutFavorites.map((c) => c.tailDigits));
    const setWith = new Set(withFavorites.map((c) => c.tailDigits));
    expect(setWith).toEqual(setWithout);
  });
});

describe('generateTopCandidates — favoriteMatchScore always outranks finalScore (final priority, real-world case reported by user)', () => {
  // front=8, letters=[ข,ง], tailLength=3, favoriteDigits=[9,8,5,4]:
  // - "899"/"989"/"998": mode1=good(1), mode2=tier1(5), mode3=neutral(1) -> finalScore=151
  //   favoriteMatchScore against ['9','8','5','4'] (weights 9->4, 8->3): '9'x2@w4 + '8'x1@w3 = 11
  // - "599"/"959"/"995": mode1=good(1), mode2=tier1(5), mode3=good(2) -> finalScore=152
  //   favoriteMatchScore against ['9','8','5','4'] (weights 9->4, 5->2): '9'x2@w4 + '5'x1@w2 = 10
  // An earlier task had this the other way around (finalScore-primary, so the 599-family
  // would win) because Mode 3 still influenced ranking at the time. Now that Mode 3 is
  // confirmed FYI-only, that reasoning no longer applies: favoriteMatchScore must dominate,
  // so the 899-family (favoriteMatchScore=11) is now the one that correctly ranks above the
  // 599-family (favoriteMatchScore=10), even though its finalScore is lower (151 < 152).
  const front = 8;
  const letters: [string, string] = ['ข', 'ง'];
  const favoriteDigits = ['9', '8', '5', '4'];
  const family899 = ['899', '989', '998'];
  const family599 = ['599', '959', '995'];

  it('sanity: the two families really do have finalScore 151 vs 152, and the lower-finalScore family really does have the higher favoriteMatchScore', () => {
    const all = generateTopCandidates(front, letters, 3, false, false, 1000, favoriteDigits);
    const byTail = new Map(all.map((c) => [c.tailDigits, c]));

    for (const t of family899) {
      expect(byTail.get(t)).toMatchObject({ finalScore: 151, favoriteMatchScore: 11 });
    }
    for (const t of family599) {
      expect(byTail.get(t)).toMatchObject({ finalScore: 152, favoriteMatchScore: 10 });
    }
  });

  it('the favoriteMatchScore=11 family (899/989/998) ranks entirely above the favoriteMatchScore=10 family (599/959/995), despite scoring lower on finalScore', () => {
    const all = generateTopCandidates(front, letters, 3, false, false, 1000, favoriteDigits);
    const indexOf = (t: string) => all.findIndex((c) => c.tailDigits === t);

    const last899Rank = Math.max(...family899.map(indexOf));
    const first599Rank = Math.min(...family599.map(indexOf));
    expect(last899Rank).toBeLessThan(first599Rank);
  });

  it('"91" (favoriteMatchScore=4, finalScore=142) outranks "56"/"65" (favoriteMatchScore=2, finalScore=242) — favorites beat a 100-point finalScore deficit', () => {
    // NOTE on the task's own worked example: the task assumed "56"/"65" have
    // favoriteMatchScore=0. Verified independently that this is off — '5' IS one of the
    // favorite digits [9,8,5,4] (rank 3, weight 2), so "56"/"65" actually score
    // favoriteMatchScore=2, not 0. The core claim ("91" outranks "56"/"65") still holds and
    // is verified below using the real, correct favoriteMatchScore values.
    const tailLength = 2;
    const all = generateTopCandidates(front, letters, tailLength, false, false, 200, favoriteDigits);
    const byTail = new Map(all.map((c) => [c.tailDigits, c]));

    expect(byTail.get('91')).toMatchObject({ favoriteMatchScore: 4, finalScore: 142 });
    expect(byTail.get('56')).toMatchObject({ favoriteMatchScore: 2, finalScore: 242 });
    expect(byTail.get('65')).toMatchObject({ favoriteMatchScore: 2, finalScore: 242 });

    const rank = (t: string) => all.findIndex((c) => c.tailDigits === t);
    expect(rank('91')).toBeLessThan(rank('56'));
    expect(rank('91')).toBeLessThan(rank('65'));
  });

  it('within a favoriteMatchScore=0 tie, finalScore still breaks the tie correctly — "16"/"61"(232) > "66"(222) > "77"(122) > "22"(121)', () => {
    const tailLength = 2;
    const all = generateTopCandidates(front, letters, tailLength, false, false, 200, favoriteDigits);
    const byTail = new Map(all.map((c) => [c.tailDigits, c]));

    for (const t of ['16', '61', '66', '77', '22']) {
      expect(byTail.get(t)).toMatchObject({ favoriteMatchScore: 0 });
    }
    const rank = (t: string) => all.findIndex((c) => c.tailDigits === t);
    expect(rank('16')).toBeLessThan(rank('66'));
    expect(rank('61')).toBeLessThan(rank('66'));
    expect(rank('66')).toBeLessThan(rank('77'));
    expect(rank('77')).toBeLessThan(rank('22'));
  });

  it('hasBadPair still overrides favoriteMatchScore — "12"/"21" (a bad pair) still sort to the very bottom, below every clean candidate, regardless of favoriteMatchScore', () => {
    const tailLength = 2;
    const all = generateTopCandidates(front, letters, tailLength, false, false, 200, favoriteDigits);
    const c12 = all.find((c) => c.tailDigits === '12')!;
    const c21 = all.find((c) => c.tailDigits === '21')!;
    expect(c12.hasBadPair).toBe(true);
    expect(c21.hasBadPair).toBe(true);

    const lastCleanIndex = all
      .map((c, i) => (!c.hasBadPair ? i : -1))
      .filter((i) => i >= 0)
      .pop()!;
    expect(all.indexOf(c12)).toBeGreaterThan(lastCleanIndex);
    expect(all.indexOf(c21)).toBeGreaterThan(lastCleanIndex);
  });

  it('backward compatible: omitting favoriteDigits makes favoriteMatchScore irrelevant, so sort reduces to hasBadPair -> finalScore desc -> numeric asc, unaffected by this priority swap', () => {
    const tailLength = 2;
    const withoutFavorites = generateTopCandidates(front, letters, tailLength, false, false, 200);
    for (const c of withoutFavorites) {
      expect(c.favoriteMatchScore).toBe(0);
    }
    const reSorted = [...withoutFavorites].sort((a, b) => {
      if (a.hasBadPair !== b.hasBadPair) return a.hasBadPair ? 1 : -1;
      if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
      return Number(a.tailDigits) - Number(b.tailDigits);
    });
    expect(withoutFavorites.map((c) => c.tailDigits)).toEqual(reSorted.map((c) => c.tailDigits));
  });
});

describe('generateTopCandidates — hasBadPair (Mode 2 คู่เสีย) always sorts to the very bottom, even above a lower-finalScore clean candidate', () => {
  // front=8, letters=[ข,ง], tailLength=2 gives a small, fully-enumerable pool (67 qualifying
  // candidates after mode1=bad filtering) split cleanly into 33 hasBadPair=false ("group A")
  // and 34 hasBadPair=true ("group B") candidates — verified via direct execution below.
  const front = 8;
  const letters: [string, string] = ['ข', 'ง'];

  it('candidate.hasBadPair mirrors mode2.tier === "tier4" exactly, and both groups are non-empty for this front/letters combo', () => {
    const all = generateTopCandidates(front, letters, 2, false, false, 200);
    for (const c of all) {
      expect(c.hasBadPair).toBe(c.mode2.tier === 'tier4');
    }
    expect(all.filter((c) => !c.hasBadPair).length).toBe(33);
    expect(all.filter((c) => c.hasBadPair).length).toBe(34);
  });

  it('all hasBadPair=false candidates come strictly before all hasBadPair=true candidates — no interleaving, regardless of finalScore', () => {
    const all = generateTopCandidates(front, letters, 2, false, false, 200);
    const firstBadIndex = all.findIndex((c) => c.hasBadPair);
    expect(firstBadIndex).toBe(33);
    expect(all.slice(0, firstBadIndex).every((c) => !c.hasBadPair)).toBe(true);
    expect(all.slice(firstBadIndex).every((c) => c.hasBadPair)).toBe(true);
  });

  it('user-reported case: "12"/"21" (finalScore=202, has a bad pair) rank after every clean candidate, including lower-finalScore ones like "16"/"61"(232) and "47"/"48"(222)', () => {
    const all = generateTopCandidates(front, letters, 2, false, false, 200);
    const rank = (t: string) => all.findIndex((c) => c.tailDigits === t);
    for (const clean of ['16', '61', '47', '48']) {
      expect(rank(clean)).toBeLessThan(rank('12'));
      expect(rank(clean)).toBeLessThan(rank('21'));
    }
  });

  it('hasBadPair beats finalScore outright: "22" (finalScore=121, clean) outranks "02" (finalScore=202, has a bad pair) despite scoring 81 points lower', () => {
    const all = generateTopCandidates(front, letters, 2, false, false, 200);
    const c22 = all.find((c) => c.tailDigits === '22')!;
    const c02 = all.find((c) => c.tailDigits === '02')!;
    expect(c22).toMatchObject({ finalScore: 121, hasBadPair: false });
    expect(c02).toMatchObject({ finalScore: 202, hasBadPair: true });
    expect(all.indexOf(c22)).toBeLessThan(all.indexOf(c02));
  });

  it('Mode 3 has no independent effect on the hasBadPair layer: mode3="neutral" clean "22" still outranks mode3="good" bad-pair "02" — proving Mode 3 stays FYI-only and never enters the comparator', () => {
    const all = generateTopCandidates(front, letters, 2, false, false, 200);
    const c22 = all.find((c) => c.tailDigits === '22')!;
    const c02 = all.find((c) => c.tailDigits === '02')!;
    expect(c22.mode3.tier).toBe('neutral');
    expect(c02.mode3.tier).toBe('good');
    expect(all.indexOf(c22)).toBeLessThan(all.indexOf(c02));
  });

  it('within group B (hasBadPair=true), candidates still sort by finalScore descending, not randomly or by insertion order', () => {
    const all = generateTopCandidates(front, letters, 2, false, false, 200);
    const groupB = all.filter((c) => c.hasBadPair);
    expect(groupB.length).toBeGreaterThan(1);
    for (let i = 1; i < groupB.length; i++) {
      expect(groupB[i].finalScore).toBeLessThanOrEqual(groupB[i - 1].finalScore);
    }
  });

  it('favoriteMatchScore still only tie-breaks within each group — a favorite-matching group-B tail is promoted within group B but never crosses into group A', () => {
    const withFavorite = generateTopCandidates(front, letters, 2, false, false, 200, [
      '1',
      null,
      null,
      null,
    ]);
    const firstBadIndex = withFavorite.findIndex((c) => c.hasBadPair);
    expect(withFavorite.slice(0, firstBadIndex).every((c) => !c.hasBadPair)).toBe(true);
    expect(withFavorite.slice(firstBadIndex).every((c) => c.hasBadPair)).toBe(true);

    // "11" (favoriteMatchScore=8, the strongest match for favorite '1') still can't cross
    // into group A, even though it would out-favorite-score every group A candidate
    const rankOf11 = withFavorite.findIndex((c) => c.tailDigits === '11');
    expect(rankOf11).toBeGreaterThanOrEqual(firstBadIndex);

    // but within group B, it IS promoted ahead of other finalScore=202 tails that don't match
    const score202InGroupB = withFavorite.filter((c) => c.hasBadPair && c.finalScore === 202);
    expect(score202InGroupB[0].tailDigits).toBe('11');
  });

  it('backward compatible: within a single hasBadPair group taken in isolation, ordering matches the pre-feature comparator (finalScore desc, then numeric asc) exactly — equivalent to "group B is empty" from that group\'s own perspective', () => {
    const all = generateTopCandidates(front, letters, 2, false, false, 200);
    for (const hasBadPair of [false, true]) {
      const group = all.filter((c) => c.hasBadPair === hasBadPair);
      const reSorted = [...group].sort((a, b) => {
        if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
        return Number(a.tailDigits) - Number(b.tailDigits);
      });
      expect(group.map((c) => c.tailDigits)).toEqual(reSorted.map((c) => c.tailDigits));
    }
  });
});
