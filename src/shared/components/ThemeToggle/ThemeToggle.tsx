'use client';

import { useTheme } from 'next-themes';
import styles from './ThemeToggle.module.css';

const CYCLE: Record<string, string> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

const LABELS: Record<string, string> = {
  light: 'Motyw: jasny — przełącz na ciemny',
  dark: 'Motyw: ciemny — przełącz na systemowy',
  system: 'Motyw: systemowy — przełącz na jasny',
};

const ICONS: Record<string, string> = {
  light: '☀',
  dark: '☾',
  system: '⊙',
};

export function ThemeToggle() {
  const { theme = 'system', setTheme } = useTheme();
  const resolved = theme in CYCLE ? theme : 'system';

  return (
    <button
      className={styles.button}
      aria-label={LABELS[resolved]}
      onClick={() => setTheme(CYCLE[resolved])}
    >
      {ICONS[resolved]}
    </button>
  );
}
