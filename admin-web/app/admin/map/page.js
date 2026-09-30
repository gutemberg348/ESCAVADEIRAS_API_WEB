'use client';

import { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { Crosshair, Gauge, Navigation, Signal } from 'lucide-react';
import { machines as loadMachines } from '../../../services/machine.service';
import { session, SOCKET_URL } from '../../../services/api';
import MapCard from '../../../components/MapCard';
import StatusBadge from '../../../components/StatusBadge';
import PageHeader from '../../../components/PageHeader';
import { ErrorState, LoadingState } from '../../../components/States';

export default function FleetMap() {
  const [fleet, setFleet] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setFleet((await loadMachines()).data || []); }
    catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const token = session()?.accessToken;
    if (!token || !fleet.length) return undefined;
    const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'] });
    socket.on('connect', () => { setLive(true); fleet.forEach((machine) => socket.emit('machine:join', machine.id)); });
    socket.on('disconnect', () => setLive(false));
    socket.on('assignment:changed', () => { loadMachines().then(result => setFleet(result.data || [])).catch(err => setError(err.message)); });
    socket.on('machine:telemetry', (data) => setFleet((current) => current.map((machine) => machine.id === data.machineId ? { ...machine, status: 'ONLINE', currentState: { ...machine.currentState, ...data, updatedAt: data.timestamp } } : machine)));
    socket.on('machine:status', (data) => setFleet((current) => current.map((machine) => machine.id === data.machineId ? { ...machine, status: data.status, currentState: { ...machine.currentState, ...data } } : machine)));
    return () => socket.close();
  }, [fleet.map((machine) => machine.id).join(',')]);

  if (loading) return <div className="admin-page"><LoadingState label="Carregando últimas posições GPS..." /></div>;
  return (
    <div className="admin-page">
      <PageHeader eyebrow="GEOLOCALIZAÇÃO" title="Mapa da frota" description={`Posições reais recebidas dos dispositivos · ${live ? 'canal ao vivo conectado' : 'sincronização REST'}.`} />
      {error ? <ErrorState message={error} onRetry={load} /> : (
        <section className="map-layout">
          <article className="surface-panel full-map"><MapCard machines={fleet} /></article>
          <aside className="surface-panel map-assets">
            <div className="panel-header"><div><span className="eyebrow">ATIVOS NO MAPA</span><h2>{fleet.length} escavadeiras</h2></div><Crosshair size={18} /></div>
            {fleet.map((machine) => (
              <div className="map-asset" key={machine.id}>
                <span className="map-asset-icon"><Navigation size={17} /></span>
                <div><b>{machine.code}</b><small>{machine.assignments?.[0]?.driverProfile?.user?.name || 'Aguardando cartão'}</small><small>{machine.currentState?.latitude != null ? `${Number(machine.currentState.latitude).toFixed(5)}, ${Number(machine.currentState.longitude).toFixed(5)}` : 'Sem posição'}</small></div>
                <StatusBadge status={machine.status} />
                <p><span><Gauge size={12} />{machine.currentState?.speed ?? '—'} km/h</span><span><Signal size={12} />{machine.currentState?.signalStrength ?? '—'} dBm</span></p>
              </div>
            ))}
          </aside>
        </section>
      )}
    </div>
  );
}
