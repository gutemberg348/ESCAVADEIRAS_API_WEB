'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { io } from 'socket.io-client';
import { BatteryCharging, Clock3, Crosshair, Gauge, MapPin, Navigation, RefreshCw, Search, Truck } from 'lucide-react';
import { fleetMachines } from '../../../services/machine.service';
import { session, SOCKET_URL } from '../../../services/api';
import MapCard from '../../../components/MapCard';
import StatusBadge from '../../../components/StatusBadge';
import PageHeader from '../../../components/PageHeader';
import { ErrorState, LoadingState } from '../../../components/States';

const hasPosition = machine => {
  const { latitude, longitude } = machine.currentState || {};
  return latitude != null && longitude != null && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude)) && Math.abs(Number(latitude)) <= 90 && Math.abs(Number(longitude)) <= 180;
};
const value = (number, unit = '') => number == null || !Number.isFinite(Number(number)) ? '—' : `${Number(number).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}${unit}`;
const time = date => date ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(date)) : 'Nunca recebido';

export default function FleetMap() {
  const [fleet, setFleet] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async (initial = false) => {
    if (initial) setLoading(true); else setRefreshing(true);
    setError('');
    try { setFleet(await fleetMachines()); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { refresh(true); const timer = setInterval(() => refresh(), 30000); return () => clearInterval(timer); }, [refresh]);
  useEffect(() => {
    const token = session()?.accessToken;
    if (!token || !fleet.length) return undefined;
    const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'] });
    socket.on('connect', () => { setLive(true); fleet.forEach(machine => socket.emit('machine:join', machine.id)); refresh(); });
    socket.on('disconnect', () => setLive(false));
    socket.on('assignment:changed', () => refresh());
    socket.on('machine:telemetry', data => setFleet(current => current.map(machine => machine.id === data.machineId ? { ...machine, status: 'ONLINE', currentState: { ...machine.currentState, ...data, updatedAt: data.timestamp } } : machine)));
    socket.on('machine:status', data => setFleet(current => current.map(machine => machine.id === data.machineId ? { ...machine, status: data.status, currentState: { ...machine.currentState, ...data } } : machine)));
    return () => { setLive(false); socket.close(); };
  }, [fleet.map(machine => machine.id).join(','), refresh]);

  const visible = useMemo(() => fleet.filter(machine => {
    const text = `${machine.code} ${machine.name} ${machine.company?.name || ''}`.toLowerCase();
    return text.includes(search.trim().toLowerCase()) && (filter === 'ALL' || (filter === 'GPS' ? hasPosition(machine) : machine.status === filter));
  }), [fleet, filter, search]);
  const selected = fleet.find(machine => machine.id === selectedId);
  const positions = fleet.filter(hasPosition).length;

  if (loading) return <div className="admin-page"><LoadingState label="Carregando posições da frota..." /></div>;
  return <div className="admin-page fleet-map-page">
    <PageHeader eyebrow="GEOLOCALIZAÇÃO" title="Mapa da frota" description={`Última posição informada pelo GPS das máquinas · ${live ? 'canal ao vivo conectado' : 'atualização periódica'}.`} />
    {error && <ErrorState message={error} onRetry={() => refresh()} />}
    <section className="fleet-map-summary" aria-label="Resumo da frota">
      <Summary icon={Truck} label="Máquinas" value={fleet.length} />
      <Summary icon={MapPin} label="Com posição" value={positions} />
      <Summary icon={Crosshair} label="Sem posição" value={fleet.length - positions} />
      <Summary icon={Navigation} label="Online" value={fleet.filter(machine => machine.status === 'ONLINE').length} />
    </section>
    <div className="fleet-map-toolbar surface-panel">
      <label className="fleet-map-search"><Search size={17} /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar máquina, código ou empresa" aria-label="Buscar na frota" /></label>
      <div className="fleet-map-filters" role="group" aria-label="Filtrar máquinas">{[['ALL', 'Todas'], ['ONLINE', 'Online'], ['OFFLINE', 'Offline'], ['GPS', 'Com GPS']].map(([key, label]) => <button type="button" key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{label}</button>)}</div>
      <button type="button" className="fleet-map-refresh" onClick={() => refresh()} disabled={refreshing}><RefreshCw size={16} className={refreshing ? 'spin' : ''} /> Atualizar</button>
    </div>
    <section className="map-layout">
      <article className="surface-panel full-map"><MapCard machines={visible} selectedId={selectedId} onSelect={setSelectedId} /></article>
      <aside className="surface-panel map-assets">
        <div className="panel-header"><div><span className="eyebrow">ATIVOS FILTRADOS</span><h2>{visible.length} {visible.length === 1 ? 'escavadeira' : 'escavadeiras'}</h2></div><Crosshair size={18} /></div>
        {selected && visible.some(machine => machine.id === selectedId) && <div className="fleet-map-selection"><div><strong>{selected.code}</strong><StatusBadge status={selected.status} /></div><p>{selected.name} · {selected.company?.name || 'Empresa não informada'}</p><div><span><BatteryCharging size={15} /> {value(selected.currentState?.voltage, ' V')}</span><span><Gauge size={15} /> {value(selected.currentState?.speed, ' km/h')}</span></div><small><Clock3 size={14} /> GPS: {time(selected.currentState?.gpsUpdatedAt)}</small><Link href={`/admin/machines/${selected.id}`}>Ver detalhes da máquina →</Link></div>}
        <div className="fleet-map-list">{visible.map(machine => <button type="button" className={`map-asset ${selectedId === machine.id ? 'selected' : ''}`} key={machine.id} onClick={() => setSelectedId(machine.id)}>
          <span className="map-asset-icon"><Navigation size={17} /></span>
          <span className="map-asset-copy"><b>{machine.code}</b><small>{machine.name}</small><small>{hasPosition(machine) ? `GPS ${time(machine.currentState?.gpsUpdatedAt)}` : 'GPS ainda sem posição'}</small></span>
          <StatusBadge status={machine.status} />
          <span className="map-asset-measures"><span><BatteryCharging size={13} /> {value(machine.currentState?.voltage, ' V')}</span><span><Gauge size={13} /> {value(machine.currentState?.speed, ' km/h')}</span></span>
        </button>)}{!visible.length && <p className="panel-empty">Nenhuma máquina corresponde a este filtro.</p>}</div>
      </aside>
    </section>
  </div>;
}

function Summary({ icon: Icon, label, value }) {
  return <div className="surface-panel"><Icon size={20} /><span>{label}</span><strong>{value}</strong></div>;
}
