import React from 'react';
import { Text, View } from 'react-native';
export default function BluetoothGateway({ theme }) {
  return <View style={{ padding: 14 }}><Text style={{ color: theme.textSecondary }}>Coleta Bluetooth disponível no app Android instalado. O painel web recebe os dados sincronizados pelo celular.</Text></View>;
}
