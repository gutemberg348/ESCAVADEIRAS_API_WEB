"use client";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Keyboard, Radio, Usb, X } from "lucide-react";
import { request } from "../services/api";
const uidPattern = /\[RFID\]\s*UID lido:\s*([0-9a-f]+)/gi;

export default function CardCapture({ value, onChange, required = false }) {
  const [source, setSource] = useState("usb"),
    [machines, setMachines] = useState([]),
    [machineId, setMachineId] = useState(""),
    [capture, setCapture] = useState(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [serialState, setSerialState] = useState("idle"),
    [manual, setManual] = useState(false);
  const activeRef = useRef(null),
    portRef = useRef(null),
    readerRef = useRef(null),
    stopRef = useRef(false),
    changeRef = useRef(onChange);
  changeRef.current = onChange;
  useEffect(() => {
    request("/machines?limit=100")
      .then((result) =>
        setMachines((result.data || []).filter((item) => item.device?.active)),
      )
      .catch((err) => setError(err.message));
    return () => {
      const active = activeRef.current;
      if (active)
        request(`/rfid/captures/${active.machineId}/${active.id}`, {
          method: "DELETE",
        }).catch(() => {});
      disconnectSerial();
    };
  }, []);
  useEffect(() => {
    if (!capture || capture.code) return;
    let cancelled = false,
      timer;
    async function poll() {
      try {
        const next = await request(
          `/rfid/captures/${capture.machineId}/${capture.id}`,
        );
        if (cancelled) return;
        setCapture(next);
        if (next.code) {
          changeRef.current(next.code);
          return;
        }
        timer = setTimeout(poll, 1000);
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setCapture(null);
          activeRef.current = null;
        }
      }
    }
    timer = setTimeout(poll, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [capture?.id, capture?.code]);

  async function disconnectSerial() {
    stopRef.current = true;
    try {
      await readerRef.current?.cancel();
    } catch {}
    try {
      readerRef.current?.releaseLock();
    } catch {}
    readerRef.current = null;
    try {
      await portRef.current?.close();
    } catch {}
    portRef.current = null;
    setSerialState("idle");
  }
  async function readSerial(port) {
    const decoder = new TextDecoder();
    let buffer = "";
    stopRef.current = false;
    while (port.readable && !stopRef.current) {
      const reader = port.readable.getReader();
      readerRef.current = reader;
      try {
        while (!stopRef.current) {
          const result = await reader.read();
          if (result.done) break;
          buffer = (
            buffer + decoder.decode(result.value, { stream: true })
          ).slice(-4096);
          uidPattern.lastIndex = 0;
          const matches = [...buffer.matchAll(uidPattern)];
          for (const match of matches) {
            changeRef.current(match[1].toUpperCase());
            setSerialState("read");
            setError("");
          }
          if (matches.length)
            buffer = buffer.slice(
              (matches.at(-1).index || 0) + matches.at(-1)[0].length,
            );
        }
      } finally {
        try {
          reader.releaseLock();
        } catch {}
        readerRef.current = null;
      }
    }
  }
  async function connectSerial() {
    setError("");
    if (!("serial" in navigator)) {
      setError(
        "A leitura USB direta requer Google Chrome ou Microsoft Edge no computador.",
      );
      return;
    }
    setBusy(true);
    try {
      await disconnectSerial();
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      portRef.current = port;
      setSerialState("connected");
      changeRef.current("");
      readSerial(port).catch((err) => {
        if (!stopRef.current) {
          setError(`A conexão USB foi interrompida: ${err.message}`);
          setSerialState("idle");
        }
      });
    } catch (err) {
      if (err.name !== "NotFoundError")
        setError(`Não foi possível abrir o ESP32: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }
  async function cancelMachine() {
    if (activeRef.current) {
      const active = activeRef.current;
      try {
        await request(`/rfid/captures/${active.machineId}/${active.id}`, {
          method: "DELETE",
        });
      } catch (err) {
        setError(err.message);
      }
    }
    activeRef.current = null;
    setCapture(null);
  }
  async function startMachine() {
    setBusy(true);
    setError("");
    try {
      await cancelMachine();
      changeRef.current("");
      const next = await request("/rfid/captures", {
        method: "POST",
        body: JSON.stringify({ machineId }),
      });
      activeRef.current = next;
      setCapture(next);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-capture">
      <label>
        <span>ONDE O CARTÃO SERÁ LIDO</span>
        <select
          value={source}
          disabled={!!capture || serialState !== "idle"}
          onChange={(event) => setSource(event.target.value)}
        >
          <option value="usb">ESP32 conectado neste computador</option>
          <option value="machine">Leitor instalado em uma escavadeira</option>
        </select>
      </label>
      {source === "usb" ? (
        <div className={`usb-reader ${serialState}`}>
          <div className="usb-reader-icon">
            {value ? <CheckCircle2 size={23} /> : <Usb size={23} />}
          </div>
          <div className="usb-reader-copy">
            <b>
              {value
                ? "Cartão capturado"
                : serialState === "connected"
                  ? "Leitor pronto"
                  : "Conectar ESP32 pela USB"}
            </b>
            <span>
              {value
                ? `UID ${value}`
                : serialState === "connected"
                  ? "Agora aproxime o cartão no RC522."
                  : "Feche o Monitor Serial da Arduino IDE antes de conectar."}
            </span>
          </div>
          {serialState === "idle" ? (
            <button type="button" disabled={busy} onClick={connectSerial}>
              <Usb size={16} />
              {busy ? "Conectando..." : "Conectar leitor"}
            </button>
          ) : (
            <button
              type="button"
              className="secondary-action"
              onClick={disconnectSerial}
            >
              <X size={15} />
              Desconectar
            </button>
          )}
        </div>
      ) : (
        <>
          <label>
            <span>ESCAVADEIRA COM LEITOR</span>
            <select
              value={machineId}
              disabled={!!capture}
              onChange={(event) => setMachineId(event.target.value)}
            >
              <option value="">Selecione a escavadeira</option>
              {machines.map((machine) => (
                <option key={machine.id} value={machine.id}>
                  {machine.code} ·{" "}
                  {machine.currentState?.online ? "Conectada" : "Offline"}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!machineId || busy || !!capture}
            onClick={startMachine}
          >
            <Radio size={16} />
            Aguardar cartão na escavadeira
          </button>
          {capture && (
            <div className="capture-feedback" role="status">
              {capture.code
                ? "Cartão capturado. Confira o operador e salve o vínculo."
                : "Aproxime o cartão no RC522. A captura fica aberta por 2 minutos."}
              <button type="button" onClick={cancelMachine}>
                <X size={14} />
                Encerrar
              </button>
            </div>
          )}
        </>
      )}
      {required && !value && (
        <p className="capture-waiting">
          Aguardando a leitura automática do cartão.
        </p>
      )}
      <button
        type="button"
        className="manual-toggle"
        onClick={() => setManual((current) => !current)}
      >
        <Keyboard size={14} />
        {manual
          ? "Ocultar entrada manual"
          : "Digitar UID somente em emergência"}
      </button>
      {manual && (
        <label>
          <span>UID MANUAL</span>
          <input
            autoComplete="off"
            placeholder="Ex.: 04A83F92"
            value={value}
            onChange={(event) =>
              onChange(
                event.target.value.replace(/[^0-9a-f]/gi, "").toUpperCase(),
              )
            }
          />
        </label>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
