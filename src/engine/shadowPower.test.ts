import { describe, expect, it } from 'vitest';
import { analyzeShadowPower } from './shadowPower';

describe('analyzeShadowPower — extends Mode 6 (taksaKalakini) with STAR_POWER values, reused directly from ayatana6/lookupTables', () => {
  it('"ด,ก" on วันพฤหัสบดี -> เสาร์(power 10, กาลกิณี) + จันทร์(power 15, มูละ) -> totalPower 25', () => {
    const result = analyzeShadowPower({ thaiLetters: ['ด', 'ก'] }, 'วันพฤหัสบดี');
    expect(result.letters).toEqual([
      {
        letter: 'ด',
        star: 'เสาร์',
        role: 'กาลกิณี',
        roleMeaning: 'อัปมงคล ควรหลีกเลี่ยง',
        power: 10,
        isKalakini: true,
      },
      {
        letter: 'ก',
        star: 'จันทร์',
        role: 'มูละ',
        roleMeaning: 'รากฐาน ทรัพย์สิน ความมั่นคงทางการเงิน',
        power: 15,
        isKalakini: false,
      },
    ]);
    expect(result.totalPower).toBe(25);
  });

  it('totalPower is a plain sum of the two letter powers — no digit-root reduction (unlike Ayatana6)', () => {
    // อ (อาทิตย์, power 6) twice -> 6+6=12, not reduced further
    const result = analyzeShadowPower({ thaiLetters: ['อ', 'อ'] }, 'วันอาทิตย์');
    expect(result.letters.map((l) => l.power)).toEqual([6, 6]);
    expect(result.totalPower).toBe(12);
  });

  it('reuses the same taksaDay resolution as Mode 6 — Wednesday day/night still gives different roles/powers where applicable', () => {
    const day = analyzeShadowPower({ thaiLetters: ['จ', 'อ'] }, 'วันพุธกลางวัน');
    const night = analyzeShadowPower({ thaiLetters: ['จ', 'อ'] }, 'วันพุธกลางคืน');
    expect(day.letters[0].role).toBe('กาลกิณี');
    expect(night.letters[0].role).not.toBe('กาลกิณี');
  });
});
