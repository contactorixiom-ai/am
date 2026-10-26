// Carte Leaflet + OpenStreetMap pour l'application Android.
//
// Sur Android, react-native-maps passe obligatoirement par Google Maps, qui
// exige une clé API dans le manifeste : sans elle, l'application plante dès
// qu'une carte s'affiche. On affiche donc la même carte que la version web
// (Leaflet, tuiles OpenStreetMap, sans clé) dans une vue web intégrée.
// Leaflet est chargé depuis un CDN, vérifié par empreinte (SRI), avec un
// second CDN en secours ; s'il reste injoignable, la page prévient
// l'application qui affiche le tracé stylisé.

export interface MapPoint {
  latitude: number;
  longitude: number;
}

export interface LeafletHtmlOptions {
  from: MapPoint;
  to: MapPoint;
  fromLabel?: string;
  toLabel?: string;
  colors: { navy: string; gold: string };
  /** Carte de suivi : position du véhicule, mise à jour par window.__update. */
  live?: { progress: number; paused: boolean; glyph: string };
}

/** Origine déclarée de la page : OpenStreetMap exige un référent identifiable. */
export const MAP_BASE_URL = 'https://app-axisimport.com/app/';

const LEAFLET = {
  js: [
    'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  ],
  css: [
    'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  ],
  jsIntegrity: 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=',
  cssIntegrity: 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=',
};

/** JSON sûr dans une balise <script> (pas de « </script> » possible). */
function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(new RegExp(String.fromCharCode(0x2028), 'g'), '\\u2028')
    .replace(new RegExp(String.fromCharCode(0x2029), 'g'), '\\u2029');
}

export function leafletHtml(opts: LeafletHtmlOptions): string {
  const data = {
    from: [opts.from.latitude, opts.from.longitude],
    to: [opts.to.latitude, opts.to.longitude],
    fromLabel: opts.fromLabel ?? 'Départ',
    toLabel: opts.toLabel ?? 'Arrivée',
    navy: opts.colors.navy,
    gold: opts.colors.gold,
    live: opts.live ?? null,
    leaflet: LEAFLET,
  };
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #E9E4D6; }
  .leaflet-control-attribution { font: 10px/1.4 -apple-system, Roboto, sans-serif; }
</style>
</head>
<body>
<div id="map"></div>
<script>
(function () {
  var D = ${safeJson(data)};
  function post(msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
  }
  function loadCss(i) {
    if (i >= D.leaflet.css.length) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = D.leaflet.css[i];
    l.integrity = D.leaflet.cssIntegrity;
    l.crossOrigin = '';
    l.onerror = function () { l.remove(); loadCss(i + 1); };
    document.head.appendChild(l);
  }
  function loadJs(i) {
    if (i >= D.leaflet.js.length) { post('failed'); return; }
    var s = document.createElement('script');
    s.src = D.leaflet.js[i];
    s.integrity = D.leaflet.jsIntegrity;
    s.crossOrigin = '';
    s.onload = function () {
      try { init(); } catch (e) { post('failed'); }
    };
    s.onerror = function () { s.remove(); loadJs(i + 1); };
    document.head.appendChild(s);
  }
  function badge(bg, fg, letter) {
    return L.divIcon({
      className: '',
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      html: '<div style="background:' + bg + ';color:' + fg + ';border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font:700 12px sans-serif;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)">' + letter + '</div>'
    });
  }
  function vehicleIcon(paused) {
    var ring = paused ? '#E0A04D' : D.gold;
    var mark = paused ? '\\u23F8' : D.live.glyph;
    return L.divIcon({
      className: '',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      html: '<div style="width:40px;height:40px;display:flex;align-items:center;justify-content:center">' +
        '<div style="position:absolute;width:40px;height:40px;border-radius:50%;background:' + ring + ';opacity:.25"></div>' +
        '<div style="position:relative;width:28px;height:28px;border-radius:50%;background:#fff;border:3px solid ' + ring + ';display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,.35)">' + mark + '</div></div>'
    });
  }
  function at(p) {
    return [D.from[0] + (D.to[0] - D.from[0]) * p, D.from[1] + (D.to[1] - D.from[1]) * p];
  }
  function init() {
    // Carte d'illustration : pas de déplacement au doigt, qui se battrait
    // avec le défilement de l'écran.
    var map = L.map('map', {
      zoomControl: false, dragging: false, touchZoom: false, scrollWheelZoom: false,
      doubleClickZoom: false, boxZoom: false, keyboard: false, tap: false
    });
    map.attributionControl.setPrefix(false);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    L.marker(D.from, { icon: badge(D.navy, '#fff', 'A') }).addTo(map).bindPopup(D.fromLabel);
    L.marker(D.to, { icon: badge(D.gold, D.navy, 'B') }).addTo(map).bindPopup(D.toLabel);
    if (D.live) {
      L.polyline([D.from, D.to], { color: D.navy, weight: 3, opacity: 0.35, dashArray: '8, 8' }).addTo(map);
      var traveled = L.polyline([D.from, at(D.live.progress)], { color: D.gold, weight: 4 }).addTo(map);
      var marker = L.marker(at(D.live.progress), { icon: vehicleIcon(D.live.paused) }).addTo(map);
      window.__update = function (progress, paused) {
        var p = Math.max(0, Math.min(1, Number(progress) || 0));
        marker.setLatLng(at(p));
        marker.setIcon(vehicleIcon(!!paused));
        traveled.setLatLngs([D.from, at(p)]);
      };
    } else {
      L.polyline([D.from, D.to], { color: D.navy, weight: 3, dashArray: '10, 8' }).addTo(map);
    }
    map.fitBounds([D.from, D.to], { padding: [40, 40] });
    post('ready');
  }
  loadCss(0);
  loadJs(0);
})();
</script>
</body>
</html>`;
}
