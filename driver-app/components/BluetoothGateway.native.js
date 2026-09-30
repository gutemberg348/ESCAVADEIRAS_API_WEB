import React, { useEffect, useRef, useState } from 'react';
import { AppState, PermissionsAndroid, Platform, Pressable, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { Buffer } from 'buffer';
import { API_URL, api } from '../services/api';
import { BLE_SERVICE, BLE_RX, BLE_TX, createFrameDecoder } from '../services/bleProtocol';
import * as store from '../services/gatewayStorage';

export default function BluetoothGateway({ session, theme }) {
  const [devices, setDevices] = useState([]);
  const [status, setStatus] = useState('Bluetooth desconectado');
  const [latest, setLatest] = useState(null);
  const [rfid, setRfid] = useState('Aguardando cartão');
  const [counts, setCounts] = useState({ total: 0, rejected: 0 });
  const [error, setError] = useState('');
  const [syncStatus, setSyncStatus] = useState('Aguardando sincronização');
  const [connected, setConnected] = useState(false);
  const manager = useRef(null), deviceRef = useRef(null), monitor = useRef(null), disconnectListener = useRef(null);
  const scanTimer = useRef(null), processing = useRef(Promise.resolve()), syncing = useRef(false), alive = useRef(true);
  const owner = `${API_URL}:${session.user.id}`;
  const knownRef = useRef([]);
  const updateCounts = async () => { const value = await store.stats(owner); if (alive.current) setCounts(value); };

  async function sync() {
    if (syncing.current || !alive.current || AppState.currentState !== 'active') return;
    syncing.current = true;
    try {
      const rows = await store.pending(owner);
      let refused = 0;
      for (const row of rows) {
        if (!alive.current) break;
        try {
          const result = await api('/gateway/batch', { method: 'POST', body: JSON.stringify({ records: [JSON.parse(row.body)] }) }, session.accessToken);
          const ack = result.accepted?.find(item => item.deviceCode === row.device && item.eventId === row.event);
          if (!ack) throw new Error('Servidor não confirmou a leitura');
          await store.confirm(owner, row.device, row.event);
          if (ack.rfid && alive.current) setRfid(ack.rfid.status === 'AUTHORIZED' ? `Identificado: ${ack.rfid.driver?.name}` : ack.rfid.status === 'CAPTURED' ? 'Cartão capturado para cadastro' : 'Cartão não autorizado');
          else if (ack.historical && alive.current && JSON.parse(JSON.parse(row.body).raw).kind === 'rfid') setRfid('Cartão offline enviado ao histórico. Aproxime novamente online para identificar o operador.');
        } catch (err) {
          if ([400, 403].includes(err.status)) { refused++; await store.reject(owner, row.device, row.event, err.message); if (alive.current) setError(err.message); continue; }
          throw err;
        }
      }
      if (alive.current) setSyncStatus(refused ? `${refused} leituras recusadas, preservadas para revisão` : rows.length ? 'Envio confirmado pelo servidor' : 'Nenhuma leitura pendente');
    } catch (err) { if (alive.current) setSyncStatus(err.status === 401 ? 'Sessão expirada: entre novamente para enviar. Leituras preservadas.' : 'Sem acesso ao servidor: leituras guardadas no celular'); }
    finally { syncing.current = false; await updateCounts(); }
  }

  useEffect(() => {
    alive.current = true;
    store.cacheGet(`devices:${owner}`).then(items => { knownRef.current = items || []; }).catch(err => setError(err.message));
    api('/devices', {}, session.accessToken).then(async items => { knownRef.current = items; await store.cacheSet(`devices:${owner}`, items); }).catch(() => {});
    updateCounts().catch(err => setError(err.message));
    const timer = setInterval(() => sync(), 5000);
    const stateListener = AppState.addEventListener('change', state => { if (state === 'active') sync(); });
    return () => {
      alive.current = false; clearInterval(timer); clearTimeout(scanTimer.current); stateListener.remove();
      monitor.current?.remove(); disconnectListener.current?.remove(); manager.current?.stopDeviceScan();
      manager.current?.destroy(); manager.current = null;
    };
  }, [owner, session.accessToken]);

  async function scan() {
    setError('');
    try {
      if (Constants.appOwnership === 'expo') throw new Error('Instale o APK Bluetooth. O Expo Go não inclui este módulo.');
      if (Platform.OS === 'android') {
        const permissions = Platform.Version >= 31 ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT, PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION, PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
        const result = await PermissionsAndroid.requestMultiple(permissions);
        if (permissions.some(permission => result[permission] !== PermissionsAndroid.RESULTS.GRANTED)) throw new Error('Permita dispositivos próximos e localização precisa; mantenha Bluetooth e localização ligados para procurar a máquina.');
      }
      if (!manager.current) { const { BleManager } = require('react-native-ble-plx'); manager.current = new BleManager(); }
      let adapterState = await manager.current.state();
      for (let attempt = 0; adapterState === 'Unknown' && attempt < 10; attempt++) { await new Promise(resolve => setTimeout(resolve, 200)); adapterState = await manager.current.state(); }
      if (adapterState !== 'PoweredOn') throw new Error('Ative o Bluetooth do celular e tente novamente.');
      setDevices([]); setStatus('Procurando máquinas por 12 segundos...');
      manager.current.startDeviceScan([BLE_SERVICE], null, (err, device) => {
        if (!alive.current) return;
        if (err) { setError(err.message); return; }
        if (device) setDevices(current => current.some(item => item.id === device.id) ? current : [...current, { id: device.id, name: device.name || device.localName || 'ESP32' }]);
      });
      clearTimeout(scanTimer.current);
      scanTimer.current = setTimeout(() => { manager.current?.stopDeviceScan(); if (alive.current) setStatus('Selecione a máquina encontrada'); }, 12000);
    } catch (err) { setError(err.message); }
  }

  async function connect(item) {
    setError(''); manager.current.stopDeviceScan(); clearTimeout(scanTimer.current); setStatus('Conectando; aceite o pareamento se solicitado');
    try {
      monitor.current?.remove(); disconnectListener.current?.remove();
      if (deviceRef.current) await deviceRef.current.cancelConnection().catch(() => {});
      let device = await manager.current.connectToDevice(item.id, { timeout: 15000 });
      deviceRef.current = device;
      if (Platform.OS === 'android') device = await device.requestMTU(185);
      if (device.mtu < 100) throw new Error('ESP32 não negociou o tamanho de pacote necessário. Reconecte para tentar novamente.');
      device = await device.discoverAllServicesAndCharacteristics();
      // An encrypted write triggers Android bonding before subscribing to encrypted CCCD.
      await device.writeCharacteristicWithResponseForService(BLE_SERVICE, BLE_RX, Buffer.from('HELLO').toString('base64'));
      const decode = createFrameDecoder(packet => {
        processing.current = processing.current.then(async () => {
          if (!alive.current) return;
          const known = knownRef.current.find(value => value.deviceCode === packet.frame.deviceCode && value.active);
          if (!known) throw new Error('Dispositivo não consta no cadastro salvo. Conecte à API uma vez e reabra a coleta.');
          await store.enqueue(owner, packet); // Commit to SQLite before acknowledging the ESP32.
          if (packet.frame.kind === 'telemetry') setLatest({ ...packet.frame.data, code: packet.frame.deviceCode, time: packet.capturedAt });
          else setRfid(`UID ${packet.frame.data.code} guardado; aguardando validação do servidor`);
          await device.writeCharacteristicWithResponseForService(BLE_SERVICE, BLE_RX, Buffer.from(`ACK:${packet.frame.eventId}`).toString('base64'));
          await updateCounts();
        }).catch(err => { if (alive.current) setError(err.message); });
      });
      monitor.current = device.monitorCharacteristicForService(BLE_SERVICE, BLE_TX, (err, characteristic) => {
        if (err) { if (alive.current) setError(err.message); return; }
        if (characteristic?.value) { try { decode(Buffer.from(characteristic.value, 'base64').toString('utf8')); } catch (decodeError) { setError(decodeError.message); } }
      });
      disconnectListener.current = manager.current.onDeviceDisconnected(device.id, () => { if (alive.current) { setConnected(false); setStatus('Bluetooth desconectado. Reconecte para retomar a coleta.'); } });
      setConnected(true); setStatus(`Conectado: ${item.name}`); setDevices([]);
    } catch (err) { setConnected(false); setError(err.message); deviceRef.current?.cancelConnection().catch(() => {}); }
  }

  const textStyle = { color: theme.text, fontSize: 13, marginBottom: 8 };
  const buttonStyle = { padding: 12, borderRadius: 10, backgroundColor: theme.accent, marginTop: 8 };
  return <View style={{ padding: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, marginBottom: 18 }}>
    <Text style={[textStyle, { fontWeight: '800', fontSize: 17 }]}>Máquina por Bluetooth</Text>
    <Text style={textStyle}>{status}</Text>
    <Text style={textStyle}>{counts.total} leituras no celular · {counts.rejected || 0} exigem revisão</Text>
    <Text style={textStyle}>{syncStatus}</Text>
    <Text style={textStyle}>{rfid}</Text>
    {latest && <Text style={textStyle}>{latest.code} · {latest.voltage?.toFixed(2) ?? '—'} V · {latest.current?.toFixed(2) ?? 'não calibrado'} A{ '\n' }{latest.metadata?.gpsValid ? `${latest.latitude}, ${latest.longitude}` : 'GPS aguardando posição'}{ '\n' }Leitura local: {new Date(latest.time).toLocaleTimeString()} (validação no servidor)</Text>}
    {!!error && <Text style={{ color: theme.danger, marginBottom: 8 }}>{error}</Text>}
    {!connected ? <Pressable style={buttonStyle} onPress={scan}><Text style={{ color: theme.accentText }}>Procurar ESP32</Text></Pressable> : <Pressable style={buttonStyle} onPress={() => deviceRef.current?.cancelConnection()}><Text style={{ color: theme.accentText }}>Desconectar Bluetooth</Text></Pressable>}
    {devices.map(item => <Pressable key={item.id} style={buttonStyle} onPress={() => connect(item)}><Text style={{ color: theme.accentText }}>{item.name} · conectar</Text></Pressable>)}
    <Pressable style={buttonStyle} onPress={async () => { try { await store.retryRejected(owner); await sync(); } catch (err) { setError(err.message); } }}><Text style={{ color: theme.accentText }}>Sincronizar agora</Text></Pressable>
    <Text style={{ color: theme.textSecondary, fontSize: 11, marginTop: 10 }}>Mantenha este app aberto durante a coleta. Sem internet, os dados ficam neste celular. O painel recebe quando a conexão volta. Cartão offline não libera nem desliga a máquina.</Text>
  </View>;
}
