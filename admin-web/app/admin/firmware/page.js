"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bluetooth, CheckCircle2, Cpu, Download, HardDriveDownload, ShieldAlert, Usb } from "lucide-react";
import PageHeader from "../../../components/PageHeader";
import FirmwareInstaller from "../../../components/FirmwareInstaller";

const firmwareFile = "/firmware/empimecatronic-esp32-base.bin";

export default function FirmwarePage() {
  const [file, setFile] = useState({ status: "checking", size: null });
  const [flashed, setFlashed] = useState(false);
  const [browserSupportsUsb, setBrowserSupportsUsb] = useState(true);

  useEffect(() => {
    setBrowserSupportsUsb("serial" in navigator);
    const controller = new AbortController();
    fetch(firmwareFile, { method: "HEAD", cache: "no-store", signal: controller.signal })
      .then((response) => setFile({ status: response.ok ? "ready" : "missing", size: Number(response.headers.get("content-length")) || null }))
      .catch((error) => { if (error.name !== "AbortError") setFile({ status: "error", size: null }); });
    return () => controller.abort();
  }, []);

  return <div className="admin-page firmware-page">
    <PageHeader eyebrow="BANCADA · GRAVAÇÃO USB" title="Firmware do ESP32" description="Grave o programa-base em cada placa nova diretamente pelo navegador. Depois vincule a identidade da escavadeira à mesma placa." />

    <section className="surface-panel firmware-hero">
      <span className="firmware-hero-icon"><Cpu size={29} /></span>
      <div>
        <span className="eyebrow">ESP32 DEV MODULE · BLUETOOTH BLE</span>
        <h2>Prepare a placa antes de instalar na máquina</h2>
        <p>O servidor fornece o arquivo-base; quem o grava é este computador, pelo cabo USB. A escavadeira não precisa ficar conectada ao computador depois.</p>
      </div>
      <span className={`firmware-file-status ${file.status}`}>{file.status === "ready" ? "Arquivo disponível" : file.status === "checking" ? "Conferindo arquivo..." : "Arquivo indisponível"}</span>
    </section>

    <div className="firmware-step-grid">
      <article className="surface-panel"><span className="firmware-step-icon"><Usb size={20} /></span><small>PASSO 1</small><h3>Conecte o ESP32</h3><p>Use um cabo USB de dados neste computador. Feche o Monitor Serial da Arduino IDE para liberar a porta.</p></article>
      <article className="surface-panel"><span className="firmware-step-icon"><HardDriveDownload size={20} /></span><small>PASSO 2</small><h3>Grave o firmware-base</h3><p>Escolha a porta COM no navegador e aguarde 100%. Essa gravação substitui o programa e apaga a configuração anterior da placa.</p></article>
      <article className="surface-panel"><span className="firmware-step-icon"><Bluetooth size={20} /></span><small>PASSO 3</small><h3>Vincule e teste</h3><p>Em Dispositivos, escolha a escavadeira e salve a identidade pela USB. Depois teste Bluetooth, cartão RFID e telemetria no app.</p></article>
    </div>

    {!browserSupportsUsb && <div className="firmware-alert" role="alert"><ShieldAlert size={20} /><span>Este navegador não oferece acesso à porta USB. Abra o painel no Google Chrome ou Microsoft Edge de um computador.</span></div>}
    {file.status === "missing" && <div className="firmware-alert" role="alert"><ShieldAlert size={20} /><span>O arquivo-base não está publicado neste servidor. Atualize o painel antes de tentar gravar.</span></div>}
    {file.status === "error" && <div className="firmware-alert" role="alert"><ShieldAlert size={20} /><span>Não foi possível conferir o arquivo-base. Verifique a conexão com o painel e tente novamente.</span></div>}

    <section className="surface-panel firmware-flash-panel">
      <div className="panel-header"><div><span className="eyebrow">GRAVAÇÃO LOCAL · SEM ARDUINO IDE</span><h2>Instalar firmware nesta placa</h2></div>{file.size && <small>{(file.size / 1024 / 1024).toFixed(1)} MB</small>}</div>
      <p>Confira que a placa conectada é um ESP32 Dev Module compatível. Para uma placa que já funciona, não repita esta etapa: vá direto ao cadastro do dispositivo.</p>
      {file.status === "ready" && browserSupportsUsb ? <FirmwareInstaller onComplete={() => setFlashed(true)} /> : <p className="firmware-flash-unavailable">A gravação ficará disponível quando o arquivo-base e a porta USB estiverem prontos.</p>}
      {file.status === "ready" && <a className="firmware-download" href={firmwareFile} download><Download size={15} /> Baixar arquivo-base para guardar uma cópia</a>}
    </section>

    <section className={`firmware-next ${flashed ? "done" : ""}`}>
      <span>{flashed ? <CheckCircle2 size={24} /> : <ArrowRight size={24} />}</span>
      <div><h2>{flashed ? "Firmware gravado. Falta identificar esta placa." : "A placa já tem firmware? Continue por aqui."}</h2><p>O programa-base é igual para todas as placas. O código e a credencial exclusivos da escavadeira são salvos no próximo passo, pela USB.</p></div>
      <Link href="/admin/devices">Ir para Dispositivos <ArrowRight size={16} /></Link>
    </section>
    <p className="firmware-safety-note">A gravação não é feita à distância por Bluetooth. O relé de desligamento da escavadeira ainda não está habilitado neste firmware.</p>
  </div>;
}
