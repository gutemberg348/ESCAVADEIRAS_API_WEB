"use client";
import { useRef, useState } from "react";
import { CheckCircle2, Usb, Wrench } from "lucide-react";

export default function UsbProvisioner({ provisioning }) {
  const [state, setState] = useState("idle"),
    [message, setMessage] = useState("");
  const portRef = useRef(null);
  async function installIdentity() {
    if (!("serial" in navigator)) {
      setState("error");
      setMessage("Use Google Chrome ou Microsoft Edge no computador.");
      return;
    }
    setState("working");
    setMessage("Selecione a porta USB do ESP32.");
    let reader;
    try {
      const port = await navigator.serial.requestPort();
      portRef.current = port;
      await port.open({ baudRate: 115200 });
      await new Promise((resolve) => setTimeout(resolve, 1800));
      setMessage("Enviando a identidade segura para o ESP32...");
      const writer = port.writable.getWriter();
      await writer.write(
        new TextEncoder().encode(
          `EMP_PROVISION:${JSON.stringify({ code: provisioning.device.code, token: provisioning.device.token })}\n`,
        ),
      );
      writer.releaseLock();
      const decoder = new TextDecoder();
      reader = port.readable.getReader();
      let response = "";
      const timeout = setTimeout(() => reader.cancel().catch(() => {}), 10000);
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        response += decoder.decode(result.value, { stream: true });
        if (response.includes("EMP_PROVISION_OK:")) break;
        if (response.includes("EMP_PROVISION_ERROR:"))
          throw new Error(
            response.split("EMP_PROVISION_ERROR:")[1].split(/[\r\n]/)[0],
          );
      }
      clearTimeout(timeout);
      if (!response.includes("EMP_PROVISION_OK:"))
        throw new Error(
          "O firmware não respondeu. Grave primeiro o firmware-base atualizado.",
        );
      setState("done");
      setMessage(
        `${provisioning.device.code} configurado. O ESP32 reiniciará e anunciará esse código no Bluetooth.`,
      );
    } catch (error) {
      if (error.name === "NotFoundError") {
        setState("idle");
        setMessage("Seleção cancelada.");
      } else {
        setState("error");
        setMessage(`Falha no provisionamento: ${error.message}`);
      }
    } finally {
      try {
        reader?.releaseLock();
      } catch {}
      try {
        await portRef.current?.close();
      } catch {}
      portRef.current = null;
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
