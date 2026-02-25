import { create } from 'zustand';

type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

function getInitialMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  return (localStorage.getItem('theme') as ThemeMode) || 'system';
}

function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  root.classList.remove('dark', 'light');
  root.removeAttribute('data-theme');

  if (mode === 'dark') {
    root.classList.add('dark');
    root.setAttribute('data-theme', 'dark');
  } else if (mode === 'light') {
    root.classList.add('light');
    root.setAttribute('data-theme', 'light');
  }
  // 'system' → no class, CSS media query handles it
}

export const useThemeStore = create<ThemeState>((set) => {
  // Apply initial theme on store creation
  const initial = getInitialMode();
  if (typeof window !== 'undefined') {
    // Defer to avoid SSR hydration mismatch
    requestAnimationFrame(() => applyTheme(initial));
  }

  return {
    mode: initial,
    setMode: (mode) => {
      localStorage.setItem('theme', mode);
      applyTheme(mode);
      set({ mode });
    },
  };
});
