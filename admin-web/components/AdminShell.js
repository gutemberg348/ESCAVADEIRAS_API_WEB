'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Menu, Wifi } from 'lucide-react';
import Sidebar from './Sidebar';
import ThemeToggle from './ThemeToggle';
import { request, session } from '../services/api';

export default function AdminShell({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const activeSession = session();
    setUser(activeSession?.user || null);
    if (!activeSession?.accessToken) { router.replace('/login'); return; }

    const updateFromSession = () => setUser(session()?.user || null);
    window.addEventListener('empimecatronic:profile-updated', updateFromSession);
    request('/auth/me')
      .then((currentUser) => {
        setUser(currentUser);
        localStorage.setItem(
          'empimecatronic_session',
          JSON.stringify({ ...activeSession, user: currentUser })
        );
      })
      .catch(() => {});
    return () => window.removeEventListener('empimecatronic:profile-updated', updateFromSession);
  }, [router]);

  useEffect(() => {
    const accent = user?.company?.accentColor;
    document.documentElement.style.setProperty('--brand-accent', accent || '#d9ff43');
  }, [user?.company?.accentColor]);

  useEffect(() => {
    if (user?.role === 'DRIVER') router.replace('/login');
    else if (user?.role === 'MANAGER' && /^\/admin\/(companies|drivers|devices|commands|rfid|firmware|logs)(\/|$)|^\/admin\/machines\/new(\/|$)/.test(pathname)) router.replace('/admin');
  }, [user?.role, pathname, router]);

  const date = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long'
  }).format(new Date());
  const initials = user?.name?.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'AD';

  return (
    <main className="admin-shell">
      <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} user={user} />
      {mobileOpen && <button className="sidebar-backdrop" aria-label="Fechar menu" onClick={() => setMobileOpen(false)} />}
      <section className="admin-workbench">
        <header className="admin-topbar">
          <div className="topbar-left">
            <button className="mobile-menu" onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
            <div>
              <span className="eyebrow">EMPIMECATRÔNIC · CENTRO DE OPERAÇÕES</span>
              <strong>{date.charAt(0).toUpperCase() + date.slice(1)}</strong>
            </div>
          </div>
          <div className="topbar-actions">
            <div className="live-connection"><Wifi size={13} /><span>API CONECTADA</span></div>
            <ThemeToggle />
            <Link className="round-button notification-button" href="/admin/alerts" aria-label="Alertas"><Bell size={17} /><i /></Link>
            <Link className="user-summary" href="/admin/settings" aria-label="Abrir configurações da conta">
              <div className="avatar">{user?.avatarData ? <img src={user.avatarData} alt="Foto de perfil" /> : initials}</div>
              <div>
                <strong>{user?.name || 'Administrador'}</strong>
                <small>{user?.company?.name || 'Empimecatrônic'}</small>
              </div>
            </Link>
          </div>
        </header>
        {children}
      </section>
    </main>
  );
}
