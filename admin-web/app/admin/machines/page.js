"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BatteryCharging,
  ChevronDown,
  MapPin,
  Plus,
  Search,
  Signal,
  Trash2,
  Truck,
} from "lucide-react";
import { deleteMachine, fleetMachines } from "../../../services/machine.service";
import StatusBadge from "../../../components/StatusBadge";
import PageHeader from "../../../components/PageHeader";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../../components/States";
export default function Machines() {
  const [list, setList] = useState([]),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("ALL"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setList(await fleetMachines());
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  async function remove(machine) {
    if (!window.confirm(`Excluir ${machine.code} da frota? O histórico será mantido. Se houver ESP32 vinculado, ele também perderá o acesso e poderá ser substituído.`)) return;
    setDeletingId(machine.id);
    setError("");
    try {
      await deleteMachine(machine.id);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }
  const filtered = useMemo(
    () =>
      list.filter((machine) => {
        const matchesText =
          `${machine.code} ${machine.name} ${machine.company?.name || ""}`
            .toLowerCase()
            .includes(search.toLowerCase());
        return matchesText && (status === "ALL" || machine.status === status);
      }),
    [list, search, status],
  );
  if (loading)
    return (
      <div className="admin-page">
        <LoadingState label="Consultando ativos e estados atuais..." />
      </div>
    );
  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="GESTÃO DE ATIVOS"
        title="Escavadeiras"
        description="Inventário, conectividade e telemetria atual de todos os equipamentos permitidos."
        action="Nova escavadeira"
        icon={Plus}
      />
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <>
          <section className="fleet-summary">
            <div>
              <Truck size={18} />
              <span>
                <b>{list.length}</b> equipamentos
              </span>
            </div>
            <div>
              <span className="summary-dot online" />
              <span>
                <b>{list.filter((item) => item.status === "ONLINE").length}</b>{" "}
                online
              </span>
            </div>
            <div>
              <span className="summary-dot alert" />
              <span>
                <b>{list.filter((item) => item.status === "ALERT").length}</b>{" "}
                alertas
              </span>
            </div>
          </section>
          <section className="filter-toolbar">
            <div className="search-field">
              <Search size={16} />
              <input
                placeholder="Buscar código, nome ou empresa..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="status-filters">
              {[
                ["ALL", "Todos"],
                ["ONLINE", "Online"],
                ["OFFLINE", "Offline"],
                ["ALERT", "Alertas"],
                ["MAINTENANCE", "Manutenção"],
              ].map(([value, label]) => (
                <button
                  className={status === value ? "active" : ""}
                  onClick={() => setStatus(value)}
                  key={value}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>
          {filtered.length ? (
            <section className="surface-panel table-panel">
              <div className="responsive-table">
                <table>
                  <thead>
                    <tr>
                      <th>ESCAVADEIRA</th>
                      <th>EMPRESA</th>
                      <th>MOTORISTA ATUAL</th>
                      <th>STATUS</th>
                      <th>ÚLTIMO CONTATO</th>
                      <th>TENSÃO</th>
                      <th>SINAL</th>
                      <th>LOCALIZAÇÃO</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((machine) => (
                      <tr key={machine.id}>
                        <td>
                          <div className="asset-cell">
                            <span>
                              <Truck size={18} />
                            </span>
                            <div>
                              <b>{machine.code}</b>
                              <small>{machine.name}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="company-cell">
                            <b>{machine.company?.name || "—"}</b>
                            <small>
                              {machine.brand || "Fabricante não informado"}{" "}
                              {machine.model || ""}
                            </small>
                          </div>
                        </td>
                        <td>
                          {machine.assignments?.[0]?.driverProfile?.user
                            ?.name || (
                            <span className="muted-value">Sem vínculo</span>
                          )}
                        </td>
                        <td>
                          <StatusBadge status={machine.status} />
                        </td>
                        <td>
                          <b className="reading-primary">
                            {timeAgo(machine.currentState?.updatedAt)}
                          </b>
                          <small className="reading-secondary">
                            {formatDate(machine.currentState?.updatedAt)}
                          </small>
                        </td>
                        <td>
                          <span className="sensor-value">
                            <BatteryCharging size={14} />
                            {machine.currentState?.voltage != null
                              ? `${machine.currentState.voltage} V`
                              : "—"}
                          </span>
                        </td>
                        <td>
                          <span className="sensor-value">
                            <Signal size={14} />
                            {machine.currentState?.signalStrength != null
                              ? `${machine.currentState.signalStrength} dBm`
                              : "—"}
                          </span>
                        </td>
                        <td>
                          <span className="sensor-value">
                            <MapPin size={14} />
                            {machine.currentState?.latitude != null
                              ? "Posição recebida"
                              : "Sem GPS"}
                          </span>
                        </td>
                        <td>
                          <div className="machine-list-actions"><Link
                            className="row-action"
                            href={`/admin/machines/${machine.id}`}
                          >
                            Abrir <ChevronDown size={14} />
                          </Link><button type="button" title={`Excluir ${machine.code}`} disabled={deletingId === machine.id} onClick={() => remove(machine)}><Trash2 size={14} /> Excluir</button></div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <EmptyState
              title="Nenhuma escavadeira encontrada"
              description="Ajuste os filtros ou cadastre um novo equipamento."
            />
          )}
        </>
      )}
    </div>
  );
}
function formatDate(value) {
  return value
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "—";
}
function timeAgo(value) {
  if (!value) return "Sem contato";
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return "Agora";
  if (minutes < 60) return `Há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `Há ${hours}h` : `Há ${Math.floor(hours / 24)}d`;
}
