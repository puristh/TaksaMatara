import { useEffect, useSyncExternalStore } from 'react';
import { PLATE_TAIL_MODE } from '../config/featureFlags';

/**
 * ตรวจว่าฟอนต์ชุด custom ของภาพป้ายโหลดสำเร็จหรือไม่ — ถ้าไม่สำเร็จ PlateImage ถอยไปใช้ชุด noto
 * (ทั้งฟอนต์และตารางเลย์เอาต์) เพราะตำแหน่งข้อความคำนวณจาก metric ของฟอนต์ที่ตั้งใจใช้
 * ระหว่างรอ (font-display: block) ข้อความยังวางตามชุด custom และถูก clip ที่ขอบป้ายเสมอ
 */
export type PlateFontStatus = 'pending' | 'loaded' | 'failed';

/** ฟอนต์ custom ที่ต้องโหลดครบ: [CSS font shorthand, ตัวอย่างข้อความ] — ชื่อตรงกับ @font-face ใน theme.css
 * Norasi: ไฟล์เดิม (tailMode 'fit') หรือไฟล์ตัดหาง ('shortened') อย่างใดอย่างหนึ่ง */
export function customPlateFontFaces(tailMode: 'fit' | 'shortened' = PLATE_TAIL_MODE): ReadonlyArray<readonly [string, string]> {
  return [
    ['500 40px PlateDigits', '0123456789'],
    [`700 40px ${tailMode === 'shortened' ? 'PlateNorasiShortTail' : 'PlateNorasi'}`, 'กขกรุงเทพมหานคร'],
  ];
}
export const CUSTOM_PLATE_FONT_FACES = customPlateFontFaces();

type FontLoader = Pick<FontFaceSet, 'load'>;

/** โหลดทุกฟอนต์ใน CUSTOM_PLATE_FONT_FACES: สำเร็จเมื่อทุกตัวได้ FontFace ที่สถานะ loaded อย่างน้อย 1 ตัว */
export async function checkCustomPlateFonts(fonts: FontLoader): Promise<PlateFontStatus> {
  try {
    const results = await Promise.all(CUSTOM_PLATE_FONT_FACES.map(([font, text]) => fonts.load(font, text)));
    const ok = results.every((faces) => faces.length > 0 && faces.every((f) => f.status === 'loaded'));
    return ok ? 'loaded' : 'failed';
  } catch {
    return 'failed';
  }
}

let status: PlateFontStatus = 'pending';
let started = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function startLoad() {
  if (started || typeof document === 'undefined' || !document.fonts?.load) return;
  started = true;
  void checkCustomPlateFonts(document.fonts).then((s) => {
    status = s;
    listeners.forEach((l) => l());
  });
}

/** สถานะฟอนต์ custom (ร่วมกันทุกภาพป้ายในหน้า โหลดครั้งเดียว) — enabled = false ไม่โหลดเลย */
export function usePlateFontStatus(enabled: boolean): PlateFontStatus {
  const s = useSyncExternalStore(
    subscribe,
    () => status,
    () => 'pending' as PlateFontStatus,
  );
  useEffect(() => {
    if (enabled) startLoad();
  }, [enabled]);
  return s;
}
