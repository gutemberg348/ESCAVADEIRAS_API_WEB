'use client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
const ThemeContext = createContext(null);
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('dark');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const stored = localStorage.getItem('empimecatronic_admin_theme') || localStorage.getItem('excava_admin_theme');
      setTheme(stored === 'light' ? 'light' : 'dark');
    } catch { /* Dark remains usable when browser storage is unavailable. */ }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try { localStorage.setItem('empimecatronic_admin_theme', theme); } catch {}
  }, [theme, ready]);
  const value=useMemo(()=>({theme,toggleTheme:()=>setTheme(current=>current==='dark'?'light':'dark')}),[theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export function useTheme(){return useContext(ThemeContext)}
