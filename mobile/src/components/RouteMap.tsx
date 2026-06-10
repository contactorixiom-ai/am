import React from 'react';
import { Platform, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { useTheme } from '../theme/ThemeProvider';
import { RADII } from '../theme/tokens';

interface LatLng {
  latitude: number;
  longitude: number;
}

interface Props {
  from: LatLng;
  to: LatLng;
  height?: number;
  fromLabel?: string;
  toLabel?: string;
}

export function RouteMap({ from, to, height = 240, fromLabel, toLabel }: Props) {
  const { theme } = useTheme();
  const midLat = (from.latitude + to.latitude) / 2;
  const midLng = (from.longitude + to.longitude) / 2;
  const dLat = Math.max(Math.abs(from.latitude - to.latitude) * 1.6, 2);
  const dLng = Math.max(Math.abs(from.longitude - to.longitude) * 1.6, 2);

  return (
    <View style={{ height, borderRadius: RADII.lg, overflow: 'hidden', borderWidth: 1, borderColor: theme.line }}>
      <MapView
        provider={PROVIDER_DEFAULT}
        style={{ flex: 1 }}
        initialRegion={{
          latitude: midLat,
          longitude: midLng,
          latitudeDelta: dLat,
          longitudeDelta: dLng,
        }}
        scrollEnabled
        zoomEnabled
      >
        <Marker coordinate={from} title={fromLabel ?? 'Départ'} pinColor={Platform.OS === 'ios' ? undefined : '#0B2545'} />
        <Marker coordinate={to} title={toLabel ?? 'Arrivée'} pinColor={Platform.OS === 'ios' ? undefined : '#C9A55C'} />
        <Polyline
          coordinates={[from, to]}
          strokeColor={theme.navy}
          strokeWidth={3}
          lineDashPattern={[8, 6]}
        />
      </MapView>
    </View>
  );
}
