// Android : carte de suivi Leaflet / OpenStreetMap dans une vue web (sans
// clé API). La page est chargée une fois ; la position du véhicule y est
// ensuite poussée à chaque mise à jour, sans recharger la carte.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../theme/ThemeProvider';
import { RADII } from '../theme/tokens';
import { leafletHtml } from '../utils/leafletHtml';
import { MapWebView } from './MapWebView';
import { StyledRouteMap } from './StyledRouteMap';

interface LatLng { latitude: number; longitude: number }
interface Props {
  from: LatLng;
  to: LatLng;
  progress: number;
  paused?: boolean;
  height?: number;
  fromLabel?: string;
  toLabel?: string;
  /** Pictogramme du mobile suivi : voiture, bateau ou avion. */
  glyph?: string;
}

export function LiveConvoyMap({ from, to, progress, paused, height = 260, fromLabel, toLabel, glyph = '🚗' }: Props) {
  const { theme } = useTheme();
  const [failed, setFailed] = useState(false);
  const webRef = useRef<WebView>(null);
  const ready = useRef(false);
  const latest = useRef({ progress, paused: !!paused });
  latest.current = { progress, paused: !!paused };

  // La page ne dépend pas de l'avancement : seule la position est poussée.
  const html = useMemo(
    () => leafletHtml({
      from, to, fromLabel, toLabel,
      colors: { navy: theme.navy, gold: theme.gold },
      live: { progress: latest.current.progress, paused: latest.current.paused, glyph },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [from.latitude, from.longitude, to.latitude, to.longitude, fromLabel, toLabel, glyph, theme.navy, theme.gold],
  );

  const push = () => {
    if (!ready.current) return;
    const { progress: p, paused: z } = latest.current;
    webRef.current?.injectJavaScript(`window.__update && window.__update(${Number(p) || 0}, ${z ? 'true' : 'false'}); true;`);
  };

  useEffect(push, [progress, paused]); // eslint-disable-line react-hooks/exhaustive-deps

  if (failed) {
    return <StyledRouteMap height={height} progress={progress} from={fromLabel ?? 'Départ'} to={toLabel ?? 'Arrivée'} />;
  }
  return (
    <View style={{ height, borderRadius: RADII.lg, overflow: 'hidden', borderWidth: 1, borderColor: theme.line }}>
      <MapWebView
        ref={webRef}
        html={html}
        onFail={() => setFailed(true)}
        onReady={() => {
          ready.current = true;
          push();
        }}
      />
    </View>
  );
}
