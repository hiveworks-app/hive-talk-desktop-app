import { create } from 'zustand';

interface ThemeState {
  mode: 'light';
}

function applyTheme() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('dark');
  root.classList.add('light');
  root.setAttribute('data-theme', 'light');
}

export const useThemeStore = create<ThemeState>(() => {
  if (typeof window !== 'undefined') {
    requestAnimationFrame(() => applyTheme());
  }
  return { mode: 'light' };
});
