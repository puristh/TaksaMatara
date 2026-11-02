import { describe, expect, it } from 'vitest';
import { BACK_LABEL, DEFAULT_RETURN_CONTEXT } from './App';
import {
  buildBatchReturnContext,
  resolveBatchFormDefaults,
  THAI_LETTER_PATTERN,
} from './components/RankingPanel';
import type { BatchReturnState, ReturnContext } from './components/RankingPanel';

/**
 * เทสต์ data contract ของปุ่ม "กลับ" ในหน้าธาตุจีน/อายตนะ6/เช็ควันเกิด — ไม่มี jsdom ให้
 * render+click component จริงได้ (ดู pattern เดียวกันใน ranking.birthdayCompatLink.test.ts)
 * จึงจำลอง flow ที่ App.tsx ทำจริง (handleViewFiveElement/Ayatana6/BirthdayCompat ตั้ง
 * returnContext ตาม ctx ที่ได้รับ แล้ว handleBackFromDetail อ่านค่านั้นมาตัดสินใจปลายทาง +
 * ข้อความปุ่ม) โดยเรียก DEFAULT_RETURN_CONTEXT/BACK_LABEL ตรงๆ ร่วมกับ
 * buildBatchReturnContext/resolveBatchFormDefaults ของ RankingPanel.tsx
 */
describe('App — returnContext resolution for the five-element/ayatana6/birthday-compat "back" button', () => {
  it('DEFAULT_RETURN_CONTEXT is returnTo:"single" — this is what every call site falls back to when no context is passed', () => {
    expect(DEFAULT_RETURN_CONTEXT).toEqual({ returnTo: 'single' });
  });

  it('BACK_LABEL has the correct Thai text for each returnTo value', () => {
    expect(BACK_LABEL.single).toBe('← กลับไปวิเคราะห์เลขเดี่ยว');
    expect(BACK_LABEL.batch).toBe('← กลับไปหน้า Batch ranking');
  });

  it('arriving from ResultCard.tsx ("วิเคราะห์เลขเดี่ยว"): onViewFiveElement/onViewAyatana6 are called with only 1 argument there, so ctx is undefined — App.tsx\'s handler does `ctx ?? DEFAULT_RETURN_CONTEXT`, which must resolve to "single", unchanged from before this feature existed', () => {
    const ctx: ReturnContext | undefined = undefined; // exactly what ResultCard.tsx passes
    const resolved = ctx ?? DEFAULT_RETURN_CONTEXT;
    expect(resolved).toEqual({ returnTo: 'single' });
    expect(BACK_LABEL[resolved.returnTo]).toBe('← กลับไปวิเคราะห์เลขเดี่ยว');
  });

  it('entering five-element/ayatana6/birthday-compat directly (no link at all, e.g. typing the hash by hand) must fall back to "single" without throwing — same defaulting mechanism as the ResultCard.tsx case above, since App.tsx\'s returnContext state initializes to DEFAULT_RETURN_CONTEXT and no navigation ever ran', () => {
    const resolved = DEFAULT_RETURN_CONTEXT;
    expect(() => BACK_LABEL[resolved.returnTo]).not.toThrow();
    expect(BACK_LABEL[resolved.returnTo]).toBe('← กลับไปวิเคราะห์เลขเดี่ยว');
  });

  it('full simulated flow: RankingPanel row (front=8, letters=[ข,ง], excludeAuction=false, excludePopular=true, rowLimit=20, favoriteDigits=[9,8,5,4]) → click "ดูมุมมองธาตุจีน 5 ธาตุ" → App.tsx stores returnContext → click "back" → view becomes batch AND every form field is restored exactly', () => {
    const filledFormState: BatchReturnState = {
      frontDigit: '8',
      letter1: 'ข',
      letter2: 'ง',
      excludeAuction: false,
      excludePopular: true,
      rowLimit: 20,
      favoriteDigits: ['9', '8', '5', '4'],
    };

    // step 1: RankingPanel builds the context it attaches to the link (currentReturnContext)
    const linkedCtx = buildBatchReturnContext(filledFormState);

    // step 2: App.tsx's handleViewFiveElement receives it (ctx is defined, not undefined here)
    const storedReturnContext = linkedCtx ?? DEFAULT_RETURN_CONTEXT;
    expect(storedReturnContext.returnTo).toBe('batch');

    // step 3: user clicks "back" — handleBackFromDetail branches on returnTo
    expect(BACK_LABEL[storedReturnContext.returnTo]).toBe('← กลับไปหน้า Batch ranking');
    const nextView = storedReturnContext.returnTo === 'batch' ? 'batch' : 'single';
    expect(nextView).toBe('batch');

    // step 4: batchRestoreState is set from returnContext.batchState, RankingPanel remounts
    // and resolves its field defaults from it — every field must match the original exactly
    const restoredFields =
      storedReturnContext.returnTo === 'batch'
        ? resolveBatchFormDefaults(storedReturnContext.batchState)
        : null;
    expect(restoredFields).toEqual(filledFormState);
  });

  it('the same flow, but for the ayatana6 and birthday-compat links — identical mechanism, same guarantee', () => {
    const filledFormState: BatchReturnState = {
      frontDigit: '1',
      letter1: 'ก',
      letter2: 'ข',
      excludeAuction: true,
      excludePopular: false,
      rowLimit: 30,
      favoriteDigits: ['3', '', '7', ''],
    };
    const linkedCtx = buildBatchReturnContext(filledFormState);
    const storedReturnContext = linkedCtx ?? DEFAULT_RETURN_CONTEXT;

    expect(BACK_LABEL[storedReturnContext.returnTo]).toBe('← กลับไปหน้า Batch ranking');
    const restoredFields =
      storedReturnContext.returnTo === 'batch'
        ? resolveBatchFormDefaults(storedReturnContext.batchState)
        : null;
    expect(restoredFields).toEqual(filledFormState);
  });

  it('THAI_LETTER_PATTERN sanity: restored letter1/letter2 values from a real flow are still valid Thai letters — the round trip does not corrupt the field format the form validation expects', () => {
    const filledFormState: BatchReturnState = {
      frontDigit: '8',
      letter1: 'ข',
      letter2: 'ง',
      excludeAuction: false,
      excludePopular: true,
      rowLimit: 20,
      favoriteDigits: ['9', '8', '5', '4'],
    };
    const ctx = buildBatchReturnContext(filledFormState);
    const restored = ctx.returnTo === 'batch' ? resolveBatchFormDefaults(ctx.batchState) : null;
    expect(restored && THAI_LETTER_PATTERN.test(restored.letter1)).toBe(true);
    expect(restored && THAI_LETTER_PATTERN.test(restored.letter2)).toBe(true);
  });
});
