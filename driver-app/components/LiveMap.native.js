import React from 'react';
import { Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const fallback = { latitude: -7.115, longitude: -34.861 };
export default function LiveMap({ latitude, longitude, code, large }) {
  if (Platform.OS === 'android' && Constants.appOwnership !== 'expo' && !Constants.expoConfig?.android?.config?.googleMaps?.apiKey) return <View style={{ padding: 24 }}><Text>GPS: {latitude ?? '—'}, {longitude ?? '—'}. Mapa-base disponível no painel web; chave Google Maps pendente nesta build.</Text></View>;
  const hasPosition = latitude != null && longitude != null && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude)) && Math.abs(Number(latitude)) <= 90 && Math.abs(Number(longitude)) <= 180;
  if (!hasPosition) return <View style={{ padding: 24 }}><Text>Aguardando posição GPS da máquina</Text></View>;
  const position = hasPosition ? { latitude: Number(latitude), longitude: Number(longitude) } : fallback;
  return <MapView style={{ position: 'absolute', inset: 0 }} region={{ ...position, latitudeDelta: large ? .018 : .03, longitudeDelta: large ? .018 : .03 }} showsCompass showsScale={large} toolbarEnabled={false}>{hasPosition && <Marker coordinate={position} title={code || 'Escavadeira'} description="Última posição recebida via GPS" />}</MapView>;
}
