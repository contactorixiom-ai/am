import { CargoTrackingType } from '@prisma/client';
import type { CountryRegulationSeed, RequiredDocument } from '../customs.data';

// ─── Helpers locaux ────────────────────────────────────────────────────────

/**
 * Identifiant fiscal de l'importateur, requis pour ouvrir une déclaration en
 * douane à l'import. Le sigle varie selon le pays (NINEA, IFU, NIU, NIF…) :
 * on paramètre le libellé pour rester exact pays par pays.
 */
function importerTaxIdDoc(label: string, note?: string): RequiredDocument {
  return {
    key: 'importer_tax_id',
    label,
    mandatory: true,
    category: 'customs',
    note: note ?? 'Numéro d\'identification fiscale de l\'importateur, exigé pour le dédouanement.',
  };
}

// Déclaration préalable d'importation / intention d'importation (DPI / FDI).
// Souvent exigée au-delà d'un seuil de valeur FOB dans la zone UEMOA/CEMAC.
function importIntentDoc(note: string): RequiredDocument {
  return {
    key: 'import_intent_declaration',
    label: 'Déclaration préalable d\'importation (DPI)',
    mandatory: false,
    category: 'customs',
    note,
  };
}

// Attestation / engagement de domiciliation bancaire de l'importation.
// Conditionnel : au-delà d'un seuil de valeur, variable selon le pays.
function bankDomiciliationDoc(note: string): RequiredDocument {
  return {
    key: 'bank_domiciliation',
    label: 'Attestation de domiciliation bancaire (engagement d\'importation)',
    mandatory: false,
    category: 'customs',
    note,
  };
}

// Documents conditionnels selon la nature de la marchandise — jamais
// obligatoires par défaut, à activer au cas par cas.
const PHYTOSANITARY_DOC: RequiredDocument = {
  key: 'phytosanitary_certificate',
  label: 'Certificat phytosanitaire',
  mandatory: false,
  category: 'compliance',
  note: 'Pour les végétaux et produits d\'origine végétale. Délivré par le service de protection des végétaux du pays d\'export.',
};

const SANITARY_DOC: RequiredDocument = {
  key: 'sanitary_certificate',
  label: 'Certificat sanitaire / vétérinaire',
  mandatory: false,
  category: 'compliance',
  note: 'Pour les animaux vivants et denrées d\'origine animale.',
};

const FUMIGATION_DOC: RequiredDocument = {
  key: 'fumigation_certificate',
  label: 'Certificat de fumigation (NIMP 15)',
  mandatory: false,
  category: 'compliance',
  note: 'Pour les emballages et calages en bois (palettes, caisses) — norme NIMP 15.',
};

const IMPORT_LICENSE_DOC: RequiredDocument = {
  key: 'import_license',
  label: 'Autorisation / licence d\'importation',
  mandatory: false,
  category: 'compliance',
  note: 'Uniquement pour les produits réglementés (médicaments, armes, télécoms, denrées…).',
};

// Bon à délivrer (Delivery Order) — émis par l'agent maritime à l'arrivée,
// contre restitution du B/L original. Indispensable pour retirer le conteneur.
const DELIVERY_ORDER_DOC: RequiredDocument = {
  key: 'delivery_order',
  label: 'Bon à délivrer (Delivery Order)',
  mandatory: false,
  category: 'customs',
  note: 'Émis par l\'agent maritime à l\'arrivée, contre remise du connaissement original. Requis pour retirer la marchandise.',
};

// Déclaration en douane à l'import (déclaration unique / DDU) + déclaration de
// la valeur en douane. Toujours requise pour la mise à la consommation.
const IMPORT_DECLARATION_DOC: RequiredDocument = {
  key: 'import_declaration',
  label: 'Déclaration en douane à l\'import (déclaration unique)',
  mandatory: true,
  category: 'customs',
  note: 'Établie par le commissionnaire en douane (souvent via SYDONIA). Accompagnée de la déclaration de la valeur en douane.',
};

// Tronc commun "formalités préalables" pour la zone UEMOA/CEMAC : DPI + engagement
// de domiciliation bancaire, tous deux conditionnés à un seuil de valeur.
const UEMOA_IMPORT_DOCS: RequiredDocument[] = [
  importIntentDoc('Déclaration préalable d\'importation (DPI) généralement exigée au-delà d\'un seuil de valeur FOB dans la zone UEMOA. // TODO: à confirmer le seuil exact auprès d\'un commissionnaire en douane.'),
  bankDomiciliationDoc('Domiciliation bancaire de l\'import requise au-delà du seuil UEMOA en vigueur. // TODO: à confirmer le seuil exact.'),
];

// Variante CEMAC (Afrique centrale) : même logique, libellé adapté à la zone.
const CEMAC_IMPORT_DOCS: RequiredDocument[] = [
  importIntentDoc('Déclaration / autorisation préalable d\'importation souvent exigée au-delà d\'un seuil de valeur (zone CEMAC). // TODO: à confirmer le seuil exact auprès d\'un commissionnaire en douane.'),
  bankDomiciliationDoc('Domiciliation bancaire de l\'import requise au-delà du seuil CEMAC en vigueur. // TODO: à confirmer le seuil exact.'),
];

/**
 * Socle documentaire commun pour un envoi de marchandises vers l'Afrique :
 * facture, packing list, B/L ou LTA, certificat d'origine, assurance, plus le
 * tronc commun de dédouanement à l'import (déclaration en douane, identifiant
 * fiscal importateur, bon à délivrer) et les documents conditionnels selon la
 * nature de la marchandise.
 *
 * `taxId` permet de préciser le sigle exact de l'identifiant fiscal du pays.
 * `extra` est inséré après le socle commercial/transport et avant le bloc de
 * dédouanement, pour garder l'ordre logique (bordereau de suivi en tête).
 */
interface BaseDocsOptions {
  /**
   * Rend la licence d'importation obligatoire (pays à régime d'autorisation
   * préalable généralisé : Éthiopie, Érythrée, Angola…) et permet d'en préciser
   * la note. Sinon, la licence reste un document conditionnel (produits
   * réglementés uniquement).
   */
  importLicense?: { mandatory: boolean; note?: string };
}

function baseDocs(
  extra: RequiredDocument[] = [],
  taxId: RequiredDocument = importerTaxIdDoc('Identifiant fiscal de l\'importateur'),
  options: BaseDocsOptions = {},
): RequiredDocument[] {
  const importLicense: RequiredDocument = options.importLicense
    ? {
        ...IMPORT_LICENSE_DOC,
        mandatory: options.importLicense.mandatory,
        note: options.importLicense.note ?? IMPORT_LICENSE_DOC.note,
      }
    : IMPORT_LICENSE_DOC;
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
    // ── Tronc commun de dédouanement à l'import ──
    IMPORT_DECLARATION_DOC,
    taxId,
    DELIVERY_ORDER_DOC,
    // ── Documents conditionnels (nature de la marchandise) ──
    PHYTOSANITARY_DOC,
    FUMIGATION_DOC,
    importLicense,
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
  { key: 'vehicle_sale_invoice', label: 'Facture d\'achat / certificat de cession', mandatory: true, category: 'vehicle', note: 'Justifie la valeur du véhicule, base de calcul des droits et taxes à l\'import.' },
  { key: 'vehicle_inspection_report', label: 'Rapport d\'inspection technique à l\'import', mandatory: false, category: 'vehicle', note: 'Requis dans certains pays (contrôle technique / vérification de conformité du véhicule à l\'arrivée). À confirmer selon le pays.' },
];

/**
 * Construit le bloc de documents véhicule en y ajoutant, le cas échéant, une
 * note non bloquante rappelant la limite d'âge d'import du pays. Cette note est
 * portée par un document informatif (jamais "fourni", purement réglementaire).
 */
function vehicleDocs(ageLimitNote?: string): RequiredDocument[] {
  if (!ageLimitNote) return VEHICLE_DOCS;
  return [
    {
      key: 'vehicle_age_limit',
      label: 'Limite d\'âge du véhicule à l\'import',
      mandatory: true,
      category: 'vehicle',
      note: ageLimitNote,
    },
    ...VEHICLE_DOCS,
  ];
}

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
      'Le BSC doit être validé avant l\'arrivée au port de Dakar. Numéro à reporter sur la déclaration douanière. Préfinancement possible auprès du correspondant COSEC en Europe. DPI (Déclaration Préalable d\'Importation) obligatoire dès 1 000 000 FCFA de valeur FOB. Limite d\'âge à l\'import : 10 ans pour les voitures particulières, 15 ans pour les camions et véhicules de transport de personnes (décret du 24 octobre 2025).',
    requiredDocuments: baseDocs(
      [
        trackingDoc(CargoTrackingType.BSC, 'le COSEC'),
        importIntentDoc('Obligatoire dès 1 000 000 FCFA de valeur FOB (DPI sénégalaise).'),
        bankDomiciliationDoc('Domiciliation bancaire de l\'import requise au-delà du seuil UEMOA. // TODO: à confirmer le seuil exact en vigueur auprès d\'un commissionnaire en douane.'),
        ...vehicleDocs('10 ans pour les voitures particulières, 15 ans pour camions et véhicules de transport de personnes (décret du 24 octobre 2025).'),
      ],
      importerTaxIdDoc('NINEA (identifiant fiscal de l\'importateur)'),
    ),
  },
  {
    countryCode: 'CI',
    countryName: 'Côte d\'Ivoire',
    cargoTrackingType: CargoTrackingType.BSC,
    cargoMandatory: true,
    authority: 'OIC (Office Ivoirien des Chargeurs)',
    currency: 'XOF',
    customsNotes:
      'BSC obligatoire pour les ports d\'Abidjan et de San Pedro. Validation avant embarquement requise. Programme VoC (Vérification de la Conformité) obligatoire depuis 2017 sous l\'égide de CODINORM : Certificat de Conformité émis avant embarquement par Bureau Veritas, Cotecna, Intertek ou SGS pour les produits réglementés. Limite d\'âge à l\'import : 5 ans pour les véhicules légers (réglementation 2025). DPI (FDI) et domiciliation bancaire dans le cadre UEMOA.',
    requiredDocuments: baseDocs(
      [
        trackingDoc(CargoTrackingType.BSC, 'l\'OIC'),
        { key: 'certificate_of_conformity', label: 'Certificat de conformité VoC (CODINORM)', mandatory: true, category: 'compliance', note: 'Programme VoC ivoirien — émis avant embarquement par Bureau Veritas, Cotecna, Intertek ou SGS pour les produits réglementés.' },
        importIntentDoc('FDI (Fiche de Déclaration à l\'Importation) dans le cadre UEMOA. // TODO: à confirmer le seuil de valeur exact auprès d\'un commissionnaire en douane.'),
        bankDomiciliationDoc('Domiciliation bancaire de l\'import requise au-delà du seuil UEMOA. // TODO: à confirmer le seuil exact en vigueur.'),
        ...vehicleDocs('5 ans pour les véhicules légers (réglementation 2025) — importation interdite au-delà.'),
      ],
      importerTaxIdDoc('Compte Contribuable / numéro d\'identification fiscale ivoirien'),
    ),
  },
  {
    countryCode: 'ML',
    countryName: 'Mali',
    cargoTrackingType: CargoTrackingType.BSC,
    cargoMandatory: true,
    authority: 'CMC (Conseil Malien des Chargeurs)',
    currency: 'XOF',
    customsNotes:
      'Le BSC est exigé pour toute marchandise transitant par les ports de Dakar, Abidjan, Lomé, Conakry ou Tema à destination du Mali (pays enclavé). Émis par le CMC (Conseil Malien des Chargeurs). Zone UEMOA : DPI et domiciliation bancaire au-delà des seuils de valeur en vigueur.',
    requiredDocuments: baseDocs(
      [trackingDoc(CargoTrackingType.BSC, 'le CMC'), ...UEMOA_IMPORT_DOCS, ...VEHICLE_DOCS],
      importerTaxIdDoc('NIF (numéro d\'identification fiscale malien)'),
    ),
  },
  {
    countryCode: 'BF',
    countryName: 'Burkina Faso',
    cargoTrackingType: CargoTrackingType.ECTN,
    cargoMandatory: true,
    authority: 'CBC (Conseil Burkinabè des Chargeurs)',
    currency: 'XOF',
    customsNotes:
      'ECTN obligatoire pour tout fret à destination du Burkina (pays enclavé, transit principalement par Lomé, Abidjan, Tema). Émis par le CBC. Zone UEMOA : DPI et domiciliation bancaire au-delà des seuils de valeur en vigueur.',
    requiredDocuments: baseDocs(
      [trackingDoc(CargoTrackingType.ECTN, 'le CBC'), ...UEMOA_IMPORT_DOCS, ...VEHICLE_DOCS],
      importerTaxIdDoc('IFU (Identifiant Financier Unique burkinabè)'),
    ),
  },
  {
    countryCode: 'NE',
    countryName: 'Niger',
    cargoTrackingType: CargoTrackingType.ECTN,
    cargoMandatory: true,
    authority: 'CNUT (Conseil Nigérien des Utilisateurs des Transports Publics)',
    currency: 'XOF',
    customsNotes:
      'ECTN obligatoire pour tout import à destination du Niger (pays enclavé, transit Cotonou ou Lomé). Zone UEMOA : DPI et domiciliation bancaire au-delà des seuils de valeur en vigueur.',
    requiredDocuments: baseDocs(
      [trackingDoc(CargoTrackingType.ECTN, 'le CNUT'), ...UEMOA_IMPORT_DOCS, ...VEHICLE_DOCS],
      importerTaxIdDoc('NIF (numéro d\'identification fiscale nigérien)'),
    ),
  },
  {
    countryCode: 'BJ',
    countryName: 'Bénin',
    cargoTrackingType: CargoTrackingType.BESC,
    cargoMandatory: true,
    authority: 'PAC (Port Autonome de Cotonou) — anciennement CNCB',
    currency: 'XOF',
    customsNotes:
      'BESC (Bordereau Électronique de Suivi des Cargaisons) obligatoire pour le port de Cotonou, à valider 5 jours avant l\'arrivée du navire. Géré par le Port Autonome de Cotonou (PAC) depuis l\'arrêté n°019 d\'octobre 2021 (auparavant CNCB). Zone UEMOA : DPI et domiciliation bancaire au-delà des seuils en vigueur. Limite d\'âge à l\'import (depuis février 2025) : 10 ans pour les voitures particulières, 15 ans pour les véhicules commerciaux, 5 ans pour les motos.',
    requiredDocuments: baseDocs(
      [
        trackingDoc(CargoTrackingType.BESC, 'le PAC'),
        ...UEMOA_IMPORT_DOCS,
        ...vehicleDocs('10 ans pour les voitures particulières, 15 ans pour les véhicules commerciaux, 5 ans pour les motos (réglementation de février 2025).'),
      ],
      importerTaxIdDoc('IFU (Identifiant Fiscal Unique béninois)'),
    ),
  },
  {
    countryCode: 'TG',
    countryName: 'Togo',
    cargoTrackingType: CargoTrackingType.ECTN,
    cargoMandatory: true,
    authority: 'CNCT (Conseil National des Chargeurs du Togo)',
    currency: 'XOF',
    customsNotes:
      'ECTN obligatoire pour le port de Lomé. Référence à mentionner sur la déclaration douanière. Zone UEMOA : DPI et domiciliation bancaire au-delà des seuils en vigueur. Limite d\'âge des véhicules importés : sources contradictoires (décret 2018-005 évoquant 10 ans vs absence de limite appliquée). // TODO: à confirmer la règle en vigueur auprès d\'un commissionnaire en douane.',
    requiredDocuments: baseDocs(
      [
        trackingDoc(CargoTrackingType.ECTN, 'le CNCT'),
        ...UEMOA_IMPORT_DOCS,
        ...vehicleDocs('Règle d\'âge à confirmer (décret 2018-005 ~10 ans vs pas de limite appliquée en pratique). // TODO: à confirmer auprès d\'un commissionnaire en douane.'),
      ],
      importerTaxIdDoc('NIF (numéro d\'identification fiscale togolais)'),
    ),
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
      'CTN suspendu depuis 2024. Une réintroduction sous forme de SPN (Smart Port Note) était prévue pour le 1er février 2026 par la GSA mais a été reportée sine die suite à l\'opposition des opérateurs. Conformité produit (CCVR — Conformity Certificate Verification Report) requise via Ghana Standards Authority. ICUMS (Integrated Customs Management System) pour le dédouanement. Limite d\'âge à l\'import : véhicules de plus de 10 ans soumis à des pénalités progressives (graduated duty).',
    requiredDocuments: baseDocs(
      [
        { key: 'ccvr_certificate', label: 'CCVR (Conformity Certificate)', mandatory: true, category: 'compliance', note: 'Émis avant embarquement par un organisme agréé (Bureau Veritas, Cotecna, Intertek).' },
        ...vehicleDocs('Véhicules de plus de 10 ans : pénalités d\'âge progressives (graduated duty/penalty) en sus des droits, et non interdiction stricte.'),
      ],
      importerTaxIdDoc('TIN (Taxpayer Identification Number ghanéen)'),
    ),
  },
  {
    countryCode: 'NG',
    countryName: 'Nigeria',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'Nigerian Shippers\' Council (NSC) / SON',
    currency: 'NGN',
    customsNotes:
      'CTN suspendu. Mais SONCAP obligatoire (Standards Organisation of Nigeria Conformity Assessment Programme) pour la plupart des produits réglementés. Form M et PAAR via le système NICIS. Limite d\'âge des véhicules importés : historiquement 15 ans, ramenée à 12 ans selon plusieurs sources (politique VIN Valuation, en débat). // TODO: à confirmer la limite en vigueur auprès d\'un commissionnaire en douane.',
    requiredDocuments: baseDocs(
      [
        { key: 'soncap_certificate', label: 'SONCAP Certificate', mandatory: true, category: 'compliance', note: 'Certificat de conformité émis avant embarquement.' },
        { key: 'form_m', label: 'Form M', mandatory: true, category: 'compliance', note: 'Déclaration préalable à toute importation au Nigeria.' },
        ...vehicleDocs('Limite d\'âge ~12 à 15 ans selon la période (politique VIN Valuation). // TODO: à confirmer la limite en vigueur auprès d\'un commissionnaire en douane.'),
      ],
      importerTaxIdDoc('TIN (Tax Identification Number nigérian)'),
    ),
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
      'BESC obligatoire pour les ports de Douala et de Kribi, validé par le CNCC. À établir au départ. Référence à reporter sur la déclaration douanière. PECAE obligatoire (Programme d\'Évaluation de la Conformité Avant Embarquement) sous l\'égide de l\'ANOR : Certificat de Conformité émis avant embarquement par SGS, Intertek ou TÜV Rheinland pour les produits réglementés. Zone CEMAC.',
    requiredDocuments: baseDocs(
      [
        trackingDoc(CargoTrackingType.BESC, 'le CNCC'),
        { key: 'certificate_of_conformity', label: 'Certificat de conformité PECAE (ANOR)', mandatory: true, category: 'compliance', note: 'Programme PECAE camerounais — émis avant embarquement par SGS, Intertek ou TÜV Rheinland pour les produits réglementés.' },
        ...CEMAC_IMPORT_DOCS,
        ...VEHICLE_DOCS,
      ],
      importerTaxIdDoc('NIU (Numéro d\'Identifiant Unique camerounais)'),
    ),
  },
  {
    countryCode: 'GA',
    countryName: 'Gabon',
    cargoTrackingType: CargoTrackingType.BIETC,
    cargoMandatory: true,
    authority: 'CGC (Conseil Gabonais des Chargeurs)',
    currency: 'XAF',
    customsNotes:
      'Le BIETC est exigé pour les ports d\'Owendo, Libreville et Port-Gentil. Émission préalable obligatoire. PROGEC obligatoire (Programme Gabonais d\'Évaluation de la Conformité) sous l\'égide d\'AGANOR : Certificat de Conformité émis avant embarquement par SGS, Intertek, Bureau Veritas ou Cotecna pour les produits réglementés ; tout import sans CoC préalable est passible d\'amende. Zone CEMAC.',
    requiredDocuments: baseDocs(
      [
        trackingDoc(CargoTrackingType.BIETC, 'le CGC'),
        { key: 'certificate_of_conformity', label: 'Certificat de conformité PROGEC (AGANOR)', mandatory: true, category: 'compliance', note: 'Programme PROGEC gabonais — émis avant embarquement par SGS, Intertek, Bureau Veritas ou Cotecna pour les produits réglementés.' },
        ...CEMAC_IMPORT_DOCS,
        ...VEHICLE_DOCS,
      ],
      importerTaxIdDoc('NIF (numéro d\'identification fiscale gabonais)'),
    ),
  },
  {
    countryCode: 'CG',
    countryName: 'Congo (Brazzaville)',
    cargoTrackingType: CargoTrackingType.BESC,
    cargoMandatory: true,
    authority: 'CCC (Conseil Congolais des Chargeurs)',
    currency: 'XAF',
    customsNotes:
      'BESC obligatoire pour le port de Pointe-Noire. Référence sur la déclaration douanière. Zone CEMAC : déclaration préalable et domiciliation bancaire au-delà des seuils en vigueur.',
    requiredDocuments: baseDocs(
      [trackingDoc(CargoTrackingType.BESC, 'le CCC'), ...CEMAC_IMPORT_DOCS, ...VEHICLE_DOCS],
      importerTaxIdDoc('NIU (Numéro d\'Identification Unique congolais)'),
    ),
  },
  {
    countryCode: 'CD',
    countryName: 'République Démocratique du Congo',
    cargoTrackingType: CargoTrackingType.FERI,
    cargoMandatory: true,
    authority: 'OGEFREM (Office de Gestion du Fret Multimodal)',
    currency: 'CDF',
    customsNotes:
      'La FERI est délivrée par l\'OGEFREM. Indispensable pour le dédouanement à Matadi, Boma et à l\'est du pays (Goma, Bukavu, Lubumbashi). Contrôle de conformité obligatoire de l\'OCC (Office Congolais de Contrôle) : Certificat de Conformité délivré à l\'import, avec inspection avant expédition (programme renforcé depuis 2025, opéré notamment par BIVAC/Bureau Veritas). Limite d\'âge des véhicules importés ramenée à 15 ans (décret de janvier 2026), 20 ans pour les tracteurs agricoles/forestiers/miniers.',
    requiredDocuments: baseDocs(
      [
        trackingDoc(CargoTrackingType.FERI, 'l\'OGEFREM'),
        { key: 'certificate_of_conformity', label: 'Certificat de conformité OCC', mandatory: true, category: 'compliance', note: 'Délivré par l\'Office Congolais de Contrôle (OCC) — inspection avant expédition (BIVAC/Bureau Veritas) pour les produits réglementés.' },
        ...vehicleDocs('15 ans maximum pour la plupart des catégories (décret de janvier 2026), 20 ans pour les tracteurs agricoles, forestiers et miniers.'),
      ],
      importerTaxIdDoc('NIF (numéro d\'identification fiscale congolais / RDC)'),
    ),
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
      'BESC/ECTN obligatoire (pays enclavé, transit principalement par Douala). Validation au plus tard 5 jours avant l\'arrivée du navire. Géré par le Conseil des Chargeurs du Tchad (COC-TCHAD). Zone CEMAC : déclaration préalable et domiciliation bancaire au-delà des seuils en vigueur.',
    requiredDocuments: baseDocs(
      [trackingDoc(CargoTrackingType.BESC, 'COC-TCHAD'), ...CEMAC_IMPORT_DOCS, ...VEHICLE_DOCS],
      importerTaxIdDoc('NIF (numéro d\'identification fiscale tchadien)'),
    ),
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
      'Pas de CTN. PVoC (Pre-export Verification of Conformity) obligatoire via KEBS (Bureau Veritas, Intertek, SGS) pour la plupart des marchandises réglementées. IDF (Import Declaration Form) via iCMS. Limite d\'âge des véhicules : 8 ans (norme KS 1515) — à compter de janvier 2026, seuls les véhicules immatriculés depuis le 1er janvier 2019 sont admis. Conduite à droite (RHD) uniquement.',
    requiredDocuments: baseDocs(
      [
        { key: 'coc_kebs', label: 'CoC KEBS (Certificate of Conformity)', mandatory: true, category: 'compliance', note: 'Émis avant embarquement par un organisme agréé KEBS.' },
        { key: 'idf', label: 'Import Declaration Form (IDF)', mandatory: true, category: 'compliance' },
        ...vehicleDocs('8 ans maximum (norme KS 1515) — en 2026, seuls les véhicules de première immatriculation à partir du 1er janvier 2019. Conduite à droite (RHD) uniquement.'),
      ],
      importerTaxIdDoc('KRA PIN (Personal Identification Number)'),
    ),
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
    requiredDocuments: baseDocs(
      [...VEHICLE_DOCS],
      importerTaxIdDoc('TIN (Tax Identification Number éthiopien)'),
      { importLicense: { mandatory: true, note: 'Délivrée par le Ministry of Trade and Regional Integration.' } },
    ),
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
    requiredDocuments: baseDocs(
      [...VEHICLE_DOCS],
      importerTaxIdDoc('Identifiant fiscal de l\'importateur'),
      { importLicense: { mandatory: true, note: 'Licence préalable obligatoire (régime d\'importation restrictif).' } },
    ),
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
      'Pas de CTN. Membre de la SACU. Pays enclavé, transit principalement via les ports sud-africains (Durban). SCSR obligatoire (Botswana Standards Compulsory Standards Regulations, ex-SIIR) géré par le BOBS : Certificate of Conformity émis dans le pays d\'origine (via Intertek) pour les produits réglementés. Permis d\'import requis pour les marchandises entrant hors SACU.',
    requiredDocuments: baseDocs([
      { key: 'certificate_of_conformity', label: 'Certificate of Conformity SCSR (BOBS)', mandatory: true, category: 'compliance', note: 'Programme SCSR du Botswana Bureau of Standards — émis dans le pays d\'origine (Intertek) pour les produits réglementés.' },
      ...VEHICLE_DOCS,
    ]),
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
    requiredDocuments: baseDocs(
      [trackingDoc(CargoTrackingType.CARGO_WAIVER, 'l\'ARCCLA'), ...VEHICLE_DOCS],
      importerTaxIdDoc('NIF (número de identificação fiscal angolais)'),
      { importLicense: { mandatory: true, note: 'Licence préalable du Ministério da Indústria e Comércio souvent requise.' } },
    ),
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
