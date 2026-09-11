import React from 'react';
import { View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { useTheme } from '../theme/ThemeProvider';
import { RADII } from '../theme/tokens';

interface LatLng { latitude: number; longitude: number }
interface Props {
  from: LatLng;
  to: LatLng;
  progress: number;
  paused?: boolean;
  height?: number;
  fromLabel?: string;
  toLabel?: string;
}

export function LiveConvoyMap({ from, to, progress, paused, height = 260, fromLabel, toLabel }: Props) {
  const { theme } = useTheme();
  const lat = from.latitude + (to.latitude - from.latitude) * progress;
  const lng = from.longitude + (to.longitude - from.longitude) * progress;
  const midLat = (from.latitude + to.latitude) / 2;
  const midLng = (from.longitude + to.longitude) / 2;
  const dLat = Math.max(Math.abs(from.latitude - to.latitude) * 1.6, 2);
  const dLng = Math.max(Math.abs(from.longitude - to.longitude) * 1.6, 2);
  const vehicleColor = paused ? '#E0A04D' : theme.gold;

  return (
    <View style={{ height, borderRadius: RADII.lg, overflow: 'hidden', borderWidth: 1, borderColor: theme.line }}>
      <MapView
        provider={PROVIDER_DEFAULT}
        style={{ flex: 1 }}
        initialRegion={{ latitude: midLat, longitude: midLng, latitudeDelta: dLat, longitudeDelta: dLng }}
        scrollEnabled
        zoomEnabled
      >
        <Marker coordinate={from} title={fromLabel ?? 'Départ'} />
        <Marker coordinate={to} title={toLabel ?? 'Arrivée'} />
        <Polyline coordinates={[from, to]} strokeColor={theme.navy} strokeWidth={2} lineDashPattern={[8, 8]} />
        <Polyline coordinates={[from, { latitude: lat, longitude: lng }]} strokeColor={theme.gold} strokeWidth={4} />
        <Marker coordinate={{ latitude: lat, longitude: lng }} title={paused ? 'En pause' : 'En route'} pinColor={vehicleColor} />
      </MapView>
    </View>
  );
}
