import { GeoPoint, listCities } from './geocoding';

// Recherche de communes au-delà des ~50 grandes villes du catalogue : un
// client de Dijon ou d'Orléans ne pouvait pas commander. Deux services
// gratuits, sans clé :
// - France : Base Adresse Nationale (api-adresse.data.gouv.fr) ;
// - reste de l'Europe et Afrique : Photon (OpenStreetMap, komoot).
// En cas d'indisponibilité, on retombe sur le catalogue statique.

const EU = new Set(['FR', 'BE', 'LU', 'CH', 'DE', 'NL', 'IT', 'ES', 'PT', 'GB', 'AT', 'MC', 'IE', 'DK', 'PL', 'CZ']);
const AFRICA = new Set([
  'SN', 'CI', 'CM', 'BJ', 'TG', 'GA', 'CG', 'CD', 'BF', 'ML', 'NE', 'GN', 'TD', 'CF', 'MG', 'DJ', 'MR', 'KM', 'RW', 'BI', 'MA', 'DZ', 'TN',
]);

export function regionOf(country: string): 'EU' | 'AFRICA' | null {
  const c = country.toUpperCase();
  if (EU.has(c)) return 'EU';
  if (AFRICA.has(c)) return 'AFRICA';
  return null;
}

const cache = new Map<string, { at: number; points: GeoPoint[] }>();
const CACHE_MS = 24 * 60 * 60 * 1000;

function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'AxisImport/1.0 (recherche de ville pour devis)', Accept: 'application/json' },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function searchFrance(q: string): Promise<GeoPoint[]> {
  const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&type=municipality&autocomplete=1&limit=8`;
  const json = (await getJson(url)) as {
    features?: { geometry: { coordinates: [number, number] }; properties: { city?: string; name?: string; postcode?: string } }[];
  };
  return (json.features ?? []).map((f) => ({
    city: f.properties.city ?? f.properties.name ?? q,
    postalCode: f.properties.postcode,
    country: 'FR',
    latitude: f.geometry.coordinates[1],
    longitude: f.geometry.coordinates[0],
    region: 'EU' as const,
  }));
}

async function searchWorld(q: string): Promise<GeoPoint[]> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=12&lang=fr&layer=city&layer=district`;
  const json = (await getJson(url)) as {
    features?: { geometry: { coordinates: [number, number] }; properties: { name?: string; countrycode?: string; postcode?: string } }[];
  };
  const out: GeoPoint[] = [];
  for (const f of json.features ?? []) {
    const country = (f.properties.countrycode ?? '').toUpperCase();
    const region = regionOf(country);
    if (!region || !f.properties.name || country === 'FR') continue;
    out.push({
      city: f.properties.name,
      postalCode: f.properties.postcode,
      country,
      latitude: f.geometry.coordinates[1],
      longitude: f.geometry.coordinates[0],
      region,
    });
  }
  return out;
}

/** Villes correspondant à la saisie, catalogue d'abord, puis services en ligne. */
export async function searchPlaces(query: string, region?: 'EU' | 'AFRICA'): Promise<GeoPoint[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const key = `${region ?? '*'}|${fold(q)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.points;

  const local = listCities(region).filter((c) => fold(c.city).startsWith(fold(q)));
  const remote = await Promise.allSettled([
    region === 'AFRICA' ? Promise.resolve([]) : searchFrance(q),
    searchWorld(q),
  ]);
  const found = remote.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));

  const seen = new Set<string>();
  const merged: GeoPoint[] = [];
  for (const p of [...local, ...found]) {
    if (region && p.region !== region) continue;
    const id = `${fold(p.city)}|${p.country}|${p.postalCode ?? ''}`;
    const loose = `${fold(p.city)}|${p.country}`;
    if (seen.has(id) || (!p.postalCode && seen.has(loose))) continue;
    seen.add(id);
    seen.add(loose);
    merged.push(p);
    if (merged.length >= 12) break;
  }
  // On ne met en cache que les réponses complètes.
  if (remote.every((r) => r.status === 'fulfilled')) {
    if (cache.size > 5000) cache.clear();
    cache.set(key, { at: Date.now(), points: merged });
  }
  return merged;
}
