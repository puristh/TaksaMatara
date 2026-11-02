import { calculateMode1 } from './mode1';
import { calculateMode2 } from './mode2';
import { calculateMode3 } from './mode3';
import { detectAuctionNumber } from './auctionNumber';
import { detectPopularNumber } from './popularNumber';
import { combineVerdictAndBadges, resolveAuctionConflict } from './combine';
import type { PlateInput, PlateVerdict } from './types';

export interface AnalyzePlateOptions {
  /** toggle "แสดงเลขประมูลทั้งหมด" ตามข้อ 6 — default false (ซ่อนตามปกติ) */
  showAllAuction?: boolean;
}

export function analyzePlate(input: PlateInput, options: AnalyzePlateOptions = {}): PlateVerdict {
  const mode1 = calculateMode1(input);
  const mode2 = calculateMode2(input.tailDigits);
  const mode3 = calculateMode3(input);
  const auction = detectAuctionNumber(input.tailDigits);
  const popular = detectPopularNumber(input.tailDigits);

  const { verdict, badges } = combineVerdictAndBadges(mode1, mode2, mode3);
  const { hiddenByDefault, extraBadge } = resolveAuctionConflict(
    auction,
    mode2.tier,
    options.showAllAuction ?? false,
  );

  return {
    input,
    mode1,
    mode2,
    mode3,
    auction,
    popular,
    verdict,
    badges: extraBadge ? [...badges, extraBadge] : badges,
    hiddenByDefault,
  };
}
