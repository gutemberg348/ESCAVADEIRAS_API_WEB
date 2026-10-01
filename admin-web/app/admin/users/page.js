'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, KeyRound, Plus, Search, ShieldCheck, UserRound, UsersRound, X } from 'lucide-react';
import PageHeader from '../../../components/PageHeader';
import { ErrorState, LoadingState } from '../../../components/States';
import { request, session } from '../../../services/api';

const roleLabel = { SUPER_ADMIN: 'Superadministrador', COMPANY_ADMIN: 'Administrador', MANAGER: 'Gerente · leitura', DRIVER: 'Motorista' };
const blankManager = { name: '', email: '', password: '', companyId: '' };

export default function UsersPage() {
  const [actor, setActor] = useState(null);
  const canEdit = ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(actor?.role);
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [newManager, setNewManager] = useState(blankManager);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState(null);
  const [edit, setEdit] = useState({ name: '', email: '', active: true, password: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [list, companyPage] = await Promise.all([
        request('/users'),
        actor?.role === 'SUPER_ADMIN' ? request('/companies?limit=100') : Promise.resolve({ data: [] })
      ]);
      setUsers(list);
      setCompanies(companyPage.data || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [actor?.role]);
  useEffect(() => { setActor(session()?.user || null); }, []);
  useEffect(() => { if (actor) load(); }, [actor, load]);

  const filtered = useMemo(() => users.filter(user => {
    const matches = `${user.name} ${user.email} ${user.company?.name || ''}`.toLowerCase().includes(search.toLowerCase());
    return matches && (filter === 'ALL' || (filter === 'TEAM' ? user.role !== 'DRIVER' : user.role === 'DRIVER'));
  }), [users, search, filter]);

  function openEdit(user) {
    setSelected(user);
    setEdit({ name: user.name, email: user.email, active: user.active, password: '' });
    setError(''); setMessage('');
  }
  async function createManager(event) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    try {
      await request('/users/managers', { method: 'POST', body: JSON.stringify({ ...newManager, companyId: actor.role === 'SUPER_ADMIN' ? newManager.companyId : actor.companyId }) });
      setNewManager(blankManager); setShowCreate(false); setMessage('Gerente criado. Ele já pode acessar o painel com a senha definida.'); await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }
  async function saveUser(event) {
    event.preventDefault(); if (!selected) return;
    setSaving(true); setError(''); setMessage('');
    try {
      await request(`/users/${selected.id}`, { method: 'PATCH', body: JSON.stringify({ name: edit.name, email: edit.email, ...(selected.role === 'MANAGER' ? { active: edit.active } : {}) }) });
      if (edit.password) await request(`/users/${selected.id}/reset-password`, { method: 'POST', body: JSON.stringify({ password: edit.password }) });
      setSelected(null); setMessage(edit.password ? 'Dados e senha atualizados. A pessoa deverá entrar novamente.' : 'Dados do usuário atualizados.'); await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="admin-page"><LoadingState label="Carregando contas da plataforma..." /></div>;
  return <div className="admin-page account-page">
    <PageHeader eyebrow="ACESSOS DA PLATAFORMA" title="Usuários" description="Pessoas cadastradas na operação. Motoristas acessam o aplicativo; gerentes consultam o painel sem alterar equipamentos." />
    <section className="account-metrics">
      <div className="surface-panel"><UsersRound size={20}/><span>CONTAS</span><strong>{users.length}</strong><small>Da empresa permitida</small></div>
      <div className="surface-panel"><UserRound size={20}/><span>MOTORISTAS</span><strong>{users.filter(user => user.role === 'DRIVER' && user.active).length}</strong><small>Com acesso ao app</small></div>
      <div className="surface-panel"><ShieldCheck size={20}/><span>PAINEL</span><strong>{users.filter(user => user.role !== 'DRIVER' && user.active).length}</strong><small>Administradores e gerentes</small></div>
    </section>
    {message && <p className="account-feedback success"><Check size={16}/>{message}</p>}
    {error && <ErrorState message={error} onRetry={load} />}
    <section className="surface-panel account-directory">
      <div className="account-directory-head"><div><span className="eyebrow">DIRETÓRIO</span><h2>Pessoas e permissões</h2><p>Para cadastrar ou vincular cartões de motorista, use a seção Motoristas.</p></div>{canEdit && <button className="account-primary" onClick={() => setShowCreate(true)}><Plus size={17}/> Novo gerente</button>}</div>
      <div className="account-toolbar"><label className="account-search"><Search size={17}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por nome, e-mail ou empresa" /></label><div className="account-tabs">{[['ALL','Todos'],['TEAM','Painel'],['DRIVER','Motoristas']].map(([value,label]) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div></div>
      <div className="account-list">{filtered.length ? filtered.map(user => <article className="account-row" key={user.id}><span className="account-avatar">{user.avatarData ? <img src={user.avatarData} alt=""/> : user.name.slice(0,1).toUpperCase()}</span><div className="account-person"><strong>{user.name}</strong><span>{user.email}</span><small>{user.company?.name || 'Plataforma geral'}</small></div><div className="account-role"><b>{roleLabel[user.role]}</b><small className={user.active ? 'is-active' : 'is-inactive'}>{user.active ? 'Ativo' : 'Inativo'}</small></div>{canEdit && user.id !== actor.id && user.role !== 'SUPER_ADMIN' && (actor.role === 'SUPER_ADMIN' || user.role !== 'COMPANY_ADMIN') ? <button className="account-outline" onClick={() => openEdit(user)}>Editar conta</button> : <span className="account-readonly">{user.id === actor?.id ? 'Sua conta' : 'Somente leitura'}</span>}</article>) : <div className="account-empty">Nenhum usuário corresponde à busca.</div>}</div>
    </section>
    {canEdit && <p className="account-link-note">Precisa adicionar um motorista com cartão RFID? <Link href="/admin/drivers">Ir para Motoristas</Link></p>}

    {showCreate && <div className="account-modal-backdrop" role="presentation"><div className="account-modal surface-panel" role="dialog" aria-modal="true" aria-label="Novo gerente"><button className="account-close" onClick={() => setShowCreate(false)} aria-label="Fechar"><X size={19}/></button><span className="eyebrow">NOVO ACESSO</span><h2>Criar gerente</h2><p>O gerente pode ver dashboard, máquinas, mapa, telemetria e alertas. Não pode alterar cadastros nem enviar comandos.</p><form onSubmit={createManager}><label>Nome completo<input required value={newManager.name} onChange={event => setNewManager({ ...newManager, name: event.target.value })}/></label><label>E-mail<input required type="email" autoComplete="off" value={newManager.email} onChange={event => setNewManager({ ...newManager, email: event.target.value })}/></label>{actor.role === 'SUPER_ADMIN' && <label>Empresa<select required value={newManager.companyId} onChange={event => setNewManager({ ...newManager, companyId: event.target.value })}><option value="">Selecione a empresa</option>{companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>}<label>Senha inicial<input required type="password" minLength={10} autoComplete="new-password" value={newManager.password} onChange={event => setNewManager({ ...newManager, password: event.target.value })}/><small>Mínimo de 10 caracteres. Informe a senha por um canal seguro.</small></label><div className="account-form-actions"><button type="button" onClick={() => setShowCreate(false)}>Cancelar</button><button type="submit" disabled={saving}>{saving ? 'Criando...' : 'Criar gerente'}</button></div></form></div></div>}
    {selected && <div className="account-modal-backdrop" role="presentation"><div className="account-modal surface-panel" role="dialog" aria-modal="true" aria-label="Editar usuário"><button className="account-close" onClick={() => setSelected(null)} aria-label="Fechar"><X size={19}/></button><span className="eyebrow">CONTA EXISTENTE</span><h2>{selected.name}</h2><p>{roleLabel[selected.role]} · {selected.company?.name || 'Plataforma'}. O tipo de acesso não muda aqui para preservar os vínculos com máquinas e cartões.</p><form onSubmit={saveUser}><label>Nome completo<input required value={edit.name} onChange={event => setEdit({ ...edit, name: event.target.value })}/></label><label>E-mail<input required type="email" value={edit.email} onChange={event => setEdit({ ...edit, email: event.target.value })}/></label>{selected.role === 'MANAGER' && <label className="account-check"><input type="checkbox" checked={edit.active} onChange={event => setEdit({ ...edit, active: event.target.checked })}/> Acesso ativo ao painel</label>}<label>Nova senha (opcional)<input type="password" minLength={10} autoComplete="new-password" value={edit.password} onChange={event => setEdit({ ...edit, password: event.target.value })}/><small>Se preencher, as sessões anteriores serão revogadas.</small></label><div className="account-form-actions"><button type="button" onClick={() => setSelected(null)}>Cancelar</button><button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar alterações'}</button></div></form></div></div>}
    {(showCreate || selected) && error && <div className="account-floating-error" role="alert">{error}</div>}
  </div>;
}
