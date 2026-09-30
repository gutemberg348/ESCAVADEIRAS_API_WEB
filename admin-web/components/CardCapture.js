'use client';
import { useEffect, useRef, useState } from 'react';
import { Radio, Usb, X } from 'lucide-react';
import { request } from '../services/api';

export default function CardCapture({ value, onChange, required = false }) {
  const [source, setSource] = useState('usb');
  const [machines, setMachines] = useState([]);
  const [machineId, setMachineId] = useState('');
  const [capture, setCapture] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const activeRef = useRef(null);
  const inputRef = useRef(null);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;

  useEffect(() => {
    request('/machines?limit=100').then(result => setMachines((result.data || []).filter(item => item.device?.active))).catch(err => setError(err.message));
    return () => {
      const active = activeRef.current;
      if (active) request(`/rfid/captures/${active.machineId}/${active.id}`, { method: 'DELETE' }).catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (!capture || capture.code) return;
    let cancelled = false;
    let timer;
    async function poll() {
      try {
        const next = await request(`/rfid/captures/${capture.machineId}/${capture.id}`);
        if (cancelled) return;
        setCapture(next);
        if (next.code) { changeRef.current(next.code); return; }
        timer = setTimeout(poll, 1000);
      } catch (err) {
        if (!cancelled) { setError(err.message); setCapture(null); activeRef.current = null; }
      }
    }
    timer = setTimeout(poll, 500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [capture?.id, capture?.code]);

  async function cancel() {
    if (activeRef.current) {
      const active = activeRef.current;
      try { await request(`/rfid/captures/${active.machineId}/${active.id}`, { method: 'DELETE' }); }
      catch (err) { setError(err.message); }
    }
    activeRef.current = null;
    setCapture(null);
  }
  async function start() {
    setBusy(true); setError('');
    try {
      await cancel();
      changeRef.current('');
      const next = await request('/rfid/captures', { method: 'POST', body: JSON.stringify({ machineId }) });
      activeRef.current = next; setCapture(next);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <div className="card-capture">
    <label><span>COMO LER O CARTÃO</span><select value={source} disabled={!!capture} onChange={event => setSource(event.target.value)}>
      <option value="usb">Leitor USB / UID manual</option><option value="machine">Leitor de uma máquina</option>
    </select></label>
    {source === 'usb' ? <><p className="capture-hint">Conecte o leitor USB, clique no campo e aproxime o cartão. Use modo teclado e UID hexadecimal igual ao RC522.</p><button type="button" className="secondary-action" onClick={() => inputRef.current?.focus()}><Usb size={16}/>Ler pelo USB</button></> : <>
      <label><span>MÁQUINA COM LEITOR</span><select value={machineId} disabled={!!capture} onChange={event => setMachineId(event.target.value)}><option value="">Selecione a máquina</option>{machines.map(machine => <option key={machine.id} value={machine.id}>{machine.code} · {machine.currentState?.online ? 'Conectada' : 'Offline'}</option>)}</select></label>
      <button type="button" disabled={!machineId || busy || !!capture} onClick={start}><Radio size={16}/>Aguardar cartão na máquina</button>
      {capture && <div className="capture-feedback" role="status">{capture.code ? 'Cartão lido. Confira o operador e salve o vínculo.' : 'Aproxime o cartão no leitor. Captura válida por 2 minutos.'}<button type="button" onClick={cancel}><X size={14}/>Encerrar captura</button></div>}
    </>}
    <label><span>UID DO CARTÃO {required ? '' : '(OPCIONAL)'}</span><input ref={inputRef} required={required} autoComplete="off" placeholder="Ex.: 04A83F92" value={value} onChange={event => onChange(event.target.value.toUpperCase())} onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }}/></label>
    <small className="capture-hint">Preserve zeros à esquerda. Leitores que enviam apenas número decimal ou usam porta serial precisam ser configurados para UID hexadecimal.</small>
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
