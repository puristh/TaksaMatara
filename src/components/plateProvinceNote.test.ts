import { describe, expect, it } from 'vitest';
import { PLATE_IMAGE_DEFAULT_PROVINCE } from '../config/featureFlags';
import { plateProvinceNote, provincePlaceholder } from './plateLayout';
import { plateCopyText } from './plateCopy';

describe('province field placeholder — reads the configured default', () => {
  it('uses PLATE_IMAGE_DEFAULT_PROVINCE (not a hard-coded name)', () => {
    expect(PLATE_IMAGE_DEFAULT_PROVINCE).not.toBeNull();
    expect(provincePlaceholder()).toBe(`ค่าเริ่มต้น: ${PLATE_IMAGE_DEFAULT_PROVINCE}`);
    expect(provincePlaceholder('เชียงใหม่')).toBe('ค่าเริ่มต้น: เชียงใหม่');
  });
  it('no placeholder when the province line is turned off (config null)', () => {
    expect(provincePlaceholder(null)).toBeUndefined();
  });
});

describe('"จังหวัดในภาพ: ค่าเริ่มต้น" note next to the plate image', () => {
  it('shown when the user did not type a province (empty / blank / undefined)', () => {
    for (const province of [undefined, '', '   ']) {
      expect(plateProvinceNote({ province })).toBe('จังหวัดในภาพ: ค่าเริ่มต้น');
    }
  });
  it('hidden as soon as the user types a province', () => {
    expect(plateProvinceNote({ province: 'เชียงใหม่' })).toBeNull();
  });
  it('never shown when the config is null (no province line on the image)', () => {
    expect(plateProvinceNote({ province: undefined }, null)).toBeNull();
    expect(plateProvinceNote({ province: 'เชียงใหม่' }, null)).toBeNull();
  });
  it('copy button behaviour is unchanged: default province is never copied', () => {
    expect(plateCopyText({ frontDigit: 3, thaiLetters: ['ข', 'ย'], tailDigits: '426' })).toBe('3 ขย 426');
  });
});
