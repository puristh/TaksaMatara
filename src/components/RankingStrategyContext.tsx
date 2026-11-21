import { createContext, useContext } from 'react';
import { DEFAULT_RANKING_STRATEGY } from '../engine/types';
import type { RankingStrategy } from '../engine/types';

/**
 * strategy การจัดอันดับของทั้งแอป — App ตัดสินครั้งเดียวตอนเปิดเว็บ (resolveRankingStrategyFromWindow)
 * แล้วส่งลงมาทาง context · ไม่มี Provider (เช่นในเทสต์) = ค่าเริ่มต้น 'market-first'
 */
export const RankingStrategyContext = createContext<RankingStrategy>(DEFAULT_RANKING_STRATEGY);

export function useRankingStrategy(): RankingStrategy {
  return useContext(RankingStrategyContext);
}

/** ป้ายเล็กมุมแถบเครื่องมือ ให้เจ้าของรู้ตัวว่าเปิดโหมดคัดเข้มอยู่ — โหมดปกติไม่ render อะไรเลย */
export function StrictModeIndicator({ strategy }: { strategy: RankingStrategy }) {
  if (strategy !== 'strict') return null;
  return <span className="strict-mode-pill">โหมดคัดเข้ม</span>;
}
