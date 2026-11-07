// Saisie d'adresse assistée (numéro et rue), comme sur Google Maps, avec
// des services gratuits et sans clé :
// - France : Base Adresse Nationale (api-adresse.data.gouv.fr), la source
//   officielle des adresses françaises ;
// - Europe et Afrique : Photon (OpenStreetMap, komoot).
// En cas d'indisponibilité, la liste est vide : le client écrit son adresse
// à la main, comme avant.

export interface AddressSuggestion {
  /** Libellé complet : « 12 Rue de la République, 69002 Lyon ». */
  label: string;
  /** Numéro et rue : « 12 Rue de la République ». */
  line: string;
  postalCode: string | null;
  city: string | null;
  country: string;
  latitude: number;
  longitude: number;
}

const cache = new Map<string, { at: number; items: AddressSuggestion[] }>();
const CACHE_MS = 6 * 60 * 60 * 1000;

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'AxisImport/1.0 (saisie d\'adresse)', Accept: 'application/json' },
    signal: AbortSignal.timeout(3500),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function searchFrance(q: string): Promise<AddressSuggestion[]> {
  const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&autocomplete=1&limit=6`;
  const json = (await getJson(url)) as {
    features?: {
      geometry: { coordinates: [number, number] };
      properties: { label?: string; name?: string; postcode?: string; city?: string; type?: string };
    }[];
  };
  return (json.features ?? [])
    .filter((f) => f.properties.type !== 'municipality')
    .map((f) => ({
      // « 12 Rue de la République, 69002 Lyon » : plus lisible que le libellé brut.
      label: f.properties.name && f.properties.city
        ? `${f.properties.name}, ${[f.properties.postcode, f.properties.city].filter(Boolean).join(' ')}`
        : f.properties.label ?? f.properties.name ?? q,
      line: f.properties.name ?? f.properties.label ?? q,
      postalCode: f.properties.postcode ?? null,
      city: f.properties.city ?? null,
      country: 'FR',
      latitude: f.geometry.coordinates[1],
      longitude: f.geometry.coordinates[0],
    }));
}

async function searchWorld(q: string, country?: string): Promise<AddressSuggestion[]> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=10&lang=fr&layer=house&layer=street&layer=locality&layer=district`;
  const json = (await getJson(url)) as {
    features?: {
      geometry: { coordinates: [number, number] };
      properties: {
        name?: string; housenumber?: string; street?: string; postcode?: string; city?: string; district?: string;
        locality?: string; countrycode?: string; type?: string;
      };
    }[];
  };
  const out: AddressSuggestion[] = [];
  for (const f of json.features ?? []) {
    const p = f.properties;
    const cc = (p.countrycode ?? '').toUpperCase();
    if (!cc || (country && cc !== country)) continue;
    const street = p.street ?? (p.type === 'street' ? p.name : undefined);
    const line = street
      ? `${p.housenumber ? `${p.housenumber} ` : ''}${street}`
      : [p.name, p.district ?? p.locality].filter(Boolean).join(', ');
    if (!line) continue;
    const city = p.city ?? null;
    const place = [p.postcode, city].filter(Boolean).join(' ');
    out.push({
      label: [line, place].filter(Boolean).join(', '),
      line,
      postalCode: p.postcode ?? null,
      city,
      country: cc,
      latitude: f.geometry.coordinates[1],
      longitude: f.geometry.coordinates[0],
    });
  }
  return out;
}

/**
 * Adresses correspondant à la saisie. `country` (code ISO) restreint au
 * pays ; `city` complète la recherche quand la ville est déjà choisie.
 */
export async function searchAddresses(query: string, country?: string, city?: string): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const cc = country?.trim().toUpperCase().slice(0, 2) || undefined;
  const c = city?.trim();
  const full = c && !fold(q).includes(fold(c)) ? `${q} ${c}` : q;
  const key = `${cc ?? '*'}|${fold(full)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.items;

  const sources = await Promise.allSettled([
    !cc || cc === 'FR' ? searchFrance(full) : Promise.resolve([]),
    cc === 'FR' ? Promise.resolve([]) : searchWorld(full, cc),
  ]);
  const found = sources.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  const seen = new Set<string>();
  const items: AddressSuggestion[] = [];
  for (const a of found) {
    const id = fold(a.label);
    if (seen.has(id)) continue;
    seen.add(id);
    items.push(a);
    if (items.length >= 6) break;
  }
  if (sources.every((r) => r.status === 'fulfilled')) {
    if (cache.size > 5000) cache.clear();
    cache.set(key, { at: Date.now(), items });
  }
  return items;
}
