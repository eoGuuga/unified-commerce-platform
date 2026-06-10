'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

/**
 * Toggle de tema claro/escuro.
 * Persiste em localStorage. Aplica classe 'dark' no <html>.
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null);

  useEffect(() => {
    // Carrega tema salvo ou prefere do sistema
    const saved = localStorage.getItem('gt_theme') as 'light' | 'dark' | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.classList.toggle('dark', saved === 'dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initial = prefersDark ? 'dark' : 'light';
      setTheme(initial);
      document.documentElement.classList.toggle('dark', initial === 'dark');
    }
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    localStorage.setItem('gt_theme', next);
  }

  return (
    <button
      onClick={toggle}
      className={`group flex h-9 w-9 items-center justify-center rounded-full border border-[#1a1814]/15 bg-white/40 text-[#1a1814] transition-all duration-300 hover:border-[#1a1814]/30 hover:bg-white/60 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 ${className}`}
      aria-label={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
    >
      {theme === 'dark' ? (
        <Sun className="h-4 w-4 transition-transform duration-300 group-hover:rotate-45" />
      ) : (
        <Moon className="h-4 w-4 transition-transform duration-300 group-hover:-rotate-12" />
      )}
    </button>
  );
}
