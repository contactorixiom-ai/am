// Android : carte Leaflet / OpenStreetMap dans une vue web (sans clé API).
// iOS garde RouteMap.native.tsx (Plans d'Apple, sans clé non plus).
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { RADII } from '../theme/tokens';
import { leafletHtml } from '../utils/leafletHtml';
import { MapWebView } from './MapWebView';
import { StyledRouteMap } from './StyledRouteMap';

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
  const [failed, setFailed] = useState(false);
  const html = useMemo(
    () => leafletHtml({ from, to, fromLabel, toLabel, colors: { navy: theme.navy, gold: theme.gold } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [from.latitude, from.longitude, to.latitude, to.longitude, fromLabel, toLabel, theme.navy, theme.gold],
  );

  if (failed) {
    return <StyledRouteMap height={height} progress={0} from={fromLabel ?? 'Départ'} to={toLabel ?? 'Arrivée'} />;
  }
  return (
    <View style={{ height, borderRadius: RADII.lg, overflow: 'hidden', borderWidth: 1, borderColor: theme.line }}>
      <MapWebView html={html} onFail={() => setFailed(true)} />
    </View>
  );
}
