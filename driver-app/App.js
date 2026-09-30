import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { io } from 'socket.io-client';
import {
  Activity,
  AlertTriangle,
  BatteryCharging,
  Building2,
  Clock3,
  Cpu,
  Gauge,
  HardHat,
  LogOut,
  MapPin,
  Navigation,
  Radio,
  RefreshCw,
  Server,
  Settings2,
  ShieldCheck,
  Signal,
  UserRound,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react-native';
import {
  AlertRow,
  BottomNav,
  EmptyState,
  Header,
  LocationCard,
  MetricCard,
  SectionHeader,
  StatusPill,
  TelemetryTrend,
  ThemeToggle,
} from './components/ui';
import {
  API_URL,
  SOCKET_URL,
  getAlerts,
  getCurrentMachine,
  getMachine,
  getProfile,
  signIn,
} from './services/api';
import { themes } from './theme';
import BluetoothGateway from './components/BluetoothGateway';
import { readSession, saveSession, cacheGet, cacheSet } from './services/gatewayStorage';
import { coordinates, formatNumber, greeting, timeAgo } from './utils/format';

const roleLabels = {
  DRIVER: 'Operador',
  COMPANY_ADMIN: 'Administrador',
  SUPER_ADMIN: 'Administrador da plataforma',
};

export default function App() {
  return (
    <SafeAreaProvider>
      <EmpimecatronicApp />
    </SafeAreaProvider>
  );
}

function EmpimecatronicApp() {
  const systemTheme = useColorScheme();
  const [mode, setMode] = useState(systemTheme === 'light' ? 'light' : 'dark');
  const [stage, setStage] = useState('splash');
  const [screen, setScreen] = useState('home');
  const [email, setEmail] = useState('motorista@demo.local');
  const [password, setPassword] = useState('Demo@123');
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [machine, setMachine] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [connection, setConnection] = useState('offline');
  const requestVersion = useRef(0);

  const theme = themes[mode];
  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    let cancelled = false;
    readSession().then(async saved => {
      if (cancelled) return;
      if (saved?.accessToken && saved.user && saved.apiUrl === API_URL) {
        setSession(saved); setProfile(saved.user);
        const cached = await cacheGet(`machine:${API_URL}:${saved.user.id}`);
        if (!cancelled) { setMachine(cached); setStage('app'); }
      } else setStage('login');
    }).catch(() => { if (!cancelled) setStage('login'); });
    return () => { cancelled = true; };
  }, []);

  const loadData = useCallback(async (token, isRefresh = false) => {
    if (!token) return;
    const version = ++requestVersion.current;
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError('');

    try {
      const [profileResult, assignmentResult, alertsResult] = await Promise.allSettled([
        getProfile(token),
        getCurrentMachine(token),
        getAlerts(token),
      ]);
      if (version !== requestVersion.current) return;

      if (profileResult.status === 'fulfilled') setProfile(profileResult.value);
      if (alertsResult.status === 'fulfilled') setAlerts(alertsResult.value || []);

      if (assignmentResult.status === 'rejected') throw assignmentResult.reason;
      if (!assignmentResult.value) {
        setMachine(null);
        if (session?.user?.id) await cacheSet(`machine:${API_URL}:${session.user.id}`, null);
        return;
      }

      const detail = await getMachine(assignmentResult.value.id, token);
      if (version !== requestVersion.current) return;
      setMachine(detail);
      if (session?.user?.id) await cacheSet(`machine:${API_URL}:${session.user.id}`, detail);
      setAlerts((current) => current.filter((alert) => alert.machineId === detail.id));
    } catch (requestError) {
      if (version !== requestVersion.current) return;
      setError(requestError.message || 'Não foi possível sincronizar os dados da operação.');
    } finally {
      if (version === requestVersion.current) { setLoading(false); setRefreshing(false); }
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (session?.accessToken) loadData(session.accessToken);
  }, [session, loadData]);

  useEffect(() => {
    if (!session?.accessToken) return undefined;

    setConnection('connecting');
    const socket = io(SOCKET_URL, {
      auth: { token: session.accessToken },
      transports: ['websocket', 'polling'],
      timeout: 10000,
    });

    socket.on('connect', () => {
      setConnection('live');
      if (machine?.id) socket.emit('machine:join', machine.id);
      loadData(session.accessToken, true);
    });
    socket.on('assignment:changed', () => { setMachine(null); setAlerts([]); loadData(session.accessToken, true); });
    socket.on('machine:rfid', data => setMachine(current => current && current.id === data.machineId ? { ...current, currentState: { ...current.currentState, rfidStatus: data.status, rfidCode: data.code } } : current));
    socket.on('disconnect', () => setConnection('offline'));
    socket.on('connect_error', () => setConnection('offline'));
    socket.on('machine:telemetry', (data) => {
      setConnection('live');
      setMachine((current) => current ? ({
        ...current,
        status: 'ONLINE',
        currentState: { ...current.currentState, ...data, online: true, updatedAt: data.timestamp },
        telemetry: [
          { id: `live-${data.timestamp}`, ...data },
          ...(current.telemetry || []),
        ].slice(0, 30),
      }) : current);
    });
    socket.on('machine:status', (data) => {
      setMachine((current) => current ? ({
        ...current,
        status: data.status,
        currentState: { ...current.currentState, ...data },
      }) : current);
    });
    socket.on('machine:alert', (alert) => {
      setAlerts((current) => [alert, ...current]);
    });
    socket.on('machine:driver', (data) => {
      if (!data.authorized) return;
      setMachine((current) => current ? ({
        ...current,
        assignments: [{ id: data.assignmentId, driverProfile: { user: data.driver } }],
      }) : current);
    });

    return () => socket.close();
  }, [session?.accessToken, machine?.id]);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Informe seu e-mail e sua senha.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const authenticated = await signIn(email.trim().toLowerCase(), password);
      await saveSession({ ...authenticated, apiUrl: API_URL });
      setSession(authenticated);
      setProfile(authenticated.user);
      setStage('app');
      setScreen('home');
    } catch (loginError) {
      setError(loginError.message || 'Não foi possível entrar.');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    requestVersion.current++;
    saveSession(null).catch(() => {});
    setSession(null);
    setProfile(null);
    setMachine(null);
    setAlerts([]);
    setConnection('offline');
    setStage('login');
    setScreen('home');
  };

  const toggleTheme = () => setMode((current) => current === 'dark' ? 'light' : 'dark');

  if (stage === 'splash') {
    return <Splash />;
  }

  if (stage === 'login') {
    return (
      <LoginScreen
        email={email}
        password={password}
        setEmail={setEmail}
        setPassword={setPassword}
        loading={loading}
        error={error}
        onLogin={handleLogin}
        mode={mode}
        theme={theme}
        styles={styles}
        onToggleTheme={toggleTheme}
      />
    );
  }

  const user = profile || session?.user;
  const firstName = user?.name?.split(' ')[0] || 'Operador';
  const refresh = () => loadData(session.accessToken, true);

  return (
    <SafeAreaView style={styles.app} edges={['top']}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={theme.accent}
            colors={[theme.success]}
          />
        )}
      >
        <Header
          user={user?.name || 'Operador'}
          theme={theme}
          mode={mode}
          onToggleTheme={toggleTheme}
          alertsCount={alerts.length}
          onAlerts={() => setScreen('alerts')}
        />

        {error ? (
          <ErrorBanner message={error} onRetry={refresh} theme={theme} styles={styles} />
        ) : null}

        <BluetoothGateway key={session.user.id} session={session} theme={theme} />

        {loading && !machine ? (
          <LoadingState theme={theme} styles={styles} />
        ) : (
          <ScreenContent
            screen={screen}
            setScreen={setScreen}
            firstName={firstName}
            profile={user}
            machine={machine}
            alerts={alerts}
            connection={connection}
            theme={theme}
            mode={mode}
            styles={styles}
            onRefresh={refresh}
            onToggleTheme={toggleTheme}
            onLogout={logout}
          />
        )}
      </ScrollView>
      <BottomNav active={screen} onChange={setScreen} theme={theme} alertsCount={alerts.length} />
    </SafeAreaView>
  );
}

function Splash() {
  return (
    <View style={staticStyles.splash}>
      <View style={staticStyles.splashMark}><Text style={staticStyles.splashLetter}>E</Text></View>
      <Text style={staticStyles.splashLogo}>EMPIMECATRÔNIC</Text>
      <Text style={staticStyles.splashCaption}>FIELD OPERATIONS</Text>
      <View style={staticStyles.splashLine}><View style={staticStyles.splashLineActive} /></View>
      <StatusBar style="light" />
    </View>
  );
}

function LoginScreen({ email, password, setEmail, setPassword, loading, error, onLogin, mode, theme, styles, onToggleTheme }) {
  return (
    <SafeAreaView style={styles.login} edges={['top', 'bottom']}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        style={styles.loginKeyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.loginScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.loginTopbar}>
            <View style={styles.loginBrand}>
              <View style={styles.loginBrandMark}><Text style={styles.loginBrandLetter}>E</Text></View>
              <Text style={styles.loginBrandName}>EMPIMECATRÔNIC</Text>
            </View>
            <ThemeToggle mode={mode} onToggle={onToggleTheme} theme={theme} />
          </View>

          <View style={styles.loginIntro}>
            <View style={styles.secureLabel}>
              <ShieldCheck size={13} color={theme.success} />
              <Text style={styles.secureLabelText}>ACESSO OPERACIONAL SEGURO</Text>
            </View>
            <Text style={styles.loginTitle}>Sua máquina.{`\n`}Seus dados. <Text style={styles.loginTitleAccent}>Agora.</Text></Text>
            <Text style={styles.loginCopy}>Telemetria, localização e alertas da sua operação em uma experiência feita para o campo.</Text>
          </View>

          <View style={styles.loginPanel}>
            <Text style={styles.loginPanelEyebrow}>IDENTIFICAÇÃO DO OPERADOR</Text>
            <Text style={styles.loginPanelTitle}>Entrar na operação</Text>

            <Text style={styles.inputLabel}>E-MAIL</Text>
            <View style={styles.inputWrap}>
              <UserRound size={17} color={theme.textMuted} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="operador@empresa.com"
                placeholderTextColor={theme.textMuted}
              />
            </View>

            <Text style={styles.inputLabel}>SENHA</Text>
            <View style={styles.inputWrap}>
              <ShieldCheck size={17} color={theme.textMuted} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Sua senha"
                placeholderTextColor={theme.textMuted}
                onSubmitEditing={onLogin}
              />
            </View>

            {error ? (
              <View style={styles.loginError}>
                <WifiOff size={15} color={theme.danger} />
                <Text style={styles.loginErrorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable disabled={loading} onPress={onLogin} style={({ pressed }) => [styles.loginButton, pressed && { opacity: .85 }]}>
              {loading ? <ActivityIndicator color={theme.accentText} /> : (
                <>
                  <Text style={styles.loginButtonText}>Acessar plataforma</Text>
                  <Navigation size={18} color={theme.accentText} />
                </>
              )}
            </Pressable>

            <View style={styles.serverLine}>
              <Server size={12} color={theme.textMuted} />
              <Text numberOfLines={1} style={styles.serverText}>{API_URL.replace('/api/v1', '')}</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ScreenContent(props) {
  switch (props.screen) {
    case 'machine': return <MachineScreen {...props} />;
    case 'map': return <MapScreen {...props} />;
    case 'alerts': return <AlertsScreen {...props} />;
    case 'profile': return <ProfileScreen {...props} />;
    default: return <HomeScreen {...props} />;
  }
}

function HomeScreen({ firstName, profile, machine, alerts, connection, theme, styles, setScreen, onRefresh }) {
  if (!machine) {
    return (
      <>
        <PageIntro eyebrow={`${greeting()}, ${firstName}`} title="Operação de campo" subtitle={profile?.company?.name || 'Conta conectada'} theme={theme} styles={styles} />
        <EmptyState
          icon={HardHat}
          title="Nenhuma máquina vinculada"
          description="Seu acesso está ativo, mas ainda não existe uma escavadeira associada à sua operação. Solicite o vínculo ao administrador da empresa."
          theme={theme}
          action="Verificar novamente"
          onAction={onRefresh}
        />
      </>
    );
  }

  const state = machine.currentState || {};
  const latestAlert = alerts[0];
  return (
    <>
      <PageIntro
        eyebrow={`${greeting()}, ${firstName}`}
        title="Operação em tempo real"
        subtitle={`${profile?.company?.name || machine.company?.name || 'Frota'} · ${connection === 'live' ? 'Canal ao vivo conectado' : 'Sincronização REST ativa'}`}
        theme={theme}
        styles={styles}
        live={connection === 'live'}
      />

      <Pressable onPress={() => setScreen('machine')} style={styles.heroCard}>
        <View style={styles.heroGlow} />
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroEyebrow}>EQUIPAMENTO VINCULADO</Text>
            <Text style={styles.heroCode}>{machine.code}</Text>
            <Text style={styles.heroName}>{machine.name}</Text>
          </View>
          <StatusPill status={machine.status} theme={themes.dark} />
        </View>
        <View style={styles.heroMetaRow}>
          <View style={styles.heroMetaItem}>
            <Cpu size={15} color="#AAB7AE" />
            <View><Text style={styles.heroMetaLabel}>MODELO</Text><Text style={styles.heroMetaValue}>{machine.brand || '—'} {machine.model || ''}</Text></View>
          </View>
          <View style={styles.heroMetaDivider} />
          <View style={styles.heroMetaItem}>
            <Clock3 size={15} color="#AAB7AE" />
            <View><Text style={styles.heroMetaLabel}>ATUALIZAÇÃO</Text><Text style={styles.heroMetaValue}>{timeAgo(state.updatedAt)}</Text></View>
          </View>
        </View>
        <View style={styles.heroAction}>
          <Text style={styles.heroActionText}>Abrir painel da máquina</Text>
          <Gauge size={18} color="#172000" />
        </View>
      </Pressable>

      <SectionHeader eyebrow="Leitura instantânea" title="Telemetria principal" theme={theme} action="Detalhes" onAction={() => setScreen('machine')} />
      <View style={styles.metricGrid}>
        <MetricCard icon={BatteryCharging} label="Tensão" value={state.voltage} unit="V" detail="Sistema elétrico" theme={theme} />
        <MetricCard icon={Zap} label="Corrente" value={state.current} unit="A" detail="Consumo instantâneo" theme={theme} />
        <MetricCard icon={Gauge} label="Velocidade" value={state.speed} unit="km/h" detail="Movimento atual" theme={theme} />
        <MetricCard icon={Signal} label="Sinal Wi-Fi" value={state.signalStrength} unit="dBm" detail={signalQuality(state.signalStrength)} theme={theme} />
      </View>

      <SectionHeader eyebrow="Geolocalização" title="Posição da máquina" theme={theme} action="Tela cheia" onAction={() => setScreen('map')} />
      <LocationCard machine={machine} theme={theme} onPress={() => setScreen('map')} />

      <SectionHeader eyebrow="Segurança operacional" title="Alertas recentes" theme={theme} action="Ver todos" onAction={() => setScreen('alerts')} />
      <View style={styles.listCard}>
        {latestAlert ? <AlertRow alert={latestAlert} theme={theme} /> : (
          <View style={styles.allClear}>
            <View style={styles.allClearIcon}><ShieldCheck size={20} color={theme.success} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.allClearTitle}>Operação sem alertas</Text>
              <Text style={styles.allClearCopy}>Nenhuma ocorrência aberta para esta máquina.</Text>
            </View>
          </View>
        )}
      </View>
    </>
  );
}

function MachineScreen({ machine, theme, styles, onRefresh }) {
  if (!machine) return <EmptyState icon={HardHat} title="Máquina não vinculada" description="Vincule uma máquina para visualizar a telemetria." theme={theme} action="Atualizar" onAction={onRefresh} />;
  const state = machine.currentState || {};
  return (
    <>
      <PageIntro eyebrow="Ativo operacional" title="Minha máquina" subtitle={`${machine.company?.name || 'Empresa'} · ${machine.code}`} theme={theme} styles={styles} />
      <View style={styles.machineCard}>
        <View style={styles.machineCardTop}>
          <View style={styles.machineIdentity}>
            <View style={styles.machineIcon}><HardHat size={24} color={theme.accentText} /></View>
            <View><Text style={styles.machineCardCode}>{machine.code}</Text><Text style={styles.machineCardName}>{machine.name}</Text></View>
          </View>
          <StatusPill status={machine.status} theme={theme} />
        </View>
        <View style={styles.machineSpecs}>
          <InfoItem label="FABRICANTE" value={machine.brand || 'Não informado'} theme={theme} styles={styles} />
          <InfoItem label="MODELO" value={machine.model || 'Não informado'} theme={theme} styles={styles} />
          <InfoItem label="ANO" value={machine.year || '—'} theme={theme} styles={styles} />
          <InfoItem label="FIRMWARE" value={machine.device?.firmwareVersion || '—'} theme={theme} styles={styles} />
          <InfoItem label="CARTÃO RFID" value={state.rfidCode || 'Aguardando leitura'} theme={theme} styles={styles} />
          <InfoItem label="OPERADOR IDENTIFICADO" value={machine.assignments?.[0]?.driverProfile?.user?.name || 'Aproxime seu cartão'} theme={theme} styles={styles} />
        </View>
      </View>

      <SectionHeader eyebrow="Sensores conectados" title="Estado atual" theme={theme} />
      <View style={styles.metricGrid}>
        <MetricCard icon={BatteryCharging} label="Tensão" value={state.voltage} unit="V" detail="Circuito principal" theme={theme} />
        <MetricCard icon={Activity} label="Corrente" value={state.current} unit="A" detail="Carga do sistema" theme={theme} />
        <MetricCard icon={Gauge} label="Velocidade" value={state.speed} unit="km/h" detail="Deslocamento" theme={theme} />
        <MetricCard icon={Radio} label="Sinal" value={state.signalStrength} unit="dBm" detail={signalQuality(state.signalStrength)} theme={theme} />
      </View>

      <SectionHeader eyebrow="Análise operacional" title="Comportamento recente" theme={theme} />
      <TelemetryTrend telemetry={machine.telemetry} theme={theme} />

      <SectionHeader eyebrow="Diagnóstico" title="Saúde dos sistemas" theme={theme} />
      <View style={styles.listCard}>
        <HealthRow icon={Wifi} label="Comunicação IoT" value={machine.status === 'ONLINE' ? 'Operacional' : 'Sem conexão'} healthy={machine.status === 'ONLINE'} theme={theme} styles={styles} />
        <HealthRow icon={MapPin} label="Posicionamento GPS" value={state.latitude != null ? 'Posição recebida' : 'Aguardando sinal'} healthy={state.latitude != null} theme={theme} styles={styles} />
        <HealthRow icon={Cpu} label="Dispositivo ESP32" value={machine.device?.deviceCode || 'Não vinculado'} healthy={Boolean(machine.device)} theme={theme} styles={styles} last />
      </View>
    </>
  );
}

function MapScreen({ machine, theme, styles, onRefresh }) {
  if (!machine) return <EmptyState icon={MapPin} title="Localização indisponível" description="Nenhuma máquina está vinculada à operação." theme={theme} action="Atualizar" onAction={onRefresh} />;
  const state = machine.currentState || {};
  return (
    <>
      <PageIntro eyebrow="Rastreamento" title="Localização" subtitle={`${machine.code} · posição informada pelo GPS`} theme={theme} styles={styles} />
      <LocationCard machine={machine} theme={theme} large />
      <View style={styles.locationSummary}>
        <View style={styles.locationSummaryHead}>
          <View style={styles.locationMachineIcon}><Navigation size={22} color={theme.accentText} /></View>
          <View style={{ flex: 1 }}><Text style={styles.locationMachineCode}>{machine.code}</Text><Text style={styles.locationMachineName}>{machine.name}</Text></View>
          <StatusPill status={machine.status} theme={theme} />
        </View>
        <View style={styles.locationRows}>
          <InfoLine icon={MapPin} label="Coordenadas" value={coordinates(state.latitude, state.longitude)} theme={theme} styles={styles} />
          <InfoLine icon={Gauge} label="Velocidade atual" value={`${formatNumber(state.speed)} km/h`} theme={theme} styles={styles} />
          <InfoLine icon={Clock3} label="Última atualização" value={timeAgo(state.updatedAt)} theme={theme} styles={styles} />
        </View>
      </View>
    </>
  );
}

function AlertsScreen({ alerts, theme, styles }) {
  const critical = alerts.filter((alert) => alert.severity === 'CRITICAL').length;
  return (
    <>
      <PageIntro eyebrow="Central de ocorrências" title="Alertas" subtitle={`${alerts.length} ocorrência${alerts.length === 1 ? '' : 's'} · ${critical} crítica${critical === 1 ? '' : 's'}`} theme={theme} styles={styles} />
      {alerts.length ? (
        <View style={styles.alertsCard}>{alerts.map((alert) => <AlertRow key={alert.id} alert={alert} theme={theme} />)}</View>
      ) : (
        <EmptyState icon={ShieldCheck} title="Tudo sob controle" description="Não há alertas abertos para a sua operação neste momento." theme={theme} />
      )}
    </>
  );
}

function ProfileScreen({ profile, machine, connection, theme, mode, styles, onToggleTheme, onLogout }) {
  return (
    <>
      <PageIntro eyebrow="Conta do operador" title="Perfil" subtitle="Identidade, empresa e preferências" theme={theme} styles={styles} />
      <View style={styles.profileCard}>
        <View style={styles.profileAvatar}><Text style={styles.profileInitials}>{initials(profile?.name)}</Text></View>
        <Text style={styles.profileName}>{profile?.name || 'Operador'}</Text>
        <Text style={styles.profileRole}>{roleLabels[profile?.role] || profile?.role || 'Operador'}</Text>
        <View style={styles.profileFacts}>
          <InfoLine icon={UserRound} label="E-mail" value={profile?.email || '—'} theme={theme} styles={styles} />
          <InfoLine icon={Building2} label="Empresa" value={profile?.company?.name || machine?.company?.name || '—'} theme={theme} styles={styles} />
          <InfoLine icon={HardHat} label="Máquina vinculada" value={machine ? `${machine.code} · ${machine.name}` : 'Sem vínculo'} theme={theme} styles={styles} />
        </View>
      </View>

      <SectionHeader eyebrow="Aplicativo" title="Preferências" theme={theme} />
      <View style={styles.settingsCard}>
        <View style={styles.settingRow}>
          <View style={styles.settingCopy}><Settings2 size={19} color={theme.textSecondary} /><View><Text style={styles.settingTitle}>Aparência</Text><Text style={styles.settingCaption}>Tema {mode === 'dark' ? 'escuro' : 'claro'}</Text></View></View>
          <ThemeToggle mode={mode} onToggle={onToggleTheme} theme={theme} />
        </View>
        <View style={styles.settingDivider} />
        <View style={styles.settingRow}>
          <View style={styles.settingCopy}><Server size={19} color={theme.textSecondary} /><View><Text style={styles.settingTitle}>Servidor conectado</Text><Text numberOfLines={1} style={styles.settingCaption}>{API_URL.replace('/api/v1', '')}</Text></View></View>
          <View style={styles.serverOnline}><View style={[styles.serverOnlineDot, connection !== 'live' && { backgroundColor: theme.warning }]} /><Text style={styles.serverOnlineText}>{connection === 'live' ? 'CONECTADO' : 'SEM CONEXÃO'}</Text></View>
        </View>
      </View>

      <Pressable onPress={onLogout} style={styles.logoutButton}>
        <LogOut size={18} color={theme.danger} />
        <Text style={styles.logoutText}>Sair da conta</Text>
      </Pressable>
    </>
  );
}

function PageIntro({ eyebrow, title, subtitle, live, theme, styles }) {
  return (
    <View style={styles.pageIntro}>
      <View>
        <Text style={styles.pageEyebrow}>{eyebrow.toUpperCase()}</Text>
        <Text style={styles.pageTitle}>{title}</Text>
        <Text style={styles.pageSubtitle}>{subtitle}</Text>
      </View>
      {live ? <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>AO VIVO</Text></View> : null}
    </View>
  );
}

function ErrorBanner({ message, onRetry, theme, styles }) {
  return (
    <View style={styles.errorBanner}>
      <WifiOff size={18} color={theme.danger} />
      <View style={{ flex: 1 }}><Text style={styles.errorTitle}>Falha na sincronização</Text><Text style={styles.errorCopy}>{message}</Text></View>
      <Pressable onPress={onRetry} style={styles.retryButton}><RefreshCw size={16} color={theme.danger} /></Pressable>
    </View>
  );
}

function LoadingState({ theme, styles }) {
  return (
    <View style={styles.loadingState}>
      <ActivityIndicator size="large" color={theme.accent} />
      <Text style={styles.loadingTitle}>Sincronizando operação</Text>
      <Text style={styles.loadingCopy}>Buscando máquina, telemetria e alertas do servidor.</Text>
    </View>
  );
}

function InfoItem({ label, value, styles }) {
  return <View style={styles.infoItem}><Text style={styles.infoLabel}>{label}</Text><Text numberOfLines={1} style={styles.infoValue}>{value}</Text></View>;
}

function InfoLine({ icon: Icon, label, value, theme, styles }) {
  return (
    <View style={styles.infoLine}>
      <View style={styles.infoLineIcon}><Icon size={17} color={theme.textSecondary} /></View>
      <View style={{ flex: 1 }}><Text style={styles.infoLineLabel}>{label}</Text><Text numberOfLines={1} style={styles.infoLineValue}>{value}</Text></View>
    </View>
  );
}

function HealthRow({ icon: Icon, label, value, healthy, theme, styles, last }) {
  return (
    <View style={[styles.healthRow, last && { borderBottomWidth: 0 }]}>
      <View style={styles.healthIcon}><Icon size={18} color={healthy ? theme.success : theme.warning} /></View>
      <View style={{ flex: 1 }}><Text style={styles.healthLabel}>{label}</Text><Text style={styles.healthValue}>{value}</Text></View>
      <View style={[styles.healthDot, { backgroundColor: healthy ? theme.success : theme.warning }]} />
    </View>
  );
}

function signalQuality(signal) {
  if (signal === null || signal === undefined) return 'Sem leitura';
  if (signal >= -70) return 'Sinal excelente';
  if (signal >= -85) return 'Sinal estável';
  if (signal >= -100) return 'Sinal fraco';
  return 'Sinal crítico';
}

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'OP';
}

const staticStyles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: '#0B1210', alignItems: 'center', justifyContent: 'center' },
  splashMark: { width: 58, height: 58, borderRadius: 17, backgroundColor: '#D9FF43', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  splashLetter: { color: '#172000', fontSize: 31, fontWeight: '900', letterSpacing: -2 },
  splashLogo: { color: '#F3F7F1', fontSize: 26, fontWeight: '900', letterSpacing: -1.8 },
  splashAccent: { color: '#D9FF43' },
  splashCaption: { color: '#7E8B83', fontSize: 7.5, fontWeight: '800', letterSpacing: 2.6, marginTop: 7 },
  splashLine: { width: 70, height: 2, backgroundColor: '#26342D', marginTop: 54, overflow: 'hidden' },
  splashLineActive: { width: 46, height: 2, backgroundColor: '#D9FF43' },
});

function createStyles(theme) {
  return StyleSheet.create({
    app: { flex: 1, backgroundColor: theme.background },
    content: { paddingHorizontal: 18, paddingTop: 9, paddingBottom: 110, width: '100%', maxWidth: 700, alignSelf: 'center' },
    login: { flex: 1, backgroundColor: theme.background },
    loginKeyboard: { flex: 1 },
    loginScroll: { minHeight: '100%', paddingHorizontal: 22, paddingBottom: 26, justifyContent: 'space-between' },
    loginTopbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10 },
    loginBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    loginBrandMark: { width: 31, height: 31, borderRadius: 8, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' },
    loginBrandLetter: { color: theme.accentText, fontWeight: '900', fontSize: 17 },
    loginBrandName: { color: theme.text, fontSize: 14, fontWeight: '900', letterSpacing: -.8 },
    loginIntro: { paddingTop: 46, paddingBottom: 36 },
    secureLabel: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    secureLabelText: { color: theme.success, fontSize: 7.5, fontWeight: '900', letterSpacing: 1.2 },
    loginTitle: { color: theme.text, fontSize: 41, lineHeight: 44, fontWeight: '800', letterSpacing: -2.3, marginTop: 17 },
    loginTitleAccent: { color: theme.accent },
    loginCopy: { color: theme.textSecondary, fontSize: 13, lineHeight: 21, maxWidth: 330, marginTop: 15 },
    loginPanel: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 20, padding: 21, shadowColor: theme.shadow, shadowOpacity: theme.mode === 'dark' ? .2 : .07, shadowRadius: 25, shadowOffset: { width: 0, height: 12 } },
    loginPanelEyebrow: { color: theme.textMuted, fontSize: 7.5, fontWeight: '900', letterSpacing: 1.2 },
    loginPanelTitle: { color: theme.text, fontSize: 21, fontWeight: '800', letterSpacing: -.8, marginTop: 5, marginBottom: 12 },
    inputLabel: { color: theme.textMuted, fontSize: 7.5, fontWeight: '900', letterSpacing: 1.2, marginTop: 14, marginBottom: 6 },
    inputWrap: { height: 48, borderWidth: 1, borderColor: theme.border, borderRadius: 11, backgroundColor: theme.surfaceRaised, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13 },
    input: { flex: 1, color: theme.text, fontSize: 12, height: '100%' },
    loginError: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: theme.dangerSoft, borderRadius: 10, padding: 11, marginTop: 14 },
    loginErrorText: { color: theme.danger, fontSize: 10, lineHeight: 15, flex: 1 },
    loginButton: { height: 50, borderRadius: 11, backgroundColor: theme.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 17, marginTop: 19 },
    loginButtonText: { color: theme.accentText, fontSize: 11, fontWeight: '900' },
    serverLine: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 15 },
    serverText: { color: theme.textMuted, fontSize: 8, maxWidth: 240 },
    pageIntro: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 },
    pageEyebrow: { color: theme.textMuted, fontSize: 7.5, fontWeight: '900', letterSpacing: 1.25 },
    pageTitle: { color: theme.text, fontSize: 28, fontWeight: '800', letterSpacing: -1.35, marginTop: 5 },
    pageSubtitle: { color: theme.textSecondary, fontSize: 9.5, marginTop: 5 },
    liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.successSoft, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 12, marginBottom: 3 },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.success },
    liveText: { color: theme.success, fontSize: 7, fontWeight: '900', letterSpacing: .7 },
    heroCard: { backgroundColor: '#14221C', borderWidth: 1, borderColor: '#2A3D33', borderRadius: 18, padding: 20, overflow: 'hidden' },
    heroGlow: { position: 'absolute', width: 190, height: 190, borderRadius: 95, backgroundColor: '#D9FF4312', right: -70, top: -90 },
    heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    heroEyebrow: { color: '#84928A', fontSize: 7, fontWeight: '900', letterSpacing: 1.25 },
    heroCode: { color: '#F2F6F1', fontSize: 30, fontWeight: '900', letterSpacing: -1.7, marginTop: 7 },
    heroName: { color: '#9FAEA5', fontSize: 10, marginTop: 2 },
    heroMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 25, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#2B3D34' },
    heroMetaItem: { flex: 1, flexDirection: 'row', gap: 9, alignItems: 'center' },
    heroMetaDivider: { width: 1, height: 31, backgroundColor: '#2B3D34', marginHorizontal: 13 },
    heroMetaLabel: { color: '#718179', fontSize: 6.5, fontWeight: '900', letterSpacing: 1 },
    heroMetaValue: { color: '#DDE5DF', fontSize: 9, fontWeight: '700', marginTop: 3 },
    heroAction: { height: 44, borderRadius: 11, backgroundColor: '#D9FF43', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, marginTop: 18 },
    heroActionText: { color: '#172000', fontSize: 10, fontWeight: '900' },
    metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
    listCard: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 16, paddingHorizontal: 15 },
    allClear: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 17 },
    allClearIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.successSoft, alignItems: 'center', justifyContent: 'center' },
    allClearTitle: { color: theme.text, fontSize: 11, fontWeight: '800' },
    allClearCopy: { color: theme.textSecondary, fontSize: 8.5, marginTop: 3 },
    machineCard: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 17, padding: 17 },
    machineCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    machineIdentity: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    machineIcon: { width: 47, height: 47, borderRadius: 14, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' },
    machineCardCode: { color: theme.text, fontSize: 18, fontWeight: '900', letterSpacing: -.7 },
    machineCardName: { color: theme.textSecondary, fontSize: 9, marginTop: 2 },
    machineSpecs: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderTopColor: theme.border, marginTop: 17, paddingTop: 15, rowGap: 14 },
    infoItem: { width: '50%' },
    infoLabel: { color: theme.textMuted, fontSize: 6.5, fontWeight: '900', letterSpacing: 1 },
    infoValue: { color: theme.text, fontSize: 10, fontWeight: '700', marginTop: 4, paddingRight: 8 },
    healthRow: { flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderBottomColor: theme.border, paddingVertical: 14 },
    healthIcon: { width: 37, height: 37, borderRadius: 11, backgroundColor: theme.surfaceSoft, alignItems: 'center', justifyContent: 'center' },
    healthLabel: { color: theme.text, fontSize: 10.5, fontWeight: '800' },
    healthValue: { color: theme.textSecondary, fontSize: 8.5, marginTop: 3 },
    healthDot: { width: 7, height: 7, borderRadius: 4 },
    locationSummary: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 16, padding: 17, marginTop: 13 },
    locationSummaryHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    locationMachineIcon: { width: 43, height: 43, borderRadius: 13, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' },
    locationMachineCode: { color: theme.text, fontSize: 15, fontWeight: '900' },
    locationMachineName: { color: theme.textSecondary, fontSize: 8.5, marginTop: 2 },
    locationRows: { borderTopWidth: 1, borderTopColor: theme.border, marginTop: 16, paddingTop: 4 },
    infoLine: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54 },
    infoLineIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: theme.surfaceSoft, alignItems: 'center', justifyContent: 'center' },
    infoLineLabel: { color: theme.textMuted, fontSize: 7.5, fontWeight: '800', letterSpacing: .5 },
    infoLineValue: { color: theme.text, fontSize: 10, fontWeight: '700', marginTop: 3 },
    alertsCard: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 16, paddingHorizontal: 15 },
    profileCard: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 18, padding: 20, alignItems: 'center' },
    profileAvatar: { width: 66, height: 66, borderRadius: 21, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' },
    profileInitials: { color: theme.accentText, fontSize: 20, fontWeight: '900' },
    profileName: { color: theme.text, fontSize: 18, fontWeight: '800', letterSpacing: -.5, marginTop: 13 },
    profileRole: { color: theme.textSecondary, fontSize: 9, marginTop: 3 },
    profileFacts: { alignSelf: 'stretch', borderTopWidth: 1, borderTopColor: theme.border, marginTop: 18, paddingTop: 5 },
    settingsCard: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 16, paddingHorizontal: 15 },
    settingRow: { minHeight: 69, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
    settingCopy: { flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1 },
    settingTitle: { color: theme.text, fontSize: 10.5, fontWeight: '800' },
    settingCaption: { color: theme.textSecondary, fontSize: 8.5, marginTop: 3, maxWidth: 210 },
    settingDivider: { height: 1, backgroundColor: theme.border },
    serverOnline: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    serverOnlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.success },
    serverOnlineText: { color: theme.success, fontSize: 6.5, fontWeight: '900', letterSpacing: .8 },
    logoutButton: { height: 48, borderWidth: 1, borderColor: theme.danger, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 17 },
    logoutText: { color: theme.danger, fontSize: 10, fontWeight: '900' },
    errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.dangerSoft, borderRadius: 13, padding: 13, marginBottom: 16 },
    errorTitle: { color: theme.danger, fontSize: 9.5, fontWeight: '900' },
    errorCopy: { color: theme.danger, fontSize: 8.5, lineHeight: 13, marginTop: 2 },
    retryButton: { width: 33, height: 33, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    loadingState: { minHeight: 360, alignItems: 'center', justifyContent: 'center' },
    loadingTitle: { color: theme.text, fontSize: 15, fontWeight: '800', marginTop: 16 },
    loadingCopy: { color: theme.textSecondary, fontSize: 10, marginTop: 5 },
  });
}
