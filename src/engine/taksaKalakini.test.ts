import { describe, expect, it } from 'vitest';
import { analyzeTaksaKalakini, resolveTaksaDay } from './taksaKalakini';

describe('resolveTaksaDay — weekday -> TaksaDay, with the Wednesday day/night split', () => {
  it('non-Wednesday weekdays map directly, wednesdayPeriod is ignored/unnecessary', () => {
    expect(resolveTaksaDay(0)).toBe('วันอาทิตย์');
    expect(resolveTaksaDay(1)).toBe('วันจันทร์');
    expect(resolveTaksaDay(2)).toBe('วันอังคาร');
    expect(resolveTaksaDay(4)).toBe('วันพฤหัสบดี');
    expect(resolveTaksaDay(5)).toBe('วันศุกร์');
    expect(resolveTaksaDay(6)).toBe('วันเสาร์');
  });

  it('Wednesday (weekDay=3) requires wednesdayPeriod — defaults to day if omitted', () => {
    expect(resolveTaksaDay(3)).toBe('วันพุธกลางวัน');
    expect(resolveTaksaDay(3, 'day')).toBe('วันพุธกลางวัน');
    expect(resolveTaksaDay(3, 'night')).toBe('วันพุธกลางคืน');
  });
});

describe('analyzeTaksaKalakini — "วันเกิดพฤหัสบดี -> กาลกิณี=เสาร์ -> อักษร ด,ต,ถ,ท,ธ,น ควรถูกแฟลกว่าควรเลี่ยง" (task worked example)', () => {
  it('a letter belonging to เสาร์ (e.g. ด) on วันพฤหัสบดี is flagged isKalakini=true', () => {
    const result = analyzeTaksaKalakini({ thaiLetters: ['ด', 'ก'] }, 'วันพฤหัสบดี');
    expect(result.letterRoles[0]).toMatchObject({ letter: 'ด', star: 'เสาร์', role: 'กาลกิณี', isKalakini: true });
    expect(result.hasKalakini).toBe(true);
    expect(result.verdict).toBe('ไม่แนะนำสำหรับวันเกิดนี้');
  });

  it('every letter in the เสาร์ star group (ด,ต,ถ,ท,ธ,น) is flagged กาลกิณี on วันพฤหัสบดี', () => {
    for (const letter of ['ด', 'ต', 'ถ', 'ท', 'ธ', 'น']) {
      const result = analyzeTaksaKalakini({ thaiLetters: [letter, 'อ'] }, 'วันพฤหัสบดี');
      const target = result.letterRoles.find((l) => l.letter === letter);
      expect(target?.star).toBe('เสาร์');
      expect(target?.role).toBe('กาลกิณี');
      expect(target?.isKalakini).toBe(true);
    }
  });

  it('a plate with no กาลกิณี letter at all on วันพฤหัสบดี -> hasKalakini=false, positive verdict', () => {
    // จันทร์ (ก) is มูละ on วันพฤหัสบดี, not กาลกิณี
    const result = analyzeTaksaKalakini({ thaiLetters: ['ก', 'ก'] }, 'วันพฤหัสบดี');
    expect(result.hasKalakini).toBe(false);
    expect(result.verdict).toBe('เหมาะกับวันเกิดนี้');
  });
});

describe('analyzeTaksaKalakini — Wednesday day vs night give genuinely different results (different กาลกิณี star)', () => {
  it('letter จ (อังคาร star) is กาลกิณี on วันพุธกลางวัน but NOT on วันพุธกลางคืน', () => {
    const day = analyzeTaksaKalakini({ thaiLetters: ['จ', 'ก'] }, 'วันพุธกลางวัน');
    const night = analyzeTaksaKalakini({ thaiLetters: ['จ', 'ก'] }, 'วันพุธกลางคืน');

    expect(day.letterRoles[0]).toMatchObject({ letter: 'จ', star: 'อังคาร', role: 'กาลกิณี', isKalakini: true });
    expect(day.hasKalakini).toBe(true);

    expect(night.letterRoles[0]).toMatchObject({ letter: 'จ', star: 'อังคาร', isKalakini: false });
    expect(night.hasKalakini).toBe(false);

    // same plate, same letters, different verdict purely because of day/night
    expect(day.verdict).not.toBe(night.verdict);
  });

  it('the two Wednesday variants have different กาลกิณี stars entirely (อังคาร for day, พฤหัสบดี for night)', () => {
    // จ -> อังคาร star; is กาลกิณี on วันพุธกลางวัน per TAKSA_TABLE
    const dayResult = analyzeTaksaKalakini({ thaiLetters: ['จ', 'อ'] }, 'วันพุธกลางวัน');
    expect(dayResult.letterRoles[0]).toMatchObject({ star: 'อังคาร', role: 'กาลกิณี', isKalakini: true });

    // บ -> พฤหัสบดี star; is กาลกิณี on วันพุธกลางคืน per TAKSA_TABLE
    const nightResult = analyzeTaksaKalakini({ thaiLetters: ['บ', 'อ'] }, 'วันพุธกลางคืน');
    expect(nightResult.letterRoles[0]).toMatchObject({ star: 'พฤหัสบดี', role: 'กาลกิณี', isKalakini: true });
  });
});
