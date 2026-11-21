// พักไว้ เฟส 1 theme: ไม่ถูกเรียกใช้ระหว่างเฟส 1 (ธีมมืดอย่างเดียว) — เก็บไว้เพื่อกลับมาใช้โหมดสว่างภายหลัง
import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

/**
 * ข้อ 8: Default ตาม prefers-color-scheme ของเครื่อง ถ้าตรวจไม่ได้ (เช่น
 * matchMedia ไม่รองรับ) ให้ fallback เป็น Light
 */
function detectInitialTheme(): Theme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => detectInitialTheme());

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return [theme, toggleTheme];
}
