/**
 * ปุ่ม "คัดลอก" ใต้ภาพจำลองป้าย (PlateImage.tsx) — ข้อความใน SVG ตั้งไม่ให้เลือกได้ (ซ้อน 3 ชั้น
 * ทำตัวนูน ถ้าลากเลือกจะได้เลขซ้ำ 3 รอบ) ปุ่มนี้จึงเป็นทางคัดลอกเลขทะเบียนแทนชิปข้อความเดิม
 * แยก logic เป็น pure function เพื่อเทสใน vitest ได้โดยไม่ต้องมี DOM
 */
import type { PlateInput } from '../engine/types';
import { formatPlateText } from '../engine/plateText';

/**
 * ข้อความที่คัดลอก: เลขทะเบียน เช่น "3 ขย 426" — ต่อท้ายจังหวัดเฉพาะเมื่อผู้ใช้พิมพ์เอง
 * (จังหวัดค่าเริ่มต้นบนภาพป้ายไม่ใช่ข้อมูลของผู้ใช้ จึงไม่ต่อท้าย)
 */
export function plateCopyText(
  input: Pick<PlateInput, 'frontDigit' | 'thaiLetters' | 'tailDigits' | 'province'>,
): string {
  const plate = formatPlateText(input);
  const typed = input.province?.trim();
  return typed ? `${plate} ${typed}` : plate;
}

export interface CopyEnv {
  /** navigator.clipboard (มีเฉพาะ secure context — https/localhost) */
  clipboard?: { writeText(text: string): Promise<void> } | null;
  /** วิธีสำรอง (textarea + execCommand('copy')) คืน true เมื่อสำเร็จ */
  fallback?: ((text: string) => boolean) | null;
}

/** คัดลอกด้วย Clipboard API ก่อน ถ้าไม่มีหรือถูกปฏิเสธ ใช้วิธีสำรอง — คืน false ถ้าไม่สำเร็จทั้งคู่ */
export async function copyPlateText(text: string, env: CopyEnv): Promise<boolean> {
  if (env.clipboard) {
    try {
      await env.clipboard.writeText(text);
      return true;
    } catch {
      // ถูกปฏิเสธสิทธิ์/ไม่รองรับ → ลองวิธีสำรอง
    }
  }
  if (env.fallback) {
    try {
      return env.fallback(text);
    } catch {
      return false;
    }
  }
  return false;
}

/** วิธีสำรองสำหรับเบราว์เซอร์ที่ไม่มี navigator.clipboard (เช่น เปิดผ่าน http ที่ไม่ใช่ localhost) */
export function execCommandCopy(text: string): boolean {
  if (typeof document === 'undefined') return false;
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.top = '0';
  ta.style.left = '0';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  try {
    ta.select();
    ta.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(ta);
  }
}

/** สภาพแวดล้อมจริงของเบราว์เซอร์ */
export function browserCopyEnv(): CopyEnv {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  return { clipboard: nav?.clipboard ?? null, fallback: execCommandCopy };
}

export type CopyStatus = 'idle' | 'copied' | 'failed';

/** ข้อความสถานะที่แสดงและประกาศผ่าน aria-live */
export function copyStatusMessage(status: CopyStatus, text: string): string {
  if (status === 'copied') return 'คัดลอกแล้ว';
  if (status === 'failed') return `คัดลอกไม่สำเร็จ — คัดลอกเองได้จากข้อความนี้: ${text}`;
  return '';
}
