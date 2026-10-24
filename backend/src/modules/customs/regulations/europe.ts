import type { CountryRegulationSeed, RequiredDocument } from '../customs.data';

// ─── Helpers locaux ────────────────────────────────────────────────────────
// Échanges intra-UE : pas de douane, juste DEB/INTRASTAT pour les pros.
function euDocs(extra: RequiredDocument[] = []): RequiredDocument[] {
  return [
    {
      key: 'commercial_invoice',
      label: 'Facture commerciale',
      mandatory: true,
      category: 'commercial',
      note: 'Mention TVA intracommunautaire pour les pros.',
    },
    {
      key: 'packing_list',
      label: 'Liste de colisage',
      mandatory: false,
      category: 'commercial',
      note: 'Recommandée dès qu\'il y a plusieurs colis.',
    },
    {
      key: 'cmr',
      label: 'Lettre de voiture CMR',
      mandatory: true,
      category: 'transport',
      note: 'Document de transport routier international.',
    },
    {
      key: 'eori_number',
      label: 'Numéro EORI',
      mandatory: false,
      category: 'compliance',
      note: 'Obligatoire pour les professionnels qui dédouanent.',
    },
    {
      key: 'insurance_certificate',
      label: 'Attestation d\'assurance',
      mandatory: false,
      category: 'insurance',
    },
    ...extra,
  ];
}

// Échanges hors UE (UK post-Brexit, AELE, Balkans…) : douane requise.
function thirdCountryDocs(extra: RequiredDocument[] = []): RequiredDocument[] {
  return [
    {
      key: 'commercial_invoice',
      label: 'Facture commerciale',
      mandatory: true,
      category: 'commercial',
      note: '3 exemplaires datés et signés.',
    },
    {
      key: 'packing_list',
      label: 'Liste de colisage',
      mandatory: true,
      category: 'commercial',
    },
    {
      key: 'transport_document',
      label: 'Document de transport (CMR / B/L / LTA)',
      mandatory: true,
      category: 'transport',
    },
    {
      key: 'certificate_of_origin',
      label: 'Certificat d\'origine',
      mandatory: true,
      category: 'origin',
      note: 'EUR.1 ou EUR-MED selon les accords en vigueur.',
    },
    {
      key: 'eori_number',
      label: 'Numéro EORI',
      mandatory: true,
      category: 'compliance',
    },
    {
      key: 'insurance_certificate',
      label: 'Attestation d\'assurance',
      mandatory: false,
      category: 'insurance',
    },
    ...extra,
  ];
}

const VEHICLE_DOCS_EU: RequiredDocument[] = [
  { key: 'vehicle_registration', label: 'Carte grise (certificat d\'immatriculation)', mandatory: true, category: 'vehicle' },
  { key: 'vehicle_non_pledge', label: 'Certificat de non-gage / situation administrative', mandatory: true, category: 'vehicle', note: 'Datant de moins de 30 jours.' },
  { key: 'vehicle_coc', label: 'Certificat de conformité européen (COC)', mandatory: false, category: 'vehicle' },
];

const VEHICLE_DOCS_THIRD: RequiredDocument[] = [
  ...VEHICLE_DOCS_EU,
  { key: 'vehicle_deregistration', label: 'Certificat de désimmatriculation', mandatory: true, category: 'vehicle' },
];

const INTRASTAT_NOTE =
  'Union douanière, échanges intra-UE simplifiés (DEB/INTRASTAT pour les pros). EORI requis pour les pros.';

// Génère une fiche UE standard.
function euCountry(
  code: string,
  name: string,
  customsNotes: string = INTRASTAT_NOTE,
  currency: string = 'EUR',
): CountryRegulationSeed {
  return {
    countryCode: code,
    countryName: name,
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'Autorité douanière nationale (Union douanière européenne)',
    currency,
    customsNotes,
    requiredDocuments: euDocs(VEHICLE_DOCS_EU),
  };
}

// ─── Matrice Europe ────────────────────────────────────────────────────────
export const EUROPE_REGULATIONS: CountryRegulationSeed[] = [
  // ════════════════════════════════════════════════════════════════════════
  //  UE 27 — Union douanière
  // ════════════════════════════════════════════════════════════════════════
  euCountry('FR', 'France', 'Pays d\'origine principal Axis Import. ' + INTRASTAT_NOTE),
  euCountry('DE', 'Allemagne'),
  euCountry('IT', 'Italie'),
  euCountry('ES', 'Espagne'),
  euCountry('PT', 'Portugal'),
  euCountry('BE', 'Belgique'),
  euCountry('NL', 'Pays-Bas'),
  euCountry('LU', 'Luxembourg'),
  euCountry('AT', 'Autriche'),
  euCountry('IE', 'Irlande'),
  euCountry('FI', 'Finlande'),
  euCountry('SE', 'Suède'),
  euCountry('DK', 'Danemark'),
  euCountry('GR', 'Grèce'),
  euCountry('PL', 'Pologne', INTRASTAT_NOTE, 'PLN'),
  euCountry('CZ', 'Tchéquie', INTRASTAT_NOTE, 'CZK'),
  euCountry('SK', 'Slovaquie'),
  euCountry('HU', 'Hongrie', INTRASTAT_NOTE, 'HUF'),
  euCountry('RO', 'Roumanie', INTRASTAT_NOTE, 'RON'),
  euCountry('BG', 'Bulgarie', INTRASTAT_NOTE, 'BGN'),
  euCountry('SI', 'Slovénie'),
  euCountry('HR', 'Croatie'),
  euCountry('EE', 'Estonie'),
  euCountry('LV', 'Lettonie'),
  euCountry('LT', 'Lituanie'),
  euCountry('CY', 'Chypre'),
  euCountry('MT', 'Malte'),

  // ════════════════════════════════════════════════════════════════════════
  //  AELE — accords spécifiques avec l'UE
  // ════════════════════════════════════════════════════════════════════════
  {
    countryCode: 'CH',
    countryName: 'Suisse',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'OFDF (Office Fédéral de la Douane et de la Sécurité des Frontières)',
    currency: 'CHF',
    customsNotes:
      'Pays AELE — hors UE. Déclaration douanière requise (e-dec/Passar). EUR.1 ou EUR-MED pour bénéficier des préférences tarifaires. TVA suisse à l\'import (8,1 %).',
    requiredDocuments: thirdCountryDocs([
      { key: 'eur1_certificate', label: 'Certificat de circulation EUR.1', mandatory: false, category: 'origin', note: 'Pour bénéficier des préférences tarifaires UE/CH.' },
      ...VEHICLE_DOCS_THIRD,
    ]),
  },
  {
    countryCode: 'NO',
    countryName: 'Norvège',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'Tolletaten (Norwegian Customs)',
    currency: 'NOK',
    customsNotes:
      'AELE/EEE. Déclaration via TVINN. EUR.1 ou EUR-MED pour préférences tarifaires. TVA norvégienne (25 %) à l\'import.',
    requiredDocuments: thirdCountryDocs([
      { key: 'eur1_certificate', label: 'Certificat de circulation EUR.1', mandatory: false, category: 'origin' },
      ...VEHICLE_DOCS_THIRD,
    ]),
  },
  {
    countryCode: 'IS',
    countryName: 'Islande',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'Skatturinn (Iceland Revenue and Customs)',
    currency: 'ISK',
    customsNotes:
      'AELE/EEE. EUR.1 pour préférences tarifaires. Déclaration douanière obligatoire.',
    requiredDocuments: thirdCountryDocs([
      { key: 'eur1_certificate', label: 'Certificat de circulation EUR.1', mandatory: false, category: 'origin' },
      ...VEHICLE_DOCS_THIRD,
    ]),
  },
  {
    countryCode: 'LI',
    countryName: 'Liechtenstein',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'OFDF (union douanière avec la Suisse)',
    currency: 'CHF',
    customsNotes:
      'Union douanière avec la Suisse — mêmes règles que CH. AELE/EEE.',
    requiredDocuments: thirdCountryDocs([
      { key: 'eur1_certificate', label: 'Certificat de circulation EUR.1', mandatory: false, category: 'origin' },
      ...VEHICLE_DOCS_THIRD,
    ]),
  },

  // ════════════════════════════════════════════════════════════════════════
  //  AUTRES EUROPE — hors UE / hors AELE
  // ════════════════════════════════════════════════════════════════════════
  {
    countryCode: 'GB',
    countryName: 'Royaume-Uni',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'HM Revenue & Customs (HMRC)',
    currency: 'GBP',
    customsNotes:
      'Post-Brexit : douane complète. CDS (Customs Declaration Service) remplace CHIEF. GVMS pour le pré-enregistrement RoRo. EORI GB requis. EUR.1 ou déclaration d\'origine pour les préférences UE/UK (accord TCA).',
    requiredDocuments: thirdCountryDocs([
      { key: 'gvms_grn', label: 'Numéro GMR (GVMS Goods Movement Reference)', mandatory: true, category: 'compliance', note: 'Obligatoire pour les flux RoRo.' },
      { key: 'eori_gb', label: 'Numéro EORI GB', mandatory: true, category: 'compliance' },
      ...VEHICLE_DOCS_THIRD,
    ]),
  },
  {
    countryCode: 'TR',
    countryName: 'Turquie',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'Ticaret Bakanlığı (Ministère du Commerce)',
    currency: 'TRY',
    customsNotes:
      'Union douanière avec l\'UE (depuis 1995) pour les produits industriels. Certificat A.TR remplace EUR.1 pour les produits couverts. Pour les autres, EUR.1/EUR-MED.',
    requiredDocuments: thirdCountryDocs([
      { key: 'atr_certificate', label: 'Certificat A.TR', mandatory: true, category: 'origin', note: 'Pour les produits couverts par l\'union douanière UE/TR.' },
      ...VEHICLE_DOCS_THIRD,
    ]),
  },
  {
    countryCode: 'RS',
    countryName: 'Serbie',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'Uprava Carina (Serbian Customs Administration)',
    currency: 'RSD',
    customsNotes:
      'Accord de Stabilisation et d\'Association avec l\'UE. EUR.1 ou déclaration d\'origine. Déclaration via NCTS.',
    requiredDocuments: thirdCountryDocs([
      { key: 'eur1_certificate', label: 'Certificat de circulation EUR.1', mandatory: false, category: 'origin' },
      ...VEHICLE_DOCS_THIRD,
    ]),
  },
  {
    countryCode: 'BA',
    countryName: 'Bosnie-Herzégovine',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'Uprava za indirektno oporezivanje (UIO)',
    currency: 'BAM',
    customsNotes:
      'ASA avec l\'UE. EUR.1 pour préférences tarifaires. Procédure CEFTA possible avec les pays des Balkans.',
    requiredDocuments: thirdCountryDocs([
      { key: 'eur1_certificate', label: 'Certificat de circulation EUR.1', mandatory: false, category: 'origin' },
      ...VEHICLE_DOCS_THIRD,
    ]),
  },
  {
    countryCode: 'MK',
    countryName: 'Macédoine du Nord',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'Customs Administration of North Macedonia',
    currency: 'MKD',
    customsNotes:
      'Candidat UE. ASA avec l\'UE. EUR.1 pour préférences tarifaires.',
    requiredDocuments: thirdCountryDocs([
      { key: 'eur1_certificate', label: 'Certificat de circulation EUR.1', mandatory: false, category: 'origin' },
      ...VEHICLE_DOCS_THIRD,
    ]),
  },
  {
    countryCode: 'ME',
    countryName: 'Monténégro',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'Uprava carina Crne Gore',
    currency: 'EUR',
    customsNotes:
      'Candidat UE. ASA avec l\'UE. Utilise l\'euro de fait. EUR.1 pour préférences tarifaires.',
    requiredDocuments: thirdCountryDocs([
      { key: 'eur1_certificate', label: 'Certificat de circulation EUR.1', mandatory: false, category: 'origin' },
      ...VEHICLE_DOCS_THIRD,
    ]),
  },
  {
    countryCode: 'AL',
    countryName: 'Albanie',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'Drejtoria e Përgjithshme e Doganave',
    currency: 'ALL',
    customsNotes:
      'Candidat UE. ASA avec l\'UE. EUR.1 pour préférences tarifaires. Port principal : Durrës.',
    requiredDocuments: thirdCountryDocs([
      { key: 'eur1_certificate', label: 'Certificat de circulation EUR.1', mandatory: false, category: 'origin' },
      ...VEHICLE_DOCS_THIRD,
    ]),
  },
  {
    countryCode: 'MD',
    countryName: 'Moldavie',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'Serviciul Vamal al Republicii Moldova',
    currency: 'MDL',
    customsNotes:
      'Candidat UE. DCFTA en vigueur. EUR.1 ou déclaration d\'origine pour préférences tarifaires.',
    requiredDocuments: thirdCountryDocs([
      { key: 'eur1_certificate', label: 'Certificat de circulation EUR.1', mandatory: false, category: 'origin' },
      ...VEHICLE_DOCS_THIRD,
    ]),
  },
  {
    countryCode: 'UA',
    countryName: 'Ukraine',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'State Customs Service of Ukraine',
    currency: 'UAH',
    customsNotes:
      'Candidat UE. DCFTA + mesures temporaires de libéralisation (2022+). Vérifier le contexte sécuritaire et les zones accessibles. EUR.1 ou déclaration sur facture.',
    requiredDocuments: thirdCountryDocs([
      { key: 'eur1_certificate', label: 'Certificat de circulation EUR.1', mandatory: false, category: 'origin' },
      ...VEHICLE_DOCS_THIRD,
    ]),
  },
];
