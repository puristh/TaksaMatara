import { describe, expect, it } from 'vitest';
import themeCss from '../styles/theme.css?raw';

/**
 * หน้า #batch: ขนาดตัวอักษรขั้นต่ำของแต่ละระดับ อ่านจาก theme.css จริง (ไม่มี DOM ในเทสต์)
 * เด่นสุด (verdict / อันดับ / คะแนน) > รอง 15–16px > ป้ายกำกับ 13–14px ขึ้นไป > คำอธิบาย ≥ 13px
 * ค่าเป็น rem — ที่ตัวอักษร 100% (16px) ตรงกับ px ด้านล่าง และขยายตามขนาดตัวอักษรที่ผู้ใช้เลือก
 */
const ROOT_PX = 16;

/** rule ทั้งหมดในไฟล์ (รวมที่อยู่ใน @container/@media) เป็น [selectors, body] */
function rules(css: string): [string[], string][] {
  const out: [string[], string][] = [];
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of clean.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    out.push([m[1].split(',').map((s) => s.trim().replace(/\s+/g, ' ')), m[2]]);
  }
  return out;
}
const ALL = rules(themeCss);
const remPx = (v: string) => parseFloat(v) * ROOT_PX;

/** ตัวแปรระดับของ .ranking-panel → px */
const panelVars: Record<string, number> = (() => {
  const body = ALL.find(([sel, b]) => sel.length === 1 && sel[0] === '.ranking-panel' && b.includes('--batch-'))![1];
  return Object.fromEntries([...body.matchAll(/(--batch-[\w-]+):\s*([\d.]+)rem/g)].map((m) => [m[1], remPx(m[2])]));
})();

/** ขนาดตัวอักษร (px) จาก rule ที่ระบุ selector นี้ตรง ๆ — ถ้ามีหลาย rule (เช่นใน @container) ใช้ค่าที่เล็กที่สุด (ตรวจแบบเข้มสุด) */
function sizeOf(selector: string): number {
  const hits = ALL.filter(([sel, body]) => sel.includes(selector) && /font-size:/.test(body));
  expect(hits.length, `ไม่พบ font-size ของ ${selector}`).toBeGreaterThan(0);
  return Math.min(
    ...hits.map(([, body]) => {
      const v = body.match(/font-size:\s*([^;]+);/)![1].trim();
      const varMatch = v.match(/^var\((--batch-[\w-]+)\)$/);
      if (varMatch) return panelVars[varMatch[1]];
      expect(v, selector).toMatch(/rem$/);
      return remPx(v);
    }),
  );
}

const SECONDARY = [
  '.ranking-panel .badge', // คู่เลขที่ปรากฏ / ผลรวมตัวเลข
  '.ranking-panel .favorite-badge',
  '.ranking-panel .ranking-expand-btn', // "ดูรายละเอียด"
  '.ranking-panel .rank-row-toggle .ranking-expand-btn',
  '.ranking-panel .birthday-compat-link', // "เช็คกับวันเกิด →"
  '.ranking-panel .rank-row-detail-actions .birthday-compat-link',
  '.ranking-panel .auction-tag', // ป้ายพิเศษ
  '.ranking-panel .popular-tag',
  '.ranking-panel .score-figure__note', // "พบคู่เสีย"
  '.ranking-panel .rank-row-calc > summary', // "ดูรายละเอียดการคำนวณ"
];
const LABELS = ['.ranking-panel .score-figure__label', '.ranking-panel .ranking-table th', '.ranking-panel .rank-row-label'];
const NOTES = ['.ranking-panel .plate-figure__note', '.ranking-panel .ranking-plate-note'];
// ข้อความอื่นทุกตัวในผลลัพธ์ #batch (แท็บ, ส่วนที่ขยาย, โหมดเลขที่เล็งไว้) — ต้องไม่ต่ำกว่า 13px
const OTHERS = [
  '.ranking-panel .ranking-tabs button',
  '.ranking-panel .target-results-heading',
  '.ranking-panel .ranking-empty',
  '.ranking-panel .plate-copy-btn',
  '.ranking-panel .detail-box .mode-label',
  '.ranking-panel .detail-box .calc',
  '.ranking-panel .detail-box .meaning',
  '.ranking-panel .detail-box .explanation',
  '.ranking-panel .detail-box .explanation-lead',
  '.ranking-panel .pair-meaning-list li',
  '.ranking-panel .tag',
  '.ranking-panel .dominant-badge',
  '.ranking-panel .ayatana6-inline-title',
  '.ranking-panel .ayatana6-inline-meaning',
  '.ranking-panel .ayatana6-link',
  '.ranking-panel .five-element-link',
  '.ranking-panel .compare-supplementary-title',
  '.ranking-panel .compare-supplementary-note',
];

describe('#batch type scale (จาก theme.css)', () => {
  it('ข้อความรอง 15–16px', () => {
    for (const s of SECONDARY) {
      expect(sizeOf(s), s).toBeGreaterThanOrEqual(15);
      expect(sizeOf(s), s).toBeLessThanOrEqual(16);
    }
  });
  it('ป้ายกำกับ ("คะแนนรวม", หัวตาราง, "ช่อง N") ≥ 13px และอยู่ช่วง 13–14px', () => {
    for (const s of LABELS) {
      expect(sizeOf(s), s).toBeGreaterThanOrEqual(13);
      expect(sizeOf(s), s).toBeLessThanOrEqual(14);
    }
  });
  it('คำอธิบาย "ภาพจำลอง ไม่ใช่ป้ายจริง …" ≥ 13px', () => {
    for (const s of NOTES) expect(sizeOf(s), s).toBeGreaterThanOrEqual(13);
  });
  it('ข้อความอื่นในผลลัพธ์ #batch ≥ 13px', () => {
    for (const s of OTHERS) expect(sizeOf(s), s).toBeGreaterThanOrEqual(13);
  });
  it('verdict / อันดับ / คะแนน เด่นกว่าข้อความรองทุกขนาดจอ (รวมขนาดที่ย่อในแถวกะทัดรัดจอแคบ)', () => {
    const secondaryMax = Math.max(...SECONDARY.map(sizeOf));
    const prominent = {
      'verdict (ตาราง/เลขเดี่ยว)': sizeOf('.verdict-pill'),
      'verdict (แถวกะทัดรัดจอแคบ)': sizeOf('.ranking-panel .rank-row .verdict-pill'),
      'เลขอันดับ': sizeOf('.rank-badge'),
      'เลขอันดับ (แถวกะทัดรัดจอแคบ)': sizeOf('.rank-row .rank-badge'),
      'คะแนน': sizeOf('.score-figure__value'),
      'คะแนน (แถวกะทัดรัดจอแคบ)': sizeOf('.rank-row .score-figure__value'),
    };
    for (const [name, px] of Object.entries(prominent)) expect(px, name).toBeGreaterThan(secondaryMax);
    // verdict เป็น pill ตัวหนา 800 พื้นทึบ — ขนาดต้องมากกว่าข้อความรองอย่างน้อย 2px
    expect(prominent['verdict (แถวกะทัดรัดจอแคบ)'] - secondaryMax).toBeGreaterThanOrEqual(2);
    // ป้ายกำกับเล็กกว่าข้อความรอง (ลำดับชั้นชัด)
    for (const s of LABELS) expect(sizeOf(s), s).toBeLessThan(Math.min(...SECONDARY.map(sizeOf)));
  });
  it('type scale จำกัดอยู่ใน .ranking-panel (หน้าอื่นใช้ขนาดเดิม)', () => {
    expect(sizeOf('.badge')).toBe(12);
    expect(sizeOf('.birthday-compat-link')).toBe(11);
    expect(sizeOf('.plate-figure__note')).toBe(11);
  });
});
