'use client';
import Link from 'next/link';
import DriverCreateForm from '../../../components/DriverCreateForm';
import { useCallback, useEffect, useState } from 'react';
import { ContactRound, Link2, Radio, Truck } from 'lucide-react';
import PageHeader from '../../../components/PageHeader';
import StatusBadge from '../../../components/StatusBadge';
import { ErrorState, LoadingState } from '../../../components/States';
import { request } from '../../../services/api';
import { machines as loadMachines } from '../../../services/machine.service';

export default function DriversPage(){
  const [creating,setCreating]=useState(false);
  const [drivers,setDrivers]=useState([]),[machines,setMachines]=useState([]),[selected,setSelected]=useState({}),[loading,setLoading]=useState(true),[saving,setSaving]=useState(''),[error,setError]=useState('');
  const load=useCallback(async()=>{setLoading(true);setError('');try{const [driverResult,machineResult]=await Promise.all([request('/drivers'),loadMachines()]);setDrivers(driverResult||[]);setMachines(machineResult.data||[]);setSelected(Object.fromEntries((driverResult||[]).map(driver=>[driver.id,driver.assignments?.[0]?.machineId||''])));}catch(loadError){setError(loadError.message)}finally{setLoading(false)}},[]);
  useEffect(()=>{load()},[load]);
  useEffect(()=>{const timer=setInterval(async()=>{try{setDrivers(await request('/drivers'))}catch{}},5000);return()=>clearInterval(timer)},[]);
  async function link(profileId){const machineId=selected[profileId];if(!machineId)return;setSaving(profileId);setError('');try{await request(`/drivers/${profileId}/assignments`,{method:'POST',body:JSON.stringify({machineId})});await load()}catch(saveError){setError(saveError.message)}finally{setSaving('')}}
  if(loading)return <div className="admin-page"><LoadingState label="Carregando operadores e vínculos..."/></div>;
  return <div className="admin-page"><PageHeader eyebrow="EQUIPE DE CAMPO" title="Operadores" description="Cadastre motoristas e cartões. A leitura na máquina identifica o operador atual."/><button className="primary-action" onClick={()=>setCreating(true)}>Cadastrar motorista</button>{creating&&<DriverCreateForm onCreated={()=>{setCreating(false);load()}} onCancel={()=>setCreating(false)}/>}{error&&<ErrorState message={error} onRetry={load}/>}<section className="driver-grid">{drivers.map(driver=>{const assignment=driver.assignments?.[0];return <article className="surface-panel driver-card" key={driver.id}><div className="driver-card-head"><span><ContactRound size={22}/></span><StatusBadge status={driver.user.active?'ONLINE':'DISABLED'}/></div><h2>{driver.user.name}</h2><p>{driver.user.email}</p><div className="driver-current"><Truck size={16}/><div><small>VÍNCULO ATUAL</small><b>{assignment?`${assignment.machine.code} · ${assignment.machine.name}`:'Nenhuma máquina'}</b></div></div><label><span>ALTERAR ESCAVADEIRA</span><select value={selected[driver.id]||''} onChange={event=>setSelected({...selected,[driver.id]:event.target.value})}><option value="">Selecione</option>{machines.map(machine=><option key={machine.id} value={machine.id}>{machine.code} · {machine.name}</option>)}</select></label><button onClick={()=>link(driver.id)} disabled={saving===driver.id||!selected[driver.id]}><Link2 size={15}/>{saving===driver.id?'VINCULANDO...':'CONFIRMAR VÍNCULO'}</button><Link href={`/admin/rfid?driver=${driver.id}`}>Ler ou vincular cartão</Link><footer><Radio size={13}/>{driver.rfidCards?.length||0} cartão(ões) RFID</footer></article>})}</section></div>
}
