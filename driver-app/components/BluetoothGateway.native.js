import React, { useEffect, useRef, useState } from 'react';
import { AppState, PermissionsAndroid, Platform, Pressable, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { Buffer } from 'buffer';
import {
  Bluetooth,
  Check,
  CheckCircle2,
  CreditCard,
  RefreshCw,
  Signal,
  Truck,
  WifiOff,
} from 'lucide-react-native';
import { API_URL, api } from '../services/api';
import { BLE_SERVICE, BLE_RX, BLE_TX, createFrameDecoder } from '../services/bleProtocol';
import * as store from '../services/gatewayStorage';

export default function BluetoothGateway({ session, machine, theme }) {
  const [devices, setDevices] = useState([]);
  const [status, setStatus] = useState('Bluetooth desconectado');
  const [latest, setLatest] = useState(null);
  const [rfid, setRfid] = useState('Aguardando leitura do cartão');
  const [counts, setCounts] = useState({ total: 0, rejected: 0 });
  const [error, setError] = useState('');
  const [syncStatus, setSyncStatus] = useState('Sem leituras pendentes');
  const [connected, setConnected] = useState(false);
  const [scanning, setScanning] = useState(false);
  const manager = useRef(null);
  const deviceRef = useRef(null);
  const monitor = useRef(null);
  const disconnectListener = useRef(null);
  const scanTimer = useRef(null);
  const processing = useRef(Promise.resolve());
  const syncing = useRef(false);
  const alive = useRef(true);
  const owner = `${API_URL}:${session.user.id}`;
  const knownRef = useRef([]);

  const updateCounts = async () => {
    const value = await store.stats(owner);
    if (alive.current) setCounts(value);
  };

  async function sync() {
    if (syncing.current || !alive.current || AppState.currentState !== 'active') return;
    syncing.current = true;
    try {
      const rows = await store.pending(owner);
      let refused = 0;
      for (const row of rows) {
        if (!alive.current) break;
        try {
          const result = await api(
            '/gateway/batch',
            {
              method: 'POST',
              body: JSON.stringify({ records: [JSON.parse(row.body)] }),
            },
            session.accessToken,
          );
          const ack = result.accepted?.find(
            (item) => item.deviceCode === row.device && item.eventId === row.event,
          );
          if (!ack) throw new Error('O servidor não confirmou esta leitura.');
          await store.confirm(owner, row.device, row.event);
          if (ack.rfid && alive.current) {
            if (ack.rfid.status === 'AUTHORIZED') {
              setRfid(`Operador identificado: ${ack.rfid.driver?.name || 'cartão autorizado'}`);
            } else if (ack.rfid.status === 'CAPTURED') {
              setRfid('Cartão lido e enviado para o cadastro no painel.');
            } else {
              setRfid('Cartão não autorizado para esta empresa.');
            }
          } else if (
            ack.historical &&
            alive.current &&
            JSON.parse(JSON.parse(row.body).raw).kind === 'rfid'
          ) {
            setRfid('Leitura offline salva. Com internet, aproxime o cartão novamente para iniciar.');
          }
        } catch (err) {
          if ([400, 403].includes(err.status)) {
            refused += 1;
            await store.reject(owner, row.device, row.event, err.message);
            if (alive.current) setError(err.message);
            continue;
          }
          throw err;
        }
      }
      if (alive.current) {
        setSyncStatus(
          refused
            ? `${refused} leitura${refused === 1 ? '' : 's'} precisa${refused === 1 ? '' : 'm'} de revisão`
            : rows.length
              ? 'Dados confirmados pelo servidor'
              : 'Tudo sincronizado',
        );
      }
    } catch (err) {
      if (alive.current) {
        setSyncStatus(
          err.status === 401
            ? 'Sessão expirada. As leituras continuam salvas no celular.'
            : 'Sem internet. As leituras estão protegidas no celular.',
        );
      }
    } finally {
      syncing.current = false;
      await updateCounts();
    }
  }

  useEffect(() => {
    alive.current = true;
    store
      .cacheGet(`devices:${owner}`)
      .then((items) => {
        knownRef.current = items || [];
      })
      .catch((err) => setError(err.message));
    api('/devices', {}, session.accessToken)
      .then(async (items) => {
        knownRef.current = items || [];
        await store.cacheSet(`devices:${owner}`, items || []);
      })
      .catch(() => {});
    updateCounts().catch((err) => setError(err.message));
    const timer = setInterval(() => sync(), 5000);
    const stateListener = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    return () => {
      alive.current = false;
      clearInterval(timer);
      clearTimeout(scanTimer.current);
      stateListener.remove();
      monitor.current?.remove();
      disconnectListener.current?.remove();
      manager.current?.stopDeviceScan();
      manager.current?.destroy();
      manager.current = null;
    };
  }, [owner, session.accessToken]);

  async function scan() {
    setError('');
    setDevices([]);
    try {
      if (Constants.appOwnership === 'expo') {
        throw new Error('Esta função precisa do APK Empimecatrônic; o Expo Go não inclui Bluetooth.');
      }
      if (Platform.OS === 'android') {
        const permissions =
          Platform.Version >= 31
            ? [
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
              ]
            : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
        const result = await PermissionsAndroid.requestMultiple(permissions);
        if (permissions.some((permission) => result[permission] !== PermissionsAndroid.RESULTS.GRANTED)) {
          throw new Error('Permita Bluetooth, dispositivos próximos e localização para encontrar a máquina.');
        }
      }
      if (!manager.current) {
        const { BleManager } = require('react-native-ble-plx');
        manager.current = new BleManager();
      }
      let adapterState = await manager.current.state();
      for (let attempt = 0; adapterState === 'Unknown' && attempt < 10; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        adapterState = await manager.current.state();
      }
      if (adapterState !== 'PoweredOn') throw new Error('Ative o Bluetooth do celular e tente novamente.');
      setScanning(true);
      setStatus('Procurando escavadeiras próximas...');
      manager.current.startDeviceScan([BLE_SERVICE], null, (err, device) => {
        if (!alive.current) return;
        if (err) {
          setScanning(false);
          setError(err.message);
          return;
        }
        if (!device) return;
        const advertisedName = device.name || device.localName || '';
        const deviceCode = advertisedName.replace(/^EMP-/i, '');
        const known = knownRef.current.find(
          (item) => item.active && item.deviceCode.toUpperCase() === deviceCode.toUpperCase(),
        );
        if (!known) return;
        const found = {
          id: device.id,
          name: advertisedName,
          deviceCode: known.deviceCode,
          machine: known.machine,
        };
        setDevices((current) =>
          current.some((item) => item.id === device.id) ? current : [...current, found],
        );
      });
      clearTimeout(scanTimer.current);
      scanTimer.current = setTimeout(() => {
        manager.current?.stopDeviceScan();
        if (alive.current) {
          setScanning(false);
          setStatus('Busca concluída');
        }
      }, 12000);
    } catch (err) {
      setScanning(false);
      setError(err.message);
    }
  }

  async function connect(item) {
    setError('');
    manager.current?.stopDeviceScan();
    clearTimeout(scanTimer.current);
    setScanning(false);
    setStatus('Conectando à escavadeira...');
    try {
      monitor.current?.remove();
      disconnectListener.current?.remove();
      if (deviceRef.current) await deviceRef.current.cancelConnection().catch(() => {});
      let device = await manager.current.connectToDevice(item.id, { timeout: 15000 });
      deviceRef.current = device;
      if (Platform.OS === 'android') device = await device.requestMTU(185);
      if (device.mtu < 100) {
        throw new Error('A conexão Bluetooth não negociou o pacote necessário. Tente reconectar.');
      }
      device = await device.discoverAllServicesAndCharacteristics();
      await device.writeCharacteristicWithResponseForService(
        BLE_SERVICE,
        BLE_RX,
        Buffer.from('HELLO').toString('base64'),
      );
      const decode = createFrameDecoder((packet) => {
        processing.current = processing.current
          .then(async () => {
            if (!alive.current) return;
            const known = knownRef.current.find(
              (value) => value.deviceCode === packet.frame.deviceCode && value.active,
            );
            if (!known) {
              throw new Error('Este ESP32 ainda não está cadastrado para sua empresa.');
            }
            await store.enqueue(owner, packet);
            if (packet.frame.kind === 'telemetry') {
              setLatest({ ...packet.frame.data, code: packet.frame.deviceCode, time: packet.capturedAt });
            } else {
              setRfid('Cartão lido. Validando operador no servidor...');
            }
            await device.writeCharacteristicWithResponseForService(
              BLE_SERVICE,
              BLE_RX,
              Buffer.from(`ACK:${packet.frame.eventId}`).toString('base64'),
            );
            await updateCounts();
            void sync();
          })
          .catch((err) => {
            if (alive.current) setError(err.message);
          });
      });
      monitor.current = device.monitorCharacteristicForService(
        BLE_SERVICE,
        BLE_TX,
        (err, characteristic) => {
          if (err) {
            if (alive.current) setError(err.message);
            return;
          }
          if (!characteristic?.value) return;
          try {
            decode(Buffer.from(characteristic.value, 'base64').toString('utf8'));
          } catch (decodeError) {
            setError(decodeError.message);
          }
        },
      );
      disconnectListener.current = manager.current.onDeviceDisconnected(device.id, () => {
        if (alive.current) {
          setConnected(false);
          setStatus('Bluetooth desconectado');
        }
      });
      setConnected(true);
      setStatus(`Conectado a ${item.machine?.code || item.deviceCode}`);
      setDevices([]);
    } catch (err) {
      setConnected(false);
      setError(err.message);
      deviceRef.current?.cancelConnection().catch(() => {});
    }
  }

  const active = Boolean(machine);
  const title = active
    ? `Operação ativa em ${machine.code}`
    : connected
      ? 'Aproxime seu cartão RFID'
      : 'Conecte à escavadeira';
  const description = active
    ? `${machine.name} está vinculada ao seu usuário. A telemetria já pode ser acompanhada.`
    : connected
      ? 'Encoste o cartão cadastrado no leitor da máquina. O servidor identifica você automaticamente.'
      : 'Ligue a máquina, mantenha o aplicativo aberto e procure o ESP32 próximo.';
  const headerColor = active ? theme.success : connected ? theme.accent : theme.textSecondary;
  const HeaderIcon = active ? CheckCircle2 : connected ? CreditCard : Bluetooth;

  return (
    <View
      style={{
        padding: 17,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: active ? theme.success : theme.border,
        backgroundColor: theme.surface,
        marginBottom: 18,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 13,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: active ? theme.successSoft : theme.surfaceSoft,
          }}
        >
          <HeaderIcon size={22} color={headerColor} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: headerColor, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 }}>
            IDENTIFICAÇÃO DA OPERAÇÃO
          </Text>
          <Text style={{ color: theme.text, fontSize: 17, fontWeight: '900', marginTop: 3 }}>
            {title}
          </Text>
        </View>
      </View>

      <Text style={{ color: theme.textSecondary, fontSize: 11, lineHeight: 17, marginTop: 13 }}>
        {description}
      </Text>

      <View style={{ flexDirection: 'row', marginTop: 17, marginBottom: 15 }}>
        <JourneyStep number="1" label="Conectar" done={connected || active} theme={theme} />
        <JourneyStep number="2" label="Ler cartão" done={active} theme={theme} />
        <JourneyStep number="3" label="Iniciar" done={active} theme={theme} last />
      </View>

      {!active && !connected ? (
        <ActionButton
          label={scanning ? 'Procurando máquinas...' : 'Procurar escavadeira'}
          icon={scanning ? Signal : Bluetooth}
          onPress={scan}
          disabled={scanning}
          theme={theme}
        />
      ) : null}

      {devices.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          onPress={() => connect(item)}
          style={({ pressed }) => ({
            minHeight: 54,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.accent,
            backgroundColor: theme.surfaceRaised,
            paddingHorizontal: 13,
            marginTop: 9,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 11,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Truck size={19} color={theme.accent} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontSize: 12, fontWeight: '900' }}>
              {item.machine?.code || item.deviceCode}
            </Text>
            <Text style={{ color: theme.textSecondary, fontSize: 10, marginTop: 2 }}>
              {item.machine?.name || 'ESP32 cadastrado'}
            </Text>
          </View>
          <Text style={{ color: theme.accent, fontSize: 9, fontWeight: '900' }}>CONECTAR</Text>
        </Pressable>
      ))}

      {!active && scanning && devices.length === 0 ? (
        <Text style={{ color: theme.textMuted, fontSize: 10, textAlign: 'center', marginTop: 11 }}>
          A busca dura até 12 segundos. Aproxime-se da escavadeira.
        </Text>
      ) : null}

      {connected && !active ? (
        <View
          style={{
            backgroundColor: theme.warningSoft,
            borderRadius: 12,
            padding: 13,
            marginTop: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <CreditCard size={20} color={theme.warning} />
          <Text style={{ color: theme.warning, flex: 1, fontSize: 10.5, lineHeight: 16, fontWeight: '700' }}>
            {rfid}
          </Text>
        </View>
      ) : null}

      {latest ? (
        <View
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: theme.border,
            flexDirection: 'row',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <MiniMetric label="TENSÃO" value={`${latest.voltage?.toFixed(2) ?? '—'} V`} theme={theme} />
          <MiniMetric label="CORRENTE" value={`${latest.current?.toFixed(2) ?? '—'} A`} theme={theme} />
          <MiniMetric label="GPS" value={latest.metadata?.gpsValid ? 'Válido' : 'Buscando'} theme={theme} />
        </View>
      ) : null}

      {error ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 9,
            backgroundColor: theme.dangerSoft,
            borderRadius: 11,
            padding: 12,
            marginTop: 11,
          }}
        >
          <WifiOff size={17} color={theme.danger} />
          <Text style={{ color: theme.danger, flex: 1, fontSize: 10.5, lineHeight: 15 }}>{error}</Text>
        </View>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginTop: 14,
          paddingTop: 13,
          borderTopWidth: 1,
          borderTopColor: theme.border,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.textSecondary, fontSize: 9, fontWeight: '800' }}>{syncStatus}</Text>
          <Text style={{ color: theme.textMuted, fontSize: 8.5, marginTop: 3 }}>
            {counts.total} pendente{counts.total === 1 ? '' : 's'} no celular
            {counts.rejected ? ` · ${counts.rejected} para revisar` : ''}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sincronizar agora"
          onPress={async () => {
            try {
              setError('');
              await store.retryRejected(owner);
              await sync();
            } catch (err) {
              setError(err.message);
            }
          }}
          style={{
            minWidth: 44,
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 11,
            backgroundColor: theme.surfaceSoft,
          }}
        >
          <RefreshCw size={17} color={theme.textSecondary} />
        </Pressable>
      </View>

      {connected ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => deviceRef.current?.cancelConnection()}
          style={{ alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 10, marginTop: 4 }}
        >
          <Text style={{ color: theme.textMuted, fontSize: 9, fontWeight: '800' }}>DESCONECTAR BLUETOOTH</Text>
        </Pressable>
      ) : null}

      <Text style={{ color: theme.textMuted, fontSize: 8.5, lineHeight: 13, marginTop: 5 }}>
        Sem internet, a telemetria fica salva no celular. Por segurança, a operação só é iniciada quando o servidor valida o cartão.
      </Text>
    </View>
  );
}

function JourneyStep({ number, label, done, last, theme }) {
  return (
    <View style={{ flex: last ? 0 : 1, flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ alignItems: 'center' }}>
        <View
          style={{
            width: 27,
            height: 27,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: done ? theme.success : theme.surfaceSoft,
          }}
        >
          {done ? (
            <Check size={14} color="#FFFFFF" strokeWidth={3} />
          ) : (
            <Text style={{ color: theme.textSecondary, fontSize: 10, fontWeight: '900' }}>{number}</Text>
          )}
        </View>
        <Text style={{ color: done ? theme.success : theme.textMuted, fontSize: 7.5, fontWeight: '800', marginTop: 5 }}>
          {label.toUpperCase()}
        </Text>
      </View>
      {!last ? (
        <View style={{ height: 1, backgroundColor: done ? theme.success : theme.border, flex: 1, marginHorizontal: 6, marginBottom: 14 }} />
      ) : null}
    </View>
  );
}

function ActionButton({ label, icon: Icon, onPress, disabled, theme }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 50,
        borderRadius: 12,
        backgroundColor: theme.accent,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 9,
        opacity: disabled ? 0.65 : pressed ? 0.82 : 1,
      })}
    >
      <Icon size={18} color={theme.accentText} />
      <Text style={{ color: theme.accentText, fontSize: 11, fontWeight: '900' }}>{label}</Text>
    </Pressable>
  );
}

function MiniMetric({ label, value, theme }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: theme.textMuted, fontSize: 7, fontWeight: '900', letterSpacing: 0.7 }}>{label}</Text>
      <Text style={{ color: theme.text, fontSize: 10.5, fontWeight: '800', marginTop: 3 }}>{value}</Text>
    </View>
  );
}
