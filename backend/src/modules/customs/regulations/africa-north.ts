import { CargoTrackingType } from '@prisma/client';
import type { CountryRegulationSeed, RequiredDocument } from '../customs.data';
import { baseDocs, importerTaxIdDoc, vehicleDocs } from './africa-subsaharan';

// ─── Afrique du Nord (Maghreb, Égypte, Libye) ───────────────────────────────
// Corridors proches (Marseille / Sète → Tanger, Alger, Tunis, Alexandrie) :
// pas de bordereau de suivi de cargaison (BSC/ECTN) au Maghreb, mais des
// programmes de conformité et des règles sur les véhicules d'occasion très
// différentes de l'Afrique subsaharienne. Les règles changent souvent
// (lois de finances annuelles) : les notes signalent ce qui est à confirmer.

const CONFORMITY_MA: RequiredDocument = {
  key: 'certificate_of_conformity',
  label: 'Certificat de conformité (programme VoC marocain)',
  mandatory: false,
  category: 'compliance',
  note: 'Pour les produits industriels réglementés (électrique, textile, jouets, matériaux…) : contrôle avant embarquement par un organisme agréé (Bureau Veritas, Applus, Intertek, SGS, TÜV). Pas pour les effets personnels.',
};

const EUR1_DOC: RequiredDocument = {
  key: 'eur1_certificate',
  label: 'Certificat EUR.1 (origine UE)',
  mandatory: false,
  category: 'origin',
  note: 'Accord d\'association UE : droits de douane réduits ou nuls pour les marchandises et véhicules d\'origine européenne, sur présentation de l\'EUR.1 (ou déclaration d\'origine sur facture).',
};

const ACID_DOC: RequiredDocument = {
  key: 'cargo_tracking_note',
  label: 'Numéro ACID (système NAFEZA / ACI)',
  mandatory: true,
  category: 'tracking',
  note: 'Identifiant à 19 chiffres obtenu par l\'importateur égyptien sur NAFEZA AVANT le chargement. Obligatoire en maritime depuis octobre 2021 et en aérien depuis le 1er janvier 2026. À reporter sur le connaissement et la facture.',
};

export const AFRICA_NORTH_REGULATIONS: CountryRegulationSeed[] = [
  {
    countryCode: 'MA',
    countryName: 'Maroc',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'Administration des Douanes et Impôts Indirects (ADII)',
    currency: 'MAD',
    customsNotes:
      'Pas de bordereau de suivi (BSC). Marchandises d\'origine UE : droits réduits ou nuls avec EUR.1 (accord d\'association). Colis personnels : franchise réduite (de l\'ordre de 1 250 MAD par colis selon les prestataires, à confirmer auprès de l\'ADII) ; produits à base de porc, billets de banque et médicaments sans autorisation interdits. Véhicules d\'occasion : moins de 5 ans à la première mise en circulation pour l\'importation définitive (exception MRE retraités : 10 ans) ; au-delà, admission temporaire 6 mois seulement.',
    parcelRestrictions: [
      'Produits à base de porc et alcool interdits.',
      'Médicaments : autorisation du ministère de la Santé requise.',
      'Billets de banque, valeurs au porteur interdits.',
      'Franchise colis personnel limitée (environ 1 250 MAD) : au-delà, droits et TVA (20 %).',
    ],
    vehicleRules: {
      maxAgeYears: 5,
      rightHandDrive: false,
      note: 'Importation définitive réservée aux véhicules de moins de 5 ans (date de première mise en circulation). MRE retraités installés depuis 10 ans à l\'étranger : jusqu\'à 10 ans. Droits de douane 0 % avec EUR.1, sinon jusqu\'à 17,5 %, plus TVA 20 %.',
      source: 'Douane marocaine (ADII), guides 2025-2026 — à confirmer avant chaque expédition.',
    },
    requiredDocuments: baseDocs(
      [EUR1_DOC, CONFORMITY_MA, ...vehicleDocs('5 ans maximum à la première mise en circulation (importation définitive). À confirmer auprès de l\'ADII : la règle évolue avec les lois de finances.')],
      importerTaxIdDoc('Identifiant fiscal / ICE de l\'importateur (ou CIN pour un particulier)'),
    ),
  },
  {
    countryCode: 'DZ',
    countryName: 'Algérie',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'Direction Générale des Douanes (DGD)',
    currency: 'DZD',
    customsNotes:
      'Pas de bordereau de suivi. Importation très encadrée : licence du ministère de la Santé pour tout produit pharmaceutique ; vêtements, chaussures et linge usagés INTERDITS dans les colis ; produits frais interdits, produits industriels emballés tolérés ; porc et alcool interdits. Véhicules d\'occasion : depuis 2023, un résident peut importer un véhicule de moins de 3 ans (une fois tous les 3 ans) ; la loi de finances 2026 ouvre le « moins de 5 ans » aux Algériens de l\'étranger qui rentrent définitivement (certificat de changement de résidence, CCR). Diesel : restrictions signalées pour les particuliers — à confirmer.',
    parcelRestrictions: [
      'Vêtements, chaussures et linge d\'occasion INTERDITS.',
      'Produits pharmaceutiques : licence d\'importation obligatoire.',
      'Produits frais (viande, fromage, fruits) interdits ; alcool et porc interdits.',
      'Franchise variable selon la douane : prévoir droits et TVA 19 % au-delà.',
    ],
    vehicleRules: {
      maxAgeYears: 3,
      rightHandDrive: false,
      note: 'Résidents : véhicule de moins de 3 ans, un seul tous les 3 ans (depuis février 2023). Algériens de l\'étranger (CCR) : moins de 5 ans (loi de finances 2026). Véhicules diesel : restrictions pour les particuliers. Règles modifiées chaque année : vérifier avant la commande.',
      source: 'Douanes algériennes, lois de finances 2023 et 2026 — à confirmer.',
    },
    requiredDocuments: baseDocs(
      [EUR1_DOC, ...vehicleDocs('Moins de 3 ans (résidents) ou moins de 5 ans (changement de résidence, CCR). À confirmer : règles 2026 en cours d\'application.')],
      importerTaxIdDoc('NIF de l\'importateur (ou CIN pour un particulier)'),
    ),
  },
  {
    countryCode: 'TN',
    countryName: 'Tunisie',
    cargoTrackingType: null,
    cargoMandatory: false,
    authority: 'Direction Générale des Douanes (DGD)',
    currency: 'TND',
    customsNotes:
      'Pas de bordereau de suivi. Colis personnels : franchise limitée (de l\'ordre de 1 000 TND, à confirmer), alcool interdit sans autorisation. Véhicules : importation d\'occasion réservée en pratique aux Tunisiens résidant à l\'étranger (régime FCR, deux ans de résidence continue) ; la loi de finances 2026 (art. 55) ouvre une importation par famille d\'un véhicule de moins de 8 ans en franchise, sous conditions des textes d\'application. Contrôle technique à l\'arrivée (ATTT).',
    parcelRestrictions: [
      'Alcool interdit sans autorisation spéciale.',
      'Médicaments soumis à autorisation.',
      'Franchise colis personnel limitée (environ 1 000 TND) : droits et TVA 19 % au-delà.',
    ],
    vehicleRules: {
      maxAgeYears: 8,
      rightHandDrive: false,
      note: 'Régime FCR (Tunisiens de l\'étranger, 2 ans de résidence) ou dispositif 2026 : un véhicule de moins de 8 ans par famille en franchise, selon les textes d\'application. Hors de ces cas, l\'importation d\'occasion est très limitée. Vérifier avec la douane tunisienne avant la commande.',
      source: 'Loi de finances 2026 (art. 55), régime FCR — à confirmer.',
    },
    requiredDocuments: baseDocs(
      [EUR1_DOC, ...vehicleDocs('Moins de 8 ans (dispositif 2026, sous conditions) ou régime FCR. À confirmer avec la douane tunisienne.')],
      importerTaxIdDoc('Matricule fiscal de l\'importateur (ou CIN pour un particulier)'),
    ),
  },
  {
    countryCode: 'EG',
    countryName: 'Égypte',
    cargoTrackingType: CargoTrackingType.ACID,
    cargoMandatory: true,
    authority: 'NAFEZA (guichet unique) / Douanes égyptiennes',
    currency: 'EGP',
    customsNotes:
      'Numéro ACID (Advance Cargo Information) obligatoire AVANT le chargement, généré par l\'importateur sur NAFEZA : maritime depuis octobre 2021, aérien depuis le 1er janvier 2026. Produits réglementés : certificat d\'inspection et usine enregistrée auprès de la GOEIC. Véhicules : importation de voitures d\'occasion pratiquement interdite (véhicules particuliers neufs ou de l\'année en cours, hors régimes spéciaux pour Égyptiens de retour) — à confirmer avant toute commande.',
    parcelRestrictions: [
      'Envoi commercial : ACID obligatoire avant le chargement.',
      'Produits réglementés : certificat d\'inspection GOEIC.',
    ],
    vehicleRules: {
      maxAgeYears: 1,
      rightHandDrive: false,
      note: 'Voitures d\'occasion en principe interdites à l\'importation (hors régimes spéciaux). Ne pas accepter de commande sans accord écrit d\'un transitaire égyptien.',
      source: 'Douanes égyptiennes — à confirmer.',
    },
    requiredDocuments: baseDocs(
      [ACID_DOC, ...vehicleDocs('Véhicules d\'occasion en principe interdits : commande à valider au cas par cas avec un transitaire égyptien.')],
      importerTaxIdDoc('Numéro d\'enregistrement fiscal de l\'importateur égyptien'),
    ),
  },
  {
    countryCode: 'LY',
    countryName: 'Libye',
    cargoTrackingType: CargoTrackingType.ECTN,
    cargoMandatory: true,
    authority: 'Prestataires ECTN agréés (application variable selon les ports)',
    currency: 'LYD',
    customsNotes:
      'ECTN demandé par les ports libyens (application variable : à confirmer avec l\'agent maritime pour Tripoli, Misrata ou Benghazi). Situation sécuritaire et douanière instable : commande uniquement avec un correspondant local identifié. Véhicules d\'occasion admis, règles d\'âge non confirmées.',
    parcelRestrictions: [
      'Alcool et porc interdits.',
      'Correspondant local obligatoire pour le dédouanement.',
    ],
    vehicleRules: {
      maxAgeYears: null,
      rightHandDrive: false,
      note: 'Pas de limite d\'âge confirmée. Vérifier avec le correspondant local avant la commande.',
      source: 'À confirmer.',
    },
    requiredDocuments: baseDocs(
      [
        { key: 'cargo_tracking_note', label: 'Electronic Cargo Tracking Note (ECTN)', mandatory: true, category: 'tracking', note: 'Délivré par un prestataire agréé avant l\'arrivée au port. Application variable selon le port : à confirmer avec l\'agent maritime.' },
        ...vehicleDocs('Pas de limite d\'âge confirmée : vérifier avec le correspondant local.'),
      ],
      importerTaxIdDoc('Identifiant de l\'importateur libyen'),
    ),
  },
];
