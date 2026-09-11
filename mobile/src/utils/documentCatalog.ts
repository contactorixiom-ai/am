// ════════════════════════════════════════════════════════════════════════
//  CATALOGUE DES DOCUMENTS IMPORT / EXPORT
//  Référence de tous les documents nécessaires au transport de marchandises
//  et de véhicules entre l'Europe et l'Afrique. Sert de base à l'écran
//  « centre de conformité » : on croise ce catalogue avec la réglementation
//  par pays (module customs) pour savoir, par envoi, quels documents sont
//  requis et comment les obtenir.
// ════════════════════════════════════════════════════════════════════════

export type DocCategory =
  | 'commercial'   // facture, colisage…
  | 'transport'    // connaissement, LTA, CMR…
  | 'origin'       // certificat d'origine, EUR.1…
  | 'customs'      // déclaration export, mandat de dédouanement…
  | 'tracking'     // BSC / BESC / ECTN / BIETC / FERI
  | 'insurance'    // attestation d'assurance
  | 'compliance'   // certificat de conformité, phyto, fumigation…
  | 'vehicle'      // carte grise, non-gage, désimmatriculation…
  | 'contract';    // contrat de convoyage, état des lieux

// Qui produit le document :
//  - generated : Axis le génère automatiquement (PDF) depuis les infos saisies
//  - uploaded  : vient d'un tiers, le client/Axis le téléverse
//  - signed    : généré puis signé électroniquement dans l'app
export type DocSource = 'generated' | 'uploaded' | 'signed';

// À quel type d'envoi le document s'applique.
export type ShipmentKind = 'parcel' | 'commercial' | 'vehicle';

export interface CatalogDoc {
  key: string;
  label: string;
  category: DocCategory;
  source: DocSource;
  /** Obligatoire par défaut (peut être surchargé par la réglementation pays). */
  mandatory: boolean;
  /** Types d'envoi concernés. */
  appliesTo: ShipmentKind[];
  /** Organisme émetteur / source du document. */
  issuer?: string;
  /** Explication courte : ce que c'est, à quoi ça sert. */
  description: string;
  /** Clé du générateur PDF si source = generated/signed. */
  generator?:
    | 'commercialInvoice'
    | 'proformaInvoice'
    | 'packingList'
    | 'exportDeclaration'
    | 'insuranceCertificate'
    | 'cmr'
    | 'contract'
    | 'inspectionReport'
    | 'customsMandate';
}

export const DOCUMENT_CATALOG: CatalogDoc[] = [
  // ── Commercial ────────────────────────────────────────────────────────
  {
    key: 'commercial_invoice',
    label: 'Facture commerciale',
    category: 'commercial',
    source: 'generated',
    mandatory: true,
    appliesTo: ['parcel', 'commercial', 'vehicle'],
    issuer: 'Expéditeur (Axis / client)',
    description: "Détaille la marchandise, sa valeur et les conditions de vente. Base du calcul des droits de douane à l'arrivée.",
    generator: 'commercialInvoice',
  },
  {
    key: 'proforma_invoice',
    label: 'Facture proforma',
    category: 'commercial',
    source: 'generated',
    mandatory: false,
    appliesTo: ['commercial', 'vehicle'],
    issuer: 'Expéditeur',
    description: "Facture provisoire émise avant l'expédition, souvent exigée pour ouvrir une domiciliation bancaire à l'import.",
    generator: 'proformaInvoice',
  },
  {
    key: 'packing_list',
    label: 'Liste de colisage',
    category: 'commercial',
    source: 'generated',
    mandatory: true,
    appliesTo: ['parcel', 'commercial'],
    issuer: 'Expéditeur',
    description: 'Inventaire détaillé : nombre de colis, dimensions, poids brut/net par unité. Permet le contrôle douanier sans ouvrir les colis.',
    generator: 'packingList',
  },

  // ── Transport ─────────────────────────────────────────────────────────
  {
    key: 'bill_of_lading',
    label: 'Connaissement maritime (B/L)',
    category: 'transport',
    source: 'uploaded',
    mandatory: true,
    appliesTo: ['parcel', 'commercial', 'vehicle'],
    issuer: 'Compagnie maritime (CMA CGM, Maersk…)',
    description: "Titre de transport et de propriété de la marchandise embarquée. Indispensable pour récupérer le conteneur à l'arrivée.",
  },
  {
    key: 'air_waybill',
    label: 'Lettre de transport aérien (LTA)',
    category: 'transport',
    source: 'uploaded',
    mandatory: false,
    appliesTo: ['parcel', 'commercial'],
    issuer: 'Compagnie aérienne / agent IATA',
    description: "Équivalent du connaissement pour le fret aérien. Émise lors de la prise en charge par la compagnie.",
  },
  {
    key: 'cmr',
    label: 'Lettre de voiture CMR',
    category: 'transport',
    source: 'generated',
    mandatory: true,
    appliesTo: ['commercial', 'vehicle'],
    issuer: 'Transporteur routier',
    description: 'Contrat de transport routier international (convention CMR). Couvre le tronçon terrestre jusqu\'au port.',
    generator: 'cmr',
  },

  // ── Origine ───────────────────────────────────────────────────────────
  {
    key: 'certificate_of_origin',
    label: "Certificat d'origine",
    category: 'origin',
    source: 'uploaded',
    mandatory: true,
    appliesTo: ['commercial', 'vehicle'],
    issuer: 'Chambre de commerce du pays d\'export',
    description: "Atteste le pays de fabrication de la marchandise. Détermine les droits applicables et d'éventuelles préférences tarifaires.",
  },
  {
    key: 'eur1',
    label: 'Certificat de circulation EUR.1',
    category: 'origin',
    source: 'uploaded',
    mandatory: false,
    appliesTo: ['commercial'],
    issuer: 'Douane du pays d\'export',
    description: 'Permet de bénéficier de droits réduits ou nuls dans les pays liés à l\'UE par un accord préférentiel.',
  },

  // ── Douane (export) ───────────────────────────────────────────────────
  {
    key: 'export_declaration',
    label: "Déclaration d'exportation (DAU / EX1)",
    category: 'customs',
    source: 'generated',
    mandatory: true,
    appliesTo: ['commercial', 'vehicle'],
    issuer: 'Douane (via déclarant)',
    description: "Document administratif unique déclarant la sortie de la marchandise du territoire douanier de l'UE.",
    generator: 'exportDeclaration',
  },
  {
    key: 'customs_mandate',
    label: 'Mandat de dédouanement',
    category: 'customs',
    source: 'signed',
    mandatory: true,
    appliesTo: ['commercial', 'vehicle'],
    issuer: 'Client (signé)',
    description: 'Autorise Axis (ou son commissionnaire) à effectuer les formalités douanières au nom du client.',
    generator: 'customsMandate',
  },

  // ── Bordereau de suivi de cargaison ───────────────────────────────────
  {
    key: 'cargo_tracking_note',
    label: 'Bordereau de suivi de cargaison (BSC / ECTN…)',
    category: 'tracking',
    source: 'uploaded',
    mandatory: true,
    appliesTo: ['parcel', 'commercial', 'vehicle'],
    issuer: 'Organisme du pays de destination (COSEC, CNCC, OGEFREM…)',
    description: "Obligatoire à l'import dans la plupart des pays d'Afrique de l'Ouest et Centrale. Sans lui, la marchandise est bloquée au port. Le type exact (BSC, BESC, ECTN, BIETC, FERI) dépend du pays.",
  },

  // ── Assurance ─────────────────────────────────────────────────────────
  {
    key: 'insurance_certificate',
    label: "Attestation d'assurance transport",
    category: 'insurance',
    source: 'generated',
    mandatory: true,
    appliesTo: ['parcel', 'commercial', 'vehicle'],
    issuer: 'Assureur (AXA / Allianz via Axis)',
    description: 'Couvre la marchandise pendant tout le transport. Le plafond et la nature des risques figurent sur l\'attestation.',
    generator: 'insuranceCertificate',
  },

  // ── Conformité ────────────────────────────────────────────────────────
  {
    key: 'certificate_of_conformity',
    label: 'Certificat de conformité (CoC)',
    category: 'compliance',
    source: 'uploaded',
    mandatory: false,
    appliesTo: ['commercial'],
    issuer: 'Organisme agréé (KEBS, SONCAP, Bureau Veritas, Intertek…)',
    description: "Exigé par certains pays (Kenya PVoC, Nigeria SONCAP, Ghana, Tanzanie…) pour attester que les produits respectent les normes locales. À obtenir avant embarquement.",
  },
  {
    key: 'phytosanitary_certificate',
    label: 'Certificat phytosanitaire',
    category: 'compliance',
    source: 'uploaded',
    mandatory: false,
    appliesTo: ['commercial'],
    issuer: 'Service de protection des végétaux',
    description: 'Pour les végétaux et produits d\'origine végétale : atteste l\'absence de parasites et maladies.',
  },
  {
    key: 'fumigation_certificate',
    label: 'Certificat de fumigation',
    category: 'compliance',
    source: 'uploaded',
    mandatory: false,
    appliesTo: ['commercial', 'vehicle'],
    issuer: 'Société de fumigation agréée',
    description: 'Atteste le traitement des emballages bois (palettes, caisses) contre les nuisibles (norme NIMP 15).',
  },

  // ── Véhicule (export véhicule) ────────────────────────────────────────
  {
    key: 'vehicle_registration',
    label: 'Carte grise (certificat d\'immatriculation)',
    category: 'vehicle',
    source: 'uploaded',
    mandatory: true,
    appliesTo: ['vehicle'],
    issuer: 'Titulaire du véhicule',
    description: "Titre de propriété du véhicule. Original requis pour l'export définitif et le dédouanement à l'arrivée.",
  },
  {
    key: 'vehicle_sale_invoice',
    label: "Facture d'achat / certificat de cession",
    category: 'vehicle',
    source: 'uploaded',
    mandatory: true,
    appliesTo: ['vehicle'],
    issuer: 'Vendeur',
    description: "Justifie l'acquisition et la valeur du véhicule. Base de calcul des droits et taxes à l'import.",
  },
  {
    key: 'vehicle_non_pledge',
    label: 'Certificat de non-gage / situation administrative',
    category: 'vehicle',
    source: 'uploaded',
    mandatory: true,
    appliesTo: ['vehicle'],
    issuer: 'Administration (France : ANTS / histovec)',
    description: 'Atteste que le véhicule n\'est ni gagé ni opposé à la vente. Datant de moins de 30 jours.',
  },
  {
    key: 'vehicle_deregistration',
    label: 'Certificat de désimmatriculation (export)',
    category: 'vehicle',
    source: 'uploaded',
    mandatory: false,
    appliesTo: ['vehicle'],
    issuer: 'Administration du pays d\'origine',
    description: "Officialise la sortie du véhicule du parc national. Requis pour une réimmatriculation dans le pays de destination.",
  },

  // ── Contrat / état des lieux (convoyage) ──────────────────────────────
  {
    key: 'convoy_contract',
    label: 'Contrat de convoyage',
    category: 'contract',
    source: 'signed',
    mandatory: true,
    appliesTo: ['vehicle'],
    issuer: 'Axis (signé client + convoyeur)',
    description: 'Encadre la mission de convoyage : parties, itinéraire, prix, responsabilités, assurance.',
    generator: 'contract',
  },
  {
    key: 'inspection_report',
    label: 'État des lieux (départ & arrivée)',
    category: 'contract',
    source: 'signed',
    mandatory: true,
    appliesTo: ['vehicle'],
    issuer: 'Convoyeur (signé bilatéral)',
    description: 'Constate l\'état du véhicule à l\'enlèvement et à la livraison, avec marquage des dommages et photos. Preuve en cas de litige.',
    generator: 'inspectionReport',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────

export const CATEGORY_LABEL: Record<DocCategory, string> = {
  commercial: 'Documents commerciaux',
  transport: 'Documents de transport',
  origin: 'Origine',
  customs: 'Douane',
  tracking: 'Bordereau de suivi de cargaison',
  insurance: 'Assurance',
  compliance: 'Conformité & sanitaire',
  vehicle: 'Documents du véhicule',
  contract: 'Contrat & état des lieux',
};

export const SOURCE_LABEL: Record<DocSource, string> = {
  generated: 'Généré par Axis',
  uploaded: 'À fournir',
  signed: 'À signer',
};

export function catalogByKind(kind: ShipmentKind): CatalogDoc[] {
  return DOCUMENT_CATALOG.filter((d) => d.appliesTo.includes(kind));
}

export function catalogDoc(key: string): CatalogDoc | undefined {
  return DOCUMENT_CATALOG.find((d) => d.key === key);
}

/** Regroupe une liste de documents par catégorie (ordre du catalogue). */
export function groupByCategory(docs: CatalogDoc[]): { category: DocCategory; label: string; docs: CatalogDoc[] }[] {
  const order: DocCategory[] = ['commercial', 'transport', 'origin', 'customs', 'tracking', 'insurance', 'compliance', 'vehicle', 'contract'];
  return order
    .map((category) => ({ category, label: CATEGORY_LABEL[category], docs: docs.filter((d) => d.category === category) }))
    .filter((g) => g.docs.length > 0);
}
