"use client";
import { useState } from "react";
import { CheckCircle2, Cpu, Download, Usb } from "lucide-react";
import { resetToApplication } from "../services/usbProvisioning.mjs";

export default function FirmwareInstaller({ onComplete }) {
  const [state, setState] = useState("idle"),
    [message, setMessage] = useState(""),
    [progress, setProgress] = useState(0);
  async function flash() {
    if (!("serial" in navigator)) {
      setState("error");
      setMessage("Use Google Chrome ou Microsoft Edge no computador.");
      return;
    }
    if (
      !window.confirm(
        "Gravar o firmware-base neste ESP32? Use somente na placa do módulo da escavadeira.",
      )
    )
      return;
    setState("working");
    setProgress(0);
    setMessage("Selecione a porta USB do ESP32.");
    let transport;
    try {
      const [{ ESPLoader, Transport }, response, port] = await Promise.all([
        import("esptool-js"),
        fetch("/firmware/empimecatronic-esp32-base.bin", { cache: "no-store" }),
        navigator.serial.requestPort(),
      ]);
      if (!response.ok)
        throw new Error(
          "Arquivo do firmware-base não está publicado no servidor.",
        );
      const firmware = new Uint8Array(await response.arrayBuffer());
      transport = new Transport(port, false);
      const terminal = { clean() {}, write() {}, writeLine() {} };
      const loader = new ESPLoader({
        transport,
        baudrate: 460800,
        terminal,
        debugLogging: false,
      });
      setMessage("Conectando ao modo de gravação do ESP32...");
      const chip = await loader.main();
      if (!String(chip).toUpperCase().includes("ESP32"))
        throw new Error(`Placa incompatível: ${chip}`);
      setMessage(`Gravando firmware-base em ${chip}. Não desconecte o cabo.`);
      await loader.writeFlash({
        fileArray: [{ data: firmware, address: 0 }],
        flashMode: "dio",
        flashFreq: "40m",
        flashSize: "4MB",
        eraseAll: true,
        compress: true,
        reportProgress: (_file, written, total) =>
          setProgress(Math.round((written / total) * 100)),
      });
      // esptool-js 0.6's hard_reset only releases RTS; explicitly pulse EN.
      await resetToApplication(port);
      await transport.disconnect();
      transport = null;
      setState("done");
      setProgress(100);
      setMessage(
        "Firmware-base gravado. Agora crie/vincule o dispositivo e aplique a identidade USB.",
      );
      onComplete?.();
    } catch (error) {
      if (error.name === "NotFoundError") {
        setState("idle");
        setMessage("Seleção cancelada.");
      } else {
        setState("error");
        setMessage(`Falha na gravação: ${error.message}`);
      }
    } finally {
      try {
        await transport?.disconnect();
      } catch {}
    }
  }
  return (
    <section className={`firmware-installer ${state}`}>
      <span className="firmware-installer-icon">
        {state === "done" ? <CheckCircle2 size={23} /> : <Cpu size={23} />}
      </span>
      <div>
        <small>ETAPA DE BANCADA</small>
        <h2>Gravar firmware-base no ESP32</h2>
        <p>
          {message ||
            "Conecte uma placa nova pela USB. O painel instala o firmware que lê GPS, RFID e sensores e conversa com o Android por Bluetooth."}
        </p>
        {state === "working" && (
          <div className="firmware-progress">
            <i style={{ width: `${progress}%` }} />
            <b>{progress}%</b>
          </div>
        )}
      </div>
      <button type="button" disabled={state === "working"} onClick={flash}>
        {state === "working" ? <Download size={17} /> : <Usb size={17} />}{" "}
        {state === "working"
          ? "Gravando..."
          : state === "done"
            ? "Gravar outra placa"
            : "Conectar e gravar"}
      </button>
    </section>
  );
}
