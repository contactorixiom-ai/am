// Données compactes des pays couverts par Axis Import.
// Sert à 2 choses :
//   1. Sélecteur de pays groupé par zone géographique côté mobile.
//   2. Fallback démo si l'API /customs/regulations tombe.
// La source de vérité reste backend/customs.data.ts ; ce fichier est un miroir
// allégé maintenu manuellement (pas de RPC bloquant au boot de l'app).

import type { CargoTrackingType } from '../api/customs';

export type CountryZone =
  | 'AFRICA_WEST'
  | 'AFRICA_CENTRAL'
  | 'AFRICA_EAST'
  | 'AFRICA_SOUTH'
  | 'EUROPE_EU'
  | 'EUROPE_EFTA'
  | 'EUROPE_OTHER';

export interface CountrySummary {
  code: string;          // ISO 3166-1 alpha-2
  name: string;          // nom français
  zone: CountryZone;
  currency: string;
  trackingType: CargoTrackingType | null;
  authority: string | null;
}

export const COUNTRY_ZONE_LABEL: Record<CountryZone, string> = {
  AFRICA_WEST: 'Afrique de l\'Ouest',
  AFRICA_CENTRAL: 'Afrique Centrale',
  AFRICA_EAST: 'Afrique de l\'Est',
  AFRICA_SOUTH: 'Afrique Australe',
  EUROPE_EU: 'Union européenne',
  EUROPE_EFTA: 'AELE',
  EUROPE_OTHER: 'Autres Europe',
};

/** Ordre d'affichage des zones (Afrique d'abord — cible métier d'Axis). */
export const ZONE_ORDER: CountryZone[] = [
  'AFRICA_WEST',
  'AFRICA_CENTRAL',
  'AFRICA_EAST',
  'AFRICA_SOUTH',
  'EUROPE_EU',
  'EUROPE_EFTA',
  'EUROPE_OTHER',
];

export const COUNTRY_SUMMARIES: CountrySummary[] = [
  // ─── Afrique de l'Ouest ─────────────────────────────────────────────────
  { code: 'SN', name: 'Sénégal',           zone: 'AFRICA_WEST', currency: 'XOF', trackingType: 'BSC',  authority: 'COSEC' },
  { code: 'CI', name: 'Côte d\'Ivoire',    zone: 'AFRICA_WEST', currency: 'XOF', trackingType: 'BSC',  authority: 'OIC' },
  { code: 'ML', name: 'Mali',              zone: 'AFRICA_WEST', currency: 'XOF', trackingType: 'BSC',  authority: 'CMC' },
  { code: 'BF', name: 'Burkina Faso',      zone: 'AFRICA_WEST', currency: 'XOF', trackingType: 'ECTN', authority: 'CBC' },
  { code: 'NE', name: 'Niger',             zone: 'AFRICA_WEST', currency: 'XOF', trackingType: 'ECTN', authority: 'CNUT' },
  { code: 'BJ', name: 'Bénin',             zone: 'AFRICA_WEST', currency: 'XOF', trackingType: 'BESC', authority: 'PAC' },
  { code: 'TG', name: 'Togo',              zone: 'AFRICA_WEST', currency: 'XOF', trackingType: 'ECTN', authority: 'CNCT' },
  { code: 'GN', name: 'Guinée',            zone: 'AFRICA_WEST', currency: 'GNF', trackingType: 'ECTN', authority: 'CGC' },
  { code: 'GW', name: 'Guinée-Bissau',     zone: 'AFRICA_WEST', currency: 'XOF', trackingType: 'ECTN', authority: 'Alfândegas' },
  { code: 'SL', name: 'Sierra Leone',      zone: 'AFRICA_WEST', currency: 'SLE', trackingType: 'ECTN', authority: 'SLMA' },
  { code: 'LR', name: 'Liberia',           zone: 'AFRICA_WEST', currency: 'LRD', trackingType: 'ECTN', authority: 'NPA' },
  { code: 'GH', name: 'Ghana',             zone: 'AFRICA_WEST', currency: 'GHS', trackingType: null,    authority: 'GSA' },
  { code: 'NG', name: 'Nigeria',           zone: 'AFRICA_WEST', currency: 'NGN', trackingType: null,    authority: 'NSC/SON' },
  { code: 'MR', name: 'Mauritanie',        zone: 'AFRICA_WEST', currency: 'MRU', trackingType: 'BSC',   authority: 'DGD' },
  { code: 'CV', name: 'Cap-Vert',          zone: 'AFRICA_WEST', currency: 'CVE', trackingType: null,    authority: 'DGA' },
  { code: 'GM', name: 'Gambie',            zone: 'AFRICA_WEST', currency: 'GMD', trackingType: 'ECTN',  authority: 'GPA' },

  // ─── Afrique Centrale ───────────────────────────────────────────────────
  { code: 'CM', name: 'Cameroun',                       zone: 'AFRICA_CENTRAL', currency: 'XAF', trackingType: 'BESC',  authority: 'CNCC' },
  { code: 'GA', name: 'Gabon',                          zone: 'AFRICA_CENTRAL', currency: 'XAF', trackingType: 'BIETC', authority: 'CGC' },
  { code: 'CG', name: 'Congo (Brazzaville)',            zone: 'AFRICA_CENTRAL', currency: 'XAF', trackingType: 'BESC',  authority: 'CCC' },
  { code: 'CD', name: 'République Démocratique du Congo', zone: 'AFRICA_CENTRAL', currency: 'CDF', trackingType: 'FERI',  authority: 'OGEFREM' },
  { code: 'CF', name: 'République Centrafricaine',      zone: 'AFRICA_CENTRAL', currency: 'XAF', trackingType: 'BESC',  authority: 'DGD (RCA)' },
  { code: 'TD', name: 'Tchad',                          zone: 'AFRICA_CENTRAL', currency: 'XAF', trackingType: 'BESC',  authority: 'COC-TCHAD' },
  { code: 'GQ', name: 'Guinée équatoriale',             zone: 'AFRICA_CENTRAL', currency: 'XAF', trackingType: 'BESC',  authority: 'Autorité portuaire' },
  { code: 'ST', name: 'São Tomé-et-Principe',           zone: 'AFRICA_CENTRAL', currency: 'STN', trackingType: null,     authority: 'Alfândegas' },

  // ─── Afrique de l'Est ───────────────────────────────────────────────────
  { code: 'KE', name: 'Kenya',          zone: 'AFRICA_EAST', currency: 'KES', trackingType: null,    authority: 'KRA/KEBS' },
  { code: 'TZ', name: 'Tanzanie',       zone: 'AFRICA_EAST', currency: 'TZS', trackingType: null,    authority: 'TRA/TBS' },
  { code: 'UG', name: 'Ouganda',        zone: 'AFRICA_EAST', currency: 'UGX', trackingType: null,    authority: 'URA/UNBS' },
  { code: 'RW', name: 'Rwanda',         zone: 'AFRICA_EAST', currency: 'RWF', trackingType: null,    authority: 'RRA/RSB' },
  { code: 'BI', name: 'Burundi',        zone: 'AFRICA_EAST', currency: 'BIF', trackingType: null,    authority: 'OBR/BBN' },
  { code: 'SD', name: 'Soudan',         zone: 'AFRICA_EAST', currency: 'SDG', trackingType: 'ECTN',  authority: 'Sudan Customs (ACD)' },
  { code: 'SS', name: 'Soudan du Sud',  zone: 'AFRICA_EAST', currency: 'SSP', trackingType: null,    authority: 'SSCS' },
  { code: 'ET', name: 'Éthiopie',       zone: 'AFRICA_EAST', currency: 'ETB', trackingType: null,    authority: 'ECC' },
  { code: 'ER', name: 'Érythrée',       zone: 'AFRICA_EAST', currency: 'ERN', trackingType: null,    authority: 'Customs Authority' },
  { code: 'DJ', name: 'Djibouti',       zone: 'AFRICA_EAST', currency: 'DJF', trackingType: 'ECTN',  authority: 'Direction des Douanes' },
  { code: 'SO', name: 'Somalie',        zone: 'AFRICA_EAST', currency: 'SOS', trackingType: null,    authority: 'Customs Authority' },

  // ─── Afrique Australe ───────────────────────────────────────────────────
  { code: 'ZA', name: 'Afrique du Sud',  zone: 'AFRICA_SOUTH', currency: 'ZAR', trackingType: null,         authority: 'SARS' },
  { code: 'NA', name: 'Namibie',         zone: 'AFRICA_SOUTH', currency: 'NAD', trackingType: null,         authority: 'NamRA' },
  { code: 'BW', name: 'Botswana',        zone: 'AFRICA_SOUTH', currency: 'BWP', trackingType: null,         authority: 'BURS' },
  { code: 'ZW', name: 'Zimbabwe',        zone: 'AFRICA_SOUTH', currency: 'ZWG', trackingType: null,         authority: 'ZIMRA' },
  { code: 'ZM', name: 'Zambie',          zone: 'AFRICA_SOUTH', currency: 'ZMW', trackingType: null,         authority: 'ZRA' },
  { code: 'MW', name: 'Malawi',          zone: 'AFRICA_SOUTH', currency: 'MWK', trackingType: null,         authority: 'MRA' },
  { code: 'MZ', name: 'Mozambique',      zone: 'AFRICA_SOUTH', currency: 'MZN', trackingType: null,         authority: 'AT' },
  { code: 'AO', name: 'Angola',          zone: 'AFRICA_SOUTH', currency: 'AOA', trackingType: 'CARGO_WAIVER', authority: 'ARCCLA' },
  { code: 'LS', name: 'Lesotho',         zone: 'AFRICA_SOUTH', currency: 'LSL', trackingType: null,         authority: 'LRA' },
  { code: 'SZ', name: 'Eswatini',        zone: 'AFRICA_SOUTH', currency: 'SZL', trackingType: null,         authority: 'ERS' },
  { code: 'MG', name: 'Madagascar',      zone: 'AFRICA_SOUTH', currency: 'MGA', trackingType: 'BSC',         authority: 'GasyNet' },
  { code: 'KM', name: 'Comores',         zone: 'AFRICA_SOUTH', currency: 'KMF', trackingType: null,         authority: 'AGD' },
  { code: 'MU', name: 'Maurice',         zone: 'AFRICA_SOUTH', currency: 'MUR', trackingType: null,         authority: 'MRA Customs' },

  // ─── UE 27 ───────────────────────────────────────────────────────────────
  { code: 'FR', name: 'France',      zone: 'EUROPE_EU', currency: 'EUR', trackingType: null, authority: 'Douane française' },
  { code: 'DE', name: 'Allemagne',   zone: 'EUROPE_EU', currency: 'EUR', trackingType: null, authority: 'Zoll' },
  { code: 'IT', name: 'Italie',      zone: 'EUROPE_EU', currency: 'EUR', trackingType: null, authority: 'Agenzia delle Dogane' },
  { code: 'ES', name: 'Espagne',     zone: 'EUROPE_EU', currency: 'EUR', trackingType: null, authority: 'AEAT' },
  { code: 'PT', name: 'Portugal',    zone: 'EUROPE_EU', currency: 'EUR', trackingType: null, authority: 'AT' },
  { code: 'BE', name: 'Belgique',    zone: 'EUROPE_EU', currency: 'EUR', trackingType: null, authority: 'AGD&A' },
  { code: 'NL', name: 'Pays-Bas',    zone: 'EUROPE_EU', currency: 'EUR', trackingType: null, authority: 'Douane' },
  { code: 'LU', name: 'Luxembourg',  zone: 'EUROPE_EU', currency: 'EUR', trackingType: null, authority: 'ADA' },
  { code: 'AT', name: 'Autriche',    zone: 'EUROPE_EU', currency: 'EUR', trackingType: null, authority: 'Zollamt' },
  { code: 'IE', name: 'Irlande',     zone: 'EUROPE_EU', currency: 'EUR', trackingType: null, authority: 'Revenue' },
  { code: 'FI', name: 'Finlande',    zone: 'EUROPE_EU', currency: 'EUR', trackingType: null, authority: 'Tulli' },
  { code: 'SE', name: 'Suède',       zone: 'EUROPE_EU', currency: 'SEK', trackingType: null, authority: 'Tullverket' },
  { code: 'DK', name: 'Danemark',    zone: 'EUROPE_EU', currency: 'DKK', trackingType: null, authority: 'Toldstyrelsen' },
  { code: 'GR', name: 'Grèce',       zone: 'EUROPE_EU', currency: 'EUR', trackingType: null, authority: 'Customs' },
  { code: 'PL', name: 'Pologne',     zone: 'EUROPE_EU', currency: 'PLN', trackingType: null, authority: 'KAS' },
  { code: 'CZ', name: 'Tchéquie',    zone: 'EUROPE_EU', currency: 'CZK', trackingType: null, authority: 'Celní správa' },
  { code: 'SK', name: 'Slovaquie',   zone: 'EUROPE_EU', currency: 'EUR', trackingType: null, authority: 'Finanční správa' },
  { code: 'HU', name: 'Hongrie',     zone: 'EUROPE_EU', currency: 'HUF', trackingType: null, authority: 'NAV' },
  { code: 'RO', name: 'Roumanie',    zone: 'EUROPE_EU', currency: 'RON', trackingType: null, authority: 'ANAF' },
  { code: 'BG', name: 'Bulgarie',    zone: 'EUROPE_EU', currency: 'BGN', trackingType: null, authority: 'Customs' },
  { code: 'SI', name: 'Slovénie',    zone: 'EUROPE_EU', currency: 'EUR', trackingType: null, authority: 'FURS' },
  { code: 'HR', name: 'Croatie',     zone: 'EUROPE_EU', currency: 'EUR', trackingType: null, authority: 'Carinska uprava' },
  { code: 'EE', name: 'Estonie',     zone: 'EUROPE_EU', currency: 'EUR', trackingType: null, authority: 'EMTA' },
  { code: 'LV', name: 'Lettonie',    zone: 'EUROPE_EU', currency: 'EUR', trackingType: null, authority: 'VID' },
  { code: 'LT', name: 'Lituanie',    zone: 'EUROPE_EU', currency: 'EUR', trackingType: null, authority: 'Muitinė' },
  { code: 'CY', name: 'Chypre',      zone: 'EUROPE_EU', currency: 'EUR', trackingType: null, authority: 'Customs' },
  { code: 'MT', name: 'Malte',       zone: 'EUROPE_EU', currency: 'EUR', trackingType: null, authority: 'Customs' },

  // ─── AELE ────────────────────────────────────────────────────────────────
  { code: 'CH', name: 'Suisse',        zone: 'EUROPE_EFTA', currency: 'CHF', trackingType: null, authority: 'OFDF' },
  { code: 'NO', name: 'Norvège',       zone: 'EUROPE_EFTA', currency: 'NOK', trackingType: null, authority: 'Tolletaten' },
  { code: 'IS', name: 'Islande',       zone: 'EUROPE_EFTA', currency: 'ISK', trackingType: null, authority: 'Skatturinn' },
  { code: 'LI', name: 'Liechtenstein', zone: 'EUROPE_EFTA', currency: 'CHF', trackingType: null, authority: 'OFDF' },

  // ─── Autres Europe ───────────────────────────────────────────────────────
  { code: 'GB', name: 'Royaume-Uni',         zone: 'EUROPE_OTHER', currency: 'GBP', trackingType: null, authority: 'HMRC' },
  { code: 'TR', name: 'Turquie',             zone: 'EUROPE_OTHER', currency: 'TRY', trackingType: null, authority: 'Ticaret Bakanlığı' },
  { code: 'RS', name: 'Serbie',              zone: 'EUROPE_OTHER', currency: 'RSD', trackingType: null, authority: 'Uprava Carina' },
  { code: 'BA', name: 'Bosnie-Herzégovine',  zone: 'EUROPE_OTHER', currency: 'BAM', trackingType: null, authority: 'UIO' },
  { code: 'MK', name: 'Macédoine du Nord',   zone: 'EUROPE_OTHER', currency: 'MKD', trackingType: null, authority: 'Customs Admin.' },
  { code: 'ME', name: 'Monténégro',          zone: 'EUROPE_OTHER', currency: 'EUR', trackingType: null, authority: 'Uprava carina' },
  { code: 'AL', name: 'Albanie',             zone: 'EUROPE_OTHER', currency: 'ALL', trackingType: null, authority: 'Doganat' },
  { code: 'MD', name: 'Moldavie',            zone: 'EUROPE_OTHER', currency: 'MDL', trackingType: null, authority: 'Serviciul Vamal' },
  { code: 'UA', name: 'Ukraine',             zone: 'EUROPE_OTHER', currency: 'UAH', trackingType: null, authority: 'State Customs Service' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

export function findCountrySummary(code: string): CountrySummary | null {
  const c = code.toUpperCase();
  return COUNTRY_SUMMARIES.find((x) => x.code === c) ?? null;
}

/**
 * Groupe les pays par zone, dans l'ordre `ZONE_ORDER`.
 * Renvoie uniquement les zones non vides.
 */
export function groupCountriesByZone(
  countries: { code: string; name: string }[] = [],
): { zone: CountryZone; label: string; items: { code: string; name: string }[] }[] {
  // Si on reçoit une liste partielle (depuis l'API), on enrichit avec la zone
  // connue localement. Sinon on prend toute la matrice.
  const source = countries.length
    ? countries.map((c) => {
        const summary = findCountrySummary(c.code);
        return {
          code: c.code,
          name: c.name,
          zone: summary?.zone ?? ('EUROPE_OTHER' as CountryZone),
        };
      })
    : COUNTRY_SUMMARIES.map((s) => ({ code: s.code, name: s.name, zone: s.zone }));

  return ZONE_ORDER.map((zone) => ({
    zone,
    label: COUNTRY_ZONE_LABEL[zone],
    items: source
      .filter((x) => x.zone === zone)
      .map(({ code, name }) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
  })).filter((g) => g.items.length > 0);
}

/**
 * Recherche tolérante (accent-insensitive) sur nom ou code pays.
 */
export function searchCountries(
  query: string,
  countries: { code: string; name: string }[] = [],
): { code: string; name: string }[] {
  const q = normalize(query);
  if (!q) return countries;
  return countries.filter(
    (c) => normalize(c.name).includes(q) || c.code.toLowerCase().includes(q),
  );
}

function normalize(s: string): string {
  // Supprime les diacritiques (plage Unicode ̀-ͯ = Combining Marks).
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
