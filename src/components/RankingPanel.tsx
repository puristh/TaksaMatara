import { Fragment, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { generateTopCandidates } from '../engine/ranking';
import type { RankingCandidate, TailLength } from '../engine/ranking';
import { badgeClass, badgeIcon, popularStars } from './ResultCard';
import { ModeDetailPanel } from './ModeDetailPanel';
import { PlateImage } from './PlateImage';
import { PlateWithTags } from './PlateWithTags';
import { plateCopyText } from './plateCopy';
import { plateProvinceNote, plateVariantFor, resolvePlateProvinceLabel } from './plateLayout';
import { rankTier, ScoreFigure, VerdictPill } from './RankEmphasis';
import { CompactRankRow, ExpandButton, PlateToggleButton, RankWithLabel } from './CompactRankRow';
import { comparePlates } from '../engine/comparePlates';
import { combineVerdictAndBadges } from '../engine/combine';
import { detectAuctionNumber } from '../engine/auctionNumber';
import { detectPopularNumber } from '../engine/popularNumber';
import { DEFAULT_RANKING_STRATEGY } from '../engine/types';
import type { AuctionNumberInfo, Badge, PopularNumberInfo, RankingStrategy } from '../engine/types';
import { useRankingStrategy } from './RankingStrategyContext';
import type { ComparisonResult } from '../engine/comparePlates';
import type { PlateInput } from '../engine';
import { formatPlateText } from '../engine/plateText';

type DetailModeInput = Pick<PlateInput, 'frontDigit' | 'thaiLetters' | 'tailDigits'>;

const TABLE_COLUMN_COUNT = 7; // อันดับ, เลขทะเบียนเต็ม, Verdict, Badge, คะแนนรวม, ป้ายพิเศษ (เลขประมูล + เลขสวย รวมคอลัมน์เดียว), การดำเนินการ (ดูรายละเอียด + เช็คกับวันเกิด รวมคอลัมน์เดียว)

export const THAI_LETTER_PATTERN = /^[ก-ฮ]$/;

/**
 * ฟอร์มต้องว่างเปล่าตอนโหลดหน้า Batch ครั้งแรก (ไม่ใช่ '8 ขค' ที่ฝังไว้เดิม) — export ไว้
 * แยกเพื่อเทสได้ตรงๆ ว่าไม่มีค่า default หลุดกลับมา ผลคือ isValid=false ตอนโหลดครั้งแรก
 * และ resultsByLength=null จึงไม่มีตาราง Top N โชว์ค้าง (ข้อความ "กรอกข้อมูลด้านบนให้ครบ
 * ก่อน..." ที่มีอยู่แล้วจะแสดงแทนโดยอัตโนมัติ ไม่ต้องเพิ่ม logic ใหม่)
 */
export const RANKING_PANEL_DEFAULTS = {
  frontDigit: '',
  letter1: '',
  letter2: '',
};

const TAIL_LENGTHS: TailLength[] = [2, 3, 4];

const TAIL_LENGTH_UNIT: Record<TailLength, string> = {
  2: '2 หลัก',
  3: '3 หลัก',
  4: '4 หลัก',
};

const ROW_LIMIT_OPTIONS = [10, 20, 30] as const;
export type RowLimit = (typeof ROW_LIMIT_OPTIONS)[number];

const FAVORITE_SLOT_LABELS = ['อันดับ 1 (ชอบสุด)', 'อันดับ 2', 'อันดับ 3', 'อันดับ 4'];

type ResultsByLength = Record<TailLength, RankingCandidate[]>;

/**
 * ความกว้างป้ายทะเบียนเล็ก (px บนจอ) — ค่าเดียวกันทั้งตาราง (จอกว้าง) และแถวกะทัดรัด เพื่อให้แถวที่ 820px สูง 80–90px
 * (ผู้ใช้กำหนด ~150px · เดิมตารางใช้ 176px)
 */
export const RANKING_ROW_PLATE_WIDTH = 150;
/** จอแคบ (พื้นที่ผลลัพธ์ < RANKING_NARROW_MAX_PX เช่นจอ 390px): ป้ายเล็ก ~120–130px ให้ป้ายอันดับ + ป้าย + verdict/คะแนน อยู่แถวเดียว */
export const RANKING_ROW_PLATE_WIDTH_NARROW = 124;
export const RANKING_NARROW_MAX_PX = 480;
/**
 * ความกว้างพื้นที่ผลลัพธ์ขั้นต่ำ (rem) ที่ใช้ตารางได้โดยไม่เลื่อนแนวนอน — แคบกว่านี้ใช้แถวกะทัดรัด
 * วัดเป็น rem (ไม่ใช่ px) เพราะตารางกว้างตามขนาดตัวอักษร: ตัวอักษร 175% ใช้แถวกะทัดรัดทุกขนาดจอ (กรอบแอปกว้างสุด 880px)
 * วัดจากตารางจริง (ป้ายเล็ก 150px, ป้ายอันดับ/verdict 80%, ข้อความขนาดเดียวกับส่วนบนของหน้า, badge ไม่ตัดบรรทัด,
 * 30 แถว รวมเลขประมูล + เลขโปรด 4 ตัว, หมวดอักษร/เลขหน้าหลายแบบ, ชื่อกลุ่มเลขประมูลไม่ตัดกลางคำและไม่ล้นคอลัมน์): ตารางกว้างน้อยสุด
 * 885px (ชื่อกลุ่มยาวสุด "เลขหาม/เลขหาบ (XYYX)" — รอบ 4 วัดได้ 871px เพราะแท็กนี้ล้นคอลัมน์ไป 14px) + ขอบกรอบ 16px = 56.3rem
 * → 56.5rem (904px, ~961px ที่ตัวอักษร 100%) จุดสลับเดิมก่อน type scale — รอบ type scale (ข้อความ 15px) ตารางต้องการ 940px
 * จึงเคยขยับเป็น 60rem; ข้อความกลับขนาดเดิมแล้วตารางแคบลงพอ จึงกลับมาที่ 56.5rem (ไม่ได้ย่อเนื้อหาให้พอดี)
 * พื้นที่ผลลัพธ์แบบตารางกว้างได้ถึง RANKING_WIDE_MAX_PX (ดู .ranking-wide ใน theme.css)
 */
export const RANKING_TABLE_MIN_REM = 56.5;
/**
 * เมื่อมีแถว verdict "ไม่ควรใช้" (เกิดได้เฉพาะโหมดเลขที่เล็งไว้ — โหมดปกติคัดเลขที่ Mode 1 ไม่ดีออกตั้งแต่ engine):
 * pill "ไม่ควรใช้" กว้างกว่า "ใช้ได้" 25px และตัดบรรทัดไม่ได้ ตารางกรณีหนักสุด (ไม่ควรใช้ + เลขประมูล "เลขหาม/เลขหาบ (XYYX)")
 * กว้างน้อยสุด 910px + ขอบกรอบ 16px = 57.9rem → 58rem (928px, ~985px ที่ตัวอักษร 100%)
 * จอแคบกว่านี้ใช้แถวกะทัดรัด (ไม่ย่อเนื้อหาและไม่ให้ตารางเลื่อนแนวนอน)
 */
export const RANKING_TABLE_MIN_REM_WITH_BAD_VERDICT = 58;

/** 'table' = ตาราง (จอกว้าง) · 'compact' = แถวกะทัดรัด (จอแคบ/ตัวอักษรใหญ่) */
export type RankingLayout = 'table' | 'compact';
/** พื้นที่ผลลัพธ์แบบตารางกว้างสุด (px) — ตรงกับ .ranking-wide ใน theme.css */
export const RANKING_WIDE_MAX_PX = 1040;

/** เลือกตาราง/แถวกะทัดรัดจากความกว้างพื้นที่ผลลัพธ์ (px) และขนาดตัวอักษรราก (px) */
export function chooseRankingLayout(
  containerPx: number,
  rootFontPx: number,
  minRem: number = RANKING_TABLE_MIN_REM,
): RankingLayout {
  return containerPx / rootFontPx >= minRem ? 'table' : 'compact';
}

/** ความกว้างขั้นต่ำของตาราง (rem) ตามแถวที่แสดง — ดู RANKING_TABLE_MIN_REM_WITH_BAD_VERDICT */
export function tableMinRemFor(rows: readonly { verdict: boolean }[]): number {
  return rows.some((r) => !r.verdict) ? RANKING_TABLE_MIN_REM_WITH_BAD_VERDICT : RANKING_TABLE_MIN_REM;
}

/** ความกว้างป้ายเล็กในแถวกะทัดรัดตามความกว้างพื้นที่ผลลัพธ์ (px) — ตารางใช้ RANKING_ROW_PLATE_WIDTH เสมอ */
export function compactPlateWidth(containerPx: number): number {
  return containerPx < RANKING_NARROW_MAX_PX ? RANKING_ROW_PLATE_WIDTH_NARROW : RANKING_ROW_PLATE_WIDTH;
}

function rootFontPx(): number {
  return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
}

interface RankingLayoutState {
  layout: RankingLayout;
  plateWidth: number;
}

function measureLayout(containerPx: number, fontPx: number, minRem: number): RankingLayoutState {
  return { layout: chooseRankingLayout(containerPx, fontPx, minRem), plateWidth: compactPlateWidth(containerPx) };
}

/**
 * ตาราง/แถวกะทัดรัดตามความกว้างจริงของแผง (ResizeObserver) และขนาดตัวอักษร (style ของ <html> ที่ useFontScale ตั้ง)
 * วัดใน useLayoutEffect จึงสลับก่อน paint แรก · ค่าตั้งต้นประมาณจากความกว้างหน้าต่าง · ไม่มี DOM (SSR/เทสต์) = ตาราง
 */
function useRankingLayout(ref: RefObject<HTMLElement>, minRem: number, forced?: RankingLayout): RankingLayoutState {
  const [state, setState] = useState<RankingLayoutState>(() =>
    typeof window === 'undefined'
      ? { layout: 'table', plateWidth: RANKING_ROW_PLATE_WIDTH }
      : measureLayout(Math.min(window.innerWidth - 57, RANKING_WIDE_MAX_PX), rootFontPx(), minRem),
  );
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const next = measureLayout(el.clientWidth, rootFontPx(), minRem);
      setState((prev) => (prev.layout === next.layout && prev.plateWidth === next.plateWidth ? prev : next));
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [ref, minRem]);
  return forced ? { ...state, layout: forced } : state;
}

/** เปิด/ปิดส่วนขยายของแถวเดียว (แถวอื่นคงเดิม — เปิดได้หลายแถวพร้อมกัน ไม่ใช่ accordion เดี่ยว) */
export function toggleExpandedKey(prev: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(prev);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

/** Badge (คู่เลข / ผลรวม / เลขโปรด) ของหนึ่งทะเบียน — ใช้ทั้งแถวตารางและส่วนที่ขยายของแถวกะทัดรัด (ทั้งสองโหมด) */
function CandidateBadges({ c }: { c: Pick<RankingCandidate, 'badges' | 'matchedFavoriteDigits'> }) {
  return (
    <div className="badges-cell">
      {c.badges.map((badge, bi) => (
        <span key={bi} className={badgeClass(badge.type)}>
          {badgeIcon(badge.type)} {badge.text}
        </span>
      ))}
      {c.matchedFavoriteDigits.length > 0 && (
        <span className="favorite-badge">♥ เลขโปรด: {c.matchedFavoriteDigits.join(', ')}</span>
      )}
    </div>
  );
}

/** จำนวนช่อง "เลขที่เล็งไว้" — ผู้ใช้กรอกเลขท้ายที่อยากได้เองแล้วให้ระบบจัดอันดับเฉพาะชุดนี้ */
export const TARGET_SLOT_COUNT = 10;

/** กฎเลขท้ายเดียวกับ PlateForm/ComparePage: ตัวเลขล้วน 2-4 หลัก */
export const TAIL_DIGITS_PATTERN = /^[0-9]{2,4}$/;

export function createEmptyTargetTails(): string[] {
  return Array.from({ length: TARGET_SLOT_COUNT }, () => '');
}

export function hasAnyEntry(values: string[]): boolean {
  return values.some((v) => v.trim() !== '');
}

/**
 * "เลขที่เล็งไว้" กับ "เลขที่ชอบ" ใช้พร้อมกันไม่ได้ — ฝั่งไหนมีค่าอย่างน้อย 1 ช่อง อีกฝั่ง disabled
 * ทันที ทั้งคู่ว่างเปล่า = ใช้งานได้ทั้งคู่ กรณีมีค่าทั้งคู่ (ไม่ควรเกิดผ่าน UI แต่เผื่อ restoreState
 * เพี้ยน) ให้ "เลขที่เล็งไว้" ชนะและยังแก้ไขได้ — ห้าม disable ทั้งสองฝั่งพร้อมกันเด็ดขาด ไม่งั้น
 * ผู้ใช้จะติดล็อกลบค่าออกไม่ได้เลย
 */
export function resolveInputLocks(
  targetTails: string[],
  favoriteDigits: string[],
): { targetsDisabled: boolean; favoritesDisabled: boolean } {
  const hasTargets = hasAnyEntry(targetTails);
  return {
    targetsDisabled: !hasTargets && hasAnyEntry(favoriteDigits),
    favoritesDisabled: hasTargets,
  };
}

export type TargetSlotStatus = 'empty' | 'valid' | 'invalid' | 'duplicate';

/**
 * ตรวจแต่ละช่อง "เลขที่เล็งไว้" — ช่องที่ซ้ำกับช่องก่อนหน้า (เลขท้ายเดียวกันเป๊ะ) นับเป็น
 * 'duplicate' และไม่ถูกส่งเข้า comparePlates ซ้ำ (เก็บช่องแรกที่ผู้ใช้กรอก = อันดับความชอบสูงกว่า)
 */
export function classifyTargetSlots(targetTails: string[]): TargetSlotStatus[] {
  const seen = new Set<string>();
  return targetTails.map((raw) => {
    const v = raw.trim();
    if (v === '') return 'empty';
    if (!TAIL_DIGITS_PATTERN.test(v)) return 'invalid';
    if (seen.has(v)) return 'duplicate';
    seen.add(v);
    return 'valid';
  });
}

export interface TargetRankedResult extends ComparisonResult {
  /** index ของช่องที่ผู้ใช้กรอก (0 = ช่องที่ชอบสุด) — ใช้เป็น tie-break เมื่อ rank เท่ากัน */
  slotIndex: number;
}

/**
 * โหมด "เลขที่เล็งไว้": ประกอบเลขหน้า+อักษรเข้ากับเลขท้ายแต่ละช่องที่ valid แล้วโยนเข้า
 * comparePlates() ตรงๆ (engine เดียวกับหน้าเปรียบเทียบทะเบียน) จากนั้นเรียงตาม rank ดีสุดก่อน —
 * rank เท่ากันให้ช่องที่ผู้ใช้ชอบมากกว่า (slotIndex น้อยกว่า) ขึ้นก่อน ช่องว่าง/ผิดรูปแบบ/ซ้ำ
 * ถูกข้ามไปเงียบๆ ไม่ throw
 */
export function rankTargetTails(
  frontDigit: number,
  thaiLetters: [string, string],
  targetTails: string[],
  strategy: RankingStrategy = DEFAULT_RANKING_STRATEGY,
): TargetRankedResult[] {
  const statuses = classifyTargetSlots(targetTails);
  const slots = targetTails
    .map((raw, slotIndex) => ({ tailDigits: raw.trim(), slotIndex }))
    .filter((_, i) => statuses[i] === 'valid');
  if (slots.length === 0) return [];

  const results = comparePlates(
    slots.map(({ tailDigits }) => ({ frontDigit, thaiLetters, tailDigits })),
    strategy,
  );
  return results
    .map((r, i) => ({ ...r, slotIndex: slots[i].slotIndex }))
    .sort((a, b) => a.rank - b.rank || a.slotIndex - b.slotIndex);
}

/**
 * ฟอร์มทั้งหมดของหน้า Batch ranking ที่ต้อง "จำ" ไว้ตอนกดลิงก์ไปหน้าธาตุจีน/อายตนะ6/เช็ค
 * วันเกิด แล้วกด "กลับ" — เพื่อ restore ฟอร์มกลับมาเหมือนเดิมทุกช่อง แทนที่จะกลับไปเจอฟอร์มว่าง
 * favoriteDigits ใช้ representation เดียวกับ favoriteInputs ภายใน ('' = ช่องว่าง) ตรงๆ
 * เพื่อไม่ต้องแปลงไปมาระหว่าง restore กับ state จริง
 */
export interface BatchReturnState {
  frontDigit: string;
  letter1: string;
  letter2: string;
  excludeAuction: boolean;
  excludePopular: boolean;
  rowLimit: RowLimit;
  favoriteDigits: string[];
  /** optional เพื่อให้ state ที่สร้างก่อนมีโหมด "เลขที่เล็งไว้" ยัง restore ได้ (undefined = ว่างทุกช่อง) */
  targetTails?: string[];
}

/**
 * พกไปกับลิงก์ไปหน้าธาตุจีน/อายตนะ6/เช็ควันเกิด บอกว่าต้อง "กลับ" ไปที่ไหน — ถ้ามาจาก
 * RankingPanel (หน้านี้) จะเป็น 'batch' พร้อม batchState เต็มสำหรับ restore ฟอร์ม ถ้ามาจากหน้า
 * "วิเคราะห์เลขเดี่ยว" (ResultCard.tsx) จะเป็น 'single' (หรือไม่ส่ง context มาเลยก็ได้ ซึ่ง
 * ฝั่งรับต้อง fallback เป็น 'single' เหมือนพฤติกรรมเดิมก่อนมีฟีเจอร์นี้)
 */
export type ReturnContext =
  | { returnTo: 'single' }
  | { returnTo: 'batch'; batchState: BatchReturnState };

/** ค่าเริ่มต้นของฟอร์มตอนไม่มี restoreState (โหลดหน้าครั้งแรก หรือเข้าจากแท็บ/landing ปกติ) */
export const BATCH_FORM_DEFAULTS: BatchReturnState = {
  frontDigit: RANKING_PANEL_DEFAULTS.frontDigit,
  letter1: RANKING_PANEL_DEFAULTS.letter1,
  letter2: RANKING_PANEL_DEFAULTS.letter2,
  excludeAuction: true,
  excludePopular: false,
  rowLimit: 10,
  favoriteDigits: ['', '', '', ''],
  targetTails: createEmptyTargetTails(),
};

/**
 * แยกออกมาเป็น pure function เพื่อเทสได้ตรงๆ ว่า "ถ้ามี restoreState ต้องใช้ค่าจริงเสมอ ไม่ใช่
 * BATCH_FORM_DEFAULTS" — นี่คือ contract ของการ restore ฟอร์มจากลิงก์ธาตุจีน/อายตนะ6/เช็ค
 * วันเกิดที่ห้ามพังเด็ดขาด (เหมือน pattern resolvePlateFieldDefaults ใน BirthdayCompatPage.tsx)
 */
export function resolveBatchFormDefaults(
  restoreState: BatchReturnState | null | undefined,
): BatchReturnState {
  return restoreState ?? BATCH_FORM_DEFAULTS;
}

/**
 * แยกออกมาเป็น pure function เพื่อเทสได้ตรงๆ ว่า "ค่าฟอร์มปัจจุบันทุกช่อง" ถูกแนบไปกับลิงก์
 * ไปหน้าธาตุจีน/อายตนะ6/เช็ควันเกิดครบถ้วน — นี่คือ contract ของ "จำต้นทาง" ที่ปุ่ม "กลับ" ต้อง
 * ใช้ restore ฟอร์มกลับมา
 */
export function buildBatchReturnContext(fields: BatchReturnState): ReturnContext {
  return { returnTo: 'batch', batchState: fields };
}

interface RankingPanelProps {
  onViewFiveElement?: (input: DetailModeInput, returnContext?: ReturnContext) => void;
  onViewAyatana6?: (input: DetailModeInput, returnContext?: ReturnContext) => void;
  onViewBirthdayCompat?: (input: DetailModeInput, returnContext?: ReturnContext) => void;
  /** บังคับรูปแบบผลลัพธ์ (เทสต์) — ไม่ส่ง = เลือกตามความกว้างจริง (useRankingLayout) */
  layout?: RankingLayout;
  /** แถวที่เปิดส่วนขยายไว้ตั้งแต่แรก (เทสต์) — key = เลขท้าย หรือ "target-<index ช่อง>" */
  initialExpanded?: string[];
  /** มีค่าเฉพาะตอนกลับมาจากหน้าธาตุจีน/อายตนะ6/เช็ควันเกิดที่มาจากหน้านี้เดิม — ใช้ prefill
   * ฟอร์มทั้งหมดตั้งแต่ mount ครั้งแรก (แทน BATCH_FORM_DEFAULTS) แล้วปล่อยให้ resultsByLength
   * useMemo คำนวณ Top N ใหม่ให้เองตามปกติ ไม่ต้อง trigger อะไรเพิ่ม */
  restoreState?: BatchReturnState;
}

export function RankingPanel({
  onViewFiveElement,
  onViewAyatana6,
  onViewBirthdayCompat,
  restoreState,
  layout: forcedLayout,
  initialExpanded,
}: RankingPanelProps = {}) {
  // วัดความกว้างที่ตารางใช้ได้จริง (.ranking-wide-probe กว้างเท่าพื้นที่ผลลัพธ์แบบตาราง)
  const probeRef = useRef<HTMLDivElement>(null);
  // id ของส่วนที่ขยาย (aria-controls ของป้ายเล็กและปุ่ม "ดูรายละเอียด")
  const detailIdBase = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  // 'market-first' (ค่าเริ่มต้น) หรือ 'strict' (โหมดคัดเข้มที่ซ่อนไว้) — มีผลกับลำดับและถ้อยคำเตือนคู่เลขเท่านั้น
  const strategy = useRankingStrategy();
  const fieldDefaults = resolveBatchFormDefaults(restoreState);
  const [frontDigit, setFrontDigit] = useState(fieldDefaults.frontDigit);
  const [letter1, setLetter1] = useState(fieldDefaults.letter1);
  const [letter2, setLetter2] = useState(fieldDefaults.letter2);
  const [excludeAuction, setExcludeAuction] = useState(fieldDefaults.excludeAuction);
  const [excludePopular, setExcludePopular] = useState(fieldDefaults.excludePopular);
  const [rowLimit, setRowLimit] = useState<RowLimit>(fieldDefaults.rowLimit);
  const [activeTail, setActiveTail] = useState<TailLength>(2);
  const [expandedTails, setExpandedTails] = useState<Set<string>>(() => new Set(initialExpanded));
  const [favoriteInputs, setFavoriteInputs] = useState<string[]>(fieldDefaults.favoriteDigits);
  const [targetInputs, setTargetInputs] = useState<string[]>(
    () => fieldDefaults.targetTails ?? createEmptyTargetTails(),
  );

  const updateTargetTail = (index: number, value: string) => {
    setTargetInputs((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const { targetsDisabled, favoritesDisabled } = resolveInputLocks(targetInputs, favoriteInputs);
  const isTargetMode = hasAnyEntry(targetInputs);
  const targetStatuses = classifyTargetSlots(targetInputs);

  const updateFavoriteDigit = (index: number, value: string) => {
    setFavoriteInputs((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  // key = เลขท้าย (Top N) หรือ "target-<ช่อง>" (เลขที่เล็งไว้) — เปิดได้หลายแถวพร้อมกัน
  const toggleExpanded = (key: string) => setExpandedTails((prev) => toggleExpandedKey(prev, key));

  const isValid =
    /^[0-9]$/.test(frontDigit) &&
    THAI_LETTER_PATTERN.test(letter1) &&
    THAI_LETTER_PATTERN.test(letter2);

  // ฟอร์มนี้ไม่มีปุ่ม submit (live-recompute) ต่างจาก PlateForm ที่ error โชว์เฉพาะหลังกด
  // ปุ่มแล้วเท่านั้น — ต้องกันไม่ให้ form-error โชว์ตั้งแต่โหลดหน้าครั้งแรกที่ฟอร์มยังว่างเปล่า
  // (ค่าว่างเปล่าไม่ใช่ "กรอกผิด" แค่ยังไม่ได้กรอก) โชว์เฉพาะตอนผู้ใช้เริ่มพิมพ์แล้วแต่ยังไม่ครบ
  const hasStartedTyping = frontDigit !== '' || letter1 !== '' || letter2 !== '';

  const resultsByLength: ResultsByLength | null = useMemo(() => {
    // โหมดเลขที่เล็งไว้ไม่แสดงตาราง Top N เลย — ข้ามการ generate ที่หนักไปทั้งหมด
    if (!isValid || isTargetMode) return null;
    const front = Number(frontDigit);
    const letters: [string, string] = [letter1, letter2];
    const favoriteDigits: (string | null)[] = favoriteInputs.map((v) => (v === '' ? null : v));
    return {
      2: generateTopCandidates(front, letters, 2, excludeAuction, excludePopular, rowLimit, favoriteDigits, strategy),
      3: generateTopCandidates(front, letters, 3, excludeAuction, excludePopular, rowLimit, favoriteDigits, strategy),
      4: generateTopCandidates(front, letters, 4, excludeAuction, excludePopular, rowLimit, favoriteDigits, strategy),
    };
  }, [
    frontDigit,
    letter1,
    letter2,
    excludeAuction,
    excludePopular,
    rowLimit,
    isValid,
    favoriteInputs,
    isTargetMode,
    strategy,
  ]);

  const targetResults: TargetRankedResult[] | null = useMemo(() => {
    if (!isValid || !isTargetMode) return null;
    return rankTargetTails(Number(frontDigit), [letter1, letter2], targetInputs, strategy);
  }, [frontDigit, letter1, letter2, isValid, isTargetMode, targetInputs, strategy]);

  const activeCandidates = resultsByLength ? resultsByLength[activeTail] : [];

  // ทั้งสองโหมดแปลงเป็น RankRowData ชุดเดียวกันแล้วส่งเข้า RankResultRows ตัวเดียวกัน
  const normalRows = activeCandidates.map((c, i) =>
    candidateRowData(c, i, `${detailIdBase}-${activeTail}-${c.tailDigits}`),
  );
  const targetRows = (targetResults ?? []).map((r) => targetRowData(r, `${detailIdBase}-target-${r.slotIndex}`, strategy));
  const { layout: resultsLayout, plateWidth: compactWidthPx } = useRankingLayout(
    probeRef,
    tableMinRemFor(isTargetMode ? targetRows : normalRows),
    forcedLayout,
  );

  // แนบไปกับลิงก์ไปหน้าธาตุจีน/อายตนะ6/เช็ควันเกิด เพื่อให้ปุ่ม "กลับ" ของหน้าเหล่านั้นกลับมาที่
  // หน้านี้พร้อม restore ฟอร์มทั้งหมด แทนที่จะ hardcode กลับไปหน้า "วิเคราะห์เลขเดี่ยว" เสมอ
  const currentReturnContext: ReturnContext = useMemo(
    () =>
      buildBatchReturnContext({
        frontDigit,
        letter1,
        letter2,
        excludeAuction,
        excludePopular,
        rowLimit,
        favoriteDigits: favoriteInputs,
        targetTails: targetInputs,
      }),
    [
      frontDigit,
      letter1,
      letter2,
      excludeAuction,
      excludePopular,
      rowLimit,
      favoriteInputs,
      targetInputs,
    ],
  );

  const rowsProps = {
    layout: resultsLayout,
    compactWidthPx,
    expandedKeys: expandedTails,
    onToggle: toggleExpanded,
    onViewFiveElement: onViewFiveElement
      ? (input: DetailModeInput) => onViewFiveElement(input, currentReturnContext)
      : undefined,
    onViewAyatana6: onViewAyatana6 ? (input: DetailModeInput) => onViewAyatana6(input, currentReturnContext) : undefined,
    onViewBirthdayCompat: onViewBirthdayCompat
      ? (input: DetailModeInput) => onViewBirthdayCompat(input, currentReturnContext)
      : undefined,
  };

  return (
    <div className="ranking-panel">
      <div className="ranking-wide ranking-wide-probe" ref={probeRef} aria-hidden="true" />
      <div className="form-card">
        <div className="form-row">
          <div className="field">
            <label htmlFor="rankFrontDigit">เลขหน้า</label>
            <input
              id="rankFrontDigit"
              value={frontDigit}
              maxLength={1}
              placeholder="1"
              onChange={(e) => setFrontDigit(e.target.value.replace(/[^0-9]/g, ''))}
            />
          </div>
          <div className="field">
            <label htmlFor="rankLetter1">อักษร 1</label>
            <input
              id="rankLetter1"
              value={letter1}
              maxLength={1}
              placeholder="ก"
              onChange={(e) => setLetter1(e.target.value.slice(-1))}
            />
          </div>
          <div className="field">
            <label htmlFor="rankLetter2">อักษร 2</label>
            <input
              id="rankLetter2"
              value={letter2}
              maxLength={1}
              placeholder="ก"
              onChange={(e) => setLetter2(e.target.value.slice(-1))}
            />
          </div>
        </div>
        {!isValid && hasStartedTyping && (
          <div className="form-error">กรอกเลขหน้า 0-9 และหมวดอักษรไทย 2 ตัวให้ครบก่อน</div>
        )}
        <div className="toggle-row">
          <input
            type="checkbox"
            id="excludeAuction"
            checked={excludeAuction}
            onChange={(e) => setExcludeAuction(e.target.checked)}
          />
          <label htmlFor="excludeAuction">
            ไม่รวมเลขประมูล — เลขกลุ่มนี้ปกติต้องประมูลแยก ไม่ได้อยู่ในระบบจองปกติ
          </label>
        </div>
        <div className="toggle-row">
          <input
            type="checkbox"
            id="excludePopular"
            checked={excludePopular}
            onChange={(e) => setExcludePopular(e.target.checked)}
          />
          <label htmlFor="excludePopular">
            ไม่รวมเลขสวย — เลขกลุ่มนี้ยังจองได้ปกติ ไม่ต้องประมูล (ค่าเริ่มต้นไม่กรองออก)
          </label>
        </div>
        <div className={`favorite-toggle-row${targetsDisabled ? ' is-locked' : ''}`}>
          <div className="favorite-toggle-label">
            เลขที่เล็งไว้ (กรอกเรียงจากชอบมากไปน้อย) — ไม่บังคับกรอก
          </div>
          <div className="favorite-inputs target-inputs">
            {targetInputs.map((value, i) => (
              <div className="field" key={i}>
                <label htmlFor={`targetTail${i}`}>ช่อง {i + 1}</label>
                <input
                  id={`targetTail${i}`}
                  value={value}
                  maxLength={4}
                  inputMode="numeric"
                  placeholder="-"
                  disabled={targetsDisabled}
                  aria-invalid={targetStatuses[i] === 'invalid' || targetStatuses[i] === 'duplicate'}
                  onChange={(e) => updateTargetTail(i, e.target.value.replace(/[^0-9]/g, ''))}
                />
              </div>
            ))}
          </div>
          {targetsDisabled && (
            <div className="favorite-lock-note">
              ใช้พร้อมกับ &quot;เลขที่ชอบ&quot; ไม่ได้ — ล้างช่องเลขที่ชอบให้ว่างก่อนจึงจะกรอกได้
            </div>
          )}
          {targetStatuses.some((st) => st === 'invalid') && (
            <div className="form-error">
              เลขท้ายต้องเป็นตัวเลข 2-4 หลัก — ช่องที่ผิดรูปแบบ (
              {targetStatuses
                .map((st, i) => (st === 'invalid' ? i + 1 : null))
                .filter((n) => n !== null)
                .join(', ')}
              ) จะไม่ถูกนำไปจัดอันดับ
            </div>
          )}
          {targetStatuses.some((st) => st === 'duplicate') && (
            <div className="favorite-lock-note">
              เลขท้ายซ้ำกับช่องก่อนหน้า (ช่อง{' '}
              {targetStatuses
                .map((st, i) => (st === 'duplicate' ? i + 1 : null))
                .filter((n) => n !== null)
                .join(', ')}
              ) — นับแค่ครั้งแรก
            </div>
          )}
        </div>
        <div className={`favorite-toggle-row${favoritesDisabled ? ' is-locked' : ''}`}>
          <div className="favorite-toggle-label">
            เลขที่ชอบ (เรียงจากชอบมากไปน้อย) — ไม่บังคับกรอก
          </div>
          <div className="favorite-inputs">
            {FAVORITE_SLOT_LABELS.map((label, i) => (
              <div className="field" key={i}>
                <label htmlFor={`favoriteDigit${i}`}>{label}</label>
                <input
                  id={`favoriteDigit${i}`}
                  value={favoriteInputs[i]}
                  maxLength={1}
                  placeholder="-"
                  disabled={favoritesDisabled}
                  onChange={(e) => updateFavoriteDigit(i, e.target.value.replace(/[^0-9]/g, ''))}
                />
              </div>
            ))}
          </div>
          {favoritesDisabled && (
            <div className="favorite-lock-note">
              ใช้พร้อมกับ &quot;เลขที่เล็งไว้&quot; ไม่ได้ — ล้างช่องเลขที่เล็งไว้ให้ว่างก่อนจึงจะกรอกได้
            </div>
          )}
        </div>
        {!isTargetMode && (
          <div className="limit-toggle-row">
            <span>จำนวนแถวที่แสดง:</span>
            <div className="limit-buttons">
              {ROW_LIMIT_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={rowLimit === n ? 'active' : ''}
                  onClick={() => setRowLimit(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {isTargetMode ? (
        !isValid ? (
          <div className="ranking-empty">กรอกข้อมูลด้านบนให้ครบก่อนจึงจะจัดอันดับได้</div>
        ) : targetRows.length === 0 ? (
          <div className="ranking-empty">ยังไม่มีเลขท้ายที่ถูกรูปแบบ (ตัวเลข 2-4 หลัก) ให้จัดอันดับ</div>
        ) : (
          // ตัวแสดงผลชุดเดียวกับโหมดปกติ (RankResultRows) — ต่างกันเฉพาะหัวข้อแทนแท็บ และ "ช่อง N" ใต้ป้ายอันดับ
          <div className={`target-results${resultsLayout === 'table' ? ' ranking-wide' : ''}`}>
            <div className="target-results-heading">
              จัดอันดับเลขที่เล็งไว้ {targetRows.length} ตัว — ดีที่สุดไปแย่ที่สุด
            </div>
            <p className="ranking-plate-note">ภาพป้ายเป็นภาพจำลอง ไม่ใช่ป้ายจริง</p>
            <RankResultRows rows={targetRows} {...rowsProps} />
          </div>
        )
      ) : (
        <div className={resultsLayout === 'table' && normalRows.length > 0 ? 'ranking-wide' : undefined}>
          <div className="ranking-tabs">
            {TAIL_LENGTHS.map((len) => (
              <button
                key={len}
                type="button"
                className={activeTail === len ? 'active' : ''}
                onClick={() => setActiveTail(len)}
              >
                Top {rowLimit} เลขท้าย {TAIL_LENGTH_UNIT[len]}
              </button>
            ))}
          </div>
          {normalRows.length > 0 && <p className="ranking-plate-note">ภาพป้ายเป็นภาพจำลอง ไม่ใช่ป้ายจริง</p>}
          {!resultsByLength ? (
            <div className="ranking-table-wrap">
              <div className="ranking-empty">กรอกข้อมูลด้านบนให้ครบก่อนจึงจะจัดอันดับได้</div>
            </div>
          ) : normalRows.length === 0 ? (
            <div className="ranking-table-wrap">
              <div className="ranking-empty">ไม่พบเลขท้ายที่ผ่านเกณฑ์ในความยาวนี้</div>
            </div>
          ) : (
            <RankResultRows rows={normalRows} {...rowsProps} />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * ข้อมูลหนึ่งแถวที่ตัวแสดงผลใช้ — โหมดปกติ (Top N) และโหมดเลขที่เล็งไว้ใช้ชุดเดียวกันทุกช่อง
 * ต่างกันได้เฉพาะ label ("ช่อง N" ของโหมดเลขที่เล็งไว้)
 */
export interface RankRowData {
  /** key ของส่วนที่ขยาย: เลขท้าย (Top N) หรือ "target-<index ช่อง>" */
  key: string;
  detailId: string;
  rank: number;
  label?: string;
  input: PlateInput;
  mode1: RankingCandidate['mode1'];
  mode2: RankingCandidate['mode2'];
  mode3: RankingCandidate['mode3'];
  auction: AuctionNumberInfo;
  popular: PopularNumberInfo;
  verdict: boolean;
  badges: Badge[];
  finalScore: number;
  matchedFavoriteDigits: string[];
}

/** แถวโหมดปกติ: ทุกช่องมาจาก generateTopCandidates ตรงๆ */
export function candidateRowData(c: RankingCandidate, index: number, detailId: string): RankRowData {
  return {
    key: c.tailDigits,
    detailId,
    rank: index + 1,
    input: c.input,
    mode1: c.mode1,
    mode2: c.mode2,
    mode3: c.mode3,
    auction: c.auction,
    popular: c.popular,
    verdict: c.verdict,
    badges: c.badges,
    finalScore: c.finalScore,
    matchedFavoriteDigits: c.matchedFavoriteDigits,
  };
}

/**
 * แถวโหมดเลขที่เล็งไว้: อันดับ/คะแนน/mode1-3 มาจาก comparePlates (rankTargetTails) ตามเดิม ส่วน verdict/badge/
 * เลขประมูล/เลขสวยเรียกฟังก์ชัน engine ตัวเดียวกับที่ generateTopCandidates ใช้ (combineVerdictAndBadges,
 * detectAuctionNumber, detectPopularNumber) กับ mode1-3 ชุดเดียวกัน — ไม่มีการเดาค่าและไม่แก้ engine
 * verdict = mode1.tier !== 'bad' ซึ่งเท่ากับ mode1.verdict ที่โหมดนี้ใช้เดิม · เลขโปรด: โหมดนี้ล็อกช่องเลขโปรด จึงว่างเสมอ
 */
export function targetRowData(
  result: TargetRankedResult,
  detailId: string,
  strategy: RankingStrategy = DEFAULT_RANKING_STRATEGY,
): RankRowData {
  const { verdict, badges } = combineVerdictAndBadges(result.mode1, result.mode2, result.mode3, strategy);
  return {
    key: `target-${result.slotIndex}`,
    detailId,
    rank: result.rank,
    label: `ช่อง ${result.slotIndex + 1}`,
    input: result.input,
    mode1: result.mode1,
    mode2: result.mode2,
    mode3: result.mode3,
    auction: detectAuctionNumber(result.input.tailDigits),
    popular: detectPopularNumber(result.input.tailDigits),
    verdict,
    badges,
    finalScore: result.finalScore,
    matchedFavoriteDigits: [],
  };
}

type BoundDetailHandler = ((input: DetailModeInput) => void) | undefined;

interface RankResultRowsProps {
  rows: RankRowData[];
  layout: RankingLayout;
  compactWidthPx: number;
  expandedKeys: ReadonlySet<string>;
  onToggle: (key: string) => void;
  onViewFiveElement: BoundDetailHandler;
  onViewAyatana6: BoundDetailHandler;
  onViewBirthdayCompat: BoundDetailHandler;
}

/** ตาราง (จอกว้าง) หรือแถวกะทัดรัด (จอแคบ/ตัวอักษรใหญ่) — ใช้ทั้งโหมดปกติและโหมดเลขที่เล็งไว้ */
function RankResultRows({
  rows,
  layout,
  compactWidthPx,
  expandedKeys,
  onToggle,
  onViewFiveElement,
  onViewAyatana6,
  onViewBirthdayCompat,
}: RankResultRowsProps) {
  const birthdayLink = (r: RankRowData) =>
    onViewBirthdayCompat && (
      <button type="button" className="birthday-compat-link" onClick={() => onViewBirthdayCompat(r.input)}>
        เช็คกับวันเกิด →
      </button>
    );

  if (layout === 'compact') {
    // แถวกะทัดรัด (อันดับ | ป้ายเล็ก | verdict + คะแนน) — badge/ป้ายพิเศษ/ป้ายใหญ่อยู่ในส่วนที่ขยาย
    return (
      <ol className="rank-rows">
        {rows.map((r) => (
          <CompactRankRow
            key={r.key}
            rank={r.rank}
            label={r.label}
            input={r.input}
            auction={r.auction}
            plateWidth={compactWidthPx}
            verdict={r.verdict}
            score={r.finalScore}
            expanded={expandedKeys.has(r.key)}
            detailId={r.detailId}
            onToggle={() => onToggle(r.key)}
          >
            <div className="rank-row-detail-body">
              <PlateWithTags input={r.input} auction={r.auction} popular={r.popular} layout="column" />
              <CandidateBadges c={r} />
              <details className="rank-row-calc">
                <summary>ดูรายละเอียดการคำนวณ</summary>
                <ModeDetailPanel
                  input={r.input}
                  mode1={r.mode1}
                  mode2={r.mode2}
                  mode3={r.mode3}
                  onViewFiveElement={onViewFiveElement}
                  onViewAyatana6={onViewAyatana6}
                />
              </details>
              {onViewBirthdayCompat && <div className="rank-row-detail-actions">{birthdayLink(r)}</div>}
            </div>
          </CompactRankRow>
        ))}
      </ol>
    );
  }

  return (
    <div className="ranking-table-wrap">
      <table className="ranking-table">
        <thead>
          <tr>
            <th>อันดับ</th>
            <th>เลขทะเบียนเต็ม</th>
            <th>Verdict</th>
            <th className="ranking-badges-col">Badge (คู่เลขที่ปรากฏ / ผลรวมตัวเลข / เลขโปรด)</th>
            <th>คะแนนรวม</th>
            <th>ป้ายพิเศษ</th>
            <th className="ranking-actions-col" aria-label="การดำเนินการ"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isExpanded = expandedKeys.has(r.key);
            return (
              <Fragment key={r.key}>
                <tr data-ranking-row="" className={`ranking-row--${rankTier(r.rank)}`}>
                  <td className="rank">
                    <RankWithLabel rank={r.rank} label={r.label} />
                  </td>
                  <td className="plate-cell">
                    {/* ป้ายเล็กเป็นปุ่มขยาย (ผลเหมือน "ดูรายละเอียด") ไม่มี caption/ปุ่มคัดลอก — ประโยค "ภาพจำลอง" อยู่เหนือตารางครั้งเดียว
                        ข้อความเลขทะเบียนเก็บไว้แบบ sr-only ให้ค้นหา (Ctrl+F) */}
                    <PlateToggleButton
                      input={r.input}
                      auction={r.auction}
                      widthPx={RANKING_ROW_PLATE_WIDTH}
                      expanded={isExpanded}
                      controls={r.detailId}
                      onToggle={() => onToggle(r.key)}
                    />
                    <span className="sr-only">{formatPlateText(r.input)}</span>
                  </td>
                  <td className="verdict-cell">
                    <VerdictPill verdict={r.verdict} />
                  </td>
                  <td className="ranking-badges-col">
                    <CandidateBadges c={r} />
                  </td>
                  <td className="score-cell">
                    <ScoreFigure score={r.finalScore} rank={r.rank} />
                  </td>
                  <td>
                    {r.auction.isAuction || r.popular.isPopular ? (
                      <div className="ranking-tags-cell">
                        {r.auction.isAuction && (
                          <span className="auction-tag">
                            {/* "● เลขประมูล" และชื่อกลุ่มแต่ละชื่อไม่ตัดกลางคำ (เช่น "เลขคู่/เลขเบิ้ล") — ตัดบรรทัดได้เฉพาะระหว่างส่วน */}
                            <span className="auction-tag__cat">● เลขประมูล</span>{' '}
                            {r.auction.categories.map((cat, ci) => (
                              <Fragment key={cat}>
                                {ci > 0 && ', '}
                                <span className="auction-tag__cat">{cat}</span>
                              </Fragment>
                            ))}
                          </span>
                        )}
                        {r.popular.isPopular && (
                          <span className="popular-tag">เลขสวย {popularStars(r.popular.weight)}</span>
                        )}
                      </div>
                    ) : (
                      <span className="ranking-empty-cell">—</span>
                    )}
                  </td>
                  <td className="ranking-actions-col">
                    <div className="ranking-actions-cell">
                      <ExpandButton expanded={isExpanded} controls={r.detailId} onToggle={() => onToggle(r.key)} />
                      {birthdayLink(r)}
                    </div>
                  </td>
                </tr>
                {/* มีแถวเสมอ (ซ่อนตอนยุบ) ให้ aria-controls ชี้ได้ — เนื้อหา render เฉพาะตอนเปิด */}
                <tr id={r.detailId} className="ranking-detail-row" hidden={!isExpanded}>
                  <td colSpan={TABLE_COLUMN_COUNT}>
                    {isExpanded && (
                      <ModeDetailPanel
                        input={r.input}
                        mode1={r.mode1}
                        mode2={r.mode2}
                        mode3={r.mode3}
                        leading={
                          <PlateImage
                            className="ranking-detail-plate"
                            frontDigit={r.input.frontDigit}
                            thaiLetters={r.input.thaiLetters}
                            tailDigits={r.input.tailDigits}
                            variant={plateVariantFor(r.auction)}
                            provinceLabel={resolvePlateProvinceLabel(r.input)}
                            copyText={plateCopyText(r.input)}
                            provinceNote={plateProvinceNote(r.input)}
                          />
                        }
                        onViewFiveElement={onViewFiveElement}
                        onViewAyatana6={onViewAyatana6}
                      />
                    )}
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
