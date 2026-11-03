import { describe, expect, it } from 'vitest';
import css from './styles/theme.css?raw';
import app from './App.tsx?raw';
import indexHtml from '../index.html?raw';

/**
 * ตัวควบคุมขนาดตัวอักษร / โหมดสีเคยเป็น position: fixed และทับแถบเมนู หัวข้อ และฟอร์ม
 * (วัดบนเบราว์เซอร์จริง: ทับ 132 จาก 180 สถานะ) — ตอนนี้อยู่ใน .app-toolbar ในลำดับปกติของหน้า
 * เทสต์นี้กันไม่ให้กลับไปลอยอีก (การวัดซ้อนทับบนเบราว์เซอร์จริงอยู่ในรายงาน ไม่อยู่ในชุดเทสต์นี้
 * เพราะโปรเจกต์ไม่มี browser test runner)
 */

function rulesFor(selector: string): string[] {
  const out: string[] = [];
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(plain))) {
    const sels = m[1].split(',').map((x) => x.trim());
    if (sels.some((x) => x === selector || x.endsWith(` ${selector}`))) out.push(m[2]);
  }
  return out;
}

describe('app toolbar (font scale / theme) does not float over content', () => {
  for (const sel of ['.app-toolbar', '.font-scale-control', '.theme-toggle']) {
    it(`${sel} is not position fixed/absolute/sticky`, () => {
      for (const body of rulesFor(sel)) expect(body).not.toMatch(/position\s*:\s*(fixed|absolute|sticky)/);
    });
  }
  it('both controls are rendered inside .app-toolbar, before the nav bar', () => {
    const start = app.indexOf('<div className="app-toolbar">');
    const end = app.indexOf('</div>', start);
    expect(start).toBeGreaterThan(-1);
    const block = app.slice(start, end);
    expect(block).toContain('<FontScaleControl />');
    expect(block).toContain('<ThemeToggle');
    expect(start).toBeLessThan(app.indexOf('className="nav-bar"'));
  });
  it('touch targets: font-scale buttons and theme toggle are at least 44px', () => {
    expect(rulesFor('.font-scale-btn').join('')).toMatch(/width:\s*44px[\s\S]*height:\s*44px/);
    expect(rulesFor('.theme-toggle').join('')).toMatch(/min-height:\s*44px/);
  });
  it('page padding respects iOS safe areas', () => {
    const body = rulesFor('.app').join('');
    for (const side of ['top', 'left', 'right']) expect(body).toContain(`env(safe-area-inset-${side}`);
    expect(indexHtml).toContain('viewport-fit=cover');
  });
});
