"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Cpu, Download, Plus, Trash2, Usb } from "lucide-react";
import PageHeader from "../../../components/PageHeader";
import StatusBadge from "../../../components/StatusBadge";
import { ErrorState, LoadingState } from "../../../components/States";
import { request } from "../../../services/api";
import { fleetMachines } from "../../../services/machine.service";
import { normalizeDeviceCode, suggestedDeviceCode } from "../../../services/device-code";
import UsbProvisioner from "../../../components/UsbProvisioner";
import FirmwareInstaller from "../../../components/FirmwareInstaller";

export default function DevicesPage() {
  const [devices, setDevices] = useState([]);
  const [machines, setMachines] = useState([]);
  const [machineId, setMachineId] = useState("");
  const [boardConnected, setBoardConnected] = useState(null);
  const [firmwareInstalled, setFirmwareInstalled] = useState(null);
  const [firmwareReady, setFirmwareReady] = useState(false);
  const [provisioning, setProvisioning] = useState(null);
  const [configured, setConfigured] = useState(false);
  const [deviceCode, setDeviceCode] = useState("");
  const [hardwareSerial, setHardwareSerial] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [items, fleet] = await Promise.all([request("/devices"), fleetMachines()]);
      setDevices(items || []);
      setMachines(fleet || []);
      const requested = new URLSearchParams(window.location.search).get("machine");
      if (requested && fleet.some((machine) => machine.id === requested)) {
        setMachineId((current) => current || requested);
        const selected = fleet.find((machine) => machine.id === requested);
        if (!(items || []).some((item) => item.machineId === requested)) {
          setDeviceCode((current) => current || suggestedDeviceCode(selected.code));
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const machine = useMemo(() => machines.find((item) => item.id === machineId), [machines, machineId]);
  const existing = useMemo(() => devices.find((item) => item.machineId === machineId), [devices, machineId]);
  const canProvision = boardConnected === true && (firmwareInstalled === true || firmwareReady);

  function selectMachine(value) {
    setMachineId(value);
    setBoardConnected(null);
    setFirmwareInstalled(null);
    setFirmwareReady(false);
    setProvisioning(null);
    setConfigured(false);
    const selected = machines.find((item) => item.id === value);
    setDeviceCode(selected && !devices.some((item) => item.machineId === value)
      ? suggestedDeviceCode(selected.code)
      : "");
    setHardwareSerial("");
    setError("");
    setFormError("");
    setNotice("");
  }

  async function createDevice(event) {
    event.preventDefault();
    if (!canProvision || existing) return;
    setSaving(true);
    setError("");
    setFormError("");
    try {
      const code = normalizeDeviceCode(deviceCode);
      if (code.length < 4 || code.length > 50) {
        setFormError("O código da placa precisa ter entre 4 e 50 caracteres.");
        return;
      }
      const result = await request("/devices", {
        method: "POST",
        body: JSON.stringify({ machineId, deviceCode: code, hardwareSerial: hardwareSerial.trim() || undefined }),
      });
      setDeviceCode(code);
      setProvisioning(result.provisioning);
      setNotice("Identidade criada. Agora grave-a no ESP32 pela USB para concluir.");
      await load();
    } catch (err) {
      setFormError(err.message === "Invalid" ? "Confira o código da placa: use apenas letras, números, hífen e _." : err.message);
    } finally {
      setSaving(false);
    }
  }

  async function reconfigure() {
    if (!existing || !window.confirm("Gerar nova identidade? A credencial atual deixará de funcionar até a configuração USB terminar.")) return;
    setSaving(true);
    setError("");
    try {
      const result = await request(`/devices/${existing.id}/rotate-credentials`, { method: "POST" });
      setProvisioning(result.provisioning);
      setConfigured(false);
      setNotice("Nova identidade criada. Configure a mesma placa pela USB agora.");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(device) {
    if (!window.confirm(`Retirar ${device.deviceCode} de ${device.machine?.code}? O histórico será preservado, mas a placa perderá acesso e essa máquina poderá receber outro ESP32.`)) return;
    setSaving(true);
    setError("");
    try {
      await request(`/devices/${device.id}`, { method: "DELETE" });
      if (machineId === device.machineId) selectMachine(machineId);
      setNotice(`${device.deviceCode} retirado. A escavadeira está livre para outro dispositivo.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function downloadManifest() {
    if (!provisioning) return;
    const blob = new Blob([JSON.stringify(provisioning, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `${provisioning.device.code}-provisioning.json`;
    link.click();
    URL.revokeObjectURL(href);
  }

  if (loading) return <div className="admin-page"><LoadingState label="Carregando escavadeiras e dispositivos..." /></div>;
  return (
    <div className="admin-page device-guided-page">
      <PageHeader eyebrow="INSTALAÇÃO GUIADA" title="Dispositivos ESP32" description="Escolha a escavadeira e responda às perguntas. O painel mostra somente a próxima ação necessária." />
      {error && <ErrorState message={error} onRetry={load} />}
      {notice && <div className="guided-notice" role="status"><CheckCircle2 size={17} />{notice}</div>}

      <section className="surface-panel guided-panel">
        <div className="guided-heading"><span className="guided-number">1</span><div><h2>Qual escavadeira vai receber a placa?</h2><p>Você pode usar uma máquina já cadastrada ou criar uma nova.</p></div></div>
        <div className="guided-machine-row">
          <select aria-label="Escavadeira" value={machineId} onChange={(event) => selectMachine(event.target.value)}>
            <option value="">Selecione a escavadeira</option>
            {machines.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}{item.device ? " · ESP32 cadastrado" : ""}</option>)}
          </select>
          <Link href="/admin/machines/new"><Plus size={16} /> Nova escavadeira</Link>
        </div>
      </section>

      {machine && <section className="surface-panel guided-panel">
        <div className="guided-heading"><span className="guided-number">2</span><div><h2>A placa ESP32 está conectada por USB neste computador?</h2><p>Use Chrome ou Edge. Feche o Monitor Serial da Arduino IDE antes de continuar.</p></div></div>
        <Choice value={boardConnected} onChange={(value) => { setBoardConnected(value); setFirmwareInstalled(null); setFirmwareReady(false); }} yes="Sim, está conectada" no="Ainda não" />
        {boardConnected === false && <p className="guided-help">Conecte a placa por cabo USB de dados, escolha a porta correta no navegador e volte aqui. A máquina pode ficar cadastrada enquanto isso.</p>}
      </section>}

      {boardConnected === true && <section className="surface-panel guided-panel">
        <div className="guided-heading"><span className="guided-number">3</span><div><h2>O firmware-base já está instalado nessa placa?</h2><p>Se ela já foi gravada pela Arduino IDE ou por este painel, não grave de novo.</p></div></div>
        <Choice value={firmwareInstalled} onChange={(value) => { setFirmwareInstalled(value); setFirmwareReady(false); }} yes="Sim, já está instalado" no="Não, preciso instalar" />
        {firmwareInstalled === false && <><p className="guided-help">Esta gravação substitui o conteúdo atual da placa. Confira se é o ESP32 correto antes de começar.</p><FirmwareInstaller onComplete={() => setFirmwareReady(true)} /></>}
        {firmwareReady && <p className="guided-success"><CheckCircle2 size={17} /> Firmware-base gravado. Continue para vincular a identidade.</p>}
      </section>}

      {canProvision && <section className="surface-panel guided-panel">
        <div className="guided-heading"><span className="guided-number">4</span><div><h2>{existing ? "Esta escavadeira já tem um ESP32 cadastrado" : "Cadastrar esta placa na escavadeira"}</h2><p>{existing ? "Não crie um cadastro duplicado. Se a placa já funciona, pule a troca de credencial. Se ela nunca foi configurada, use a opção de trocar credencial abaixo." : "O código identifica a placa no aplicativo e no painel. Anote-o na etiqueta física."}</p></div></div>
        {existing ? <div className="guided-existing"><Cpu size={20} /><div><strong>{existing.deviceCode}</strong><span>{existing.hardwareSerial || "Serial não informado"} · {existing.active ? "Ativo" : "Inativo"}</span></div>{!provisioning && <button type="button" onClick={reconfigure} disabled={saving}>Trocar credencial e configurar pela USB</button>}</div> : !provisioning ? <form className="guided-form" onSubmit={createDevice}>
          <label><span>Código sugerido (pode alterar) *</span><input required minLength={4} maxLength={50} pattern="[A-Z0-9_-]+" title="Use letras, números, hífen e _. Espaços viram hífen." placeholder="ESP-ESC-001" value={deviceCode} onChange={(event) => { setDeviceCode(normalizeDeviceCode(event.target.value)); setFormError(""); }} /><small>Espaços no código da escavadeira são convertidos em hífens automaticamente.</small></label>
          <label><span>Serial da placa (opcional)</span><input minLength={4} maxLength={100} placeholder="Número escrito na placa, se houver" value={hardwareSerial} onChange={(event) => setHardwareSerial(event.target.value)} /></label>
          <button disabled={saving}>{saving ? "Cadastrando..." : "Cadastrar e continuar"}</button>
          {formError && <p className="guided-form-error" role="alert">{formError}</p>}
        </form> : <p className="guided-success"><CheckCircle2 size={17} /> Dispositivo cadastrado. Ainda falta salvar a identidade na placa.</p>}
      </section>}

      {canProvision && provisioning && <section className="surface-panel guided-panel">
        <div className="guided-heading"><span className="guided-number">5</span><div><h2>Salvar identidade na placa</h2><p>Escolha a porta USB do mesmo ESP32. Aguarde a confirmação de reinicialização antes de retirar o cabo.</p></div></div>
        <UsbProvisioner key={provisioning.device.token} provisioning={provisioning} onComplete={() => setConfigured(true)} />
        <details className="guided-backup"><summary>Guardar cópia da configuração (opcional)</summary><p>O token aparece só agora. O arquivo é uma cópia de segurança; baixá-lo não instala nada na placa. Guarde-o em lugar seguro.</p><button type="button" onClick={downloadManifest}><Download size={15} /> Baixar JSON de segurança</button></details>
      </section>}

      {canProvision && existing && !provisioning && <section className="guided-finish"><CheckCircle2 size={22} /><div><strong>Dispositivo já cadastrado</strong><p>Se a placa está funcionando, abra o aplicativo do motorista, ative o Bluetooth, procure a escavadeira e aproxime o cartão RFID. Só troque a credencial se precisar reconfigurar essa placa.</p></div></section>}
      {configured && canProvision && <section className="guided-finish"><CheckCircle2 size={22} /><div><strong>Configuração concluída</strong><p>Desconecte a USB, ligue o ESP32 na máquina e teste no aplicativo: Bluetooth → escavadeira → cartão RFID. Confirme o último contato e a telemetria no painel.</p></div></section>}

      <section className="surface-panel device-list-panel guided-inventory">
        <div className="panel-header"><div><span className="eyebrow">INVENTÁRIO</span><h2>{devices.length} dispositivos vinculados</h2></div><Usb size={19} /></div>
        {devices.length ? <div className="guided-device-grid">{devices.map((device) => <article className="guided-device-card" key={device.id}>
          <div className="guided-device-title"><Cpu size={20} /><div><strong>{device.deviceCode}</strong><small>{device.hardwareSerial || "Serial não informado"}</small></div><StatusBadge status={device.active ? device.machine?.status || "OFFLINE" : "DISABLED"} /></div>
          <div className="guided-device-meta"><span>Escavadeira <b>{device.machine?.code || "Sem máquina"}</b></span><span>Último contato <b>{formatDate(device.lastSeenAt)}</b></span></div>
          <div className="guided-row-actions"><button type="button" onClick={() => { selectMachine(device.machineId); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Ver instalação</button><button type="button" className="danger" disabled={saving} onClick={() => remove(device)}><Trash2 size={14} /> Retirar vínculo</button></div>
        </article>)}</div> : <p className="guided-help">Nenhum ESP32 vinculado ainda. Escolha uma escavadeira acima para começar.</p>}
      </section>
    </div>
  );
}

function Choice({ value, onChange, yes, no }) {
  return <div className="guided-choices"><button type="button" aria-pressed={value === true} className={value === true ? "selected" : ""} onClick={() => onChange(true)}>{yes}</button><button type="button" aria-pressed={value === false} className={value === false ? "selected" : ""} onClick={() => onChange(false)}>{no}</button></div>;
}

function formatDate(value) {
  return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "Ainda não conectado";
}
