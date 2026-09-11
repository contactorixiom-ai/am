// Géocodage statique des principales villes EU + Afrique subsaharienne francophone.
// Évite une dépendance Mapbox/Google côté MVP. À étendre selon les besoins métier.

export interface GeoPoint {
  latitude: number;
  longitude: number;
  city: string;
  country: string;
  region: 'EU' | 'AFRICA';
}

const CITIES: Record<string, GeoPoint> = {
  // ── EUROPE — France
  'paris':       { city: 'Paris',       country: 'FR', latitude: 48.8566, longitude: 2.3522,  region: 'EU' },
  'lyon':        { city: 'Lyon',        country: 'FR', latitude: 45.7640, longitude: 4.8357,  region: 'EU' },
  'marseille':   { city: 'Marseille',   country: 'FR', latitude: 43.2965, longitude: 5.3698,  region: 'EU' },
  'toulouse':    { city: 'Toulouse',    country: 'FR', latitude: 43.6047, longitude: 1.4442,  region: 'EU' },
  'bordeaux':    { city: 'Bordeaux',    country: 'FR', latitude: 44.8378, longitude: -0.5792, region: 'EU' },
  'lille':       { city: 'Lille',       country: 'FR', latitude: 50.6292, longitude: 3.0573,  region: 'EU' },
  'nantes':      { city: 'Nantes',      country: 'FR', latitude: 47.2184, longitude: -1.5536, region: 'EU' },
  'strasbourg':  { city: 'Strasbourg',  country: 'FR', latitude: 48.5734, longitude: 7.7521,  region: 'EU' },
  'nice':        { city: 'Nice',        country: 'FR', latitude: 43.7102, longitude: 7.2620,  region: 'EU' },
  'rennes':      { city: 'Rennes',      country: 'FR', latitude: 48.1173, longitude: -1.6778, region: 'EU' },
  'le havre':    { city: 'Le Havre',    country: 'FR', latitude: 49.4944, longitude: 0.1079,  region: 'EU' },
  'montpellier': { city: 'Montpellier', country: 'FR', latitude: 43.6108, longitude: 3.8767,  region: 'EU' },

  // ── EUROPE — Belgique
  'bruxelles':   { city: 'Bruxelles',   country: 'BE', latitude: 50.8503, longitude: 4.3517,  region: 'EU' },
  'anvers':      { city: 'Anvers',      country: 'BE', latitude: 51.2194, longitude: 4.4025,  region: 'EU' },
  'liege':       { city: 'Liège',       country: 'BE', latitude: 50.6326, longitude: 5.5797,  region: 'EU' },
  'gand':        { city: 'Gand',        country: 'BE', latitude: 51.0543, longitude: 3.7174,  region: 'EU' },

  // ── EUROPE — Pays-Bas
  'amsterdam':   { city: 'Amsterdam',   country: 'NL', latitude: 52.3676, longitude: 4.9041,  region: 'EU' },
  'rotterdam':   { city: 'Rotterdam',   country: 'NL', latitude: 51.9244, longitude: 4.4777,  region: 'EU' },

  // ── EUROPE — Allemagne
  'berlin':      { city: 'Berlin',      country: 'DE', latitude: 52.5200, longitude: 13.4050, region: 'EU' },
  'munich':      { city: 'Munich',      country: 'DE', latitude: 48.1351, longitude: 11.5820, region: 'EU' },
  'francfort':   { city: 'Francfort',   country: 'DE', latitude: 50.1109, longitude: 8.6821,  region: 'EU' },
  'hambourg':    { city: 'Hambourg',    country: 'DE', latitude: 53.5511, longitude: 9.9937,  region: 'EU' },
  'cologne':     { city: 'Cologne',     country: 'DE', latitude: 50.9375, longitude: 6.9603,  region: 'EU' },

  // ── EUROPE — Luxembourg
  'luxembourg':  { city: 'Luxembourg',  country: 'LU', latitude: 49.6116, longitude: 6.1319,  region: 'EU' },

  // ── EUROPE — Suisse
  'geneve':      { city: 'Genève',      country: 'CH', latitude: 46.2044, longitude: 6.1432,  region: 'EU' },
  'zurich':      { city: 'Zurich',      country: 'CH', latitude: 47.3769, longitude: 8.5417,  region: 'EU' },
  'lausanne':    { city: 'Lausanne',    country: 'CH', latitude: 46.5197, longitude: 6.6323,  region: 'EU' },

  // ── EUROPE — Espagne
  'madrid':      { city: 'Madrid',      country: 'ES', latitude: 40.4168, longitude: -3.7038, region: 'EU' },
  'barcelone':   { city: 'Barcelone',   country: 'ES', latitude: 41.3851, longitude: 2.1734,  region: 'EU' },

  // ── EUROPE — Italie
  'rome':        { city: 'Rome',        country: 'IT', latitude: 41.9028, longitude: 12.4964, region: 'EU' },
  'milan':       { city: 'Milan',       country: 'IT', latitude: 45.4642, longitude: 9.1900,  region: 'EU' },

  // ── EUROPE — UK (post-Brexit mais transport routier toujours OK)
  'londres':     { city: 'Londres',     country: 'GB', latitude: 51.5074, longitude: -0.1278, region: 'EU' },

  // ── AFRIQUE SUBSAHARIENNE FRANCOPHONE
  'dakar':       { city: 'Dakar',       country: 'SN', latitude: 14.7167, longitude: -17.4677, region: 'AFRICA' },
  'thies':       { city: 'Thiès',       country: 'SN', latitude: 14.7900, longitude: -16.9356, region: 'AFRICA' },
  'abidjan':     { city: 'Abidjan',     country: 'CI', latitude: 5.3600,  longitude: -4.0083,  region: 'AFRICA' },
  'yamoussoukro':{ city: 'Yamoussoukro',country: 'CI', latitude: 6.8276,  longitude: -5.2893,  region: 'AFRICA' },
  'douala':      { city: 'Douala',      country: 'CM', latitude: 4.0511,  longitude: 9.7679,   region: 'AFRICA' },
  'yaounde':     { city: 'Yaoundé',     country: 'CM', latitude: 3.8480,  longitude: 11.5021,  region: 'AFRICA' },
  'libreville':  { city: 'Libreville',  country: 'GA', latitude: 0.4162,  longitude: 9.4673,   region: 'AFRICA' },
  'brazzaville': { city: 'Brazzaville', country: 'CG', latitude: -4.2634, longitude: 15.2429,  region: 'AFRICA' },
  'pointe-noire':{ city: 'Pointe-Noire',country: 'CG', latitude: -4.7894, longitude: 11.8569,  region: 'AFRICA' },
  'kinshasa':    { city: 'Kinshasa',    country: 'CD', latitude: -4.4419, longitude: 15.2663,  region: 'AFRICA' },
  'bamako':      { city: 'Bamako',      country: 'ML', latitude: 12.6392, longitude: -8.0029,  region: 'AFRICA' },
  'ouagadougou': { city: 'Ouagadougou', country: 'BF', latitude: 12.3714, longitude: -1.5197,  region: 'AFRICA' },
  'lome':        { city: 'Lomé',        country: 'TG', latitude: 6.1375,  longitude: 1.2123,   region: 'AFRICA' },
  'cotonou':     { city: 'Cotonou',     country: 'BJ', latitude: 6.3703,  longitude: 2.3912,   region: 'AFRICA' },
  'porto-novo':  { city: 'Porto-Novo',  country: 'BJ', latitude: 6.4969,  longitude: 2.6289,   region: 'AFRICA' },
  'niamey':      { city: 'Niamey',      country: 'NE', latitude: 13.5117, longitude: 2.1251,   region: 'AFRICA' },
  'ndjamena':    { city: "N'Djaména",   country: 'TD', latitude: 12.1348, longitude: 15.0557,  region: 'AFRICA' },
  'bangui':      { city: 'Bangui',      country: 'CF', latitude: 4.3947,  longitude: 18.5582,  region: 'AFRICA' },
  'conakry':     { city: 'Conakry',     country: 'GN', latitude: 9.5092,  longitude: -13.7122, region: 'AFRICA' },
  'antananarivo':{ city: 'Antananarivo',country: 'MG', latitude: -18.8792,longitude: 47.5079,  region: 'AFRICA' },
  'djibouti':    { city: 'Djibouti',    country: 'DJ', latitude: 11.5886, longitude: 43.1450,  region: 'AFRICA' },
};

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['']/g, '')
    .replace(/\s+/g, ' ');
}

export function lookupCity(name: string): GeoPoint | null {
  return CITIES[normalize(name)] ?? null;
}

export function listCities(region?: 'EU' | 'AFRICA'): GeoPoint[] {
  return Object.values(CITIES).filter((c) => !region || c.region === region);
}
