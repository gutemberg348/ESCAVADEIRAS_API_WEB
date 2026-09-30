'use client';
import { Moon, Sun } from 'lucide-react'; import { useTheme } from './ThemeProvider';
export default function ThemeToggle(){const {theme,toggleTheme}=useTheme();return <button className="theme-toggle" onClick={toggleTheme} aria-label="Alternar tema claro e escuro"><span className={theme==='light'?'selected':''}><Sun size={15}/></span><span className={theme==='dark'?'selected':''}><Moon size={15}/></span></button>}
