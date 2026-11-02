import { describe, expect, it } from 'vitest';
import { FEATURE_FLAGS } from './featureFlags';
import { calculateMode1 } from '../engine/mode1';
import { analyzeFiveElement } from '../engine/fiveElement';
import { analyzeAyatana6 } from '../engine/ayatana6';
import { analyzeTaksaKalakini } from '../engine/taksaKalakini';
import { analyzeShadowPower } from '../engine/shadowPower';

describe('FEATURE_FLAGS — ayatana6Mode is fully independent of fiveElementMode and the core engine', () => {
  it('both default to true out of the box', () => {
    expect(FEATURE_FLAGS.fiveElementMode).toBe(true);
    expect(FEATURE_FLAGS.ayatana6Mode).toBe(true);
  });

  it('turning ayatana6Mode off does not touch fiveElementMode\'s value', () => {
    const original = FEATURE_FLAGS.ayatana6Mode;
    FEATURE_FLAGS.ayatana6Mode = false;
    try {
      expect(FEATURE_FLAGS.fiveElementMode).toBe(true);
    } finally {
      FEATURE_FLAGS.ayatana6Mode = original;
    }
  });

  it('turning ayatana6Mode off does not change Mode 1 (core numerology engine) output at all — the flag is a pure UI-gating concern, never consulted by engine calculations', () => {
    const input = { frontDigit: 1, thaiLetters: ['ก', 'ข'] as [string, string], tailDigits: '59' };
    const before = calculateMode1(input);

    FEATURE_FLAGS.ayatana6Mode = false;
    const during = calculateMode1(input);
    FEATURE_FLAGS.ayatana6Mode = true;
    const after = calculateMode1(input);

    expect(during).toEqual(before);
    expect(after).toEqual(before);
  });

  it('turning ayatana6Mode off does not change the five-element (Mode 4) calculation output either', () => {
    const before = analyzeFiveElement('2683');

    FEATURE_FLAGS.ayatana6Mode = false;
    const during = analyzeFiveElement('2683');
    FEATURE_FLAGS.ayatana6Mode = true;

    expect(during).toEqual(before);
  });

  it('analyzeAyatana6 itself never reads FEATURE_FLAGS — output is identical whether the flag is on or off, proving the engine layer has zero coupling to the flag (it is only checked at render time in ModeDetailPanel/App)', () => {
    const input = { frontDigit: 1, thaiLetters: ['ก', 'ข'] as [string, string], tailDigits: '59' };

    FEATURE_FLAGS.ayatana6Mode = false;
    const whileOff = analyzeAyatana6(input);
    FEATURE_FLAGS.ayatana6Mode = true;
    const whileOn = analyzeAyatana6(input);

    expect(whileOff).toEqual(whileOn);
  });
});

describe('FEATURE_FLAGS — taksaKalakiniMode (Mode 6) and shadowPowerMode (Mode 7) toggle independently of each other and of everything else', () => {
  it('all four flags default to true out of the box', () => {
    expect(FEATURE_FLAGS.fiveElementMode).toBe(true);
    expect(FEATURE_FLAGS.ayatana6Mode).toBe(true);
    expect(FEATURE_FLAGS.taksaKalakiniMode).toBe(true);
    expect(FEATURE_FLAGS.shadowPowerMode).toBe(true);
  });

  it('turning taksaKalakiniMode off does not touch shadowPowerMode, ayatana6Mode, or fiveElementMode', () => {
    const original = FEATURE_FLAGS.taksaKalakiniMode;
    FEATURE_FLAGS.taksaKalakiniMode = false;
    try {
      expect(FEATURE_FLAGS.shadowPowerMode).toBe(true);
      expect(FEATURE_FLAGS.ayatana6Mode).toBe(true);
      expect(FEATURE_FLAGS.fiveElementMode).toBe(true);
    } finally {
      FEATURE_FLAGS.taksaKalakiniMode = original;
    }
  });

  it('turning shadowPowerMode off does not touch taksaKalakiniMode, ayatana6Mode, or fiveElementMode', () => {
    const original = FEATURE_FLAGS.shadowPowerMode;
    FEATURE_FLAGS.shadowPowerMode = false;
    try {
      expect(FEATURE_FLAGS.taksaKalakiniMode).toBe(true);
      expect(FEATURE_FLAGS.ayatana6Mode).toBe(true);
      expect(FEATURE_FLAGS.fiveElementMode).toBe(true);
    } finally {
      FEATURE_FLAGS.shadowPowerMode = original;
    }
  });

  it('toggling either flag off/on never changes Mode 1 (core engine) output — both are pure UI-gating concerns', () => {
    const input = { frontDigit: 1, thaiLetters: ['ก', 'ข'] as [string, string], tailDigits: '59' };
    const before = calculateMode1(input);

    FEATURE_FLAGS.taksaKalakiniMode = false;
    FEATURE_FLAGS.shadowPowerMode = false;
    const bothOff = calculateMode1(input);
    FEATURE_FLAGS.taksaKalakiniMode = true;
    FEATURE_FLAGS.shadowPowerMode = true;
    const bothOn = calculateMode1(input);

    expect(bothOff).toEqual(before);
    expect(bothOn).toEqual(before);
  });

  it('analyzeTaksaKalakini/analyzeShadowPower never read FEATURE_FLAGS — output identical regardless of flag state, proving the engine layer has zero coupling to the flags (only checked at render time in App.tsx/RankingPanel/BirthdayCompatPage)', () => {
    const input = { thaiLetters: ['ด', 'ก'] as [string, string] };

    FEATURE_FLAGS.taksaKalakiniMode = false;
    FEATURE_FLAGS.shadowPowerMode = false;
    const taksaOff = analyzeTaksaKalakini(input, 'วันพฤหัสบดี');
    const shadowOff = analyzeShadowPower(input, 'วันพฤหัสบดี');

    FEATURE_FLAGS.taksaKalakiniMode = true;
    FEATURE_FLAGS.shadowPowerMode = true;
    const taksaOn = analyzeTaksaKalakini(input, 'วันพฤหัสบดี');
    const shadowOn = analyzeShadowPower(input, 'วันพฤหัสบดี');

    expect(taksaOff).toEqual(taksaOn);
    expect(shadowOff).toEqual(shadowOn);
  });
});
