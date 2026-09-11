import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
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

// Web : Leaflet via CDN (gratuit, sans clé API).
export function RouteMap({ from, to, height = 240, fromLabel, toLabel }: Props) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;

    let map: any;
    let cleanup = false;

    const ensureLeaflet = () => new Promise<any>((resolve) => {
      const w = window as any;
      if (w.L) return resolve(w.L);
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(css);
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      s.onload = () => resolve((window as any).L);
      document.head.appendChild(s);
    });

    ensureLeaflet().then((L) => {
      if (cleanup || !containerRef.current) return;
      const midLat = (from.latitude + to.latitude) / 2;
      const midLng = (from.longitude + to.longitude) / 2;
      map = L.map(containerRef.current, { zoomControl: true, attributionControl: false }).setView([midLat, midLng], 5);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

      const fromIcon = L.divIcon({ html: `<div style="background:${theme.navy};color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:700;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">A</div>`, iconSize: [28, 28], iconAnchor: [14, 14], className: '' });
      const toIcon = L.divIcon({ html: `<div style="background:${theme.gold};color:${theme.navy};border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:700;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">B</div>`, iconSize: [28, 28], iconAnchor: [14, 14], className: '' });

      L.marker([from.latitude, from.longitude], { icon: fromIcon }).addTo(map).bindPopup(fromLabel ?? 'Départ');
      L.marker([to.latitude, to.longitude], { icon: toIcon }).addTo(map).bindPopup(toLabel ?? 'Arrivée');
      L.polyline([[from.latitude, from.longitude], [to.latitude, to.longitude]], { color: theme.navy, weight: 3, dashArray: '10, 8' }).addTo(map);

      map.fitBounds([
        [from.latitude, from.longitude],
        [to.latitude, to.longitude],
      ], { padding: [40, 40] });
    });

    return () => {
      cleanup = true;
      if (map) map.remove();
    };
  }, [from.latitude, from.longitude, to.latitude, to.longitude, fromLabel, toLabel, theme.navy, theme.gold]);

  return (
    <View style={{ height, borderRadius: RADII.lg, overflow: 'hidden', borderWidth: 1, borderColor: theme.line }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}
