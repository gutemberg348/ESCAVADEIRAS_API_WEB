'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, AlertTriangle, BatteryCharging, Clock3, Gauge, MapPinned, Radio, Truck, UsersRound, Wifi, WifiOff } from 'lucide-react';
import { alerts as loadAlerts, fleetMachines } from '../../services/machine.service';
import StatusBadge from '../../components/StatusBadge';
import MapCard from '../../components/MapCard';
import PageHeader, { PanelHeader } from '../../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';

const metricConfig = [
  ['Total da frota', Truck, 'neutral'],
  ['Máquinas online', Wifi, 'success'],
  ['Máquinas offline', WifiOff, 'muted'],
  ['Em alerta', AlertTriangle, 'warning'],
];

function average(values) {
  const valid = values.filter(value => value != null).map(Number).filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function formatTime(value) {
  return value ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : 'Sem contato';
}

export default function Dashboard() {
  const [fleet, setFleet] = useState([]);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    setError('');
    try {
      const [machines, alerts] = await Promise.all([fleetMachines(), loadAlerts()]);
      setFleet(machines);
      setRecentAlerts(alerts || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(true); const timer = setInterval(() => load(), 15000); return () => clearInterval(timer); }, [load]);

  const counts = useMemo(() => [
    fleet.length,
    fleet.filter(machine => machine.status === 'ONLINE').length,
    fleet.filter(machine => machine.status === 'OFFLINE').length,
    fleet.filter(machine => machine.status === 'ALERT').length,
  ], [fleet]);
  const onlineRate = fleet.length ? Math.round(counts[1] / fleet.length * 100) : 0;
  const linkedDrivers = fleet.filter(machine => machine.assignments?.length).length;
  const gpsCount = fleet.filter(machine => machine.currentState?.latitude != null && machine.currentState?.longitude != null).length;
  const recentlyUpdated = fleet.filter(machine => {
    const timestamp = machine.currentState?.gatewaySampleAt || machine.currentState?.updatedAt;
    return timestamp && Date.now() - new Date(timestamp).getTime() < 5 * 60 * 1000;
  }).length;
  const avgVoltage = average(fleet.map(machine => machine.currentState?.voltage));

  if (loading) return <div className="admin-page"><LoadingState label="Consultando frota, telemetria e alertas..." /></div>;
  if (error && !fleet.length) return <div className="admin-page"><ErrorState message={error} onRetry={() => load(true)} /></div>;

  return <div className="admin-page">
    <PageHeader eyebrow="VISÃO EXECUTIVA" title="Pulso da operação" description="Estado consolidado da frota com dados recebidos do servidor." action="Explorar frota" href="/admin/machines" icon={Gauge} />
    {error && <ErrorState message={error} onRetry={() => load()} />}
    <section className="kpi-grid">{metricConfig.map(([label, Icon, tone], index) => <article className={`kpi-card ${tone}`} key={label}><div className="kpi-icon"><Icon size={19} /></div><span>{label.toUpperCase()}</span><strong>{counts[index]}</strong><small>{['Ativos cadastrados', 'Conectadas ao servidor', 'Sem contato recente', 'Requer atenção'][index]}</small></article>)}</section>
    <section className="dashboard-main-grid">
      <article className="surface-panel map-panel"><PanelHeader eyebrow="LOCALIZAÇÃO" title="Últimas posições GPS" action="Abrir mapa" href="/admin/map" /><MapCard machines={fleet} /></article>
      <article className="surface-panel availability-panel"><PanelHeader eyebrow="DISPONIBILIDADE" title="Saúde da frota" /><div className="availability-ring" style={{ '--availability': `${onlineRate * 3.6}deg` }}><div><strong>{onlineRate}%</strong><span>online</span></div></div><div className="availability-legend">{['ONLINE', 'OFFLINE', 'ALERT', 'MAINTENANCE'].map(status => <div key={status}><StatusBadge status={status} /><b>{fleet.filter(machine => machine.status === status).length}</b></div>)}</div></article>
    </section>
    <section className="operations-strip">
      <div><span className="strip-icon"><UsersRound size={18} /></span><p><small>MÁQUINAS COM MOTORISTA VINCULADO</small><strong>{linkedDrivers}</strong></p></div>
      <div><span className="strip-icon"><BatteryCharging size={18} /></span><p><small>TENSÃO MÉDIA DA ÚLTIMA LEITURA</small><strong>{avgVoltage != null ? `${avgVoltage.toFixed(1)} V` : '—'}</strong></p></div>
      <div><span className="strip-icon"><MapPinned size={18} /></span><p><small>COM POSIÇÃO GPS</small><strong>{gpsCount} de {fleet.length}</strong></p></div>
      <div><span className="strip-icon"><Radio size={18} /></span><p><small>ATUALIZADAS NOS ÚLTIMOS 5 MIN</small><strong>{recentlyUpdated} máquinas</strong></p></div>
    </section>
    <section className="dashboard-lower-grid">
      <article className="surface-panel"><PanelHeader eyebrow="MONITORAMENTO" title="Ativos recentes" action="Ver frota" href="/admin/machines" />{fleet.length ? <div className="machine-list">{fleet.slice(0, 5).map(machine => <Link href={`/admin/machines/${machine.id}`} key={machine.id}><span className="machine-list-icon"><Truck size={17} /></span><div><b>{machine.code}</b><small>{machine.name}</small></div><StatusBadge status={machine.status} /><div className="machine-reading"><strong>{machine.currentState?.voltage != null ? `${machine.currentState.voltage} V` : '—'}</strong><small>{formatTime(machine.currentState?.updatedAt)}</small></div></Link>)}</div> : <EmptyState title="Frota vazia" description="Cadastre uma escavadeira para iniciar o monitoramento." />}</article>
      <article className="surface-panel"><PanelHeader eyebrow="PRIORIDADE" title="Ocorrências recentes" action="Ver alertas" href="/admin/alerts" />{recentAlerts.length ? <div className="dashboard-alerts">{recentAlerts.slice(0, 5).map(alert => <div key={alert.id}><span className={`alert-symbol ${alert.severity?.toLowerCase()}`}><AlertTriangle size={17} /></span><p><b>{alert.machine?.code}</b><span>{alert.message}</span><small>{formatTime(alert.createdAt)}</small></p></div>)}</div> : <div className="all-clear"><span><Activity size={21} /></span><div><strong>Nenhum alerta registrado</strong><p>A frota não tem ocorrências recentes no servidor.</p></div></div>}</article>
    </section>
  </div>;
}
