import { DEFAULT_RANKING_STRATEGY } from '../engine/types';
import type { RankingStrategy } from '../engine/types';

/**
 * โหมดคัดเข้ม (strategy 'strict') — ซ่อนไว้ ไม่มีปุ่ม/ลิงก์/ข้อความในหน้าปกติ
 * เปิด: เข้าลิงก์ที่มี ?strict=1 (เช่น https://…/?strict=1#batch) · ปิด: ?strict=0
 * ค่าที่เลือกจำไว้ใน localStorage ของเบราว์เซอร์นั้น (ครอบ try/catch — เปิดไม่ได้ก็ใช้ค่าเริ่มต้น)
 *
 * นี่เป็นการ "ซ่อน" ไม่ใช่ความปลอดภัย: ใครรู้พารามิเตอร์ (หรืออ่านโค้ด JS ที่ส่งไปกับเว็บ) ก็เปิดได้
 * และโหมดนี้ไม่มีข้อมูลลับ — เปลี่ยนแค่ลำดับ/ถ้อยคำ ข้อมูลตาราง/คะแนนเหมือนกันทุกโหมด
 */

export const STRICT_STORAGE_KEY = 'carlicense.rankingStrategy';
export const STRICT_QUERY_PARAM = 'strict';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** อ่าน ?strict=1 / ?strict=0 จาก location.search — ค่าอื่นหรือไม่มี = null (ไม่เปลี่ยนค่าที่จำไว้) */
export function parseStrictParam(search: string): boolean | null {
  let value: string | null;
  try {
    value = new URLSearchParams(search).get(STRICT_QUERY_PARAM);
  } catch {
    return null;
  }
  if (value === '1') return true;
  if (value === '0') return false;
  return null;
}

/**
 * ตัดสิน strategy ตอนเปิดเว็บ (pure: รับ search + storage เข้ามา เทสได้โดยไม่ต้องมี window)
 * - ?strict=1 → 'strict' และจำไว้ · ?strict=0 → 'market-first' และลบค่าที่จำไว้
 * - ไม่มีพารามิเตอร์ → ใช้ค่าที่จำไว้ ('strict' เท่านั้นที่นับ ค่าอื่น = ค่าเริ่มต้น)
 * - storage ใช้ไม่ได้ (null/throw) → ยังได้ผลจากพารามิเตอร์ในครั้งนั้น ไม่ throw ออกไป
 */
export function resolveRankingStrategy(search: string, storage: StorageLike | null): RankingStrategy {
  const param = parseStrictParam(search);
  if (param === true) {
    try {
      storage?.setItem(STRICT_STORAGE_KEY, 'strict');
    } catch {
      /* จำไม่ได้ (private mode/บล็อก storage) — ใช้ได้เฉพาะรอบนี้ */
    }
    return 'strict';
  }
  if (param === false) {
    try {
      storage?.removeItem(STRICT_STORAGE_KEY);
    } catch {
      /* ไม่มีอะไรต้องทำ */
    }
    return DEFAULT_RANKING_STRATEGY;
  }
  try {
    return storage?.getItem(STRICT_STORAGE_KEY) === 'strict' ? 'strict' : DEFAULT_RANKING_STRATEGY;
  } catch {
    return DEFAULT_RANKING_STRATEGY;
  }
}

/** URL เดิมที่ตัดพารามิเตอร์ strict ออก (คง path, พารามิเตอร์อื่น และ hash) — null ถ้าไม่มีอะไรต้องตัด */
export function urlWithoutStrictParam(pathname: string, search: string, hash: string): string | null {
  const params = new URLSearchParams(search);
  if (!params.has(STRICT_QUERY_PARAM)) return null;
  params.delete(STRICT_QUERY_PARAM);
  const rest = params.toString();
  return `${pathname}${rest ? `?${rest}` : ''}${hash}`;
}

/** อ่านจาก window จริงครั้งเดียวตอนเปิดเว็บ แล้วตัด ?strict ออกจากแถบที่อยู่ (กันลิงก์ถูกแชร์ต่อพร้อมพารามิเตอร์) */
export function resolveRankingStrategyFromWindow(): RankingStrategy {
  if (typeof window === 'undefined') return DEFAULT_RANKING_STRATEGY;
  let storage: StorageLike | null = null;
  try {
    storage = window.localStorage;
  } catch {
    storage = null;
  }
  const { pathname, search, hash } = window.location;
  const strategy = resolveRankingStrategy(search, storage);
  try {
    const cleaned = urlWithoutStrictParam(pathname, search, hash);
    if (cleaned !== null) window.history.replaceState(window.history.state, '', cleaned);
  } catch {
    /* แถบที่อยู่ยังมี ?strict อยู่ — ไม่กระทบการทำงาน */
  }
  return strategy;
}
