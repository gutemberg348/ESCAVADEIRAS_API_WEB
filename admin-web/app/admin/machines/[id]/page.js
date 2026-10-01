"use client";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";
import {
  Activity,
  ArrowLeft,
  BatteryCharging,
  Clock3,
  Cpu,
  Gauge,
  MapPin,
  Radio,
  Satellite,
  ShieldCheck,
  Trash2,
  UserRound,
  Zap,
} from "lucide-react";
import {
  deleteMachine,
  machine as loadMachine,
} from "../../../../services/machine.service";
import StatusBadge from "../../../../components/StatusBadge";
import TelemetryCard from "../../../../components/TelemetryCard";
import MapCard from "../../../../components/MapCard";
import { session, SOCKET_URL } from "../../../../services/api";
import { PanelHeader } from "../../../../components/PageHeader";
import { ErrorState, LoadingState } from "../../../../components/States";
export default function MachineDetail({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const [item, setItem] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [live, setLive] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [canManage, setCanManage] = useState(false);
  useEffect(() => setCanManage(['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(session()?.user?.role)), []);
  async function remove() {
    if (!window.confirm(`Excluir ${item.code} da frota? O histórico será preservado, mas o ESP32 vinculado perderá o acesso.`)) return;
    setDeleting(true);
    setError("");
    try {
      await deleteMachine(id);
      router.replace("/admin/machines");
      router.refresh();
    } catch (deleteError) {
      setError(deleteError.message);
      setDeleting(false);
    }
  }
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItem(await loadMachine(id));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    const token = session()?.accessToken;
    if (!token || !item?.id) return;
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });
    socket.on("connect", () => {
      setLive(true);
      socket.emit("machine:join", id);
    });
    socket.on("disconnect", () => setLive(false));
    socket.on("machine:telemetry", (data) =>
      setItem((current) => ({
        ...current,
        status: "ONLINE",
        currentState: {
          ...current.currentState,
          ...data,
          updatedAt: data.timestamp,
        },
        telemetry: [
          { id: `live-${data.timestamp}`, ...data },
          ...(current.telemetry || []),
        ].slice(0, 30),
      })),
    );
    socket.on("machine:status", (data) =>
      setItem((current) => ({
        ...current,
        status: data.status,
        currentState: { ...current.currentState, ...data },
      })),
    );
    socket.on("assignment:changed", () => {
      loadMachine(id)
        .then(setItem)
        .catch((err) => setError(err.message));
    });
    socket.on("machine:rfid", (data) =>
      setItem((current) => ({
        ...current,
        currentState: {
          ...current.currentState,
          rfidStatus: data.status,
          rfidCode: data.code,
        },
      })),
    );
    return () => socket.close();
  }, [id, item?.id]);
  const trend = useMemo(
    () => item?.telemetry?.slice(0, 18).reverse() || [],
    [item?.telemetry],
  );
  if (loading)
    return (
      <div className="admin-page">
        <LoadingState label="Carregando cadastro, dispositivo e histórico de telemetria..." />
      </div>
    );
  if (error || !item)
    return (
      <div className="admin-page">
        <ErrorState
          message={error || "Máquina não encontrada"}
          onRetry={load}
        />
      </div>
    );
  const state = item.currentState || {};
  const latestReading = item.telemetry?.[0];
  return (
    <div className="admin-page">
      <Link className="back-link" href="/admin/machines">
        <ArrowLeft size={15} /> Voltar para escavadeiras
      </Link>
      <header className="machine-detail-header">
        <div className="detail-identity">
          <span className="detail-machine-mark">
            <Gauge size={25} />
          </span>
          <div>
            <span className="eyebrow">{item.company?.name || "EMPRESA"}</span>
            <h1>
              {item.name}
              <code>{item.code}</code>
            </h1>
            <p>
              {item.brand || "Fabricante não informado"} {item.model || ""} ·{" "}
              {item.year || "Ano não informado"} · ESP32{" "}
              {item.device?.deviceCode || "não vinculado"}
            </p>
          </div>
        </div>
        <div className="detail-status">
          <StatusBadge status={item.status} />
          <span className={`realtime-indicator ${live ? "connected" : ""}`}>
            <i />
            {live ? "CANAL AO VIVO" : "REST SINCRONIZADO"}
          </span>
        </div>
      </header>
      <section className="telemetry-grid">
        <TelemetryCard
          icon={BatteryCharging}
          label="Tensão"
          value={state.voltage}
          unit="V"
          detail="Circuito principal"
        />
        <TelemetryCard
          icon={Zap}
          label="Corrente"
          value={state.current}
          unit="A"
          detail={state.current == null ? "Sensor ainda não calibrado" : "Carga instantânea"}
        />
        <TelemetryCard
          icon={Gauge}
          label="Velocidade"
          value={state.speed}
          unit="km/h"
          detail="Deslocamento atual"
        />
        <TelemetryCard
          icon={Satellite}
          label="Satélites GPS"
          value={latestReading?.gpsSatellites}
          unit="sat"
          detail={state.gpsValid ? "Posição válida" : "Aguardando fix GPS"}
        />
      </section>
      <section className="machine-info-strip">
        <Info
          icon={Cpu}
          label="DISPOSITIVO"
          value={item.device?.deviceCode || "Não vinculado"}
        />
        <Info
          icon={Radio}
          label="FIRMWARE"
          value={item.device?.firmwareVersion || "—"}
        />
        <Info
          icon={UserRound}
          label="OPERADOR IDENTIFICADO"
          value={
            item.assignments?.[0]?.driverProfile?.user?.name || "Sem vínculo"
          }
        />
        <Info
          icon={Radio}
          label="CARTÃO RFID"
          value={`${state.rfidCode || "Sem leitura"} · ${{ AUTHORIZED: "Identificado", DENIED: "Não autorizado", AWAITING_CARD: "Aproxime o cartão", MANUAL_ASSIGNMENT: "Vínculo manual" }[state.rfidStatus] || "Aguardando"}`}
        />
        <Info
          icon={Clock3}
          label="ÚLTIMO CONTATO"
          value={timeAgo(state.updatedAt)}
        />
      </section>
      <section className="detail-main-grid">
        <article className="surface-panel">
          <PanelHeader
            eyebrow="POSIÇÃO MAIS RECENTE"
            title={coordinates(state.latitude, state.longitude)}
          />
          <MapCard focus={item} />
        </article>
        <article className="surface-panel trend-panel reading-summary-panel">
          <PanelHeader eyebrow="ÚLTIMA LEITURA" title="Resumo da máquina" />
          <div className="reading-summary-grid">
            <div><BatteryCharging size={17} /><span>Tensão</span><strong>{displayNumber(state.voltage, ' V')}</strong></div>
            <div><Zap size={17} /><span>Corrente</span><strong>{displayNumber(state.current, ' A')}</strong></div>
            <div><Gauge size={17} /><span>Velocidade</span><strong>{displayNumber(state.speed, ' km/h')}</strong></div>
            <div><Satellite size={17} /><span>Satélites</span><strong>{displayNumber(latestReading?.gpsSatellites)}</strong></div>
          </div>
          <div className="reading-summary-meta"><span><MapPin size={14}/>{state.gpsValid ? 'GPS com posição' : state.latitude != null ? 'Última posição conhecida' : 'Aguardando GPS'}</span><span><Clock3 size={14}/>{timeAgo(state.updatedAt)}</span></div>
          <div className="reading-chart-heading"><b>Tensão recente</b><Link href="/admin/telemetry">Ver histórico completo →</Link></div>
          <div className="desktop-chart">
            {trend.filter(reading => reading.voltage != null).length > 1 ? (
              trend.filter(reading => reading.voltage != null).map((reading, index) => (
                <div
                  key={reading.id || index}
                  style={{ height: `${barHeight(reading.voltage, trend)}%` }}
                  title={`${reading.voltage ?? "—"} V`}
                >
                  <span />
                </div>
              ))
            ) : (
              <p>{trend.some(reading => reading.voltage != null) ? `Primeira leitura: ${displayNumber(latestReading?.voltage, ' V')}` : 'Sem leituras de tensão no período'}</p>
            )}
          </div>
          <div className="chart-axis">
            <span>MAIS ANTIGO</span>
            <span>AGORA</span>
          </div>
        </article>
      </section>
      <section className="detail-lower-grid">
        <article className="surface-panel">
          <PanelHeader
            eyebrow="EVENTOS DO DISPOSITIVO"
            title="Timeline operacional"
          />
          {item.telemetry?.length ? (
            <div className="event-timeline">
              {item.telemetry.slice(0, 7).map((reading, index) => (
                <div key={reading.id}>
                  <span className="event-dot">
                    <Activity size={13} />
                  </span>
                  <div>
                    <b>
                      {index === 0
                        ? "Telemetria recebida"
                        : "Leitura registrada"}
                    </b>
                    <p>
                      {reading.speed ?? 0} km/h · {reading.voltage ?? "—"} V ·{" "}
                      {reading.current ?? "—"} A
                    </p>
                  </div>
                  <time>{formatTime(reading.timestamp)}</time>
                </div>
              ))}
            </div>
          ) : (
            <p className="panel-empty">Nenhuma telemetria registrada.</p>
          )}
        </article>
        <article className="surface-panel">
          <PanelHeader eyebrow="SEGURANÇA" title="Alertas e comandos" />
          <div className="operational-counters">
            <div>
              <span className="counter-icon warning">
                <ShieldCheck size={18} />
              </span>
              <p>
                <b>{item.alerts?.length || 0}</b>
                <small>alertas recentes</small>
              </p>
            </div>
            <div>
              <span className="counter-icon">
                <Cpu size={18} />
              </span>
              <p>
                <b>{item.commands?.length || 0}</b>
                <small>comandos enviados</small>
              </p>
            </div>
            <div>
              <span className="counter-icon success">
                <Satellite size={18} />
              </span>
              <p>
                <b>
                  {state.gpsValid
                    ? "Fix válido"
                    : state.latitude != null
                      ? "Última posição"
                      : "Sem fix"}
                </b>
                <small>posicionamento GPS</small>
              </p>
            </div>
          </div>
          {item.alerts?.slice(0, 3).map((alert) => (
            <div className="detail-alert" key={alert.id}>
              <span />
              <p>
                <b>{alert.type.replaceAll("_", " ")}</b>
                {alert.message}
              </p>
              <time>{formatTime(alert.createdAt)}</time>
            </div>
          ))}
        </article>
      </section>
        {canManage && <section className="surface-panel machine-danger-zone">
          <div><h2>Excluir escavadeira</h2><p>A escavadeira sairá da frota. O ESP32 vinculado perderá acesso e o histórico permanecerá salvo.</p></div>
        <button className="danger-action" type="button" disabled={deleting} onClick={remove}><Trash2 size={16}/>{deleting ? "Excluindo..." : "Excluir escavadeira"}</button>
      </section>}
    </div>
  );
}
function Info({ icon: Icon, label, value }) {
  return (
    <div>
      <span>
        <Icon size={17} />
      </span>
      <p>
        <small>{label}</small>
        <b>{value}</b>
      </p>
    </div>
  );
}
function timeAgo(value) {
  if (!value) return "Sem contato";
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 60000),
  );
  if (minutes < 1) return "Agora";
  if (minutes < 60) return `Há ${minutes} min`;
  return `Há ${Math.floor(minutes / 60)}h`;
}
function formatTime(value) {
  return value
    ? new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "—";
}
function coordinates(lat, lng) {
  return lat != null && lng != null
    ? `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`
    : "Posição ainda não recebida";
}
function displayNumber(value, unit = '') {
  return value == null || !Number.isFinite(Number(value)) ? '—' : `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}${unit}`;
}
function barHeight(value, values) {
  const numeric = values
    .filter((item) => item.voltage != null)
    .map((item) => Number(item.voltage))
    .filter(Number.isFinite);
  if (!numeric.length) return 5;
  const min = Math.min(...numeric),
    max = Math.max(...numeric),
    range = Math.max(max - min, 0.5);
  return 20 + ((Number(value) - min) / range) * 80;
}
