'use client';

import { useEffect, useState, startTransition } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import styles from './ThemeToggle.module.css';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    startTransition(() => setMounted(true));
  }, []);

  if (!mounted) {
    return <div className={styles.skeleton} aria-hidden />;
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      role='switch'
      aria-checked={isDark}
      aria-label={
        isDark
          ? 'Motyw ciemny — przełącz na jasny'
          : 'Motyw jasny — przełącz na ciemny'
      }
      className={`${styles.track} ${isDark ? styles.trackDark : styles.trackLight}`}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      <span
        className={`${styles.thumb} ${isDark ? styles.thumbDark : styles.thumbLight}`}
      >
        {isDark ? (
          <Moon size={12} strokeWidth={2.5} />
        ) : (
          <Sun size={12} strokeWidth={2.5} />
        )}
      </span>
    </button>
  );
}
