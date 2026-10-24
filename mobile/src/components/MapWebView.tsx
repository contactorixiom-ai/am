// Vue web qui affiche une carte Leaflet (voir utils/leafletHtml.ts).
// Utilisée par les cartes Android : Google Maps y exigerait une clé API.
import React, { forwardRef } from 'react';
import { Linking } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { MAP_BASE_URL } from '../utils/leafletHtml';

interface Props {
  html: string;
  /** Leaflet injoignable ou page en erreur : afficher le tracé stylisé. */
  onFail: () => void;
  onReady?: () => void;
}

export const MapWebView = forwardRef<WebView, Props>(function MapWebView({ html, onFail, onReady }, ref) {
  const onMessage = (e: WebViewMessageEvent) => {
    if (e.nativeEvent.data === 'failed') onFail();
    else if (e.nativeEvent.data === 'ready') onReady?.();
  };
  return (
    <WebView
      ref={ref}
      originWhitelist={['*']}
      source={{ html, baseUrl: MAP_BASE_URL }}
      javaScriptEnabled
      domStorageEnabled={false}
      scrollEnabled={false}
      nestedScrollEnabled={false}
      overScrollMode="never"
      setSupportMultipleWindows={false}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      onMessage={onMessage}
      onError={onFail}
      onHttpError={onFail}
      // Un lien touché dans la carte (crédit OpenStreetMap) s'ouvre dans le
      // navigateur : la vue web ne quitte jamais la carte.
      onShouldStartLoadWithRequest={(req) => {
        if (req.url === MAP_BASE_URL || req.url.startsWith('about:') || req.url.startsWith('data:')) return true;
        if (/^https?:/.test(req.url)) Linking.openURL(req.url).catch(() => {});
        return false;
      }}
      style={{ flex: 1, backgroundColor: 'transparent' }}
    />
  );
});
