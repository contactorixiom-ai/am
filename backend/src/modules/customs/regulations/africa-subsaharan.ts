import { CargoTrackingType } from '@prisma/client';
import type { CountryRegulationSeed, RequiredDocument } from '../customs.data';

// ─── Helpers locaux ────────────────────────────────────────────────────────
// Socle documentaire commun pour un envoi de marchandises vers l'Afrique :
// facture, packing list, B/L ou LTA, certificat d'origine, assurance.
function baseDocs(extra: RequiredDocument[] = []): RequiredDocument[] {
  return [
    {
      key: 'commercial_invoice',
      label: 'Facture commerciale',
      mandatory: true,
      category: 'commercial',
      note: '3 exemplaires originaux, datés et signés.',
    },
    {
      key: 'packing_list',
      label: 'Liste de colisage',
      mandatory: true,
      category: 'commercial',
      note: 'Détail des colis, poids brut/net et dimensions.',
    },
    {
      key: 'bill_of_lading',
      label: 'Connaissement (B/L) ou LTA',
      mandatory: true,
      category: 'transport',
      note: 'Connaissement maritime (B/L) ou lettre de transport aérien (LTA).',
    },
    {
      key: 'certificate_of_origin',
      label: 'Certificat d\'origine',
      mandatory: true,
      category: 'origin',
      note: 'Visé par la chambre de commerce du pays d\'expédition.',
    },
    {
      key: 'insurance_certificate',
      label: 'Attestation d\'assurance',
      mandatory: false,
      category: 'insurance',
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
    BIETC: 'Bordereau d\'Identification Électronique de Traçabilité des Cargaisons (BIETC)',
    FERI: 'Fiche Électronique de Renseignement à l\'Importation (FERI)',
    CARGO_WAIVER: 'Cargo Tracking Note',
  };
  return {
    key: 'cargo_tracking_note',
    label: labels[type],
    mandatory: true,
    category: 'tracking',
    note: `Obligatoire à l'import — émis par ${authority}. À valider avant l'embarquement.`,
  };
}

// Documents véhicule (import voiture, deux-roues, engin)
const VEHICLE_DOCS: RequiredDocument[] = [
  { key: 'vehicle_registration', label: 'Carte grise (certificat d\'immatriculation)', mandatory: true, category: 'vehicle' },
  { key: 'vehicle_non_pledge', label: 'Certificat de non-gage', mandatory: true, category: 'vehicle', note: 'Datant de moins de 30 jours.' },
  { key: 'vehicle_deregistration', label: 'Certificat de désimmatriculation / cession', mandatory: false, category: 'vehicle' },
];

// ─── Matrice Afrique subsaharienne ─────────────────────────────────────────
export const AFRICA_SUBSAHARAN_REGULATIONS: CountryRegulationSeed[] = [
  // ════════════════════════════════════════════════════════════════════════
  //  AFRIQUE DE L'OUEST
  // ════════════════════════════════════════════════════════════════════════
  {
    countryCode: 'SN',
    countryName: 'Sénégal',
    cargoTrackingType: CargoTrackingType.BSC,
    cargoMandatory: true,
    authority: 'COSEC (Conseil Sénégalais des Chargeurs)',
    currency: 'XOF',
    customsNotes:
      'Le BSC doit être validé avant l\'arrivée au port de Dakar. Numéro à reporter sur la déclaration douanière. Préfinancement possible auprès du correspondant COSEC en Europe.',
    requiredDocuments: baseDocs([
      trackingDoc(CargoTrackingType.BSC, 'le COSEC'),
      ...VEHICLE_DOCS,
    ]),
  },
  {
    countryCode: 'CI',
    countryName: 'Côte d\'Ivoire',
    cargoTrackingType: CargoTrackingType.BSC,
    cargoMandatory: true,
    authority: 'OIC (Office Ivoirien des Chargeurs)',
    currency: 'XOF',
    customsNotes:
      'BSC obligatoire pour les ports d\'Abidjan et de San Pedro. Validation avant embarquement requise. Inspection Webb Fontaine possible.',
    requiredDocuments: baseDocs([
      trackingDoc(CargoTrackingType.BSC, 'l\'OIC'),
      ...VEHICLE_DOCS,
    ]),
  },
  {
    countryCode: 'ML',
    countryName: 'Mali',
    cargoTrackingType: CargoTrackingType.BSC,
    cargoMandatory: true,
    authority: 'CMC (Conseil Malien des Chargeurs)',
    currency: 'XOF',
    customsNotes:
      'Le BSC est exigé pour toute marchandise transitant par les ports de Dakar, Abidjan, Lomé, Conakry ou Tema à destination du Mali (pays enclavé). Émis par le CMC (Conseil Malien des Chargeurs).',
    requiredDocuments: baseDocs([trackingDoc(CargoTrackingType.BSC, 'le CMC'), ...VEHICLE_DOCS]),
  },
  {
    countryCode: 'BF',
    countryName: 'Burkina Faso',
    cargoTrackingType: CargoTrackingType.ECTN,
    cargoMandatory: true,
    authority: 'CBC (Conseil Burkinabè des Chargeurs)',
    currency: 'XOF',
    customsNotes:
      'ECTN obligatoire pour tout fret à destination du Burkina (pays enclavé, transit principalement par Lomé, Abidjan, Tema). Émis par le CBC.',
    requiredDocuments: baseDocs([trackingDoc(CargoTrackingType.ECTN, 'le CBC'), ...VEHICLE_DOCS]),
  },
  {
    countryCode: 'NE',
    countryName: 'Niger',
    cargoTrackingType: CargoTrackingType.ECTN,
    cargoMandatory: true,
    authority: 'CNUT (Conseil Nigérien des Utilisateurs des Transports Publics)',
    currency: 'XOF',
    customsNotes:
      'ECTN obligatoire pour tout import à destination du Niger (pays enclavé, transit Cotonou ou Lomé).',
    requiredDocuments: baseDocs([trackingDoc(CargoTrackingType.ECTN, 'le CNUT'), ...VEHICLE_DOCS]),
  },
  {
    countryCode: 'BJ',
    countryName: 'Bénin',
    cargoTrackingType: CargoTrackingType.BESC,
    cargoMandatory: true,
    authority: 'PAC (Port Autonome de Cotonou) — anciennement CNCB',
    currency: 'XOF',
    customsNotes:
      'BESC (Bordereau Électronique de Suivi des Cargaisons) obligatoire pour le port de Cotonou, à valider 5 jours avant l\'arrivée du navire. Géré par le Port Autonome de Cotonou (PAC) depuis l\'arrêté n°019 d\'octobre 2021 (auparavant CNCB).',
    requiredDocuments: baseDocs([trackingDoc(CargoTrackingType.BESC, 'le PAC'), ...VEHICLE_DOCS]),
  },
  {
    countryCode: 'TG',
    countryName: 'Togo',
    cargoTrackingType: CargoTrackingType.ECTN,
    cargoMandatory: true,
    authority: 'CNCT (Conseil National des Chargeurs du Togo)',
    currency: 'XOF',
    customsNotes:
      'ECTN obligatoire pour le port de Lomé. Référence à mentionner sur la déclaration douanière.',
    requiredDocuments: baseDocs([trackingDoc(CargoTrackingType.ECTN, 'le CNCT'), ...VEHICLE_DOCS]),
  },
  {
    countryCode: 'GN',
    countryName: 'Guinée',
    cargoTrackingType: CargoTrackingType.ECTN,
    cargoMandatory: true,
    authority: 'CGC (Conseil Guinéen des Chargeurs)',
    currency: 'GNF',
    customsNotes:
      'ECTN/BSC exigé pour le port de Conakry (décret N° D/2011/305/PRG/SGG depuis 2011, renforcé par décret 2018/10/1/2/2/MT). Validation avant embarquement par le correspondant CGC.',
    requiredDocuments: baseDocs([trackingDoc(CargoTrackingType.ECTN, 'le CGC'), ...VEHICLE_DOCS]),
  },
  {
    // TODO: à confirmer — délégataire officiel (Catalyst Business Solutions / Antaser selon les périodes).
    countryCode: 'GW',
    countryName: 'Guinée-Bissau',
    cargoTrackingType: CargoTrackingType.ECTN,
    cargoMandatory: true,
    authority: 'Direção Geral das Alfândegas (gestion déléguée à un prestataire agréé)',
    currency: 'XOF',
    customsNotes:
      'CEE (Certificado Eletrônico de Embarque), équivalent ECTN/BSC, exigé pour le port de Bissau (Porto Pidjiguiti) depuis 2011. Gestion opérationnelle déléguée à un prestataire agréé.',
    requiredDocuments: baseDocs([trackingDoc(CargoTrackingType.ECTN, 'le prestataire agréé'), ...VEHICLE_DOCS]),
  },
  {
    countryCode: 'SL',
    countryName: 'Sierra Leone',
    cargoTrackingType: CargoTrackingType.ECTN,
    cargoMandatory: true,
    authority: 'Sierra Leone Maritime Administration (SLMA)',
    currency: 'SLE',
    customsNotes:
      'ECTN obligatoire pour le port de Freetown (Queen Elizabeth II Quay).',
    requiredDocuments: baseDocs([trackingDoc(CargoTrackingType.ECTN, 'la SLMA'), ...VEHICLE_DOCS]),
  },
  {
    countryCode: 'LR',
    countryName: 'Liberia',
    cargoTrackingType: CargoTrackingType.ECTN,
    cargoMandatory: true,
    authority: 'National Port Authority (NPA) of Liberia',
    currency: 'LRD',
    customsNotes:
      'CTN/ECTN obligatoire pour le port de Monrovia (Freeport of Monrovia), Greenville et autres ports liberiens. Imposé par la NPA depuis 2018.',
    requiredDocuments: baseDocs([trackingDoc(CargoTrackingType.ECTN, 'la NPA'), ...VEHICLE_DOCS]),
  },
  {
    countryCode: 'GH',
    countryName: 'Ghana',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'Ghana Shippers\' Authority (GSA)',
    currency: 'GHS',
    customsNotes:
      'CTN suspendu depuis 2024. Une réintroduction sous forme de SPN (Smart Port Note) était prévue pour le 1er février 2026 par la GSA mais a été reportée sine die suite à l\'opposition des opérateurs. Conformité produit (CCVR — Conformity Certificate Verification Report) requise via Ghana Standards Authority. ICUMS (Integrated Customs Management System) pour le dédouanement.',
    requiredDocuments: baseDocs([
      { key: 'ccvr_certificate', label: 'CCVR (Conformity Certificate)', mandatory: true, category: 'compliance', note: 'Émis avant embarquement par un organisme agréé (Bureau Veritas, Cotecna, Intertek).' },
      ...VEHICLE_DOCS,
    ]),
  },
  {
    countryCode: 'NG',
    countryName: 'Nigeria',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'Nigerian Shippers\' Council (NSC) / SON',
    currency: 'NGN',
    customsNotes:
      'CTN suspendu. Mais SONCAP obligatoire (Standards Organisation of Nigeria Conformity Assessment Programme) pour la plupart des produits réglementés. Form M et PAAR via le système NICIS.',
    requiredDocuments: baseDocs([
      { key: 'soncap_certificate', label: 'SONCAP Certificate', mandatory: true, category: 'compliance', note: 'Certificat de conformité émis avant embarquement.' },
      { key: 'form_m', label: 'Form M', mandatory: true, category: 'compliance', note: 'Déclaration préalable à toute importation au Nigeria.' },
      ...VEHICLE_DOCS,
    ]),
  },
  {
    // TODO: à confirmer — l'émetteur du BSC en Mauritanie n'est pas formellement identifié dans nos sources publiques (DGD ou PANPA / Port Autonome de Nouakchott).
    countryCode: 'MR',
    countryName: 'Mauritanie',
    cargoTrackingType: CargoTrackingType.BSC,
    cargoMandatory: true,
    authority: 'Direction Générale des Douanes (DGD) — TODO à confirmer',
    currency: 'MRU',
    customsNotes:
      'BSC/ECTN exigé pour les ports de Nouakchott (PANPA — Port Autonome de Nouakchott) et Nouadhibou. Visa préalable de l\'autorité portuaire.',
    requiredDocuments: baseDocs([trackingDoc(CargoTrackingType.BSC, 'l\'autorité douanière mauritanienne'), ...VEHICLE_DOCS]),
  },
  {
    countryCode: 'CV',
    countryName: 'Cap-Vert',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'Direção Geral das Alfândegas',
    currency: 'CVE',
    customsNotes:
      'Pas de CTN obligatoire. Procédure simplifiée pour les colis personnels < 1000 EUR. Déclaration via SYDONIA World.',
    requiredDocuments: baseDocs(VEHICLE_DOCS),
  },
  {
    countryCode: 'GM',
    countryName: 'Gambie',
    cargoTrackingType: CargoTrackingType.ECTN,
    cargoMandatory: true,
    authority: 'Gambia Ports Authority (GPA)',
    currency: 'GMD',
    customsNotes:
      'CTN exigé pour le port de Banjul. Validation avant embarquement.',
    requiredDocuments: baseDocs([trackingDoc(CargoTrackingType.ECTN, 'la GPA'), ...VEHICLE_DOCS]),
  },

  // ════════════════════════════════════════════════════════════════════════
  //  AFRIQUE CENTRALE
  // ════════════════════════════════════════════════════════════════════════
  {
    countryCode: 'CM',
    countryName: 'Cameroun',
    cargoTrackingType: CargoTrackingType.BESC,
    cargoMandatory: true,
    authority: 'CNCC (Conseil National des Chargeurs du Cameroun)',
    currency: 'XAF',
    customsNotes:
      'BESC obligatoire pour les ports de Douala et de Kribi, validé par le CNCC. À établir au départ. Référence à reporter sur la déclaration douanière.',
    requiredDocuments: baseDocs([trackingDoc(CargoTrackingType.BESC, 'le CNCC'), ...VEHICLE_DOCS]),
  },
  {
    countryCode: 'GA',
    countryName: 'Gabon',
    cargoTrackingType: CargoTrackingType.BIETC,
    cargoMandatory: true,
    authority: 'CGC (Conseil Gabonais des Chargeurs)',
    currency: 'XAF',
    customsNotes:
      'Le BIETC est exigé pour les ports d\'Owendo, Libreville et Port-Gentil. Émission préalable obligatoire.',
    requiredDocuments: baseDocs([trackingDoc(CargoTrackingType.BIETC, 'le CGC'), ...VEHICLE_DOCS]),
  },
  {
    countryCode: 'CG',
    countryName: 'Congo (Brazzaville)',
    cargoTrackingType: CargoTrackingType.BESC,
    cargoMandatory: true,
    authority: 'CCC (Conseil Congolais des Chargeurs)',
    currency: 'XAF',
    customsNotes:
      'BESC obligatoire pour le port de Pointe-Noire. Référence sur la déclaration douanière.',
    requiredDocuments: baseDocs([trackingDoc(CargoTrackingType.BESC, 'le CCC'), ...VEHICLE_DOCS]),
  },
  {
    countryCode: 'CD',
    countryName: 'République Démocratique du Congo',
    cargoTrackingType: CargoTrackingType.FERI,
    cargoMandatory: true,
    authority: 'OGEFREM (Office de Gestion du Fret Multimodal)',
    currency: 'CDF',
    customsNotes:
      'La FERI est délivrée par l\'OGEFREM. Indispensable pour le dédouanement à Matadi, Boma et à l\'est du pays (Goma, Bukavu, Lubumbashi).',
    requiredDocuments: baseDocs([trackingDoc(CargoTrackingType.FERI, 'l\'OGEFREM'), ...VEHICLE_DOCS]),
  },
  {
    // TODO: à confirmer — la RCA n'a pas de Conseil National des Chargeurs. Selon plusieurs sources, le BESC est émis par la Direction Générale des Douanes ; un accord 2023 délègue l'opérationnel à JSL Africa SAS / SAIGE pour la zone Cameroun↔RCA.
    countryCode: 'CF',
    countryName: 'République Centrafricaine',
    cargoTrackingType: CargoTrackingType.BESC,
    cargoMandatory: true,
    authority: 'Direction Générale des Douanes (RCA)',
    currency: 'XAF',
    customsNotes:
      'BESC requis pour tout import/export (pays enclavé, transit principalement par Douala ou Pointe-Noire). La RCA ne dispose pas d\'un Conseil National des Chargeurs : l\'émission est gérée par la Direction Générale des Douanes, avec délégation opérationnelle à des partenaires agréés (JSL Africa, SAIGE depuis 2023).',
    requiredDocuments: baseDocs([trackingDoc(CargoTrackingType.BESC, 'la Direction Générale des Douanes'), ...VEHICLE_DOCS]),
  },
  {
    countryCode: 'TD',
    countryName: 'Tchad',
    cargoTrackingType: CargoTrackingType.BESC,
    cargoMandatory: true,
    authority: 'COC-TCHAD (Conseil des Chargeurs du Tchad)',
    currency: 'XAF',
    customsNotes:
      'BESC/ECTN obligatoire (pays enclavé, transit principalement par Douala). Validation au plus tard 5 jours avant l\'arrivée du navire. Géré par le Conseil des Chargeurs du Tchad (COC-TCHAD).',
    requiredDocuments: baseDocs([trackingDoc(CargoTrackingType.BESC, 'COC-TCHAD'), ...VEHICLE_DOCS]),
  },
  {
    countryCode: 'GQ',
    countryName: 'Guinée équatoriale',
    cargoTrackingType: CargoTrackingType.BESC,
    cargoMandatory: true,
    authority: 'Autorité Portuaire de Guinée équatoriale',
    currency: 'XAF',
    customsNotes:
      'BESC exigé pour les ports de Malabo et Bata. Validation préalable obligatoire.',
    requiredDocuments: baseDocs([trackingDoc(CargoTrackingType.BESC, 'l\'autorité portuaire'), ...VEHICLE_DOCS]),
  },
  {
    countryCode: 'ST',
    countryName: 'São Tomé-et-Principe',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'Direção das Alfândegas',
    currency: 'STN',
    customsNotes:
      'Pas de CTN obligatoire. Faible volume d\'import, procédure douanière simplifiée.',
    requiredDocuments: baseDocs(VEHICLE_DOCS),
  },

  // ════════════════════════════════════════════════════════════════════════
  //  AFRIQUE DE L'EST
  // ════════════════════════════════════════════════════════════════════════
  {
    countryCode: 'KE',
    countryName: 'Kenya',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'Kenya Revenue Authority (KRA) / KEBS',
    currency: 'KES',
    customsNotes:
      'Pas de CTN. PVoC (Pre-export Verification of Conformity) obligatoire via KEBS (Bureau Veritas, Intertek, SGS) pour la plupart des marchandises réglementées. IDF (Import Declaration Form) via iCMS.',
    requiredDocuments: baseDocs([
      { key: 'coc_kebs', label: 'CoC KEBS (Certificate of Conformity)', mandatory: true, category: 'compliance', note: 'Émis avant embarquement par un organisme agréé KEBS.' },
      { key: 'idf', label: 'Import Declaration Form (IDF)', mandatory: true, category: 'compliance' },
      ...VEHICLE_DOCS,
    ]),
  },
  {
    countryCode: 'TZ',
    countryName: 'Tanzanie',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'Tanzania Revenue Authority (TRA) / TBS',
    currency: 'TZS',
    customsNotes:
      'PVoC obligatoire via TBS (Tanzania Bureau of Standards) — programme PCoC. TANCIS pour la déclaration douanière.',
    requiredDocuments: baseDocs([
      { key: 'coc_tbs', label: 'CoC TBS (Certificate of Conformity)', mandatory: true, category: 'compliance', note: 'Émis par Bureau Veritas, Intertek, SGS ou Tüv Rheinland.' },
      ...VEHICLE_DOCS,
    ]),
  },
  {
    countryCode: 'UG',
    countryName: 'Ouganda',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'Uganda Revenue Authority (URA) / UNBS',
    currency: 'UGX',
    customsNotes:
      'PVoC obligatoire via UNBS (Uganda National Bureau of Standards). Pays enclavé, transit Mombasa ou Dar es Salaam.',
    requiredDocuments: baseDocs([
      { key: 'coc_unbs', label: 'CoC UNBS (Certificate of Conformity)', mandatory: true, category: 'compliance' },
      ...VEHICLE_DOCS,
    ]),
  },
  {
    countryCode: 'RW',
    countryName: 'Rwanda',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'Rwanda Revenue Authority (RRA) / RSB',
    currency: 'RWF',
    customsNotes:
      'PVoC obligatoire via RSB (Rwanda Standards Board). Pays enclavé, accès via Mombasa ou Dar es Salaam.',
    requiredDocuments: baseDocs([
      { key: 'coc_rsb', label: 'CoC RSB (Certificate of Conformity)', mandatory: true, category: 'compliance' },
      ...VEHICLE_DOCS,
    ]),
  },
  {
    countryCode: 'BI',
    countryName: 'Burundi',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'Office Burundais des Recettes (OBR) / BBN',
    currency: 'BIF',
    customsNotes:
      'PVoC obligatoire via BBN (Bureau Burundais de Normalisation). Pays enclavé, accès via Dar es Salaam principalement.',
    requiredDocuments: baseDocs([
      { key: 'coc_bbn', label: 'CoC BBN (Certificate of Conformity)', mandatory: true, category: 'compliance' },
      ...VEHICLE_DOCS,
    ]),
  },
  {
    countryCode: 'SD',
    countryName: 'Soudan',
    cargoTrackingType: CargoTrackingType.ECTN,
    cargoMandatory: true,
    authority: 'Sudan Customs Authority (ACD)',
    currency: 'SDG',
    customsNotes:
      'ACD (Advance Cargo Declaration) / ECTN obligatoire pour Port-Soudan depuis le 1er janvier 2026 pour tous les imports et marchandises en transit. À valider au moins 5 jours avant l\'arrivée du navire, référence ACD à reporter sur le B/L. Contexte sécuritaire à vérifier au cas par cas.',
    requiredDocuments: baseDocs([trackingDoc(CargoTrackingType.ECTN, 'la Sudan Customs Authority'), ...VEHICLE_DOCS]),
  },
  {
    countryCode: 'SS',
    countryName: 'Soudan du Sud',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'South Sudan Customs Service',
    currency: 'SSP',
    customsNotes:
      'Pays enclavé, transit via Mombasa, Dar es Salaam ou Djibouti. Procédure douanière en cours de structuration.',
    requiredDocuments: baseDocs(VEHICLE_DOCS),
  },
  {
    countryCode: 'ET',
    countryName: 'Éthiopie',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'Ethiopian Customs Commission (ECC)',
    currency: 'ETB',
    customsNotes:
      'Pas de CTN. Pays enclavé, transit via Djibouti (corridor principal). Licence d\'importation préalable (Ministry of Trade) souvent requise.',
    requiredDocuments: baseDocs([
      { key: 'import_license', label: 'Licence d\'importation', mandatory: true, category: 'compliance', note: 'Délivrée par le Ministry of Trade and Regional Integration.' },
      ...VEHICLE_DOCS,
    ]),
  },
  {
    countryCode: 'ER',
    countryName: 'Érythrée',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'Eritrean Customs Authority',
    currency: 'ERN',
    customsNotes:
      'Procédure restrictive — licence d\'importation préalable obligatoire. Devises strictement contrôlées.',
    requiredDocuments: baseDocs([
      { key: 'import_license', label: 'Licence d\'importation', mandatory: true, category: 'compliance' },
      ...VEHICLE_DOCS,
    ]),
  },
  {
    countryCode: 'DJ',
    countryName: 'Djibouti',
    cargoTrackingType: CargoTrackingType.ECTN,
    cargoMandatory: true,
    authority: 'Direction des Douanes de Djibouti',
    currency: 'DJF',
    customsNotes:
      'ECTN obligatoire pour le port de Djibouti — hub régional pour Éthiopie. Validation préalable requise.',
    requiredDocuments: baseDocs([trackingDoc(CargoTrackingType.ECTN, 'la Direction des Douanes'), ...VEHICLE_DOCS]),
  },
  {
    countryCode: 'SO',
    countryName: 'Somalie',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'Somali Customs Authority',
    currency: 'SOS',
    customsNotes:
      'Contexte sécuritaire complexe. Vérifier l\'accès portuaire (Mogadiscio, Berbera, Bosaso) et les sanctions internationales applicables.',
    requiredDocuments: baseDocs(VEHICLE_DOCS),
  },

  // ════════════════════════════════════════════════════════════════════════
  //  AFRIQUE AUSTRALE
  // ════════════════════════════════════════════════════════════════════════
  {
    countryCode: 'ZA',
    countryName: 'Afrique du Sud',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'SARS (South African Revenue Service)',
    currency: 'ZAR',
    customsNotes:
      'Pas de CTN. Code importateur SARS obligatoire. Déclaration via SARS eFiling. Pays membre de la SACU (union douanière avec NA, BW, LS, SZ).',
    requiredDocuments: baseDocs([
      { key: 'sars_importer_code', label: 'Code importateur SARS', mandatory: true, category: 'compliance', note: 'À obtenir préalablement auprès de SARS.' },
      ...VEHICLE_DOCS,
    ]),
  },
  {
    countryCode: 'NA',
    countryName: 'Namibie',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'Namibia Revenue Agency (NamRA)',
    currency: 'NAD',
    customsNotes:
      'Pas de CTN. Membre de la SACU : échanges simplifiés avec Afrique du Sud. Port principal : Walvis Bay.',
    requiredDocuments: baseDocs(VEHICLE_DOCS),
  },
  {
    countryCode: 'BW',
    countryName: 'Botswana',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'Botswana Unified Revenue Service (BURS)',
    currency: 'BWP',
    customsNotes:
      'Pas de CTN. Membre de la SACU. Pays enclavé, transit principalement via les ports sud-africains (Durban).',
    requiredDocuments: baseDocs(VEHICLE_DOCS),
  },
  {
    countryCode: 'ZW',
    countryName: 'Zimbabwe',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'ZIMRA (Zimbabwe Revenue Authority)',
    currency: 'ZWG',
    customsNotes:
      'Devise officielle : ZiG (Zimbabwe Gold, code ZWG) depuis avril 2024 — USD reste largement utilisé en pratique (système multi-devises). CBCA (Consignment Based Conformity Assessment) géré par Bureau Veritas obligatoire pour la plupart des produits réglementés. Pays enclavé.',
    requiredDocuments: baseDocs([
      { key: 'cbca_certificate', label: 'CBCA Certificate', mandatory: true, category: 'compliance', note: 'Émis avant embarquement par Bureau Veritas.' },
      ...VEHICLE_DOCS,
    ]),
  },
  {
    countryCode: 'ZM',
    countryName: 'Zambie',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'Zambia Revenue Authority (ZRA)',
    currency: 'ZMW',
    customsNotes:
      'Pas de CTN. Pays enclavé, transit via Dar es Salaam, Beira ou Durban. Import permit requis pour certaines catégories.',
    requiredDocuments: baseDocs(VEHICLE_DOCS),
  },
  {
    countryCode: 'MW',
    countryName: 'Malawi',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'Malawi Revenue Authority (MRA)',
    currency: 'MWK',
    customsNotes:
      'Pays enclavé, transit via Beira, Nacala (Mozambique) ou Dar es Salaam. Pas de CTN, licence d\'importation requise pour certains produits.',
    requiredDocuments: baseDocs(VEHICLE_DOCS),
  },
  {
    countryCode: 'MZ',
    countryName: 'Mozambique',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'Autoridade Tributária de Moçambique (AT)',
    currency: 'MZN',
    customsNotes:
      'Pas de CTN à l\'embarquement. Pre-Shipment Inspection (PSI) sur la "Lista Positiva" via Intertek (programme officiel), accompagnée d\'un Documento Único Certificado (DUC). Système électronique national de suivi en transit MECTS/SEERC pour le scellement. Ports : Maputo, Beira, Nacala.',
    requiredDocuments: baseDocs(VEHICLE_DOCS),
  },
  {
    countryCode: 'AO',
    countryName: 'Angola',
    cargoTrackingType: CargoTrackingType.CARGO_WAIVER,
    cargoMandatory: true,
    authority: 'ARCCLA (Agência Reguladora de Certificação de Cargas e Logística de Angola)',
    currency: 'AOA',
    customsNotes:
      'CNCA / ARCCLA (Cargo Tracking Note) obligatoire pour tous les ports angolais (Luanda, Lobito, Namibe, Soyo). À valider au plus tard 5 jours avant l\'arrivée du navire, référence à reporter sur le B/L. Licence d\'importation préalable (Ministério da Indústria e Comércio) souvent requise.',
    requiredDocuments: baseDocs([
      trackingDoc(CargoTrackingType.CARGO_WAIVER, 'l\'ARCCLA'),
      { key: 'import_license', label: 'Licence d\'importation', mandatory: true, category: 'compliance' },
      ...VEHICLE_DOCS,
    ]),
  },
  {
    countryCode: 'LS',
    countryName: 'Lesotho',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'Lesotho Revenue Authority (LRA)',
    currency: 'LSL',
    customsNotes:
      'Membre SACU. Pas de CTN. Enclavé en Afrique du Sud, transit RSA principalement.',
    requiredDocuments: baseDocs(VEHICLE_DOCS),
  },
  {
    countryCode: 'SZ',
    countryName: 'Eswatini',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'Eswatini Revenue Service (ERS)',
    currency: 'SZL',
    customsNotes:
      'Membre SACU. Pas de CTN. Pays enclavé, transit via les ports sud-africains.',
    requiredDocuments: baseDocs(VEHICLE_DOCS),
  },
  {
    countryCode: 'MG',
    countryName: 'Madagascar',
    cargoTrackingType: CargoTrackingType.BSC,
    cargoMandatory: true,
    authority: 'GasyNet / Direction Générale des Douanes',
    currency: 'MGA',
    customsNotes:
      'BSC obligatoire (TradeNet/GasyNet) pour les ports de Toamasina, Mahajanga, Diego-Suarez. Référence à reporter sur la déclaration.',
    requiredDocuments: baseDocs([trackingDoc(CargoTrackingType.BSC, 'GasyNet'), ...VEHICLE_DOCS]),
  },
  {
    countryCode: 'KM',
    countryName: 'Comores',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'Administration Générale des Douanes',
    currency: 'KMF',
    customsNotes:
      'Pas de CTN obligatoire. Port principal : Moroni. Procédure simplifiée.',
    requiredDocuments: baseDocs(VEHICLE_DOCS),
  },
  {
    countryCode: 'MU',
    countryName: 'Maurice',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'Mauritius Revenue Authority (MRA) Customs',
    currency: 'MUR',
    customsNotes:
      'Pas de CTN. Procédure douanière modernisée (MNS — Mauritius Network Services). Port Louis hub régional.',
    requiredDocuments: baseDocs(VEHICLE_DOCS),
  },
];
