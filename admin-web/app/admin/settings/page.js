'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Check, LockKeyhole, LogOut, Moon, Palette, ShieldCheck, Sun, Upload, UserRound } from 'lucide-react';
import PageHeader from '../../../components/PageHeader';
import { ErrorState, LoadingState } from '../../../components/States';
import { useTheme } from '../../../components/ThemeProvider';
import { request, session } from '../../../services/api';
import { imageForUpload, saveSessionUser } from '../../../services/account.service';

const colors = [
  ['#D9FF43', 'Lima'], ['#4DDC8F', 'Verde'], ['#69B7FF', 'Azul'],
  ['#FFB75E', 'Âmbar'], ['#B99AFF', 'Violeta']
];

export default function SettingsPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [user, setUser] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState('');
  const [profile, setProfile] = useState({ name: '', email: '', avatarData: null });
  const [brand, setBrand] = useState({ logoData: null, accentColor: '#D9FF43' });
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [passwordDone, setPasswordDone] = useState(false);

  useEffect(() => {
    request('/auth/me').then(async current => {
      setUser(current);
      setProfile({ name: current.name, email: current.email, avatarData: current.avatarData || null });
      if (current.role === 'SUPER_ADMIN') {
        const result = await request('/companies?limit=100');
        setCompanies(result.data || []);
        setCompanyId(current.companyId || result.data?.[0]?.id || '');
      } else setCompanyId(current.companyId || '');
    }).catch(err => setError(err.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!companyId) return;
    request(`/companies/${companyId}`).then(company => setBrand({ logoData: company.logoData || null, accentColor: company.accentColor || '#D9FF43' })).catch(err => setError(err.message));
  }, [companyId]);

  async function upload(file, target) {
    if (!file) return;
    try {
      setError('');
      const image = await imageForUpload(file, target === 'avatar' ? 320 : 512);
      if (target === 'avatar') setProfile(current => ({ ...current, avatarData: image }));
      else setBrand(current => ({ ...current, logoData: image }));
    } catch (err) { setError(err.message); }
  }
  async function saveProfile(event) {
    event.preventDefault(); setBusy('profile'); setError(''); setMessage('');
    try {
      const updated = await request('/auth/me', { method: 'PATCH', body: JSON.stringify(profile) });
      setUser(updated); saveSessionUser(updated); setMessage('Seu perfil foi atualizado. A foto já aparece no topo do painel.');
    } catch (err) { setError(err.message); }
    finally { setBusy(''); }
  }
  async function saveBrand(event) {
    event.preventDefault(); if (!companyId) return;
    setBusy('brand'); setError(''); setMessage('');
    try {
      const company = await request(`/companies/${companyId}/branding`, { method: 'PATCH', body: JSON.stringify(brand) });
      if (user.companyId === companyId) {
        const updated = { ...user, company: { ...user.company, ...company } };
        setUser(updated); saveSessionUser(updated);
      }
      setMessage(`Identidade visual de ${company.name} salva para a equipe.`);
    } catch (err) { setError(err.message); }
    finally { setBusy(''); }
  }
  async function changePassword(event) {
    event.preventDefault(); setError(''); setMessage('');
    if (password.newPassword !== password.confirm) { setError('A confirmação não corresponde à nova senha.'); return; }
    setBusy('password');
    try {
      await request('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: password.currentPassword, newPassword: password.newPassword }) });
      localStorage.removeItem('empimecatronic_session');
      localStorage.removeItem('excava_session');
      setPassword({ currentPassword: '', newPassword: '', confirm: '' });
      setPasswordDone(true);
      setMessage('Senha alterada. Entre novamente com a nova senha.');
    } catch (err) { setError(err.message); }
    finally { setBusy(''); }
  }

  if (loading) return <div className="admin-page"><LoadingState label="Carregando suas configurações..." /></div>;
  return <div className="admin-page settings-page">
    <PageHeader eyebrow="SUA PLATAFORMA" title="Configurações" description="Cuide da sua conta, do visual da empresa e da forma como o painel aparece neste dispositivo." />
    {error && <ErrorState message={error} onRetry={() => setError('')} />}
    {message && <p className="account-feedback success"><Check size={17}/>{message}</p>}
    <section className="settings-grid">
      <article className="surface-panel settings-card"><div className="settings-card-title"><UserRound size={20}/><div><span className="eyebrow">PESSOAL</span><h2>Meu perfil</h2><p>Seu nome, e-mail e foto visíveis no topo.</p></div></div><form onSubmit={saveProfile}><div className="settings-image-row"><span className="settings-image-preview">{profile.avatarData ? <img src={profile.avatarData} alt="Prévia da foto"/> : profile.name?.slice(0,2).toUpperCase()}</span><div><label className="account-outline settings-upload"><Camera size={16}/> Escolher foto<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => upload(event.target.files?.[0], 'avatar')}/></label>{profile.avatarData && <button className="settings-text-button" type="button" onClick={() => setProfile({ ...profile, avatarData: null })}>Remover foto</button>}<small>PNG, JPG ou WebP; otimizada antes de enviar.</small></div></div><label>Nome<input required value={profile.name} onChange={event => setProfile({ ...profile, name: event.target.value })}/></label><label>E-mail<input required type="email" value={profile.email} onChange={event => setProfile({ ...profile, email: event.target.value })}/></label><button className="account-primary" disabled={busy === 'profile'}>{busy === 'profile' ? 'Salvando...' : 'Salvar perfil'}</button></form></article>
      <article className="surface-panel settings-card"><div className="settings-card-title"><LockKeyhole size={20}/><div><span className="eyebrow">SEGURANÇA</span><h2>Trocar senha</h2><p>Após a mudança, entre novamente no painel.</p></div></div>{passwordDone ? <div className="settings-complete"><ShieldCheck size={28}/><strong>Senha atualizada</strong><p>As sessões antigas foram revogadas.</p><button className="account-primary" onClick={() => router.replace('/login')}><LogOut size={16}/> Voltar ao login</button></div> : <form onSubmit={changePassword}><label>Senha atual<input type="password" required autoComplete="current-password" value={password.currentPassword} onChange={event => setPassword({ ...password, currentPassword: event.target.value })}/></label><label>Nova senha<input type="password" required minLength={10} autoComplete="new-password" value={password.newPassword} onChange={event => setPassword({ ...password, newPassword: event.target.value })}/></label><label>Confirmar nova senha<input type="password" required minLength={10} autoComplete="new-password" value={password.confirm} onChange={event => setPassword({ ...password, confirm: event.target.value })}/></label><small>Mínimo de 10 caracteres.</small><button className="account-primary" disabled={busy === 'password'}>{busy === 'password' ? 'Alterando...' : 'Atualizar senha'}</button></form>}</article>
      <article className="surface-panel settings-card"><div className="settings-card-title"><Palette size={20}/><div><span className="eyebrow">PREFERÊNCIA LOCAL</span><h2>Aparência do painel</h2><p>O tema claro ou escuro fica salvo neste navegador.</p></div></div><div className="settings-theme-buttons"><button type="button" className={theme === 'light' ? 'active' : ''} onClick={() => theme !== 'light' && toggleTheme()}><Sun size={19}/> Claro</button><button type="button" className={theme === 'dark' ? 'active' : ''} onClick={() => theme !== 'dark' && toggleTheme()}><Moon size={19}/> Escuro</button></div></article>
      {['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(user?.role) && <article className="surface-panel settings-card settings-brand-card"><div className="settings-card-title"><Upload size={20}/><div><span className="eyebrow">IDENTIDADE DA EMPRESA</span><h2>Logo e cor principal</h2><p>Essas escolhas são carregadas do servidor por todos os usuários da empresa.</p></div></div>{user.role === 'SUPER_ADMIN' && <label>Empresa<select value={companyId} onChange={event => setCompanyId(event.target.value)}>{companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>}{companyId ? <form onSubmit={saveBrand}><div className="settings-image-row"><span className="settings-logo-preview">{brand.logoData ? <img src={brand.logoData} alt="Prévia do logo"/> : 'E'}</span><div><label className="account-outline settings-upload"><Camera size={16}/> Escolher logo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => upload(event.target.files?.[0], 'logo')}/></label>{brand.logoData && <button className="settings-text-button" type="button" onClick={() => setBrand({ ...brand, logoData: null })}>Remover logo</button>}<small>Recomendado: imagem quadrada com fundo transparente.</small></div></div><span className="settings-field-title">COR DE DESTAQUE</span><div className="settings-colors">{colors.map(([hex, label]) => <button key={hex} type="button" title={label} aria-label={`Cor ${label}`} aria-pressed={brand.accentColor === hex} className={brand.accentColor === hex ? 'selected' : ''} onClick={() => setBrand({ ...brand, accentColor: hex })} style={{ '--swatch': hex }}>{brand.accentColor === hex && <Check size={16}/>}</button>)}</div><button className="account-primary" disabled={busy === 'brand'}>{busy === 'brand' ? 'Salvando...' : 'Salvar identidade visual'}</button></form> : <p>Nenhuma empresa disponível para personalização.</p>}</article>}
    </section>
  </div>;
}
