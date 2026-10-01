"use client";
import { useState } from "react";
import { CheckCircle2, Usb, Wrench } from "lucide-react";
import { provisionOverUsb } from "../services/usbProvisioning.mjs";

export default function UsbProvisioner({ provisioning, onComplete }) {
  const [state, setState] = useState("idle"),
    [message, setMessage] = useState("");
  async function installIdentity() {
    if (!("serial" in navigator)) {
      setState("error");
      setMessage("Use Google Chrome ou Microsoft Edge no computador.");
      return;
    }
    setState("working");
    setMessage("Selecione a porta USB do ESP32.");
    try {
      const port = await navigator.serial.requestPort();
      await provisionOverUsb(port, provisioning.device, { onProgress: setMessage });
      setState("done");
      setMessage(
        `${provisioning.device.code} configurado e confirmado após reiniciar. Agora procure esse dispositivo no Bluetooth do aplicativo.`,
      );
      onComplete?.();
    } catch (error) {
      if (error.name === "NotFoundError") {
        setState("idle");
        setMessage("Seleção cancelada.");
      } else {
        setState("error");
        setMessage(error.name === "InvalidStateError" || error.name === "NetworkError"
          ? "A porta USB está ocupada ou desconectada. Feche o Monitor Serial e desconecte o leitor RFID do painel antes de tentar novamente."
          : `Falha na configuração: ${error.message}`);
      }
    }
  }
  return (
    <div className={`usb-provisioner ${state}`}>
      <span>
        {state === "done" ? <CheckCircle2 size={22} /> : <Wrench size={22} />}
      </span>
      <div>
        <b>
          {state === "done"
            ? "ESP32 pronto para instalar"
            : "Aplicar identidade no ESP32"}
        </b>
        <p>
          {message ||
            "Conecte pela USB depois de gravar o firmware-base. A credencial será salva na memória da placa."}
        </p>
      </div>
      <button
        type="button"
        disabled={state === "working" || state === "done"}
        onClick={installIdentity}
      >
        <Usb size={16} />
        {state === "working"
          ? "Configurando..."
          : state === "done"
            ? "Configurado"
            : "Configurar pela USB"}
      </button>
    </div>
  );
}
