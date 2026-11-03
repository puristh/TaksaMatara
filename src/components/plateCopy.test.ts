import { describe, expect, it } from 'vitest';
import { copyPlateText, copyStatusMessage, plateCopyText } from './plateCopy';

describe('plateCopyText — what the "คัดลอก" button copies', () => {
  it('plate number only when the province was not typed (default province is not appended)', () => {
    expect(plateCopyText({ frontDigit: 3, thaiLetters: ['ข', 'ย'], tailDigits: '426' })).toBe('3 ขย 426');
    expect(plateCopyText({ frontDigit: null, thaiLetters: ['ศ', 'ร'], tailDigits: '91', province: '  ' })).toBe('ศร 91');
  });
  it('front digit 0 is kept (0 ≠ null)', () => {
    expect(plateCopyText({ frontDigit: 0, thaiLetters: ['ฐ', 'ร'], tailDigits: '18' })).toBe('0 ฐร 18');
  });
  it('typed province is appended, trimmed', () => {
    expect(plateCopyText({ frontDigit: 3, thaiLetters: ['ข', 'ย'], tailDigits: '426', province: ' เชียงใหม่ ' })).toBe(
      '3 ขย 426 เชียงใหม่',
    );
  });
});

describe('copyPlateText — clipboard with fallback', () => {
  it('uses navigator.clipboard when available', async () => {
    const written: string[] = [];
    const ok = await copyPlateText('3 ขย 426', {
      clipboard: { writeText: async (t) => void written.push(t) },
      fallback: () => {
        throw new Error('should not be called');
      },
    });
    expect(ok).toBe(true);
    expect(written).toEqual(['3 ขย 426']);
  });
  it('falls back when clipboard is missing or rejects', async () => {
    const used: string[] = [];
    const fallback = (t: string) => (used.push(t), true);
    expect(await copyPlateText('a', { clipboard: null, fallback })).toBe(true);
    expect(
      await copyPlateText('b', {
        clipboard: { writeText: () => Promise.reject(new Error('denied')) },
        fallback,
      }),
    ).toBe(true);
    expect(used).toEqual(['a', 'b']);
  });
  it('reports failure when both ways fail', async () => {
    expect(await copyPlateText('x', { clipboard: null, fallback: () => false })).toBe(false);
    expect(
      await copyPlateText('x', {
        clipboard: { writeText: () => Promise.reject(new Error('denied')) },
        fallback: () => {
          throw new Error('no execCommand');
        },
      }),
    ).toBe(false);
    expect(await copyPlateText('x', {})).toBe(false);
  });
  it('status messages: success is short, failure tells the user and shows the text to copy by hand', () => {
    expect(copyStatusMessage('copied', '3 ขย 426')).toBe('คัดลอกแล้ว');
    expect(copyStatusMessage('failed', '3 ขย 426')).toContain('คัดลอกไม่สำเร็จ');
    expect(copyStatusMessage('failed', '3 ขย 426')).toContain('3 ขย 426');
    expect(copyStatusMessage('idle', '3 ขย 426')).toBe('');
  });
});
