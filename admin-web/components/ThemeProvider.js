'use client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
const ThemeContext = createContext(null);
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('dark');
  useEffect(() => { const stored=localStorage.getItem('empimecatronic_admin_theme')||localStorage.getItem('excava_admin_theme'); const preferred=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'; setTheme(stored||preferred); }, []);
  useEffect(() => { document.documentElement.dataset.theme=theme; document.documentElement.style.colorScheme=theme; localStorage.setItem('empimecatronic_admin_theme',theme); }, [theme]);
  const value=useMemo(()=>({theme,toggleTheme:()=>setTheme(current=>current==='dark'?'light':'dark')}),[theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export function useTheme(){return useContext(ThemeContext)}
