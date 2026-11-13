import { describe, expect, it } from 'vitest';
import themeCss from '../styles/theme.css?raw';

/**
 * หน้า #batch: ขนาดตัวอักษร อ่านจาก theme.css จริง (ไม่มี DOM ในเทสต์)
 *
 * เหตุผล (รอบ 4 — แทนเทสต์ "ขั้นต่ำ 13px / รอง 15–16px" ของรอบ type scale):
 * ผู้ใช้: ข้อความส่วนบนของหน้า (ฟอร์ม) กับข้อความในผลลัพธ์ขนาดไม่เท่ากันแล้วรู้สึกแปลก → ข้อความทั่วไปในผลลัพธ์
 * (ตาราง / แถวกะทัดรัด / ส่วนที่ขยาย / โหมดเลขที่เล็งไว้) กลับเป็นขนาดก่อน type scale ซึ่งต้องเป็นขนาดที่ส่วนบนของหน้าใช้
 * (ข้อความ 11px เดิมใช้ 11.5px เท่าป้ายช่องกรอก เพราะส่วนบนไม่มี 11px) — เทสต์ขั้นต่ำ 13px จึงขัดกับข้อกำหนดนี้และถูกแทนที่
 * ที่เด่นคือ verdict / อันดับ / คะแนน: ต้องใหญ่กว่าข้อความทั่วไปทุกขนาดจอ (verdict/อันดับย่อเหลือ 80% ของรอบก่อน คะแนนคงเดิม)
 * ค่าเป็น rem — ที่ตัวอักษร 100% (16px) ตรงกับ px ด้านล่าง และขยายตามขนาดตัวอักษรที่ผู้ใช้เลือก (ส่วนบนกับผลลัพธ์จึงเท่ากันทุกขนาด)
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
const fontPx = (body: string) => {
  const v = body.match(/font-size:\s*([^;]+);/)![1].trim();
  expect(v).toMatch(/rem$/);
  return remPx(v);
};
const propPx = (body: string, prop: string) => {
  const m = body.match(new RegExp(`(?:^|;|\\s)${prop}:\\s*([\\d.]+)rem`));
  return m ? remPx(m[1]) : undefined;
};

/** ทุกค่าขนาดตัวอักษร (px) จาก rule ที่ระบุ selector นี้ตรง ๆ (รวมใน @container/@media) */
function sizesOf(selector: string): number[] {
  const hits = ALL.filter(([sel, body]) => sel.includes(selector) && /font-size:/.test(body));
  expect(hits.length, `ไม่พบ font-size ของ ${selector}`).toBeGreaterThan(0);
  return hits.map(([, body]) => fontPx(body));
}
const sizeOf = (selector: string) => Math.min(...sizesOf(selector));
const maxSizeOf = (selector: string) => Math.max(...sizesOf(selector));

/** ส่วนบนของหน้า #batch: หัวหน้า, แถบเมนู, ฟอร์ม */
const TOP = [
  '.field label', // "เลขหน้า" 11.5
  '.theme-toggle',
  '.font-scale-control',
  '.eyebrow', // 12
  '.limit-toggle-row .limit-buttons button',
  '.nav-tabs button', // 12.5
  '.toggle-row', // 13
  '.favorite-toggle-label',
  '.limit-toggle-row',
  '.font-scale-btn',
  '.nav-brand', // 14
  '.sub', // 14.5
];
const TOP_SIZES = new Set(TOP.flatMap(sizesOf));

/**
 * ข้อความทั่วไปในผลลัพธ์ #batch — selector ที่มีผลจริงในแต่ละบริบท
 * (ตาราง: .ranking-actions-cell, แถวกะทัดรัด: .rank-row-toggle / .rank-row-detail-actions)
 */
const RESULTS = [
  // ข้อความรอง
  '.badge',
  '.favorite-badge',
  '.ranking-panel .ranking-actions-cell .ranking-expand-btn', // "ดูรายละเอียด" (ตาราง)
  '.rank-row-toggle .ranking-expand-btn', // "ดูรายละเอียด" (แถวกะทัดรัด)
  '.ranking-panel .ranking-expand-icon',
  '.ranking-panel .ranking-actions-cell .birthday-compat-link', // "เช็คกับวันเกิด →" (ตาราง)
  '.rank-row-detail-actions .birthday-compat-link', // (ส่วนที่ขยาย)
  '.ranking-panel .auction-tag',
  '.ranking-panel .popular-tag',
  '.score-figure__note', // "พบคู่เสีย"
  // (เดิมมี '.rank-row-calc > summary' "ดูรายละเอียดการคำนวณ" — ตัดออกเพราะจอแคบเปิดกล่องวิเคราะห์ไว้เลย ไม่มี summary แล้ว)
  '.plate-copy-btn',
  '.plate-copy-status',
  // ป้ายกำกับ
  '.ranking-panel .score-figure__label', // "คะแนนรวม"
  '.ranking-panel .ranking-table th',
  '.ranking-panel .rank-row-label', // "ช่อง N"
  '.ranking-tabs button',
  '.target-results-heading',
  // คำอธิบาย
  '.ranking-panel .plate-figure__note', // "ภาพจำลอง ไม่ใช่ป้ายจริง …"
  '.ranking-plate-note',
  '.ranking-empty',
  // ส่วนที่ขยาย
  '.ranking-panel .detail-box .mode-label',
  '.detail-box .calc',
  '.detail-box .meaning',
  '.detail-box .explanation',
  '.detail-box .explanation-lead',
  '.pair-meaning-list li',
  '.ranking-panel .tag',
  '.ranking-panel .dominant-badge',
  '.ayatana6-inline-title',
  '.ayatana6-inline-meaning',
  '.ayatana6-link',
  '.five-element-link',
  '.ranking-panel .compare-supplementary-title',
  '.compare-supplementary-note',
];

const PROMINENT = {
  'verdict (ตาราง)': () => sizeOf('.ranking-panel .ranking-table .verdict-pill'),
  'verdict (แถวกะทัดรัด, เล็กสุดคือจอแคบ)': () => sizeOf('.rank-row .verdict-pill'),
  'เลขอันดับ (ตาราง)': () => sizeOf('.rank-badge'),
  'เลขอันดับ (แถวกะทัดรัด, จอแคบ)': () => sizeOf('.rank-row .rank-badge'),
  'คะแนน (ตาราง)': () => sizeOf('.score-figure__value'),
  'คะแนน (แถวกะทัดรัด, จอแคบ)': () => sizeOf('.rank-row .score-figure__value'),
};

describe('#batch ขนาดตัวอักษร (จาก theme.css)', () => {
  it('ส่วนบนของหน้าใช้ 11.5 / 12 / 12.5 / 13 / 14 / 14.5px (ตัวอักษร 100%)', () => {
    expect([...TOP_SIZES].sort((a, b) => a - b)).toEqual([11.5, 12, 12.5, 13, 14, 14.5]);
  });

  it('ข้อความทั่วไปในผลลัพธ์ทุกตัว = ขนาดที่ส่วนบนของหน้าใช้ (ไม่มีขนาดเฉพาะผลลัพธ์ เช่น 11px หรือ 15px)', () => {
    for (const s of RESULTS) {
      for (const px of sizesOf(s)) expect(TOP_SIZES.has(px), `${s} = ${px}px ไม่ตรงกับส่วนบนของหน้า`).toBe(true);
    }
  });

  it('ทุก rule ใน .ranking-panel ที่ตั้ง font-size (ยกเว้น verdict) ใช้ขนาดของส่วนบนของหน้า — กันไม่ให้มี type scale แยกกลับมา', () => {
    const scoped = ALL.filter(([sel, body]) => /font-size:/.test(body) && sel.some((s) => s.startsWith('.ranking-panel ') && !s.includes('verdict-pill')));
    expect(scoped.length).toBeGreaterThan(0);
    for (const [sel, body] of scoped) expect(TOP_SIZES.has(fontPx(body)), sel.join(', ')).toBe(true);
    expect(themeCss).not.toMatch(/--batch-(secondary|label|note|body)/);
  });

  it('verdict / อันดับ / คะแนน ใหญ่กว่าข้อความทั่วไปในผลลัพธ์ทุกขนาดจอ', () => {
    // หัวข้อส่วน "ผลลัพธ์เลขที่เล็งไว้" (.target-results-heading 14px = แบรนด์ในแถบเมนู) เป็นหัวข้อ ไม่ใช่ข้อความรอง จึงไม่นับ
    const secondary = RESULTS.filter((s) => s !== '.target-results-heading');
    const resultsMax = Math.max(...secondary.map(maxSizeOf)); // 13px
    expect(resultsMax).toBe(13);
    for (const [name, get] of Object.entries(PROMINENT)) expect(get(), name).toBeGreaterThan(resultsMax);
    // เลขอันดับ/คะแนนใหญ่กว่าอย่างน้อย 1.3 เท่า · verdict เป็น pill ทึบตัวหนา 800 + ไอคอน 1.3em จึงเด่นแม้ขนาดใกล้กัน
    expect(PROMINENT['เลขอันดับ (แถวกะทัดรัด, จอแคบ)']() / resultsMax).toBeGreaterThanOrEqual(1.3);
    expect(PROMINENT['คะแนน (แถวกะทัดรัด, จอแคบ)']() / resultsMax).toBeGreaterThanOrEqual(1.3);
  });

  it('ป้ายอันดับและ verdict = 80% ของรอบก่อน (ตัวอักษร ป้าย และ pill) · คะแนนคงเดิม', () => {
    const body = (sel: string, extra = '') =>
      ALL.filter(([s, b]) => s.includes(sel) && /font-size:/.test(b) && b.includes(extra)).map(([, b]) => b);
    // ป้ายอันดับ (ตาราง/แถวกว้าง): 54px ตัวเลข 28px → 43.2 / 22.4
    for (const b of [...body('.rank-badge'), ...body('.rank-row .rank-badge', 'width: 2.7rem')]) {
      if (!b.includes('width: 2.7rem')) continue;
      expect(propPx(b, 'width')).toBeCloseTo(54 * 0.8);
      expect(propPx(b, 'height')).toBeCloseTo(54 * 0.8);
      expect(fontPx(b)).toBeCloseTo(28 * 0.8);
    }
    // ป้ายอันดับจอแคบ: 40px ตัวเลข 22px → 32 / 17.6
    const narrow = body('.rank-row .rank-badge', 'width: 2rem')[0];
    expect(propPx(narrow, 'width')).toBeCloseTo(40 * 0.8);
    expect(fontPx(narrow)).toBeCloseTo(22 * 0.8);
    // verdict: ตาราง/แถวกว้าง 18 → 14.4, จอแคบ 17 → 13.6 (ไอคอน 1.3em และ padding em ย่อตาม)
    expect(sizeOf('.ranking-panel .ranking-table .verdict-pill')).toBeCloseTo(18 * 0.8);
    expect(maxSizeOf('.rank-row .verdict-pill')).toBeCloseTo(18 * 0.8);
    expect(sizeOf('.rank-row .verdict-pill')).toBeCloseTo(17 * 0.8);
    expect(themeCss).toMatch(/\.verdict-pill__icon\s*\{\s*font-size:\s*1\.3em/);
    expect(themeCss).toMatch(/\.verdict-pill\s*\{[^}]*padding:\s*0\.35em 0\.9em 0\.35em 0\.75em/);
    // คะแนนคงเดิม
    expect(sizeOf('.score-figure__value')).toBe(34);
    expect(sizeOf('.score-figure--top .score-figure__value')).toBe(40);
    expect(sizeOf('.rank-row .score-figure__value')).toBe(24);
  });

  it('ขนาดเฉพาะ #batch จำกัดอยู่ใน .ranking-panel (หน้าอื่นใช้ขนาดเดิม: verdict #single 18px)', () => {
    expect(sizeOf('.verdict-pill')).toBe(18);
    expect(sizeOf('.badge')).toBe(12);
    expect(sizeOf('.birthday-compat-link')).toBe(11);
    expect(sizeOf('.plate-figure__note')).toBe(11);
  });
});
