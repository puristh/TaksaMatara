import { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { PlateInput } from '../engine/types';
import { PLATE_IMAGE_DEFAULT_PROVINCE } from '../config/featureFlags';
import { buildPlateLayout, PLATE_H, PLATE_LAYOUT, PLATE_W } from './plateLayout';
import type { PlateTextLine, PlateVariant } from './plateLayout';
import { browserCopyEnv, copyPlateText, copyStatusMessage } from './plateCopy';
import type { CopyStatus } from './plateCopy';

interface PlateImageProps extends Pick<PlateInput, 'frontDigit' | 'thaiLetters' | 'tailDigits'> {
  variant: PlateVariant;
  /** undefined = ค่าเริ่มต้น (PLATE_IMAGE_DEFAULT_PROVINCE), null = ไม่แสดงบรรทัดจังหวัด */
  provinceLabel?: string | null;
  /** ข้อความที่ปุ่ม "คัดลอก" คัดลอก (ดู plateCopyText) — ไม่ส่งมา = เลขทะเบียนอย่างเดียว */
  copyText?: string;
  /** ข้อความเล็กต่อท้าย "ภาพจำลอง ไม่ใช่ป้ายจริง" เช่น "จังหวัดในภาพ: ค่าเริ่มต้น" (ดู plateProvinceNote) */
  provinceNote?: string | null;
  className?: string;
}

/** เวลาที่ข้อความ "คัดลอกแล้ว" ค้างอยู่ (ms) — ข้อความคัดลอกไม่สำเร็จค้างไว้จนกดใหม่ */
const COPIED_MESSAGE_MS = 2000;

/** เลเยอร์ตัวนูน: เงาล่างขวา → ไฮไลต์บนซ้าย → ตัวจริง (ไม่ใช้ SVG filter เพื่อให้เบาเครื่อง) */
const EMBOSS_LAYERS = [
  { dx: 1.4, dy: 1.7, fill: 'rgba(0, 0, 0, 0.28)' },
  { dx: -0.9, dy: -0.9, fill: 'rgba(255, 255, 255, 0.8)' },
  { dx: 0, dy: 0, fill: '#161616' },
] as const;

/**
 * เงาสิ่งก่อสร้างของป้ายประมูล — ออกแบบเองจากรูปทรงเรขาคณิตล้วน (สี่เหลี่ยม โดม ยอดแหลม
 * หลังคาซ้อนชั้น) ไม่ได้อ้างอิงสถานที่ใดโดยเฉพาะ ตึกสูงอยู่ริมซ้าย-ขวา ตรงกลางเตี้ยเพื่อไม่ให้
 * รบกวนชื่อจังหวัด
 */
const SKYLINE_PATH = [
  // ซ้าย: ตึกเหลี่ยมขั้นบันได
  'M14 200V166H30V157H44V200Z',
  // โดม + ยอดเข็ม
  'M50 200V160H92V200Z',
  'M50 160A21 21 0 0 1 92 160Z',
  'M69 141L71 128L73 141Z',
  // หอยอดแหลม
  'M98 200V150L107 121L116 150V200Z',
  // กลาง: อาคารเตี้ย
  'M116 200V182H168V177H204V184H246V179H292V183H334V200Z',
  // ขวา: หลังคาซ้อนชั้น + ยอด
  'M340 200V168H390V200Z',
  'M334 168L344 160H386L396 168Z',
  'M344 160L352 152H378L386 160Z',
  'M352 152L361 144H369L378 152Z',
  'M362 144L365 123L368 144Z',
  // ขวาสุด: ตึกเหลี่ยม
  'M396 200V158H410V149H428V200Z',
].join('');
const SKYLINE_BASE_H = 200;
/** เส้นขอบป้าย — ค่าอยู่ใน PLATE_LAYOUT.frame ที่เดียว (ระยะปลอดภัยของข้อความวัดจากเส้นขอบใน) */
const F = PLATE_LAYOUT.frame;

function EmbossedText({ line, anchor }: { line: PlateTextLine; anchor: 'start' | 'middle' }) {
  const k = line.fontSize / 100;
  return (
    <>
      {EMBOSS_LAYERS.map((layer, i) => (
        <text
          key={i}
          x={line.x + layer.dx * k}
          y={line.y + layer.dy * k}
          fontSize={line.fontSize}
          textAnchor={anchor}
          fill={layer.fill}
        >
          {line.text}
        </text>
      ))}
    </>
  );
}

/**
 * ภาพจำลองป้ายทะเบียน (inline SVG) — ป้ายเป็นวัตถุกายภาพ ขนาดจึงตามความกว้างของกรอบ (px)
 * ไม่ตาม font scale ของระบบ ยกเว้นข้อความ "ภาพจำลอง ไม่ใช่ป้ายจริง" ใต้ป้ายที่ใช้ rem
 * ข้อความนี้แสดงเสมอ ไม่มี prop ให้ปิด
 */
export const PlateImage = memo(function PlateImage({
  frontDigit,
  thaiLetters,
  tailDigits,
  variant,
  provinceLabel,
  copyText,
  provinceNote,
  className,
}: PlateImageProps) {
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  const letter1 = thaiLetters[0];
  const letter2 = thaiLetters[1];
  const resolvedProvince = provinceLabel === undefined ? PLATE_IMAGE_DEFAULT_PROVINCE : provinceLabel;
  const layout = useMemo(
    () =>
      buildPlateLayout({
        frontDigit,
        thaiLetters: [letter1, letter2],
        tailDigits,
        variant,
        provinceLabel: resolvedProvince,
      }),
    [frontDigit, letter1, letter2, tailDigits, variant, resolvedProvince],
  );

  const textToCopy = copyText ?? layout.plateText;
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );
  const onCopy = async () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    const ok = await copyPlateText(textToCopy, browserCopyEnv());
    setCopyStatus(ok ? 'copied' : 'failed');
    if (ok) resetTimer.current = setTimeout(() => setCopyStatus('idle'), COPIED_MESSAGE_MS);
  };

  const bgId = `plate-bg-${id}`;
  const clipId = `plate-clip-${id}`;
  const isAuction = variant === 'auction';

  return (
    <figure className={`plate-figure${className ? ` ${className}` : ''}`}>
      <svg
        className={`plate-image plate-image--${variant}`}
        viewBox={`0 0 ${PLATE_W} ${PLATE_H}`}
        role="img"
        aria-label={layout.ariaLabel}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {isAuction ? (
            <linearGradient id={bgId} x1="0" y1="0" x2="1" y2="0.35">
              <stop offset="0" stopColor="#c5afe7" />
              <stop offset="0.5" stopColor="#e6d6f0" />
              <stop offset="1" stopColor="#fdd5b3" />
            </linearGradient>
          ) : (
            <linearGradient id={bgId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fbfaf4" />
              <stop offset="1" stopColor="#efede4" />
            </linearGradient>
          )}
          <clipPath id={clipId}>
            <rect
              x={F.outerInset}
              y={F.outerInset}
              width={PLATE_W - 2 * F.outerInset}
              height={PLATE_H - 2 * F.outerInset}
              rx={F.outerRadius}
            />
          </clipPath>
        </defs>

        <rect
          x={F.outerInset}
          y={F.outerInset}
          width={PLATE_W - 2 * F.outerInset}
          height={PLATE_H - 2 * F.outerInset}
          rx={F.outerRadius}
          fill={`url(#${bgId})`}
        />

        {isAuction && (
          <g clipPath={`url(#${clipId})`} aria-hidden="true">
            <circle cx="378" cy="62" r="30" fill="#fff3e6" opacity="0.55" />
            {/* SKYLINE_PATH วาดไว้บนพื้นสูง 200 — เลื่อนให้ฐานอาคารชิดขอบล่างของป้ายจริง */}
            <path
              d={SKYLINE_PATH}
              transform={`translate(0 ${PLATE_H - SKYLINE_BASE_H})`}
              fill="#3d2766"
              opacity="0.17"
            />
          </g>
        )}

        <rect
          x={F.outerInset}
          y={F.outerInset}
          width={PLATE_W - 2 * F.outerInset}
          height={PLATE_H - 2 * F.outerInset}
          rx={F.outerRadius}
          fill="none"
          stroke="#141414"
          strokeWidth={F.outerStroke}
        />
        <rect
          x={F.innerInset}
          y={F.innerInset}
          width={PLATE_W - 2 * F.innerInset}
          height={PLATE_H - 2 * F.innerInset}
          rx={F.innerRadius}
          fill="none"
          stroke="#141414"
          strokeWidth={F.innerStroke}
        />

        {/* clip ที่ขอบป้าย: ถ้าฟอนต์ป้ายโหลดไม่สำเร็จและฟอนต์สำรองกว้างกว่า ข้อความจะไม่ล้นออกนอกป้าย */}
        <g className="plate-image__text" clipPath={`url(#${clipId})`}>
          {layout.topRuns.map((run, i) => (
            <EmbossedText key={i} line={run} anchor="start" />
          ))}
          {layout.provinceLine && (
            <g className="plate-image__province">
              <EmbossedText line={layout.provinceLine} anchor="middle" />
            </g>
          )}
        </g>
      </svg>
      <figcaption className="plate-figure__caption">
        <span className="plate-figure__note">ภาพจำลอง ไม่ใช่ป้ายจริง</span>
        {provinceNote && <span className="plate-figure__note plate-figure__province-note">· {provinceNote}</span>}
        <button
          type="button"
          className="plate-copy-btn"
          onClick={onCopy}
          aria-label={`คัดลอกเลขทะเบียน ${textToCopy}`}
        >
          คัดลอก
        </button>
        <span
          className={`plate-copy-status${copyStatus === 'failed' ? ' failed' : ''}`}
          role="status"
          aria-live="polite"
        >
          {copyStatus === 'failed' ? (
            <>
              {copyStatusMessage('failed', '')}
              <span className="plate-copy-manual">{textToCopy}</span>
            </>
          ) : (
            copyStatusMessage(copyStatus, textToCopy)
          )}
        </span>
      </figcaption>
    </figure>
  );
});
