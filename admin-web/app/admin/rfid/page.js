'use client';
import CardCapture from '../../../components/CardCapture';
import { useCallback, useEffect, useState } from 'react';
import { Radio, Link2, Tags } from 'lucide-react';
import PageHeader from '../../../components/PageHeader';
import StatusBadge from '../../../components/StatusBadge';
import { ErrorState, LoadingState } from '../../../components/States';
import { request } from '../../../services/api';

export default function RfidPage(){
  const [captureKey,setCaptureKey]=useState(0);
  const [cards,setCards]=useState([]),[drivers,setDrivers]=useState([]),[form,setForm]=useState({driverProfileId:'',code:''}),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState('');
  const load=useCallback(async()=>{setLoading(true);setError('');try{const [cardResult,driverResult]=await Promise.all([request('/rfid'),request('/drivers')]);setCards(cardResult||[]);setDrivers(driverResult||[])}catch(loadError){setError(loadError.message)}finally{setLoading(false)}},[]);useEffect(()=>{load();const driver=new URLSearchParams(window.location.search).get('driver');if(driver)setForm(current=>({...current,driverProfileId:driver}))},[load]);
  async function create(event){event.preventDefault();setSaving(true);setError('');try{await request('/rfid',{method:'POST',body:JSON.stringify(form)});setForm({driverProfileId:'',code:''});setCaptureKey(current=>current+1);await load()}catch(saveError){setError(saveError.message)}finally{setSaving(false)}}
  if(loading)return <div className="admin-page"><LoadingState label="Carregando cartões RFID..."/></div>;
  return <div className="admin-page"><PageHeader eyebrow="CONTROLE DE ACESSO" title="Cartões RFID" description="Vincule identificadores físicos aos operadores autorizados."/>{error&&<ErrorState message={error} onRetry={load}/>}<section className="rfid-layout"><form className="surface-panel rfid-form" onSubmit={create}><div className="panel-header"><div><span className="eyebrow">NOVO CARTÃO</span><h2>Vincular RFID</h2></div><Radio size={20}/></div><label><span>OPERADOR</span><select required value={form.driverProfileId} onChange={event=>setForm({...form,driverProfileId:event.target.value})}><option value="">Selecione</option>{drivers.map(driver=><option value={driver.id} key={driver.id}>{driver.user.name}</option>)}</select></label><CardCapture key={captureKey} required value={form.code} onChange={code=>setForm(current=>({...current,code}))}/><button disabled={saving}><Link2 size={15}/>{saving?'VINCULANDO...':'VINCULAR CARTÃO'}</button></form><article className="surface-panel rfid-list"><div className="panel-header"><div><span className="eyebrow">CARTÕES CADASTRADOS</span><h2>{cards.length} identificadores</h2></div><Tags size={19}/></div>{cards.map(card=><div className="rfid-row" key={card.id}><span><Radio size={17}/></span><div><b>{card.code}</b><small>{card.driverProfile.user.name} · {card.driverProfile.user.email}</small></div><StatusBadge status={card.active?'ONLINE':'DISABLED'}/><button type="button" disabled={saving} onClick={async()=>{setSaving(true);try{await request('/rfid/'+card.id,{method:'PATCH',body:JSON.stringify({active:!card.active})});await load()}catch(err){setError(err.message)}finally{setSaving(false)}}}>{card.active?'Desativar':'Ativar'}</button></div>)}</article></section></div>
}
