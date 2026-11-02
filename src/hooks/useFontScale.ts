import { useCallback, useLayoutEffect, useState } from 'react';

/**
 * ระดับขนาดตัวอักษรทั้งเว็บ (Accessibility Font Scale) — เปลี่ยน font-size ที่ <html>
 * ตรงๆ ทุก font-size ในระบบถูกแปลงเป็น rem แล้ว (ดู theme.css) จึง scale ตามอัตโนมัติ
 * ทั้งเว็บโดยไม่ต้องไปแก้ทีละจุด
 *
 * ปรับตามผลทดสอบผู้ใช้จริง (รอบ 2): ตัดระดับ "เล็ก" (87.5%) ออกเพราะเล็กเกินไปไม่มีใครใช้
 * และเพิ่ม 150%/175% ต่อจาก 125% เดิม เพราะกลุ่มผู้สูงอายุที่เป็นเป้าหมายหลักของฟีเจอร์นี้
 * ต้องการขยายได้มากกว่า 125% — ต้องแก้ตารางนี้ให้ตรงกับ inline script ใน index.html เสมอ
 * (duplicate ไว้ที่นั่นเพื่อ apply ก่อน paint แรกโดยไม่ต้องรอ React bundle โหลด)
 */
export const FONT_SCALE_LEVELS = [
  { key: 'normal', label: 'ปกติ', percent: 100, px: 16 },
  { key: 'large', label: 'ใหญ่', percent: 112.5, px: 18 },
  { key: 'xlarge', label: 'ใหญ่มาก', percent: 125, px: 20 },
  { key: 'xxlarge', label: 'ใหญ่พิเศษ', percent: 150, px: 24 },
  { key: 'xxxlarge', label: 'ใหญ่สุด', percent: 175, px: 28 },
] as const;

export type FontScaleKey = (typeof FONT_SCALE_LEVELS)[number]['key'];

const STORAGE_KEY = 'fontScale';
const DEFAULT_KEY: FontScaleKey = 'normal';

function isFontScaleKey(value: string | null): value is FontScaleKey {
  return FONT_SCALE_LEVELS.some((level) => level.key === value);
}

/**
 * export ไว้แยกจาก useFontScale() เพื่อ unit test ได้ตรงๆ โดยไม่ต้องพึ่ง React
 * (เช่น เคส migration: ค่าเก่าที่เคยมีในตารางรอบก่อน เช่น 'small' แต่ถูกลบออกไปแล้ว
 * ต้อง fallback เป็น 'normal' อย่างปลอดภัย ไม่ error และไม่ค้างที่ค่าที่ไม่มีอยู่จริง)
 */
export function readInitialFontScale(): FontScaleKey {
  if (typeof window === 'undefined') return DEFAULT_KEY;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isFontScaleKey(stored) ? stored : DEFAULT_KEY;
  } catch {
    return DEFAULT_KEY;
  }
}

function applyFontScale(key: FontScaleKey): void {
  const level =
    FONT_SCALE_LEVELS.find((l) => l.key === key) ??
    FONT_SCALE_LEVELS.find((l) => l.key === DEFAULT_KEY)!;
  document.documentElement.style.fontSize = `${level.px}px`;
}

export function useFontScale(): [FontScaleKey, (key: FontScaleKey) => void] {
  const [fontScale, setFontScaleState] = useState<FontScaleKey>(() => readInitialFontScale());

  // useLayoutEffect (ไม่ใช่ useEffect) เพื่อ apply ก่อน browser paint ของ commit นี้ —
  // ค่าเริ่มต้นจริงๆ ถูก apply ไปแล้วโดย inline script ใน index.html ก่อน React จะโหลดด้วยซ้ำ
  // ส่วนนี้คุมกรณีที่ผู้ใช้เปลี่ยนระดับระหว่างใช้งาน (re-render) ให้ sync ทันทีเช่นกัน
  useLayoutEffect(() => {
    applyFontScale(fontScale);
  }, [fontScale]);

  const setFontScale = useCallback((key: FontScaleKey) => {
    setFontScaleState(key);
    try {
      window.localStorage.setItem(STORAGE_KEY, key);
    } catch {
      // localStorage อาจใช้ไม่ได้ (private mode ฯลฯ) — ยังคงเปลี่ยนขนาดในเซสชันนี้ได้ปกติ
      // แค่จะไม่ถูกจำไว้ข้ามเซสชัน
    }
  }, []);

  return [fontScale, setFontScale];
}
