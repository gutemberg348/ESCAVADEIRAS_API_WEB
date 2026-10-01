import 'leaflet/dist/leaflet.css'; import './globals.css'; import { ThemeProvider } from '../components/ThemeProvider';
import './usability.css';
export const metadata={title:'Empimecatrônic | Centro de Operações',description:'Plataforma IoT para frotas pesadas'};
export default function RootLayout({children}){return <html lang="pt-BR" suppressHydrationWarning><body><ThemeProvider>{children}</ThemeProvider></body></html>}
