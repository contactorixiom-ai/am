// Géocodage statique des principales villes EU + Afrique subsaharienne francophone.
// Évite une dépendance Mapbox/Google côté MVP. À étendre selon les besoins métier.

export interface GeoPoint {
  latitude: number;
  longitude: number;
  city: string;
  country: string;
  region: 'EU' | 'AFRICA';
  /** Code postal, quand la recherche en ligne le fournit. */
  postalCode?: string;
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
  // Afrique du Nord
  'casablanca':  { city: 'Casablanca',  country: 'MA', latitude: 33.5731, longitude: -7.5898,  region: 'AFRICA' },
  'rabat':       { city: 'Rabat',       country: 'MA', latitude: 34.0209, longitude: -6.8416,  region: 'AFRICA' },
  'tanger':      { city: 'Tanger',      country: 'MA', latitude: 35.7595, longitude: -5.8340,  region: 'AFRICA' },
  'marrakech':   { city: 'Marrakech',   country: 'MA', latitude: 31.6295, longitude: -7.9811,  region: 'AFRICA' },
  'agadir':      { city: 'Agadir',      country: 'MA', latitude: 30.4278, longitude: -9.5981,  region: 'AFRICA' },
  'fes':         { city: 'Fès',         country: 'MA', latitude: 34.0181, longitude: -5.0078,  region: 'AFRICA' },
  'oujda':       { city: 'Oujda',       country: 'MA', latitude: 34.6814, longitude: -1.9086,  region: 'AFRICA' },
  'alger':       { city: 'Alger',       country: 'DZ', latitude: 36.7538, longitude: 3.0588,   region: 'AFRICA' },
  'oran':        { city: 'Oran',        country: 'DZ', latitude: 35.6971, longitude: -0.6308,  region: 'AFRICA' },
  'constantine': { city: 'Constantine', country: 'DZ', latitude: 36.3650, longitude: 6.6147,   region: 'AFRICA' },
  'annaba':      { city: 'Annaba',      country: 'DZ', latitude: 36.9000, longitude: 7.7667,   region: 'AFRICA' },
  'setif':       { city: 'Sétif',       country: 'DZ', latitude: 36.1911, longitude: 5.4137,   region: 'AFRICA' },
  'bejaia':      { city: 'Béjaïa',      country: 'DZ', latitude: 36.7509, longitude: 5.0567,   region: 'AFRICA' },
  'tunis':       { city: 'Tunis',       country: 'TN', latitude: 36.8065, longitude: 10.1815,  region: 'AFRICA' },
  'sfax':        { city: 'Sfax',        country: 'TN', latitude: 34.7406, longitude: 10.7603,  region: 'AFRICA' },
  'sousse':      { city: 'Sousse',      country: 'TN', latitude: 35.8256, longitude: 10.6369,  region: 'AFRICA' },
  'bizerte':     { city: 'Bizerte',     country: 'TN', latitude: 37.2744, longitude: 9.8739,   region: 'AFRICA' },
  'le caire':    { city: 'Le Caire',    country: 'EG', latitude: 30.0444, longitude: 31.2357,  region: 'AFRICA' },
  'alexandrie':  { city: 'Alexandrie',  country: 'EG', latitude: 31.2001, longitude: 29.9187,  region: 'AFRICA' },
  'tripoli':     { city: 'Tripoli',     country: 'LY', latitude: 32.8872, longitude: 13.1913,  region: 'AFRICA' },
  'benghazi':    { city: 'Benghazi',    country: 'LY', latitude: 32.1167, longitude: 20.0667,  region: 'AFRICA' },
  'nouakchott':  { city: 'Nouakchott',  country: 'MR', latitude: 18.0735, longitude: -15.9582, region: 'AFRICA' },
  // Afrique de l'Ouest (suite)
  'accra':       { city: 'Accra',       country: 'GH', latitude: 5.6037,  longitude: -0.1870,  region: 'AFRICA' },
  'tema':        { city: 'Tema',        country: 'GH', latitude: 5.6698,  longitude: -0.0166,  region: 'AFRICA' },
  'kumasi':      { city: 'Kumasi',      country: 'GH', latitude: 6.6666,  longitude: -1.6163,  region: 'AFRICA' },
  'lagos':       { city: 'Lagos',       country: 'NG', latitude: 6.5244,  longitude: 3.3792,   region: 'AFRICA' },
  'abuja':       { city: 'Abuja',       country: 'NG', latitude: 9.0765,  longitude: 7.3986,   region: 'AFRICA' },
  'banjul':      { city: 'Banjul',      country: 'GM', latitude: 13.4549, longitude: -16.5790, region: 'AFRICA' },
  'bissau':      { city: 'Bissau',      country: 'GW', latitude: 11.8817, longitude: -15.6178, region: 'AFRICA' },
  'freetown':    { city: 'Freetown',    country: 'SL', latitude: 8.4657,  longitude: -13.2317, region: 'AFRICA' },
  'monrovia':    { city: 'Monrovia',    country: 'LR', latitude: 6.3005,  longitude: -10.7969, region: 'AFRICA' },
  'praia':       { city: 'Praia',       country: 'CV', latitude: 14.9330, longitude: -23.5133, region: 'AFRICA' },
  // Afrique centrale (suite)
  'malabo':      { city: 'Malabo',      country: 'GQ', latitude: 3.7504,  longitude: 8.7371,   region: 'AFRICA' },
  'lubumbashi':  { city: 'Lubumbashi',  country: 'CD', latitude: -11.6876, longitude: 27.5026, region: 'AFRICA' },
  'matadi':      { city: 'Matadi',      country: 'CD', latitude: -5.8167, longitude: 13.4500,  region: 'AFRICA' },
  // Afrique de l'Est
  'nairobi':     { city: 'Nairobi',     country: 'KE', latitude: -1.2921, longitude: 36.8219,  region: 'AFRICA' },
  'mombasa':     { city: 'Mombasa',     country: 'KE', latitude: -4.0435, longitude: 39.6682,  region: 'AFRICA' },
  'dar es salaam': { city: 'Dar es Salaam', country: 'TZ', latitude: -6.7924, longitude: 39.2083, region: 'AFRICA' },
  'kampala':     { city: 'Kampala',     country: 'UG', latitude: 0.3476,  longitude: 32.5825,  region: 'AFRICA' },
  'kigali':      { city: 'Kigali',      country: 'RW', latitude: -1.9441, longitude: 30.0619,  region: 'AFRICA' },
  'bujumbura':   { city: 'Bujumbura',   country: 'BI', latitude: -3.3614, longitude: 29.3599,  region: 'AFRICA' },
  'addis-abeba': { city: 'Addis-Abeba', country: 'ET', latitude: 9.0250,  longitude: 38.7469,  region: 'AFRICA' },
  'khartoum':    { city: 'Khartoum',    country: 'SD', latitude: 15.5007, longitude: 32.5599,  region: 'AFRICA' },
  'mogadiscio':  { city: 'Mogadiscio',  country: 'SO', latitude: 2.0469,  longitude: 45.3182,  region: 'AFRICA' },
  'victoria':    { city: 'Victoria',    country: 'SC', latitude: -4.6191, longitude: 55.4513,  region: 'AFRICA' },
  'moroni':      { city: 'Moroni',      country: 'KM', latitude: -11.7172, longitude: 43.2473, region: 'AFRICA' },
  'port-louis':  { city: 'Port-Louis',  country: 'MU', latitude: -20.1609, longitude: 57.5012, region: 'AFRICA' },
  // Afrique australe
  'luanda':      { city: 'Luanda',      country: 'AO', latitude: -8.8390, longitude: 13.2894,  region: 'AFRICA' },
  'maputo':      { city: 'Maputo',      country: 'MZ', latitude: -25.9692, longitude: 32.5732, region: 'AFRICA' },
  'johannesburg':{ city: 'Johannesburg',country: 'ZA', latitude: -26.2041, longitude: 28.0473, region: 'AFRICA' },
  'durban':      { city: 'Durban',      country: 'ZA', latitude: -29.8587, longitude: 31.0218, region: 'AFRICA' },
  'le cap':      { city: 'Le Cap',      country: 'ZA', latitude: -33.9249, longitude: 18.4241, region: 'AFRICA' },
  'lusaka':      { city: 'Lusaka',      country: 'ZM', latitude: -15.3875, longitude: 28.3228, region: 'AFRICA' },
  'harare':      { city: 'Harare',      country: 'ZW', latitude: -17.8252, longitude: 31.0335, region: 'AFRICA' },
  'windhoek':    { city: 'Windhoek',    country: 'NA', latitude: -22.5609, longitude: 17.0658, region: 'AFRICA' },
  'gaborone':    { city: 'Gaborone',    country: 'BW', latitude: -24.6282, longitude: 25.9231, region: 'AFRICA' },
  'lilongwe':    { city: 'Lilongwe',    country: 'MW', latitude: -13.9626, longitude: 33.7741, region: 'AFRICA' },
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
