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
