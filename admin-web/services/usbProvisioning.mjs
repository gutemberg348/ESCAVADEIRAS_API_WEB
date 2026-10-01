const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

// GPIO0 (DTR) must remain released while EN (RTS) receives a reset pulse.
export async function resetToApplication(port, sleep = pause) {
  await port.setSignals({ dataTerminalReady: false, requestToSend: false });
  await port.setSignals({ dataTerminalReady: false, requestToSend: true });
  await sleep(100);
  await port.setSignals({ dataTerminalReady: false, requestToSend: false });
}

function identityFromLine(line) {
  try {
    const value = JSON.parse(line);
    return value.type === 'EMP_IDENTITY' && typeof value.deviceCode === 'string' ? value : null;
  } catch { return null; }
}

const firmwareErrors = {
  json_invalido: 'A placa não conseguiu interpretar a configuração.',
  dados_invalidos: 'O código ou a credencial do dispositivo é inválido.',
  codigo_invalido: 'O código do dispositivo contém caracteres inválidos.',
  memoria_indisponivel: 'A memória de configuração do ESP32 está indisponível.',
  falha_ao_salvar: 'O ESP32 não conseguiu salvar a configuração.',
  comando_muito_grande: 'A configuração excede o tamanho aceito pelo ESP32.',
};

export async function provisionOverUsb(port, device, {
  onProgress = () => {},
  identifyTimeout = 15000,
  ackTimeout = 8000,
  rebootTimeout = 15000,
  pollInterval = 50,
  sleep = pause,
} = {}) {
  if (!/^[A-Za-z0-9_-]{3,40}$/.test(device?.code || '') ||
      typeof device?.token !== 'string' || device.token.length < 32 || device.token.length > 160) {
    throw new Error('Credencial de instalação inválida. Abra o cadastro do dispositivo e gere a credencial novamente.');
  }
  let reader, pump, opened = false, closed = false, readError, sequence = 0;
  let lines = [];
  let receivedFirmware = false, bootloader = false;
  const send = async line => {
    const writer = port.writable.getWriter();
    try { await writer.write(new TextEncoder().encode(`${line}\n`)); }
    finally { writer.releaseLock(); }
  };
  const waitFor = async (predicate, timeout, after) => {
    const deadline = Date.now() + timeout;
    do {
      const match = lines.find(item => item.sequence > after && predicate(item.line));
      if (match) return match.line;
      if (readError) throw new Error('A conexão USB foi interrompida. Reconecte o cabo e tente novamente.');
      await sleep(pollInterval);
    } while (Date.now() < deadline);
    return null;
  };
  const identify = async (timeout, predicate = () => true) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const after = sequence;
      await send('EMP_IDENTIFY');
      const line = await waitFor(line => {
        const identity = identityFromLine(line);
        return identity && predicate(identity);
      }, Math.min(1000, deadline - Date.now()), after);
      if (line) return identityFromLine(line);
    }
    return null;
  };
  try {
    await port.open({ baudRate: 115200, flowControl: 'none', bufferSize: 4096 });
    opened = true;
    reader = port.readable.getReader();
    // Start draining serial before reset or writes. Startup messages can be fragmented.
    pump = (async () => {
      const decoder = new TextDecoder();
      let pending = '';
      try {
        while (!closed) {
          const { value, done } = await reader.read();
          if (done) { if (!closed) readError = new Error('USB encerrada'); break; }
          pending += decoder.decode(value, { stream: true });
          const complete = pending.split(/\r?\n/);
          pending = complete.pop().slice(-4096);
          for (const raw of complete) {
            const line = raw.trim();
            if (!line) continue;
            receivedFirmware ||= /\[SYSTEM\]|\[PROVISION\]|Firmware /.test(line);
            bootloader ||= /waiting for download|DOWNLOAD_BOOT/.test(line);
            lines.push({ sequence: ++sequence, line });
          }
          lines = lines.slice(-128);
        }
      } catch (error) { if (!closed) readError = error; }
    })();
    onProgress('Reiniciando o ESP32 e aguardando o firmware ficar pronto...');
    await resetToApplication(port, sleep);
    const identity = await identify(identifyTimeout);
    if (!identity) {
      if (bootloader) throw new Error('A placa ficou em modo de gravação. Solte o botão BOOT, pressione EN/RESET e tente novamente.');
      if (receivedFirmware) throw new Error('A placa iniciou, mas não respondeu à identificação USB. Confira se gravou o firmware-base atual do painel.');
      throw new Error('Sem resposta da placa. Confira a porta USB, feche o Monitor Serial e reconecte o cabo antes de tentar novamente.');
    }
    onProgress(`Firmware ${identity.firmware || ''} identificado. Salvando ${device.code}...`);
    const after = sequence;
    // Do not retry the write blindly: it saves flash and reboots the board.
    await send(`EMP_PROVISION:${JSON.stringify({ code: device.code, token: device.token })}`);
    const ack = await waitFor(line => line === `EMP_PROVISION_OK:${device.code}` || line.startsWith('EMP_PROVISION_ERROR:'), ackTimeout, after);
    if (!ack) throw new Error('O firmware respondeu, mas não confirmou a gravação da identidade. Tente configurar novamente; não é necessário criar outro dispositivo.');
    if (ack.startsWith('EMP_PROVISION_ERROR:')) {
      const reason = ack.slice('EMP_PROVISION_ERROR:'.length);
      throw new Error(firmwareErrors[reason] || 'O ESP32 recusou a configuração.');
    }
    onProgress('Identidade salva. Conferindo a configuração após o reinício...');
    // Existing firmware flushes the acknowledgement and reboots after 700 ms.
    await sleep(1000);
    const confirmed = await identify(rebootTimeout, value => value.deviceCode === device.code && value.provisioned === true);
    if (!confirmed) throw new Error('A identidade foi salva, mas não foi possível conferir o reinício. Reconecte o cabo e configure novamente o mesmo dispositivo.');
    return confirmed;
  } finally {
    closed = true;
    try { await reader?.cancel(); } catch {}
    await pump;
    try { reader?.releaseLock(); } catch {}
    if (opened) {
      try { await port.setSignals({ dataTerminalReady: false, requestToSend: false }); } catch {}
      try { await port.close(); } catch {}
    }
  }
}
