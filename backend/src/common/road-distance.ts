import { Logger } from '@nestjs/common';
import { haversineKm, LatLng, roadKmFromHaversine } from './haversine';

// Distance routière réelle via un serveur OSRM (itinéraire voiture le plus
// court en temps). Le prix du convoyage étant proportionnel au kilomètre, une
// estimation « vol d'oiseau × 1,3 » faisait payer ±10 % de trop ou de moins
// selon le trajet (Paris → Lyon : 509 km estimés pour 465 km de route).
//
// ROUTING_URL : serveur OSRM à utiliser (par défaut le serveur public du
// projet OSRM) ; « off » pour s'en passer. Sans réponse sous 4 s, on retombe
// sur l'estimation : un devis ne doit jamais échouer pour ça.

const logger = new Logger('RoadDistance');
const cache = new Map<string, number>();
const CACHE_MAX = 5000;

const key = (a: LatLng, b: LatLng) =>
  [a.latitude, a.longitude, b.latitude, b.longitude].map((v) => v.toFixed(3)).join(',');

export async function roadDistanceKm(a: LatLng, b: LatLng): Promise<number> {
  const straight = haversineKm(a, b);
  const fallback = roadKmFromHaversine(straight);
  const base = (process.env.ROUTING_URL ?? 'https://router.project-osrm.org').replace(/\/$/, '');
  if (base === 'off' || straight < 0.5) return fallback;

  const k = key(a, b);
  const hit = cache.get(k);
  if (hit != null) return hit;

  try {
    const url = `${base}/route/v1/driving/${a.longitude},${a.latitude};${b.longitude},${b.latitude}?overview=false`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AxisImport/1.0 (devis convoyage)' },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { code?: string; routes?: Array<{ distance?: number }> };
    const meters = body.routes?.[0]?.distance;
    if (body.code !== 'Ok' || typeof meters !== 'number') throw new Error(body.code ?? 'réponse vide');
    const km = Math.round(meters / 1000);
    // Garde-fou : un itinéraire plus court que la ligne droite, ou démesuré
    // (ferry, contournement absurde), est ignoré au profit de l'estimation.
    if (km < straight * 0.95 || km > straight * 3) throw new Error(`itinéraire incohérent (${km} km)`);
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
    cache.set(k, km);
    return km;
  } catch (err) {
    logger.warn(`Distance routière indisponible, estimation utilisée : ${(err as Error).message}`);
    return fallback;
  }
}
