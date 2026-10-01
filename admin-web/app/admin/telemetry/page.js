'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BatteryCharging, Clock3, Gauge, MapPin, RefreshCw, Zap } from 'lucide-react';
import PageHeader from '../../../components/PageHeader';
import StatusBadge from '../../../components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '../../../components/States';
import { fleetMachines, telemetryHistory } from '../../../services/machine.service';

const metrics = {
  voltage: { label: 'Tensão', unit: 'V', icon: BatteryCharging, digits: 1 },
  current: { label: 'Corrente', unit: 'A', icon: Zap, digits: 1 },
  speed: { label: 'Velocidade', unit: 'km/h', icon: Gauge, digits: 1 },
};

function number(value, digits = 1) {
  return value == null || !Number.isFinite(Number(value))
    ? '—'
    : Number(value).toLocaleString('pt-BR', { maximumFractionDigits: digits });
}

function date(value) {
  return value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—';
}

function readingValue(reading, key) {
  return reading?.[key] == null || !Number.isFinite(Number(reading[key])) ? null : Number(reading[key]);
}
const withUnit = (value, unit) => value == null ? '—' : `${number(value)} ${unit}`;

export default function TelemetryPage() {
  const [fleet, setFleet] = useState([]);
  const [machineId, setMachineId] = useState('');
  const [readings, setReadings] = useState([]);
  const [metric, setMetric] = useState('voltage');
  const [loadingFleet, setLoadingFleet] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);

  const loadFleet = useCallback(async () => {
    setError('');
    try {
      const machines = await fleetMachines();
      setFleet(machines);
      setMachineId(current => machines.some(item => item.id === current) ? current : machines[0]?.id || '');
    } catch (err) { setError(err.message); }
    finally { setLoadingFleet(false); }
  }, []);

  useEffect(() => { loadFleet(); }, [loadFleet]);

  const loadHistory = useCallback(async () => {
    if (!machineId) { setReadings([]); return; }
    setLoadingHistory(true);
    setError('');
    try {
      setReadings(await telemetryHistory(machineId, 100));
      setUpdatedAt(new Date());
    } catch (err) { setError(err.message); }
    finally { setLoadingHistory(false); }
  }, [machineId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const selected = fleet.find(item => item.id === machineId);
  const config = metrics[metric];
  const chart = useMemo(() => readings.slice(0, 48).reverse(), [readings]);
  const values = chart.map(item => readingValue(item, metric)).filter(value => value != null);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const span = Math.max(max - min, 0.5);
  const latest = readings[0];
  const hasGps = latest?.latitude != null && latest?.longitude != null;

  if (loadingFleet) return <div className="admin-page"><LoadingState label="Consultando máquinas e leituras reais..." /></div>;
  return (
    <div className="admin-page telemetry-page">
      <PageHeader eyebrow="HISTÓRICO REAL" title="Telemetria" description="Leituras enviadas pelo ESP32 ao celular e salvas no servidor. Valores indisponíveis aparecem como travessão." />
      {error && <ErrorState message={error} onRetry={fleet.length ? loadHistory : loadFleet} />}
      {!fleet.length ? <EmptyState title="Nenhuma escavadeira cadastrada" description="Cadastre uma máquina e vincule um dispositivo para começar a receber telemetria." /> : <>
        <div className="telemetry-toolbar surface-panel">
          <label><span>ESCAVADEIRA</span><select value={machineId} onChange={event => setMachineId(event.target.value)}>{fleet.map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
          <div className="telemetry-toolbar-status"><StatusBadge status={selected?.status} /><span>{readings.length} leituras recentes</span></div>
          <button type="button" onClick={loadHistory} disabled={loadingHistory}><RefreshCw size={16} className={loadingHistory ? 'spin' : ''} /> Atualizar</button>
        </div>
        {!readings.length ? <EmptyState title="Ainda sem histórico" description="Conecte o ESP32 pelo aplicativo, mantenha o celular com internet e aguarde o envio das primeiras leituras." /> : <>
          <section className="telemetry-overview" aria-label="Última leitura">
            <Summary icon={BatteryCharging} label="Tensão" value={number(latest.voltage)} unit="V" />
            <Summary icon={Zap} label="Corrente" value={number(latest.current)} unit="A" note={latest.current == null ? 'Sensor sem calibração' : null} />
            <Summary icon={Gauge} label="Velocidade" value={number(latest.speed)} unit="km/h" />
            <Summary icon={MapPin} label="GPS" value={hasGps ? 'Com posição' : 'Sem fix'} note={hasGps ? `${number(latest.latitude, 5)}, ${number(latest.longitude, 5)}` : 'Aguardando satélites'} />
          </section>
          <section className="surface-panel telemetry-history-panel">
            <div className="telemetry-history-heading"><div><span className="eyebrow">ÚLTIMAS {chart.length} LEITURAS</span><h2>Histórico de {config.label.toLowerCase()}</h2><p>Mais antigo à esquerda · leitura mais recente à direita</p></div><div className="telemetry-metric-tabs" role="group" aria-label="Grandeza do gráfico">{Object.entries(metrics).map(([key, item]) => <button key={key} type="button" className={metric === key ? 'active' : ''} onClick={() => setMetric(key)}>{item.label}</button>)}</div></div>
            {values.length === 1 ? <div className="telemetry-first-reading"><span>Primeira leitura registrada</span><strong>{number(values[0])} {config.unit}</strong><span>{date(chart.find(item => readingValue(item, metric) != null)?.timestamp)}</span></div> : values.length ? <><div className="telemetry-chart" role="img" aria-label={`Histórico de ${config.label}: mínimo ${number(min)} e máximo ${number(max)} ${config.unit}`}>
              {chart.map((reading, index) => {
                const value = readingValue(reading, metric);
                return <div key={reading.id || index} className={`telemetry-chart-column ${value == null ? 'missing' : ''}`} title={`${date(reading.timestamp)} · ${value == null ? 'sem leitura' : `${number(value)} ${config.unit}`}`}><span style={{ height: value == null ? '3px' : `${Math.max(10, 20 + (value - min) / span * 80)}%` }} /></div>;
              })}
            </div><div className="telemetry-chart-scale"><span>{date(chart[0]?.timestamp)}</span><strong>{number(min)}–{number(max)} {config.unit}</strong><span>{date(chart.at(-1)?.timestamp)}</span></div></> : <p className="telemetry-no-metric">Nenhuma leitura de {config.label.toLowerCase()} neste período.</p>}
          </section>
          <section className="surface-panel telemetry-readings"><div className="telemetry-history-heading"><div><span className="eyebrow">REGISTROS DO SERVIDOR</span><h2>Leituras recentes</h2><p><Clock3 size={13} /> Atualizado {updatedAt ? date(updatedAt) : '—'}</p></div><Link href={`/admin/machines/${machineId}`}>Abrir máquina</Link></div><div className="responsive-table"><table><thead><tr><th>DATA E HORA</th><th>TENSÃO</th><th>CORRENTE</th><th>VELOCIDADE</th><th>GPS</th></tr></thead><tbody>{readings.slice(0, 30).map((reading, index) => <tr key={reading.id || index}><td>{date(reading.timestamp)}</td><td>{withUnit(reading.voltage, 'V')}</td><td>{reading.current == null ? 'Não calibrada' : withUnit(reading.current, 'A')}</td><td>{withUnit(reading.speed, 'km/h')}</td><td>{reading.latitude == null ? 'Sem fix' : `${number(reading.latitude, 5)}, ${number(reading.longitude, 5)}`}</td></tr>)}</tbody></table></div></section>
        </>}
      </>}
    </div>
  );
}

function Summary({ icon: Icon, label, value, unit, note }) {
  return <article className="surface-panel telemetry-summary-card"><span><Icon size={20} /></span><small>{label}</small><strong>{value}<em>{value !== '—' && unit ? ` ${unit}` : ''}</em></strong>{note && <p>{note}</p>}</article>;
}
