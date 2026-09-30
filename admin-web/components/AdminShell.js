'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, Menu, Search, Wifi } from 'lucide-react';
import Sidebar from './Sidebar';
import ThemeToggle from './ThemeToggle';
import { request, session } from '../services/api';

export default function AdminShell({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const activeSession = session();
    setUser(activeSession?.user || null);
    if (!activeSession?.accessToken) return;

    request('/auth/me')
      .then((currentUser) => {
        setUser(currentUser);
        localStorage.setItem(
          'empimecatronic_session',
          JSON.stringify({ ...activeSession, user: currentUser })
        );
      })
      .catch(() => {});
  }, []);

  const date = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long'
  }).format(new Date());
  const initials = user?.name?.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'AD';

  return (
    <main className="admin-shell">
      <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
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
            <button className="round-button" aria-label="Buscar"><Search size={17} /></button>
            <Link className="round-button notification-button" href="/admin/alerts" aria-label="Alertas"><Bell size={17} /><i /></Link>
            <div className="user-summary">
              <div className="avatar">{initials}</div>
              <div>
                <strong>{user?.name || 'Administrador'}</strong>
                <small>{user?.company?.name || 'Empimecatrônic'}</small>
              </div>
            </div>
          </div>
        </header>
        {children}
      </section>
    </main>
  );
}
