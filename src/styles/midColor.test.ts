import { describe, expect, it } from 'vitest';
import css from './theme.css?raw';

/**
 * สี "ปานกลาง" (--mid บน --mid-bg) ต้องผ่าน 4.5:1 และเป็นค่าเดียวกันทั้งแอป (#batch, #single, ธาตุจีน ฯลฯ)
 * — ไม่มีการ override --mid เฉพาะบางส่วนของหน้า
 */
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const values = (name: string) => [...css.matchAll(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`, 'g'))].map((m) => m[1]);

describe('สี --mid ("ปานกลาง") ทั้งแอป', () => {
  it('ตั้งค่าเฉพาะใน :root (สว่าง) และธีมมืด 2 ที่ — ไม่มี override ที่อื่น และไม่มี --mid-text แยก', () => {
    expect(values('--mid')).toHaveLength(3);
    expect(css).not.toMatch(/--mid:\s*var\(/);
    expect(css).not.toContain('--mid-text');
  });
  it('ตัวอักษร --mid บน --mid-bg ≥ 4.5:1 ทั้งสองธีม', () => {
    const mid = values('--mid');
    const bg = values('--mid-bg');
    expect(bg).toHaveLength(3);
    for (let i = 0; i < 3; i++) expect(ratio(mid[i], bg[i])).toBeGreaterThanOrEqual(4.5);
  });
});
