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
  progress: number; // 0..1
  paused?: boolean;
  height?: number;
  fromLabel?: string;
  toLabel?: string;
}

// Carte temps réel (web) : Leaflet + OpenStreetMap (gratuit, sans clé),
// avec un marqueur véhicule qui se déplace le long de l'itinéraire.
export function LiveConvoyMap({ from, to, progress, paused, height = 260, fromLabel, toLabel }: Props) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const traveledRef = useRef<any>(null);
  const LRef = useRef<any>(null);

  const vehicleIcon = (L: any, isPaused: boolean) => {
    const ring = isPaused ? '#E0A04D' : theme.gold;
    const glyph = isPaused ? '⏸' : '🚗';
    return L.divIcon({
      className: '',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      html: `<div style="width:40px;height:40px;display:flex;align-items:center;justify-content:center">
        <div style="position:absolute;width:40px;height:40px;border-radius:50%;background:${ring};opacity:.25"></div>
        <div style="position:relative;width:28px;height:28px;border-radius:50%;background:#fff;border:3px solid ${ring};display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,.35)">${glyph}</div>
      </div>`,
    });
  };

  // Init une seule fois
  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;
    let cancelled = false;

    const ensureLeaflet = () =>
      new Promise<any>((resolve) => {
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
      if (cancelled || !containerRef.current) return;
      LRef.current = L;
      const map = L.map(containerRef.current, { zoomControl: false, attributionControl: false, dragging: true });
      mapRef.current = map;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

      const fromIcon = L.divIcon({ html: `<div style="background:${theme.navy};color:white;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)">A</div>`, iconSize: [24, 24], iconAnchor: [12, 12], className: '' });
      const toIcon = L.divIcon({ html: `<div style="background:${theme.gold};color:${theme.navy};border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)">B</div>`, iconSize: [24, 24], iconAnchor: [12, 12], className: '' });

      L.marker([from.latitude, from.longitude], { icon: fromIcon }).addTo(map).bindPopup(fromLabel ?? 'Départ');
      L.marker([to.latitude, to.longitude], { icon: toIcon }).addTo(map).bindPopup(toLabel ?? 'Arrivée');

      // Itinéraire complet (pointillé) + portion parcourue (plein)
      L.polyline([[from.latitude, from.longitude], [to.latitude, to.longitude]], { color: theme.navy, weight: 3, opacity: 0.35, dashArray: '8, 8' }).addTo(map);
      traveledRef.current = L.polyline([[from.latitude, from.longitude], [from.latitude, from.longitude]], { color: theme.gold, weight: 4 }).addTo(map);

      markerRef.current = L.marker([from.latitude, from.longitude], { icon: vehicleIcon(L, !!paused) }).addTo(map);

      map.fitBounds([[from.latitude, from.longitude], [to.latitude, to.longitude]], { padding: [44, 44] });
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from.latitude, from.longitude, to.latitude, to.longitude]);

  // Met à jour la position du véhicule quand progress/pause change
  useEffect(() => {
    const L = LRef.current;
    const marker = markerRef.current;
    if (!L || !marker) return;
    const lat = from.latitude + (to.latitude - from.latitude) * progress;
    const lng = from.longitude + (to.longitude - from.longitude) * progress;
    marker.setLatLng([lat, lng]);
    marker.setIcon(vehicleIcon(L, !!paused));
    if (traveledRef.current) {
      traveledRef.current.setLatLngs([[from.latitude, from.longitude], [lat, lng]]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, paused]);

  return (
    <View style={{ height, borderRadius: RADII.lg, overflow: 'hidden', borderWidth: 1, borderColor: theme.line }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}
