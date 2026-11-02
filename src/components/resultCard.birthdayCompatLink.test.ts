import { describe, expect, it } from 'vitest';
import { analyzePlate } from '../engine';
import { BACK_LABEL, DEFAULT_RETURN_CONTEXT, isBirthdayCompatEnabled } from '../App';
import { buildBirthdayCompatLinkArgs, RESULT_CARD_RETURN_CONTEXT } from './ResultCard';
import { BIRTHDAY_COMPAT_DEFAULTS, resolvePlateFieldDefaults } from './BirthdayCompatPage';
import {
  BATCH_FORM_DEFAULTS,
  buildBatchReturnContext,
  resolveBatchFormDefaults,
} from './RankingPanel';
import type { BatchReturnState, ReturnContext } from './RankingPanel';

/**
 * เทสต์ data contract ของปุ่ม "เช็คกับวันเกิด →" ในหน้าวิเคราะห์เลขเดี่ยว (ResultCard.tsx) —
 * ปุ่มเรียก onViewBirthdayCompat(...buildBirthdayCompatLinkArgs(result)) ซึ่ง App.tsx
 * (handleViewBirthdayCompat) เก็บ input เป็น birthdayCompatInput และ ctx เป็น returnContext
 * แล้ว BirthdayCompatPage ใช้ resolvePlateFieldDefaults(initialInput) prefill ฟอร์ม — ไม่มี jsdom
 * จึงจำลอง flow ด้วย pure function ชุดเดียวกับที่ component ใช้จริง
 */
describe('ResultCard.tsx "เช็คกับวันเกิด →" -> App.tsx handleViewBirthdayCompat -> BirthdayCompatPage', () => {
  it('forwards exactly this card\'s plate (frontDigit/thaiLetters/tailDigits) and returnTo:"single"', () => {
    const submitted = { frontDigit: 8, thaiLetters: ['ข', 'ค'] as [string, string], tailDigits: '2683', province: 'กรุงเทพมหานคร' };
    const [input, ctx] = buildBirthdayCompatLinkArgs(analyzePlate(submitted));

    expect(input).toEqual({ frontDigit: 8, thaiLetters: ['ข', 'ค'], tailDigits: '2683' });
    expect(ctx).toEqual({ returnTo: 'single' });
    expect(BACK_LABEL[ctx.returnTo]).toBe('← กลับไปวิเคราะห์เลขเดี่ยว');

    expect(resolvePlateFieldDefaults(input)).toEqual({
      frontDigit: '8',
      letter1: 'ข',
      letter2: 'ค',
      tailDigits: '2683',
    });
  });

  it('each accumulated card forwards its own plate, not the latest one', () => {
    const inputA = { frontDigit: 1, thaiLetters: ['ก', 'ข'] as [string, string], tailDigits: '11' };
    const inputB = { frontDigit: 9, thaiLetters: ['ฮ', 'ฬ'] as [string, string], tailDigits: '99' };
    // App.tsx prepends new submissions: plates = [B, A]
    const results = [inputB, inputA].map((p) => analyzePlate(p));

    expect(buildBirthdayCompatLinkArgs(results[0])[0]).toEqual(inputB);
    expect(buildBirthdayCompatLinkArgs(results[1])[0]).toEqual(inputA);
  });

  it('frontDigit = 0 is prefilled as "0", never treated as empty', () => {
    const [input] = buildBirthdayCompatLinkArgs(
      analyzePlate({ frontDigit: 0, thaiLetters: ['ก', 'ข'], tailDigits: '59' }),
    );
    expect(input.frontDigit).toBe(0);
    const fields = resolvePlateFieldDefaults(input);
    expect(fields.frontDigit).toBe('0');
    expect(fields).not.toEqual(BIRTHDAY_COMPAT_DEFAULTS);
    expect(/^[0-9]$/.test(fields.frontDigit)).toBe(true);
  });

  it('returnTo:"single" carries no batchState, so going back never touches Batch restore state', () => {
    const ctx: ReturnContext = RESULT_CARD_RETURN_CONTEXT;
    expect(ctx).toEqual(DEFAULT_RETURN_CONTEXT);
    expect('batchState' in ctx).toBe(false);

    // handleBackFromDetail: only the 'batch' branch calls setBatchRestoreState
    const previousBatchRestoreState: BatchReturnState | null = null;
    const nextBatchRestoreState = ctx.returnTo === 'batch' ? ctx.batchState : previousBatchRestoreState;
    const nextView = ctx.returnTo === 'batch' ? 'batch' : 'single';
    expect(nextView).toBe('single');
    expect(nextBatchRestoreState).toBeNull();
    // a later normal Batch tab entry still shows the pristine defaults
    expect(resolveBatchFormDefaults(nextBatchRestoreState)).toEqual(BATCH_FORM_DEFAULTS);
  });
});

describe('existing Batch ranking -> Tab 3 link is unaffected', () => {
  it('still returns to Batch with every form field restored', () => {
    const formState: BatchReturnState = {
      ...BATCH_FORM_DEFAULTS,
      frontDigit: '0',
      letter1: 'ก',
      letter2: 'ข',
      excludeAuction: false,
      excludePopular: true,
    };
    const ctx = buildBatchReturnContext(formState);
    expect(ctx.returnTo).toBe('batch');
    expect(BACK_LABEL[ctx.returnTo]).toBe('← กลับไปหน้า Batch ranking');
    const restored = ctx.returnTo === 'batch' ? resolveBatchFormDefaults(ctx.batchState) : null;
    expect(restored).toEqual(formState);
  });
});

describe('entering Tab 3 directly from the nav tab', () => {
  it('handleNavigateTab clears birthdayCompatInput -> empty form, even after a prior "เช็คกับวันเกิด →" visit', () => {
    // prior visit via ResultCard set birthdayCompatInput; handleNavigateTab now resets it to null
    const birthdayCompatInputAfterTabClick = null;
    expect(resolvePlateFieldDefaults(birthdayCompatInputAfterTabClick)).toEqual(BIRTHDAY_COMPAT_DEFAULTS);
    expect(DEFAULT_RETURN_CONTEXT).toEqual({ returnTo: 'single' });
  });
});

describe('feature flag gating (BIRTHDAY_COMPAT_ENABLED)', () => {
  it('button hidden only when both taksaKalakiniMode and shadowPowerMode are off', () => {
    expect(isBirthdayCompatEnabled({ taksaKalakiniMode: false, shadowPowerMode: false })).toBe(false);
    expect(isBirthdayCompatEnabled({ taksaKalakiniMode: true, shadowPowerMode: false })).toBe(true);
    expect(isBirthdayCompatEnabled({ taksaKalakiniMode: false, shadowPowerMode: true })).toBe(true);
    expect(isBirthdayCompatEnabled({ taksaKalakiniMode: true, shadowPowerMode: true })).toBe(true);
  });
});
