import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  AlertTriangle,
  Bell,
  ChevronRight,
  CircleUserRound,
  Gauge,
  Home,
  MapPin,
  MapPinned,
  Moon,
  Sun,
  Truck,
  UserRound,
} from 'lucide-react-native';
import { coordinates, formatNumber, timeAgo } from '../utils/format';
import { statusMeta } from '../theme';
import LiveMap from './LiveMap';

export function ThemeToggle({ mode, onToggle, theme }) {
  return (
    <Pressable
      accessibilityLabel="Alternar tema claro e escuro"
      onPress={onToggle}
      style={[styles.themeToggle, { backgroundColor: theme.surfaceSoft, borderColor: theme.border }]}
    >
      <View style={[styles.themeOption, mode === 'light' && { backgroundColor: theme.surfaceRaised }]}>
        <Sun size={15} color={mode === 'light' ? theme.text : theme.textMuted} strokeWidth={2.2} />
      </View>
      <View style={[styles.themeOption, mode === 'dark' && { backgroundColor: theme.surfaceRaised }]}>
        <Moon size={15} color={mode === 'dark' ? theme.accent : theme.textMuted} strokeWidth={2.2} />
      </View>
    </Pressable>
  );
}

export function Header({ user, theme, mode, onToggleTheme, alertsCount, onAlerts }) {
  const initials = user
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <View style={styles.header}>
      <View style={styles.headerBrand}>
        <View style={[styles.brandMark, { backgroundColor: theme.accent }]}>
          <Text style={[styles.brandLetter, { color: theme.accentText }]}>E</Text>
        </View>
        <View>
          <Text style={[styles.brandName, { color: theme.text }]}>EMPIMECATRÔNIC</Text>
          <Text style={[styles.brandCaption, { color: theme.textMuted }]}>FIELD OPERATIONS</Text>
        </View>
      </View>
      <View style={styles.headerActions}>
        <ThemeToggle mode={mode} onToggle={onToggleTheme} theme={theme} />
        <Pressable
          onPress={onAlerts}
          style={[styles.iconButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <Bell size={18} color={theme.textSecondary} strokeWidth={2} />
          {alertsCount > 0 && (
            <View style={[styles.notificationDot, { backgroundColor: theme.warning }]}>
              <Text style={styles.notificationText}>{Math.min(alertsCount, 9)}</Text>
            </View>
          )}
        </Pressable>
        <View style={[styles.avatar, { backgroundColor: theme.surfaceSoft, borderColor: theme.border }]}>
          <Text style={[styles.avatarText, { color: theme.text }]}>{initials || 'OP'}</Text>
        </View>
      </View>
    </View>
  );
}

export function StatusPill({ status, theme }) {
  const meta = statusMeta[status] || statusMeta.OFFLINE;
  const color = meta.tone === 'success' ? theme.success : meta.tone === 'warning' ? theme.warning : theme.textMuted;
  const background = meta.tone === 'success' ? theme.successSoft : meta.tone === 'warning' ? theme.warningSoft : theme.surfaceSoft;
  return (
    <View style={[styles.statusPill, { backgroundColor: background }]}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={[styles.statusText, { color }]}>{meta.label.toUpperCase()}</Text>
    </View>
  );
}

export function MetricCard({ icon: Icon, label, value, unit, detail, theme }) {
  return (
    <View style={[styles.metricCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={[styles.metricIcon, { backgroundColor: theme.surfaceSoft }]}>
        <Icon size={19} color={theme.accent} strokeWidth={2.1} />
      </View>
      <Text style={[styles.metricLabel, { color: theme.textMuted }]}>{label.toUpperCase()}</Text>
      <View style={styles.metricValueRow}>
        <Text style={[styles.metricValue, { color: theme.text }]}>{formatNumber(value)}</Text>
        {value !== null && value !== undefined && (
          <Text style={[styles.metricUnit, { color: theme.textSecondary }]}>{unit}</Text>
        )}
      </View>
      <Text numberOfLines={1} style={[styles.metricDetail, { color: theme.textSecondary }]}>{detail}</Text>
    </View>
  );
}

export function SectionHeader({ eyebrow, title, action, onAction, theme }) {
  return (
    <View style={styles.sectionHeader}>
      <View>
        {eyebrow ? <Text style={[styles.eyebrow, { color: theme.textMuted }]}>{eyebrow.toUpperCase()}</Text> : null}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      </View>
      {action ? (
        <Pressable onPress={onAction} style={styles.sectionAction}>
          <Text style={[styles.sectionActionText, { color: theme.textSecondary }]}>{action}</Text>
          <ChevronRight size={15} color={theme.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function LocationCard({ machine, theme, onPress, large = false }) {
  const state = machine?.currentState || {};
  return (
    <View style={[styles.mapCard, large && styles.mapCardLarge, { backgroundColor: theme.map, borderColor: theme.border }]}>
      <LiveMap latitude={state.latitude} longitude={state.longitude} code={machine?.code} large={large} />
      <View style={[styles.locationOverlay, { backgroundColor: theme.surfaceRaised }]}>
        <Text style={[styles.locationEyebrow, { color: theme.textMuted }]}>ÚLTIMA POSIÇÃO RECEBIDA</Text>
        <Text style={[styles.locationCoordinates, { color: theme.text }]}>
          {coordinates(state.latitude, state.longitude)}
        </Text>
        <Text style={[styles.locationUpdate, { color: theme.textSecondary }]}>
          {timeAgo(state.gpsUpdatedAt)} · {state.gpsValid ? `${formatNumber(state.speed)} km/h` : 'Aguardando sinal GPS'}
        </Text>
      </View>
      <Pressable accessibilityLabel="Abrir mapa" onPress={onPress} style={[styles.mapOpen, { backgroundColor: theme.accent }]}>
        <MapPinned size={16} color={theme.accentText} />
      </Pressable>
    </View>
  );
}

export function TelemetryTrend({ telemetry = [], theme }) {
  const values = telemetry
    .slice(0, 16)
    .reverse()
    .map((item) => Number(item.voltage))
    .filter(Number.isFinite);
  const chartValues = values.length ? values : [0];
  const min = Math.min(...chartValues);
  const max = Math.max(...chartValues);
  const range = Math.max(max - min, 0.5);

  return (
    <View style={[styles.chartCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.chartHeader}>
        <View>
          <Text style={[styles.eyebrow, { color: theme.textMuted }]}>HISTÓRICO RECENTE</Text>
          <Text style={[styles.chartTitle, { color: theme.text }]}>Tensão da bateria</Text>
        </View>
        <Text style={[styles.chartCount, { color: theme.textSecondary }]}>{values.length} leituras</Text>
      </View>
      <View style={styles.chartBars}>
        {chartValues.map((value, index) => (
          <View
            key={`${value}-${index}`}
            style={[
              styles.chartBar,
              {
                backgroundColor: index === chartValues.length - 1 ? theme.accent : theme.border,
                height: values.length ? 18 + ((value - min) / range) * 52 : 2,
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.chartFooter}>
        <Text style={[styles.chartAxis, { color: theme.textMuted }]}>MAIS ANTIGO</Text>
        <Text style={[styles.chartAxis, { color: theme.textMuted }]}>AGORA</Text>
      </View>
    </View>
  );
}

export function AlertRow({ alert, theme }) {
  const critical = alert.severity === 'CRITICAL';
  const color = critical ? theme.danger : theme.warning;
  const soft = critical ? theme.dangerSoft : theme.warningSoft;
  return (
    <View style={[styles.alertRow, { borderBottomColor: theme.border }]}>
      <View style={[styles.alertIcon, { backgroundColor: soft }]}>
        <AlertTriangle size={18} color={color} strokeWidth={2.1} />
      </View>
      <View style={styles.alertCopy}>
        <Text style={[styles.alertType, { color }]}>{alert.type?.replaceAll('_', ' ') || alert.severity}</Text>
        <Text style={[styles.alertMessage, { color: theme.text }]}>{alert.message}</Text>
        <Text style={[styles.alertMeta, { color: theme.textMuted }]}>
          {alert.machine?.code || 'Máquina'} · {timeAgo(alert.createdAt)}
        </Text>
      </View>
      <ChevronRight size={17} color={theme.textMuted} />
    </View>
  );
}

export function EmptyState({ icon: Icon = Truck, title, description, theme, action, onAction }) {
  return (
    <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.surfaceSoft }]}>
        <Icon size={25} color={theme.textSecondary} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.emptyDescription, { color: theme.textSecondary }]}>{description}</Text>
      {action ? (
        <Pressable onPress={onAction} style={[styles.emptyAction, { backgroundColor: theme.accent }]}>
          <Text style={[styles.emptyActionText, { color: theme.accentText }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const navigation = [
  { key: 'home', label: 'Início', icon: Home },
  { key: 'machine', label: 'Máquina', icon: Gauge },
  { key: 'map', label: 'Mapa', icon: MapPinned },
  { key: 'alerts', label: 'Alertas', icon: Bell },
  { key: 'profile', label: 'Perfil', icon: UserRound },
];

export function BottomNav({ active, onChange, theme, alertsCount }) {
  return (
    <View style={[styles.bottomNav, { backgroundColor: theme.nav, borderTopColor: theme.border }]}> 
      {navigation.map(({ key, label, icon: Icon }) => {
        const selected = active === key;
        return (
          <Pressable key={key} onPress={() => onChange(key)} style={styles.navItem}>
            <View style={[styles.navIconWrap, selected && { backgroundColor: theme.surfaceSoft }]}>
              <Icon size={19} color={selected ? theme.accent : theme.textMuted} strokeWidth={selected ? 2.4 : 1.9} />
              {key === 'alerts' && alertsCount > 0 ? <View style={[styles.navDot, { backgroundColor: theme.warning }]} /> : null}
            </View>
            <Text style={[styles.navText, { color: selected ? theme.text : theme.textMuted }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const profileIcons = { CircleUserRound, Truck, MapPin };

const styles = StyleSheet.create({
  themeToggle: { flexDirection: 'row', borderRadius: 19, borderWidth: 1, padding: 2 },
  themeOption: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 26 },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMark: { width: 31, height: 31, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  brandLetter: { fontSize: 17, fontWeight: '900', letterSpacing: -1 },
  brandName: { fontSize: 13, fontWeight: '900', letterSpacing: -.6 },
  brandCaption: { fontSize: 6.5, fontWeight: '700', letterSpacing: 1.15, marginTop: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  notificationDot: { position: 'absolute', right: -2, top: -3, minWidth: 15, height: 15, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  notificationText: { color: '#172015', fontSize: 8, fontWeight: '900' },
  avatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 10, fontWeight: '800' },
  statusPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 8, fontWeight: '900', letterSpacing: .8 },
  metricCard: { width: '48.7%', minHeight: 145, borderWidth: 1, borderRadius: 14, padding: 15 },
  metricIcon: { width: 35, height: 35, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  metricLabel: { fontSize: 8, fontWeight: '800', letterSpacing: 1.1 },
  metricValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 5 },
  metricValue: { fontSize: 25, fontWeight: '800', letterSpacing: -1.4 },
  metricUnit: { fontSize: 10, fontWeight: '600' },
  metricDetail: { fontSize: 9, marginTop: 5 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 27, marginBottom: 13 },
  eyebrow: { fontSize: 7.5, fontWeight: '800', letterSpacing: 1.3 },
  sectionTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -.7, marginTop: 4 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  sectionActionText: { fontSize: 9, fontWeight: '800' },
  mapCard: { height: 218, borderRadius: 16, borderWidth: 1, overflow: 'hidden', position: 'relative' },
  mapCardLarge: { height: 390 },
  mapRoad: { position: 'absolute', width: 520, height: 48, borderRadius: 30 },
  mapRoadOne: { top: 86, left: -75, transform: [{ rotate: '-18deg' }] },
  mapRoadTwo: { top: 95, left: -32, transform: [{ rotate: '54deg' }] },
  mapRoadThin: { position: 'absolute', width: 370, height: 2, opacity: .16, top: 52, left: 26, transform: [{ rotate: '19deg' }] },
  mapPinWrap: { position: 'absolute', top: '37%', left: '53%', alignItems: 'center' },
  mapPulse: { position: 'absolute', width: 52, height: 52, borderRadius: 26, top: -13 },
  mapPin: { width: 29, height: 29, borderRadius: 15, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  mapCode: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 5, marginTop: 5 },
  mapCodeText: { fontSize: 8, fontWeight: '900', letterSpacing: .4 },
  locationOverlay: { position: 'absolute', left: 12, right: 54, bottom: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, shadowColor: '#000', shadowOpacity: .08, shadowRadius: 12 },
  locationEyebrow: { fontSize: 6.5, fontWeight: '900', letterSpacing: 1 },
  locationCoordinates: { fontSize: 11, fontWeight: '800', marginTop: 3 },
  locationUpdate: { fontSize: 8.5, marginTop: 3 },
  mapOpen: { position: 'absolute', right: 12, bottom: 12, width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  chartCard: { borderWidth: 1, borderRadius: 16, padding: 17 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  chartTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -.4, marginTop: 4 },
  chartCount: { fontSize: 8.5, marginTop: 3 },
  chartBars: { height: 75, flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 20 },
  chartBar: { flex: 1, minWidth: 3, borderRadius: 3 },
  chartFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  chartAxis: { fontSize: 6.5, fontWeight: '800', letterSpacing: .9 },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, paddingVertical: 14 },
  alertIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  alertCopy: { flex: 1 },
  alertType: { fontSize: 7.5, fontWeight: '900', letterSpacing: .8, textTransform: 'uppercase' },
  alertMessage: { fontSize: 11, fontWeight: '700', lineHeight: 16, marginTop: 3 },
  alertMeta: { fontSize: 8.5, marginTop: 4 },
  emptyState: { borderWidth: 1, borderRadius: 16, padding: 25, alignItems: 'center' },
  emptyIcon: { width: 50, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '800', marginTop: 15 },
  emptyDescription: { fontSize: 11, lineHeight: 17, textAlign: 'center', maxWidth: 270, marginTop: 7 },
  emptyAction: { marginTop: 16, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10 },
  emptyActionText: { fontSize: 10, fontWeight: '900' },
  bottomNav: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 78, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-around', paddingTop: 8, paddingBottom: 7 },
  navItem: { flex: 1, alignItems: 'center' },
  navIconWrap: { width: 39, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 7.5, fontWeight: '700', marginTop: 3 },
  navDot: { position: 'absolute', width: 6, height: 6, borderRadius: 3, right: 7, top: 4 },
});
