import { CargoTrackingType } from '@prisma/client';

export interface RequiredDocument {
  key: string;
  label: string;
  mandatory: boolean;
  note?: string;
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

// ─── Socle documentaire commun à tout import de marchandises ───────────────
// La plupart des pays exigent ce noyau ; chaque pays y ajoute son bordereau.
function baseDocuments(extra: RequiredDocument[] = []): RequiredDocument[] {
  return [
    {
      key: 'commercial_invoice',
      label: 'Facture commerciale',
      mandatory: true,
      note: '3 exemplaires originaux, datés et signés.',
    },
    {
      key: 'packing_list',
      label: 'Liste de colisage',
      mandatory: true,
      note: 'Détail des colis, poids brut/net et dimensions.',
    },
    {
      key: 'bill_of_lading',
      label: 'Connaissement (B/L) ou LTA',
      mandatory: true,
      note: 'Connaissement maritime (B/L) ou lettre de transport aérien (LTA).',
    },
    {
      key: 'certificate_of_origin',
      label: 'Certificat d\'origine',
      mandatory: true,
      note: 'Visé par la chambre de commerce du pays d\'expédition.',
    },
    {
      key: 'insurance_certificate',
      label: 'Attestation d\'assurance',
      mandatory: false,
      note: 'Recommandée pour couvrir la valeur déclarée.',
    },
    ...extra,
  ];
}

function trackingDoc(type: CargoTrackingType, authority: string): RequiredDocument {
  const labels: Record<CargoTrackingType, string> = {
    BSC: 'Bordereau de Suivi de Cargaison (BSC)',
    BESC: 'Bordereau Électronique de Suivi de Cargaison (BESC)',
    ECTN: 'Electronic Cargo Tracking Note (ECTN)',
    BIETC: 'Bordereau d\'Identification Électronique du Transport de Cargaison (BIETC)',
    FERI: 'Fiche Électronique de Renseignement à l\'Importation (FERI)',
    CARGO_WAIVER: 'Cargo Tracking Note',
  };
  return {
    key: 'cargo_tracking_note',
    label: labels[type],
    mandatory: true,
    note: `Obligatoire à l'import — émis par ${authority}. À valider avant l'embarquement.`,
  };
}

// ─── Matrice réglementaire par pays (pilote) ───────────────────────────────
export const COUNTRY_REGULATIONS: CountryRegulationSeed[] = [
  {
    countryCode: 'SN',
    countryName: 'Sénégal',
    cargoTrackingType: CargoTrackingType.BSC,
    cargoMandatory: true,
    authority: 'COSEC (Conseil Sénégalais des Chargeurs)',
    currency: 'XOF',
    customsNotes:
      'Le BSC doit être validé avant l\'arrivée au port de Dakar. Numéro à reporter sur la déclaration douanière.',
    requiredDocuments: baseDocuments([trackingDoc(CargoTrackingType.BSC, 'le COSEC')]),
  },
  {
    countryCode: 'CI',
    countryName: 'Côte d\'Ivoire',
    cargoTrackingType: CargoTrackingType.BSC,
    cargoMandatory: true,
    authority: 'OIC (Office Ivoirien des Chargeurs)',
    currency: 'XOF',
    customsNotes:
      'BSC obligatoire pour le port d\'Abidjan et de San Pedro. Validation avant embarquement requise.',
    requiredDocuments: baseDocuments([trackingDoc(CargoTrackingType.BSC, 'l\'OIC')]),
  },
  {
    countryCode: 'CM',
    countryName: 'Cameroun',
    cargoTrackingType: CargoTrackingType.BESC,
    cargoMandatory: true,
    authority: 'CNCC (Conseil National des Chargeurs du Cameroun)',
    currency: 'XAF',
    customsNotes:
      'Le BESC (parfois appelé BIC) est exigé pour le port de Douala. À établir au départ.',
    requiredDocuments: baseDocuments([trackingDoc(CargoTrackingType.BESC, 'le CNCC')]),
  },
  {
    countryCode: 'BJ',
    countryName: 'Bénin',
    cargoTrackingType: CargoTrackingType.ECTN,
    cargoMandatory: true,
    authority: 'CNCC (Conseil National des Chargeurs du Bénin)',
    currency: 'XOF',
    customsNotes: 'ECTN obligatoire pour le port de Cotonou.',
    requiredDocuments: baseDocuments([trackingDoc(CargoTrackingType.ECTN, 'le CNCC')]),
  },
  {
    countryCode: 'TG',
    countryName: 'Togo',
    cargoTrackingType: CargoTrackingType.ECTN,
    cargoMandatory: true,
    authority: 'CNCC (Conseil National des Chargeurs du Togo)',
    currency: 'XOF',
    customsNotes: 'ECTN obligatoire pour le port de Lomé.',
    requiredDocuments: baseDocuments([trackingDoc(CargoTrackingType.ECTN, 'le CNCC')]),
  },
  {
    countryCode: 'GA',
    countryName: 'Gabon',
    cargoTrackingType: CargoTrackingType.BIETC,
    cargoMandatory: true,
    authority: 'Conseil Gabonais des Chargeurs',
    currency: 'XAF',
    customsNotes: 'Le BIETC est exigé pour le port d\'Owendo / Libreville.',
    requiredDocuments: baseDocuments([trackingDoc(CargoTrackingType.BIETC, 'le Conseil Gabonais des Chargeurs')]),
  },
  {
    countryCode: 'CD',
    countryName: 'République Démocratique du Congo',
    cargoTrackingType: CargoTrackingType.FERI,
    cargoMandatory: true,
    authority: 'OGEFREM (Office de Gestion du Fret Multimodal)',
    currency: 'CDF',
    customsNotes:
      'La FERI est délivrée par l\'OGEFREM. Indispensable pour le dédouanement à Matadi et à l\'est du pays.',
    requiredDocuments: baseDocuments([trackingDoc(CargoTrackingType.FERI, 'l\'OGEFREM')]),
  },
];

/**
 * Déduit le type de bordereau requis pour un pays de destination.
 * Renvoie null si le pays n'est pas couvert / pas concerné.
 */
export function trackingTypeForCountry(countryCode: string): CargoTrackingType | null {
  const reg = COUNTRY_REGULATIONS.find(
    (r) => r.countryCode === countryCode.toUpperCase(),
  );
  return reg?.cargoTrackingType ?? null;
}
