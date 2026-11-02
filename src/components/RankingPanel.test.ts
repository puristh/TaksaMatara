import { describe, expect, it } from 'vitest';
import {
  BATCH_FORM_DEFAULTS,
  buildBatchReturnContext,
  classifyTargetSlots,
  createEmptyTargetTails,
  hasAnyEntry,
  RANKING_PANEL_DEFAULTS,
  rankTargetTails,
  resolveBatchFormDefaults,
  resolveInputLocks,
  TARGET_SLOT_COUNT,
  THAI_LETTER_PATTERN,
} from './RankingPanel';
import { comparePlates } from '../engine/comparePlates';
import type { BatchReturnState } from './RankingPanel';

describe('RankingPanel — the "แนะนำเลขทะเบียน (Batch)" form must be empty on first load, not "8 ขค"', () => {
  it('all editable field defaults are empty strings (no hardcoded example front/letters left behind)', () => {
    expect(RANKING_PANEL_DEFAULTS.frontDigit).toBe('');
    expect(RANKING_PANEL_DEFAULTS.letter1).toBe('');
    expect(RANKING_PANEL_DEFAULTS.letter2).toBe('');
  });

  it('the empty defaults fail the same isValid check the component uses internally — confirms resultsByLength stays null on first load, so no Top N table can render (the existing "กรอกข้อมูลด้านบนให้ครบก่อน..." placeholder message shows instead, with zero new logic needed)', () => {
    const isValid =
      /^[0-9]$/.test(RANKING_PANEL_DEFAULTS.frontDigit) &&
      THAI_LETTER_PATTERN.test(RANKING_PANEL_DEFAULTS.letter1) &&
      THAI_LETTER_PATTERN.test(RANKING_PANEL_DEFAULTS.letter2);

    expect(isValid).toBe(false);
  });

  it('the pristine (never-touched) default state must NOT be treated as "started typing" — otherwise the red form-error banner would show immediately on first load, which is exactly the intimidating first-impression this task set out to remove', () => {
    const hasStartedTyping =
      RANKING_PANEL_DEFAULTS.frontDigit !== '' ||
      RANKING_PANEL_DEFAULTS.letter1 !== '' ||
      RANKING_PANEL_DEFAULTS.letter2 !== '';

    expect(hasStartedTyping).toBe(false);
  });
});

/**
 * เทสต์ data contract ของฟีเจอร์ "จำต้นทาง" — RankingPanel ส่ง returnContext ไปกับลิงก์ธาตุจีน/
 * อายตนะ6/เช็ควันเกิด (ผ่าน buildBatchReturnContext) แล้วรับ restoreState กลับมา prefill ฟอร์ม
 * (ผ่าน resolveBatchFormDefaults) — ไม่มี jsdom ให้ render+click component จริงได้ จึงจำลอง flow
 * ทั้งหมดที่ระดับ pure function สองตัวนี้ตรงๆ (ดู pattern เดียวกันใน BirthdayCompatPage.test.ts
 * ที่เทส resolvePlateFieldDefaults และ ranking.birthdayCompatLink.test.ts ที่เทส data contract
 * ของลิงก์ "เช็คกับวันเกิด →" แบบเดียวกัน)
 */
describe('RankingPanel — return-context data contract (จำต้นทาง กลับไป Batch ranking พร้อม restore ฟอร์ม)', () => {
  const filledFormState: BatchReturnState = {
    frontDigit: '8',
    letter1: 'ข',
    letter2: 'ง',
    excludeAuction: false,
    excludePopular: true,
    rowLimit: 20,
    favoriteDigits: ['9', '8', '5', '4'],
  };

  it('buildBatchReturnContext(fields) carries every field the task requires — frontDigit, letter1, letter2, excludeAuction, excludePopular, rowLimit, favoriteDigits (all 4 slots, in order)', () => {
    const ctx = buildBatchReturnContext(filledFormState);
    expect(ctx).toEqual({ returnTo: 'batch', batchState: filledFormState });
    if (ctx.returnTo === 'batch') {
      expect(ctx.batchState.favoriteDigits).toEqual(['9', '8', '5', '4']);
    }
  });

  it('simulated flow: RankingPanel row → five-element/ayatana6/birthday-compat link → "back" → resolveBatchFormDefaults(returnContext.batchState) reproduces the exact original form state, field for field', () => {
    // this is exactly what App.tsx's handleBackFromDetail + RankingPanel's fieldDefaults do:
    // setBatchRestoreState(returnContext.batchState) then resolveBatchFormDefaults(restoreState)
    const returnContext = buildBatchReturnContext(filledFormState);
    expect(returnContext.returnTo).toBe('batch');
    const restored =
      returnContext.returnTo === 'batch'
        ? resolveBatchFormDefaults(returnContext.batchState)
        : null;

    expect(restored).toEqual(filledFormState);
    expect(restored?.frontDigit).toBe('8');
    expect(restored?.letter1).toBe('ข');
    expect(restored?.letter2).toBe('ง');
    expect(restored?.excludeAuction).toBe(false);
    expect(restored?.excludePopular).toBe(true);
    expect(restored?.rowLimit).toBe(20);
    expect(restored?.favoriteDigits).toEqual(['9', '8', '5', '4']);
  });

  it('falsy-but-real values survive the round trip — excludeAuction=false and rowLimit=10 must not be silently replaced by defaults just because they look "empty"', () => {
    const edgeCaseState: BatchReturnState = {
      frontDigit: '0',
      letter1: 'ก',
      letter2: 'ก',
      excludeAuction: false,
      excludePopular: false,
      rowLimit: 10,
      favoriteDigits: ['', '', '', ''],
    };
    const ctx = buildBatchReturnContext(edgeCaseState);
    const restored = ctx.returnTo === 'batch' ? resolveBatchFormDefaults(ctx.batchState) : null;
    expect(restored).toEqual(edgeCaseState);
  });

  it('resolveBatchFormDefaults(undefined) and resolveBatchFormDefaults(null) both fall back to BATCH_FORM_DEFAULTS — the "no return context" / direct-tab-entry case, must not throw', () => {
    expect(() => resolveBatchFormDefaults(undefined)).not.toThrow();
    expect(() => resolveBatchFormDefaults(null)).not.toThrow();
    expect(resolveBatchFormDefaults(undefined)).toEqual(BATCH_FORM_DEFAULTS);
    expect(resolveBatchFormDefaults(null)).toEqual(BATCH_FORM_DEFAULTS);
  });

  it('BATCH_FORM_DEFAULTS matches the pre-feature defaults exactly (empty front/letters, excludeAuction=true, excludePopular=false, rowLimit=10, no favorites) — confirms normal tab entry to Batch (restoreState=undefined) is unaffected by this feature', () => {
    expect(BATCH_FORM_DEFAULTS).toEqual({
      frontDigit: '',
      letter1: '',
      letter2: '',
      excludeAuction: true,
      excludePopular: false,
      rowLimit: 10,
      favoriteDigits: ['', '', '', ''],
      targetTails: ['', '', '', '', '', '', '', '', '', ''],
    });
  });
});

/**
 * โหมด "เลขที่เล็งไว้" — ไม่มี jsdom จึงเทสที่ระดับ pure function ที่ component ใช้ตรงๆ:
 * resolveInputLocks() คือค่าที่ส่งเข้า prop disabled ของทั้ง 2 กลุ่มช่องกรอก, hasAnyEntry()
 * คือ isTargetMode ที่สลับระหว่างตาราง Top N กับลิสต์ผลจัดอันดับ
 */
describe('RankingPanel — "เลขที่เล็งไว้" vs "เลขที่ชอบ" mutual exclusivity', () => {
  const emptyTargets = createEmptyTargetTails();
  const emptyFavorites = ['', '', '', ''];

  it('has exactly 10 target slots, all empty by default', () => {
    expect(TARGET_SLOT_COUNT).toBe(10);
    expect(emptyTargets).toEqual(Array(10).fill(''));
  });

  it('both empty → neither side disabled, and target mode is off (Top N table shows)', () => {
    expect(resolveInputLocks(emptyTargets, emptyFavorites)).toEqual({
      targetsDisabled: false,
      favoritesDisabled: false,
    });
    expect(hasAnyEntry(emptyTargets)).toBe(false);
  });

  it('typing into 1 target slot (any slot, not just the first) disables every favorite input', () => {
    const targets = [...emptyTargets];
    targets[6] = '9';
    expect(resolveInputLocks(targets, emptyFavorites)).toEqual({
      targetsDisabled: false,
      favoritesDisabled: true,
    });
    expect(hasAnyEntry(targets)).toBe(true);
  });

  it('typing into 1 favorite slot disables every target input', () => {
    expect(resolveInputLocks(emptyTargets, ['', '', '7', ''])).toEqual({
      targetsDisabled: true,
      favoritesDisabled: false,
    });
  });

  it('clearing every filled slot unlocks the other side immediately (no stale disabled state)', () => {
    const filled = [...emptyTargets];
    filled[0] = '95';
    filled[1] = '995';
    expect(resolveInputLocks(filled, emptyFavorites).favoritesDisabled).toBe(true);

    const partlyCleared = [...filled];
    partlyCleared[0] = '';
    expect(resolveInputLocks(partlyCleared, emptyFavorites).favoritesDisabled).toBe(true);

    const cleared = [...partlyCleared];
    cleared[1] = '';
    expect(resolveInputLocks(cleared, emptyFavorites)).toEqual({
      targetsDisabled: false,
      favoritesDisabled: false,
    });
    expect(hasAnyEntry(cleared)).toBe(false);

    // และกลับกัน: ล้างเลขที่ชอบจนว่าง ช่องเลขที่เล็งไว้ต้องกลับมาใช้ได้
    expect(resolveInputLocks(emptyTargets, ['5', '', '', '']).targetsDisabled).toBe(true);
    expect(resolveInputLocks(emptyTargets, emptyFavorites).targetsDisabled).toBe(false);
  });

  it('never disables both sides at once, even if a restored state somehow has both filled — targets stay editable so the user can clear them', () => {
    const locks = resolveInputLocks(['95', ...Array(9).fill('')], ['9', '', '', '']);
    expect(locks.targetsDisabled && locks.favoritesDisabled).toBe(false);
    expect(locks).toEqual({ targetsDisabled: false, favoritesDisabled: true });
  });

  it('whitespace-only slots do not count as "started typing"', () => {
    expect(hasAnyEntry(['  ', '', ...Array(8).fill('')])).toBe(false);
  });

  it('targetTails round-trips through the return context (restore after visiting five-element/ayatana6/birthday pages)', () => {
    const state = { ...BATCH_FORM_DEFAULTS, frontDigit: '8', letter1: 'ข', letter2: 'ง' };
    state.targetTails = ['95', '995', '8899', ...Array(7).fill('')];
    const ctx = buildBatchReturnContext(state);
    const restored = ctx.returnTo === 'batch' ? resolveBatchFormDefaults(ctx.batchState) : null;
    expect(restored?.targetTails).toEqual(state.targetTails);
  });
});

describe('RankingPanel — "เลขที่เล็งไว้" engine (rankTargetTails → comparePlates)', () => {
  const front = 8;
  const letters: [string, string] = ['ข', 'ง']; // ข=2, ง=2 → front+letters = 12

  /**
   * คำนวณด้วยมือ:
   * - "95":   Mode1 12+14=26 good(100) · Mode2 [95] tier1(50) · Mode3 8+14=22→4 good(2) = 152
   * - "995":  Mode1 12+23=35 good(100) · Mode2 [99,95] tier1(50) · Mode3 8+23=31→4 good(2) = 152
   * - "8899": Mode1 12+34=46 excellent(200) · Mode2 [88 tier3, 89 tier1, 99 tier1] → tier1(50)
   *           · Mode3 8+34=42→6 good(2) = 252
   * → 8899 อันดับ 1, 95 กับ 995 เสมอกันที่อันดับ 2 (ไม่มีคู่เสียทั้งคู่ คะแนนเท่ากัน)
   */
  const targets = ['95', '995', '8899', ...Array(7).fill('')];

  it('mixed-length tails (2/3/4 digits) are ranked best → worst with hand-computed scores', () => {
    const results = rankTargetTails(front, letters, targets);

    expect(results.map((r) => r.input.tailDigits)).toEqual(['8899', '95', '995']);
    expect(results.map((r) => r.finalScore)).toEqual([252, 152, 152]);
    expect(results.map((r) => r.rank)).toEqual([1, 2, 2]);
    expect(results.map((r) => r.mode1.total)).toEqual([46, 26, 35]);
    expect(results.map((r) => r.mode1.tier)).toEqual(['excellent', 'good', 'good']);
    expect(results.every((r) => r.mode2.tier === 'tier1' && !r.hasBadPair)).toBe(true);
    expect(results.map((r) => r.mode3.digitRoot)).toEqual([6, 4, 4]);
    // slotIndex บอกว่ามาจากช่องไหน — tie ที่อันดับ 2 เรียงตามลำดับที่ผู้ใช้ชอบ (ช่องก่อนขึ้นก่อน)
    expect(results.map((r) => r.slotIndex)).toEqual([2, 0, 1]);
    for (const r of results) {
      expect(r.input.frontDigit).toBe(8);
      expect(r.input.thaiLetters).toEqual(['ข', 'ง']);
    }
  });

  it('is a thin wrapper over comparePlates — same ranks/scores as calling comparePlates directly', () => {
    const direct = comparePlates(
      ['95', '995', '8899'].map((tailDigits) => ({ frontDigit: front, thaiLetters: letters, tailDigits })),
    );
    const viaTargets = rankTargetTails(front, letters, targets);
    for (const d of direct) {
      const match = viaTargets.find((v) => v.input.tailDigits === d.input.tailDigits)!;
      expect(match.rank).toBe(d.rank);
      expect(match.finalScore).toBe(d.finalScore);
    }
  });

  it('when user-preference order is reversed, a tie is broken by the new slot order instead', () => {
    const results = rankTargetTails(front, letters, ['995', '95', '8899']);
    expect(results.map((r) => r.input.tailDigits)).toEqual(['8899', '995', '95']);
  });

  it('a plate with a bad pair or Mode1=bad still appears (ranked last), never silently dropped', () => {
    // "12": Mode1 12+3=15 excellent แต่คู่ 12 เป็น tier4 → hasBadPair ต้องแพ้ 95
    const results = rankTargetTails(front, letters, ['12', '95']);
    expect(results.map((r) => r.input.tailDigits)).toEqual(['95', '12']);
    expect(results[1].hasBadPair).toBe(true);
    expect(results.map((r) => r.rank)).toEqual([1, 2]);
  });
});

describe('RankingPanel — "เลขที่เล็งไว้" validation of malformed tails', () => {
  it('classifies each slot: empty / valid / invalid (non-digit, <2, >4) / duplicate', () => {
    expect(
      classifyTargetSlots(['95', '', 'ab', '5', '12345', '9a9', '995', '95', ' 8899 ', '0000']),
    ).toEqual([
      'valid',
      'empty',
      'invalid',
      'invalid',
      'invalid',
      'invalid',
      'valid',
      'duplicate',
      'valid',
      'valid',
    ]);
  });

  it('malformed slots are skipped without throwing — only valid ones reach comparePlates', () => {
    const input = ['ab', '5', '12345', '95', '-1', '9.5', '', '', '', ''];
    expect(() => rankTargetTails(8, ['ข', 'ง'], input)).not.toThrow();
    const results = rankTargetTails(8, ['ข', 'ง'], input);
    expect(results).toHaveLength(1);
    expect(results[0].input.tailDigits).toBe('95');
    expect(results[0].slotIndex).toBe(3);
  });

  it('all slots malformed → empty result (UI shows the "no valid tail yet" message), no error', () => {
    expect(rankTargetTails(8, ['ข', 'ง'], ['x', '1', '99999', ...Array(7).fill('')])).toEqual([]);
  });

  it('duplicate tails are ranked once (first slot kept)', () => {
    const results = rankTargetTails(8, ['ข', 'ง'], ['95', '95', '995']);
    expect(results.map((r) => r.slotIndex)).toEqual([0, 2]);
  });
});
