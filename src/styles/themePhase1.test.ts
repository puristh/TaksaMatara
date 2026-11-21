import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import css from './theme.css?raw';
import indexHtml from '../../index.html?raw';
import { TmHeader } from '../components/TmHeader';

/**
 * theme "The Living Wisdom" เฟส 1 (สี ฟอนต์หัวข้อ พื้นหลัง หัวเว็บ) — ข้อห้ามและข้อกำหนดของเฟสนี้
 */
const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
const block = (selector: string) => {
  const start = css.indexOf(selector);
  return css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
};

/** hue/saturation (HSL) ของสี hex */
function hsl(hex: string): [number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return [h, s];
}

describe('theme เฟส 1: ฟอนต์', () => {
  it('เพิ่มเฉพาะ Cormorant Garamond น้ำหนักที่ใช้จริง (500, 600) display=swap · ฟอนต์เดิมคงเดิม', () => {
    const href = indexHtml.match(/href="(https:\/\/fonts\.googleapis\.com\/css2\?[^"]+)"/)![1];
    expect(href).toContain('family=Cormorant+Garamond:wght@500;600');
    expect(href).toContain('family=Sarabun:wght@400;500;600;700');
    expect(href).toContain('family=IBM+Plex+Mono:wght@500;600');
    expect(href).toMatch(/display=swap$/);
    expect(href).not.toMatch(/Jost|Noto/);
  });

  it('Cormorant ใช้เฉพาะหัวเว็บ (.tm-brand) และหัวข้อหน้า/ส่วน (h1, h2, .landing-title)', () => {
    const selectors = [...plain.matchAll(/([^{}]+)\{[^{}]*Cormorant[^{}]*\}/g)].map((m) => m[1].trim()).sort();
    expect(selectors).toEqual(['.landing-title', '.tm-brand', 'h1', 'h2']);
  });

  it('น้ำหนักที่ใช้กับ Cormorant ครอบด้วยไฟล์ที่โหลด: .tm-brand 500 · h1 700 → ใช้ไฟล์ 600 ที่ใกล้สุด (ตัวไทยเป็น Sarabun)', () => {
    expect(block('.tm-brand {')).toMatch(/font-weight:\s*500/);
  });
});

describe('theme เฟส 1: สี (ธีมมืด)', () => {
  const darkBlock = block("[data-theme='dark'] {");
  const darkHex = [...darkBlock.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]] as const);

  it('ไม่มีสีฟ้า/น้ำเงิน/ม่วงในตัวแปรธีมมืด (hue 180–300° ที่อิ่มตัว > 20%)', () => {
    expect(darkHex.length).toBeGreaterThan(15);
    for (const [name, hex] of darkHex) {
      const [h, s] = hsl(hex);
      expect(h >= 180 && h <= 300 && s > 0.2, `${name} ${hex} hue ${h.toFixed(0)}`).toBe(false);
    }
  });

  it('สีแดงที่จำเป็นใช้ #c8735a (--bad, --verdict-bad) ไม่ใช้แดงสด', () => {
    expect(darkBlock).toMatch(/--bad:\s*#c8735a/);
    expect(darkBlock).toMatch(/--verdict-bad:\s*#c8735a/);
  });

  it('ค่าตัวแปรธีมมืดสองบล็อก (prefers-color-scheme / data-theme) ตรงกันทุกตัว', () => {
    const pref = block(":root:not([data-theme='light']) {");
    const vars = (b: string) => Object.fromEntries([...b.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
    expect(vars(pref)).toEqual(vars(darkBlock));
  });

  it('--line เป็นทองโปร่งตาม theme (ใช้ตัวแปรเดิม ไม่สร้างชุดใหม่ — ไม่มี --gold/--ivory/--bg ซ้อน)', () => {
    expect(darkBlock).toMatch(/--line:\s*rgba\(168, 121, 53, 0\.32\)/);
    expect(plain).not.toMatch(/--(gold|ivory|champ|radiant|bg2?|bronze):/);
  });
});

describe('theme เฟส 1: พื้นหลัง หัวเว็บ และข้อห้าม', () => {
  it('พื้นหลังตาม theme ข้อ 1 · background-attachment: fixed ปิดที่จอ ≤700px (จุดตัดเดิม)', () => {
    expect(block("[data-theme='dark'] body {")).toMatch(/radial-gradient\(1200px 800px at 76% 30%/);
    expect(block("[data-theme='dark'] body {")).toMatch(/background-attachment:\s*fixed/);
    const narrow = plain.match(/@media \(max-width: 700px\) \{\s*\[data-theme='dark'\] body \{\s*background-attachment: scroll;/);
    expect(narrow).not.toBeNull();
  });

  it('ไม่มี backdrop-filter, .glass, .btn, ขอบทองวิ่ง (@property/conic), จุดตัด 820px', () => {
    expect(plain).not.toMatch(/backdrop-filter|\.glass\b|\.btn\b|@property|conic-gradient|820px/);
  });

  it('class ใหม่ของ theme ขึ้นต้น tm- (หัวเว็บ)', () => {
    const html = renderToStaticMarkup(createElement(TmHeader));
    const classes = [...html.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(' '));
    expect(classes.length).toBeGreaterThan(0);
    for (const c of classes) expect(c).toMatch(/^tm-/);
  });

  it('สัญลักษณ์ Seed of Life: วง r=13 เจ็ดวง, วงแหวน r=46, วงจุดประ r=40, จุดทอง 8 จุด + จุดกลาง · คำ "Taksa Matara"', () => {
    const html = renderToStaticMarkup(createElement(TmHeader));
    expect(html.match(/ r="13"/g)).toHaveLength(7);
    expect(html).toContain('r="46"');
    expect(html).toMatch(/r="40" stroke-dasharray/);
    expect(html.match(/ r="2\.2"/g)).toHaveLength(8);
    expect(html.match(/ r="2\.6"/g)).toHaveLength(1);
    expect(html).toContain('aria-hidden="true"');
    expect(html.replace(/<[^>]+>/g, '')).toBe('Taksa Matara');
  });
});
