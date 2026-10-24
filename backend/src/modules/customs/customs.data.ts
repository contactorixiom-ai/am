import { CargoTrackingType } from '@prisma/client';
import { AFRICA_SUBSAHARAN_REGULATIONS } from './regulations/africa-subsaharan';
import { EUROPE_REGULATIONS } from './regulations/europe';

/**
 * Catégorie fonctionnelle d'un document de la checklist douanière.
 * Permet de filtrer la liste selon le type d'envoi (colis personnel,
 * marchandise commerciale, véhicule…).
 */
export type DocumentCategory =
  | 'commercial'
  | 'transport'
  | 'origin'
  | 'customs'
  | 'insurance'
  | 'tracking'
  | 'compliance'
  | 'vehicle';

export interface RequiredDocument {
  key: string;
  label: string;
  mandatory: boolean;
  note?: string;
  /** Catégorie fonctionnelle pour filtrer par type d'envoi. */
  category?: DocumentCategory;
  /** État "fourni" calculé à la volée pour un colis (cf. getRequirements). */
  provided?: boolean;
}

export interface CountryRegulationSeed {
  countryCode: string;
  countryName: string;
  cargoTrackingType: CargoTrackingType | null;
  cargoMandatory: boolean;
  authority: string | null;
  currency: string;
  customsNotes: string;
  requiredDocuments: RequiredDocument[];
}

/**
 * Regroupement géographique des pays couverts — utile pour l'UI mobile
 * (sélecteur de pays groupé) et pour le rapport orchestrateur.
 */
export type CountryZone =
  | 'AFRICA_WEST'
  | 'AFRICA_CENTRAL'
  | 'AFRICA_EAST'
  | 'AFRICA_SOUTH'
  | 'EUROPE_EU'
  | 'EUROPE_EFTA'
  | 'EUROPE_OTHER';

const COUNTRY_ZONE: Record<string, CountryZone> = {
  // Afrique de l'Ouest
  SN: 'AFRICA_WEST', CI: 'AFRICA_WEST', ML: 'AFRICA_WEST', BF: 'AFRICA_WEST',
  NE: 'AFRICA_WEST', BJ: 'AFRICA_WEST', TG: 'AFRICA_WEST', GN: 'AFRICA_WEST',
  GW: 'AFRICA_WEST', SL: 'AFRICA_WEST', LR: 'AFRICA_WEST', GH: 'AFRICA_WEST',
  NG: 'AFRICA_WEST', MR: 'AFRICA_WEST', CV: 'AFRICA_WEST', GM: 'AFRICA_WEST',
  // Afrique Centrale
  CM: 'AFRICA_CENTRAL', GA: 'AFRICA_CENTRAL', CG: 'AFRICA_CENTRAL', CD: 'AFRICA_CENTRAL',
  CF: 'AFRICA_CENTRAL', TD: 'AFRICA_CENTRAL', GQ: 'AFRICA_CENTRAL', ST: 'AFRICA_CENTRAL',
  // Afrique de l'Est
  KE: 'AFRICA_EAST', TZ: 'AFRICA_EAST', UG: 'AFRICA_EAST', RW: 'AFRICA_EAST',
  BI: 'AFRICA_EAST', SD: 'AFRICA_EAST', SS: 'AFRICA_EAST', ET: 'AFRICA_EAST',
  ER: 'AFRICA_EAST', DJ: 'AFRICA_EAST', SO: 'AFRICA_EAST',
  // Afrique Australe
  ZA: 'AFRICA_SOUTH', NA: 'AFRICA_SOUTH', BW: 'AFRICA_SOUTH', ZW: 'AFRICA_SOUTH',
  ZM: 'AFRICA_SOUTH', MW: 'AFRICA_SOUTH', MZ: 'AFRICA_SOUTH', AO: 'AFRICA_SOUTH',
  LS: 'AFRICA_SOUTH', SZ: 'AFRICA_SOUTH', MG: 'AFRICA_SOUTH', KM: 'AFRICA_SOUTH',
  MU: 'AFRICA_SOUTH',
  // UE 27
  FR: 'EUROPE_EU', DE: 'EUROPE_EU', IT: 'EUROPE_EU', ES: 'EUROPE_EU',
  PT: 'EUROPE_EU', BE: 'EUROPE_EU', NL: 'EUROPE_EU', LU: 'EUROPE_EU',
  AT: 'EUROPE_EU', IE: 'EUROPE_EU', FI: 'EUROPE_EU', SE: 'EUROPE_EU',
  DK: 'EUROPE_EU', GR: 'EUROPE_EU', PL: 'EUROPE_EU', CZ: 'EUROPE_EU',
  SK: 'EUROPE_EU', HU: 'EUROPE_EU', RO: 'EUROPE_EU', BG: 'EUROPE_EU',
  SI: 'EUROPE_EU', HR: 'EUROPE_EU', EE: 'EUROPE_EU', LV: 'EUROPE_EU',
  LT: 'EUROPE_EU', CY: 'EUROPE_EU', MT: 'EUROPE_EU',
  // AELE
  CH: 'EUROPE_EFTA', NO: 'EUROPE_EFTA', IS: 'EUROPE_EFTA', LI: 'EUROPE_EFTA',
  // Autres Europe
  GB: 'EUROPE_OTHER', TR: 'EUROPE_OTHER', RS: 'EUROPE_OTHER', BA: 'EUROPE_OTHER',
  MK: 'EUROPE_OTHER', ME: 'EUROPE_OTHER', AL: 'EUROPE_OTHER', MD: 'EUROPE_OTHER',
  UA: 'EUROPE_OTHER',
};

export const COUNTRY_ZONE_LABEL: Record<CountryZone, string> = {
  AFRICA_WEST: 'Afrique de l\'Ouest',
  AFRICA_CENTRAL: 'Afrique Centrale',
  AFRICA_EAST: 'Afrique de l\'Est',
  AFRICA_SOUTH: 'Afrique Australe',
  EUROPE_EU: 'Union européenne',
  EUROPE_EFTA: 'AELE',
  EUROPE_OTHER: 'Autres Europe',
};

export function zoneForCountry(countryCode: string): CountryZone | null {
  return COUNTRY_ZONE[countryCode.toUpperCase()] ?? null;
}

// ─── Matrice réglementaire complète ────────────────────────────────────────
// On délègue le détail par région à `regulations/*.ts` pour garder ce fichier
// digeste. Tout ajout ou correction passe par les fichiers régionaux.
export const COUNTRY_REGULATIONS: CountryRegulationSeed[] = [
  ...AFRICA_SUBSAHARAN_REGULATIONS,
  ...EUROPE_REGULATIONS,
];

/**
 * Récupère la fiche réglementaire d'un pays (insensible à la casse).
 * Helper exporté pour les tests, le seed et les consommateurs externes.
 */
export function findRegulation(countryCode: string): CountryRegulationSeed | null {
  const code = countryCode.toUpperCase();
  return COUNTRY_REGULATIONS.find((r) => r.countryCode === code) ?? null;
}

/**
 * Déduit le type de bordereau requis pour un pays de destination.
 * Renvoie null si le pays n'est pas couvert / pas concerné.
 */
export function trackingTypeForCountry(countryCode: string): CargoTrackingType | null {
  return findRegulation(countryCode)?.cargoTrackingType ?? null;
}

/**
 * Filtre la checklist douanière selon le type d'envoi.
 * - `parcel`        : envoi standard de marchandise / colis (exclut `vehicle`).
 * - `vehicle`       : convoyage de véhicule (n'exclut rien, ajoute le bloc véhicule).
 * - `personalParcel`: colis perso (assurance et compliance recommandés, vehicle exclu).
 * - `commercial`    : marchandise commerciale (toutes catégories sauf vehicle).
 */
export type ShipmentKind = 'parcel' | 'vehicle' | 'personalParcel' | 'commercial';

export function filterDocumentsForShipment(
  docs: RequiredDocument[],
  kind: ShipmentKind,
): RequiredDocument[] {
  if (kind === 'vehicle') return docs;
  // Tous les autres types n'ont pas besoin des docs spécifiques véhicule.
  return docs.filter((d) => d.category !== 'vehicle');
}
