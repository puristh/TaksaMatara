// พักไว้ เฟส 1 theme: ไม่ถูกเรียกใช้ระหว่างเฟส 1 (ธีมมืดอย่างเดียว) — เก็บไว้เพื่อกลับมาใช้โหมดสว่างภายหลัง
import type { Theme } from '../hooks/useTheme';

interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  return (
    <div className="theme-toggle" onClick={onToggle} role="button" tabIndex={0}>
      <span>{theme === 'dark' ? '☾ Dark' : '☀ Light'}</span>
      <span className="knob" />
    </div>
  );
}
