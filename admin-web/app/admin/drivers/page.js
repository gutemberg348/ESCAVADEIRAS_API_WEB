"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ContactRound,
  CreditCard,
  Link2,
  Plus,
  Radio,
  Truck,
  Trash2,
  Unlink,
  UsersRound,
} from "lucide-react";
import DriverCreateForm from "../../../components/DriverCreateForm";
import PageHeader from "../../../components/PageHeader";
import StatusBadge from "../../../components/StatusBadge";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../../components/States";
import { request } from "../../../services/api";
import { machines as loadMachines } from "../../../services/machine.service";

export default function DriversPage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false),
    [drivers, setDrivers] = useState([]),
    [machines, setMachines] = useState([]),
    [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(""),
    [error, setError] = useState("");
  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError("");
    try {
      const [driverResult, machineResult] = await Promise.all([
        request("/drivers"),
        loadMachines(),
      ]);
      setDrivers(driverResult || []);
      setMachines(machineResult.data || []);
      setSelected(
        Object.fromEntries(
          (driverResult || []).map((driver) => [
            driver.id,
            driver.assignments?.[0]?.machineId || "",
          ]),
        ),
      );
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    const timer = setInterval(() => load(false), 10000);
    return () => clearInterval(timer);
  }, [load]);
  const stats = useMemo(
    () => ({
      active: drivers.filter((driver) => driver.user.active).length,
      assigned: drivers.filter((driver) => driver.assignments?.length).length,
      cards: drivers.reduce(
        (total, driver) =>
          total + (driver.rfidCards?.filter((card) => card.active).length || 0),
        0,
      ),
    }),
    [drivers],
  );
  async function link(profileId) {
    const machineId = selected[profileId];
    if (!machineId) return;
    setSaving(profileId);
    setError("");
    try {
      await request(`/drivers/${profileId}/assignments`, {
        method: "POST",
        body: JSON.stringify({ machineId }),
      });
      await load(false);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving("");
    }
  }
  async function unlink(driver) {
    const assignment = driver.assignments?.[0];
    if (
      !assignment ||
      !window.confirm(
        `Encerrar o vínculo de ${driver.user.name} com ${assignment.machine.code}?`,
      )
    )
      return;
    setSaving(driver.id);
    setError("");
    try {
      await request(`/drivers/assignments/${assignment.id}`, {
        method: "DELETE",
      });
      await load(false);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving("");
    }
  }
  async function remove(driver) {
    if (!window.confirm(`Excluir ${driver.user.name}? O acesso será bloqueado, os cartões desativados e a operação atual encerrada. O histórico será preservado.`)) return;
    setSaving(driver.id);
    setError("");
    try {
      await request(`/drivers/${driver.id}`, { method: "DELETE" });
      await load(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving("");
    }
  }
  if (loading)
    return (
      <div className="admin-page">
        <LoadingState label="Carregando operadores e vínculos..." />
      </div>
    );
  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="EQUIPE DE CAMPO"
        title="Operadores"
        description="Gerencie acessos, cartões RFID e a operação atual de cada motorista."
      />
      <section className="driver-toolbar">
        <div className="driver-summary">
          <div>
            <UsersRound size={18} />
            <span>
              <b>{stats.active}</b> ativos
            </span>
          </div>
          <div>
            <Truck size={18} />
            <span>
              <b>{stats.assigned}</b> em operação
            </span>
          </div>
          <div>
            <CreditCard size={18} />
            <span>
              <b>{stats.cards}</b> cartões ativos
            </span>
          </div>
        </div>
        <button
          className="primary-action driver-add"
          onClick={() => setCreating(true)}
        >
          <Plus size={17} />
          <span>Cadastrar operador</span>
        </button>
      </section>
      {error && <ErrorState message={error} onRetry={() => load()} />}
      {drivers.length ? (
        <section className="driver-grid">
          {drivers.map((driver) => {
            const assignment = driver.assignments?.[0];
            const activeCards =
              driver.rfidCards?.filter((card) => card.active).length || 0;
            return (
              <article className="surface-panel driver-card" key={driver.id}>
                <div className="driver-card-head">
                  <span>
                    <ContactRound size={22} />
                  </span>
                  <StatusBadge
                    status={driver.user.active ? "ACTIVE" : "INACTIVE"}
                  />
                </div>
                <div className="driver-identity">
                  <h2>{driver.user.name}</h2>
                  <p>{driver.user.email}</p>
                </div>
                <div
                  className={`driver-current ${assignment ? "assigned" : ""}`}
                >
                  <Truck size={17} />
                  <div>
                    <small>OPERAÇÃO ATUAL</small>
                    <b>
                      {assignment
                        ? `${assignment.machine.code} · ${assignment.machine.name}`
                        : "Nenhuma escavadeira vinculada"}
                    </b>
                  </div>
                </div>
                <div className="driver-card-stats">
                  <span>
                    <Radio size={14} />
                    <b>{activeCards}</b> RFID ativo
                    {activeCards === 1 ? "" : "s"}
                  </span>
                  <span>
                    <i className={assignment ? "online" : ""} />
                    {assignment ? "Em operação" : "Disponível"}
                  </span>
                </div>
                <details className="driver-assignment">
                  <summary>Vínculo manual de contingência</summary>
                  <p>
                    Use somente se a leitura do cartão na máquina estiver
                    indisponível.
                  </p>
                  <label>
                    <span>VÍNCULO MANUAL (OPCIONAL)</span>
                    <select
                      value={selected[driver.id] || ""}
                      onChange={(event) =>
                        setSelected({
                          ...selected,
                          [driver.id]: event.target.value,
                        })
                      }
                    >
                      <option value="">Selecione uma escavadeira</option>
                      {machines.filter((machine) => machine.companyId === driver.user.companyId).map((machine) => (
                        <option key={machine.id} value={machine.id}>
                          {machine.code} · {machine.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    onClick={() => link(driver.id)}
                    disabled={
                      saving === driver.id ||
                      !selected[driver.id] ||
                      selected[driver.id] === assignment?.machineId
                    }
                  >
                    <Link2 size={15} />
                    {saving === driver.id ? "Salvando..." : "Confirmar vínculo"}
                  </button>
                </details>
                <div className="driver-card-actions">
                  <Link href={`/admin/rfid?driver=${driver.id}`}>
                    <CreditCard size={15} />
                    Gerenciar cartão RFID
                  </Link>
                  {assignment && (
                    <button
                      type="button"
                      onClick={() => unlink(driver)}
                      disabled={saving === driver.id}
                    >
                      <Unlink size={15} />
                      Encerrar operação
                    </button>
                  )}
                  <button type="button" className="driver-delete" disabled={saving === driver.id} onClick={() => remove(driver)}>
                    <Trash2 size={16} />
                    Excluir motorista
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <EmptyState
          title="Nenhum operador cadastrado"
          description="Cadastre o primeiro motorista para liberar acesso ao aplicativo e aos cartões RFID."
        />
      )}
      {creating && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCreating(false);
          }}
        >
          <div
            className="modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Cadastrar operador"
          >
            <DriverCreateForm
              onCreated={(profileId) => {
                setCreating(false);
                if (profileId) {
                  router.push(`/admin/rfid?driver=${profileId}`);
                  return;
                }
                load();
              }}
              onCancel={() => setCreating(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
