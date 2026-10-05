import 'leaflet/dist/leaflet.css'; import './globals.css'; import { ThemeProvider } from '../components/ThemeProvider';
import './usability.css';
import './operations.css';
import './account.css';
export const metadata={title:'Empimecatrônic | Centro de Operações',description:'Plataforma IoT para frotas pesadas'};
export default function RootLayout({children}){return <html lang="pt-BR" data-theme="dark" style={{colorScheme:'dark'}} suppressHydrationWarning><body><ThemeProvider>{children}</ThemeProvider></body></html>}
