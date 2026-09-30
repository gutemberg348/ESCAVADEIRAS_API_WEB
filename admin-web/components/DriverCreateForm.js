'use client';
import { useEffect, useState } from 'react';
import { request } from '../services/api';
import CardCapture from './CardCapture';

export default function DriverCreateForm({ onCreated, onCancel }) {
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', companyId: '', phone: '', cardCode: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { request('/companies').then(result => { const items = Array.isArray(result) ? result : result.data || []; setCompanies(items); if (items.length === 1) setForm(current => ({ ...current, companyId: items[0].id })); }).catch(err => setError(err.message)); }, []);
  async function submit(event) {
    event.preventDefault(); setSaving(true); setError('');
    try { const body = { ...form }; if (!body.cardCode) delete body.cardCode; await request('/drivers', { method: 'POST', body: JSON.stringify(body) }); onCreated(); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }
  return <form className="surface-panel rfid-form driver-create" onSubmit={submit}><h2>Cadastrar motorista</h2><p className="capture-hint">Crie o acesso ao app e vincule o cartão agora ou depois.</p>
    {['name', 'email', 'password', 'phone'].map((field, index) => <label key={field}><span>{['NOME', 'E-MAIL PARA LOGIN', 'SENHA INICIAL', 'TELEFONE'][index]}</span><input required={field !== 'phone'} type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'} minLength={field === 'password' ? 8 : undefined} autoComplete={field === 'password' ? 'new-password' : 'off'} value={form[field]} onChange={event => setForm({ ...form, [field]: event.target.value })}/></label>)}
    <label><span>EMPRESA</span><select required value={form.companyId} onChange={event => setForm({ ...form, companyId: event.target.value })}><option value="">Selecione</option>{companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
    <CardCapture value={form.cardCode} onChange={cardCode => setForm(current => ({ ...current, cardCode }))}/>
    {error && <p className="form-error" role="alert">{error}</p>}<button disabled={saving}>{saving ? 'SALVANDO...' : 'CADASTRAR MOTORISTA'}</button><button type="button" className="secondary-action" onClick={onCancel}>Cancelar</button>
  </form>;
}
