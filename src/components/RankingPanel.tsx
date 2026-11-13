import { Fragment, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { generateTopCandidates } from '../engine/ranking';
import type { RankingCandidate, TailLength } from '../engine/ranking';
import { badgeClass, badgeIcon, popularStars } from './ResultCard';
import { ModeDetailPanel } from './ModeDetailPanel';
import { ComparisonSupplementary } from './ComparisonResultCard';
import { PlateImage } from './PlateImage';
import { PlateWithTags } from './PlateWithTags';
import { plateCopyText } from './plateCopy';
import { plateProvinceNote, plateVariantFor, resolvePlateProvinceLabel } from './plateLayout';
import { RankBadge, rankTier, ScoreFigure, VerdictPill } from './RankEmphasis';
import { CompactRankRow, ExpandButton, PlateToggleButton } from './CompactRankRow';
import { comparePlates } from '../engine/comparePlates';
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
 * วัดจากตารางจริง (ป้ายอันดับ/verdict/คะแนนแบบเด่น, 30 แถว, รวมเลขประมูล) ตอนป้าย 176px: กว้างน้อยสุด 879px
 * + ขอบกรอบ = 55.9rem → 56.5rem (904px) — คงจุดสลับเดิมไว้ (~961px ที่ตัวอักษร 100%) ตามที่ผู้ใช้กำหนด แม้ป้ายเล็กลงเป็น 150px
 * พื้นที่ผลลัพธ์แบบตารางกว้างได้ถึง RANKING_WIDE_MAX_PX (ดู .ranking-wide ใน theme.css)
 */
export const RANKING_TABLE_MIN_REM = 56.5;

/** 'table' = ตาราง (จอกว้าง) · 'compact' = แถวกะทัดรัด (จอแคบ/ตัวอักษรใหญ่) */
export type RankingLayout = 'table' | 'compact';
/** พื้นที่ผลลัพธ์แบบตารางกว้างสุด (px) — ตรงกับ .ranking-wide ใน theme.css */
export const RANKING_WIDE_MAX_PX = 1040;

/** เลือกตาราง/แถวกะทัดรัดจากความกว้างพื้นที่ผลลัพธ์ (px) และขนาดตัวอักษรราก (px) */
export function chooseRankingLayout(containerPx: number, rootFontPx: number): RankingLayout {
  return containerPx / rootFontPx >= RANKING_TABLE_MIN_REM ? 'table' : 'compact';
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

function measureLayout(containerPx: number, fontPx: number): RankingLayoutState {
  return { layout: chooseRankingLayout(containerPx, fontPx), plateWidth: compactPlateWidth(containerPx) };
}

/**
 * ตาราง/แถวกะทัดรัดตามความกว้างจริงของแผง (ResizeObserver) และขนาดตัวอักษร (style ของ <html> ที่ useFontScale ตั้ง)
 * วัดใน useLayoutEffect จึงสลับก่อน paint แรก · ค่าตั้งต้นประมาณจากความกว้างหน้าต่าง · ไม่มี DOM (SSR/เทสต์) = ตาราง
 */
function useRankingLayout(ref: RefObject<HTMLElement>, forced?: RankingLayout): RankingLayoutState {
  const [state, setState] = useState<RankingLayoutState>(() =>
    typeof window === 'undefined'
      ? { layout: 'table', plateWidth: RANKING_ROW_PLATE_WIDTH }
      : measureLayout(Math.min(window.innerWidth - 57, RANKING_WIDE_MAX_PX), rootFontPx()),
  );
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const next = measureLayout(el.clientWidth, rootFontPx());
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
  }, [ref]);
  return forced ? { ...state, layout: forced } : state;
}

/** เปิด/ปิดส่วนขยายของแถวเดียว (แถวอื่นคงเดิม — เปิดได้หลายแถวพร้อมกัน ไม่ใช่ accordion เดี่ยว) */
export function toggleExpandedKey(prev: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(prev);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

/** Badge (คู่เลข / ผลรวม / เลขโปรด) ของหนึ่งทะเบียน — ใช้ทั้งแถวตารางและการ์ด */
function CandidateBadges({ c }: { c: RankingCandidate }) {
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
): TargetRankedResult[] {
  const statuses = classifyTargetSlots(targetTails);
  const slots = targetTails
    .map((raw, slotIndex) => ({ tailDigits: raw.trim(), slotIndex }))
    .filter((_, i) => statuses[i] === 'valid');
  if (slots.length === 0) return [];

  const results = comparePlates(
    slots.map(({ tailDigits }) => ({ frontDigit, thaiLetters, tailDigits })),
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
  const { layout: resultsLayout, plateWidth: compactWidthPx } = useRankingLayout(probeRef, forcedLayout);
  // id ของส่วนที่ขยาย (aria-controls ของป้ายเล็กและปุ่ม "ดูรายละเอียด")
  const detailIdBase = useId().replace(/[^a-zA-Z0-9_-]/g, '');
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
      2: generateTopCandidates(front, letters, 2, excludeAuction, excludePopular, rowLimit, favoriteDigits),
      3: generateTopCandidates(front, letters, 3, excludeAuction, excludePopular, rowLimit, favoriteDigits),
      4: generateTopCandidates(front, letters, 4, excludeAuction, excludePopular, rowLimit, favoriteDigits),
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
  ]);

  const targetResults: TargetRankedResult[] | null = useMemo(() => {
    if (!isValid || !isTargetMode) return null;
    return rankTargetTails(Number(frontDigit), [letter1, letter2], targetInputs);
  }, [frontDigit, letter1, letter2, isValid, isTargetMode, targetInputs]);

  const activeCandidates = resultsByLength ? resultsByLength[activeTail] : [];

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
        <div className="target-results">
          {!isValid ? (
            <div className="ranking-empty">กรอกข้อมูลด้านบนให้ครบก่อนจึงจะจัดอันดับได้</div>
          ) : !targetResults || targetResults.length === 0 ? (
            <div className="ranking-empty">
              ยังไม่มีเลขท้ายที่ถูกรูปแบบ (ตัวเลข 2-4 หลัก) ให้จัดอันดับ
            </div>
          ) : (
            <>
              <div className="target-results-heading">
                จัดอันดับเลขที่เล็งไว้ {targetResults.length} ตัว — ดีที่สุดไปแย่ที่สุด
              </div>
              <p className="ranking-plate-note">ภาพป้ายเป็นภาพจำลอง ไม่ใช่ป้ายจริง</p>
              {/* แถวกะทัดรัดทุกความกว้างจอ — กดป้ายเล็กหรือ "ดูรายละเอียด" เพื่อดูป้ายใหญ่ + การคำนวณ */}
              <ol className="rank-rows target-results-list">
                {targetResults.map((result) => {
                  const key = `target-${result.slotIndex}`;
                  const detailId = `${detailIdBase}-target-${result.slotIndex}`;
                  const isExpanded = expandedTails.has(key);
                  return (
                    <CompactRankRow
                      key={result.slotIndex}
                      rank={result.rank}
                      label={`ช่อง ${result.slotIndex + 1}`}
                      input={result.input}
                      plateWidth={compactWidthPx}
                      verdict={result.mode1.verdict}
                      score={result.finalScore}
                      scoreNote={result.hasBadPair && <span className="score-figure__note">พบคู่เสีย (Mode 2)</span>}
                      expanded={isExpanded}
                      detailId={detailId}
                      onToggle={() => toggleExpanded(key)}
                    >
                      <div className="rank-row-detail-body">
                        <PlateWithTags input={result.input} layout="column" />
                        <details className="rank-row-calc">
                          <summary>ดูรายละเอียดการคำนวณ</summary>
                          <ModeDetailPanel
                            input={result.input}
                            mode1={result.mode1}
                            mode2={result.mode2}
                            mode3={result.mode3}
                            onViewFiveElement={
                              onViewFiveElement ? (input) => onViewFiveElement(input, currentReturnContext) : undefined
                            }
                            onViewAyatana6={
                              onViewAyatana6 ? (input) => onViewAyatana6(input, currentReturnContext) : undefined
                            }
                          />
                          <ComparisonSupplementary result={result} />
                        </details>
                        {onViewBirthdayCompat && (
                          <div className="rank-row-detail-actions">
                            <button
                              type="button"
                              className="birthday-compat-link"
                              onClick={() => onViewBirthdayCompat(result.input, currentReturnContext)}
                            >
                              เช็คกับวันเกิด →
                            </button>
                          </div>
                        )}
                      </div>
                    </CompactRankRow>
                  );
                })}
              </ol>
            </>
          )}
        </div>
      ) : (
        <>

          <div
            className={
              resultsLayout === 'table' && resultsByLength && activeCandidates.length > 0 ? 'ranking-wide' : undefined
            }
          >
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
            {resultsByLength && activeCandidates.length > 0 && (
              <p className="ranking-plate-note">ภาพป้ายเป็นภาพจำลอง ไม่ใช่ป้ายจริง</p>
            )}
            {!resultsByLength ? (
              <div className="ranking-table-wrap">
                <div className="ranking-empty">กรอกข้อมูลด้านบนให้ครบก่อนจึงจะจัดอันดับได้</div>
              </div>
            ) : activeCandidates.length === 0 ? (
              <div className="ranking-table-wrap">
                <div className="ranking-empty">ไม่พบเลขท้ายที่ผ่านเกณฑ์ในความยาวนี้</div>
              </div>
            ) : resultsLayout === 'compact' ? (
              // จอแคบ/ตัวอักษรใหญ่: แถวกะทัดรัด (อันดับ | ป้ายเล็ก | verdict + คะแนน) — badge/ป้ายพิเศษ/ป้ายใหญ่อยู่ในส่วนที่ขยาย
              <ol className="rank-rows">
                {activeCandidates.map((c, i) => {
                  const isExpanded = expandedTails.has(c.tailDigits);
                  return (
                    <CompactRankRow
                      key={c.tailDigits}
                      rank={i + 1}
                      input={c.input}
                      auction={c.auction}
                      plateWidth={compactWidthPx}
                      verdict={c.verdict}
                      score={c.finalScore}
                      expanded={isExpanded}
                      detailId={`${detailIdBase}-${activeTail}-${c.tailDigits}`}
                      onToggle={() => toggleExpanded(c.tailDigits)}
                    >
                      <div className="rank-row-detail-body">
                        <PlateWithTags input={c.input} auction={c.auction} popular={c.popular} layout="column" />
                        <CandidateBadges c={c} />
                        <details className="rank-row-calc">
                          <summary>ดูรายละเอียดการคำนวณ</summary>
                          <ModeDetailPanel
                            input={c.input}
                            mode1={c.mode1}
                            mode2={c.mode2}
                            mode3={c.mode3}
                            onViewFiveElement={
                              onViewFiveElement ? (input) => onViewFiveElement(input, currentReturnContext) : undefined
                            }
                            onViewAyatana6={
                              onViewAyatana6 ? (input) => onViewAyatana6(input, currentReturnContext) : undefined
                            }
                          />
                        </details>
                        {onViewBirthdayCompat && (
                          <div className="rank-row-detail-actions">
                            <button
                              type="button"
                              className="birthday-compat-link"
                              onClick={() => onViewBirthdayCompat(c.input, currentReturnContext)}
                            >
                              เช็คกับวันเกิด →
                            </button>
                          </div>
                        )}
                      </div>
                    </CompactRankRow>
                  );
                })}
              </ol>
            ) : (
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
                    {activeCandidates.map((c, i) => {
                      const isExpanded = expandedTails.has(c.tailDigits);
                      const detailId = `${detailIdBase}-${activeTail}-${c.tailDigits}`;
                      return (
                        <Fragment key={c.tailDigits}>
                          <tr data-ranking-row="" className={`ranking-row--${rankTier(i + 1)}`}>
                            <td className="rank">
                              <RankBadge rank={i + 1} />
                            </td>
                            <td className="plate-cell">
                              {/* ป้ายเล็กเป็นปุ่มขยาย (ผลเหมือน "ดูรายละเอียด") ไม่มี caption/ปุ่มคัดลอก — ประโยค "ภาพจำลอง" อยู่เหนือตารางครั้งเดียว
                                  ข้อความเลขทะเบียนเก็บไว้แบบ sr-only ให้ค้นหา (Ctrl+F) */}
                              <PlateToggleButton
                                input={c.input}
                                auction={c.auction}
                                widthPx={RANKING_ROW_PLATE_WIDTH}
                                expanded={isExpanded}
                                controls={detailId}
                                onToggle={() => toggleExpanded(c.tailDigits)}
                              />
                              <span className="sr-only">{formatPlateText(c.input)}</span>
                            </td>
                            <td className="verdict-cell">
                              <VerdictPill verdict={c.verdict} />
                            </td>
                            <td className="ranking-badges-col">
                              <CandidateBadges c={c} />
                            </td>
                            <td className="score-cell">
                              <ScoreFigure score={c.finalScore} rank={i + 1} />
                            </td>
                            <td>
                              {c.auction.isAuction || c.popular.isPopular ? (
                                <div className="ranking-tags-cell">
                                  {c.auction.isAuction && (
                                    <span className="auction-tag">● เลขประมูล {c.auction.categories.join(', ')}</span>
                                  )}
                                  {c.popular.isPopular && (
                                    <span className="popular-tag">เลขสวย {popularStars(c.popular.weight)}</span>
                                  )}
                                </div>
                              ) : (
                                <span className="ranking-empty-cell">—</span>
                              )}
                            </td>
                            <td className="ranking-actions-col">
                              <div className="ranking-actions-cell">
                                <ExpandButton
                                  expanded={isExpanded}
                                  controls={detailId}
                                  onToggle={() => toggleExpanded(c.tailDigits)}
                                />
                                {onViewBirthdayCompat && (
                                  <button
                                    type="button"
                                    className="birthday-compat-link"
                                    onClick={() => onViewBirthdayCompat(c.input, currentReturnContext)}
                                  >
                                    เช็คกับวันเกิด →
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {/* มีแถวเสมอ (ซ่อนตอนยุบ) ให้ aria-controls ชี้ได้ — เนื้อหา render เฉพาะตอนเปิด */}
                          <tr id={detailId} className="ranking-detail-row" hidden={!isExpanded}>
                            <td colSpan={TABLE_COLUMN_COUNT}>
                              {isExpanded && (
                                <ModeDetailPanel
                                  input={c.input}
                                  mode1={c.mode1}
                                  mode2={c.mode2}
                                  mode3={c.mode3}
                                  leading={
                                    <PlateImage
                                      className="ranking-detail-plate"
                                      frontDigit={c.input.frontDigit}
                                      thaiLetters={c.input.thaiLetters}
                                      tailDigits={c.input.tailDigits}
                                      variant={plateVariantFor(c.auction)}
                                      provinceLabel={resolvePlateProvinceLabel(c.input)}
                                      copyText={plateCopyText(c.input)}
                                      provinceNote={plateProvinceNote(c.input)}
                                    />
                                  }
                                  onViewFiveElement={
                                    onViewFiveElement
                                      ? (input) => onViewFiveElement(input, currentReturnContext)
                                      : undefined
                                  }
                                  onViewAyatana6={
                                    onViewAyatana6
                                      ? (input) => onViewAyatana6(input, currentReturnContext)
                                      : undefined
                                  }
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
            )}
          </div>
        </>
      )}
    </div>
  );
}
