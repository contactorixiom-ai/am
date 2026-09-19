// ════════════════════════════════════════════════════════════════════════
//  MOTEUR D'AUTO-ASSEMBLAGE DU DOSSIER ADMINISTRATIF
//
//  Objectif produit : « l'utilisateur saisit les infos d'un envoi UNE SEULE
//  fois, l'app produit tout le dossier documentaire automatiquement ».
//
//  Ce module est le cerveau : à partir d'un `ShipmentInput` et de la
//  réglementation du pays de destination (module customs), il :
//    1. croise le catalogue de documents × la réglementation pays pour
//       savoir QUELS documents sont requis (`buildDossierPlan`) ;
//    2. classe chaque document : `auto` (générable maintenant),
//       `to_upload` (vient d'un tiers) ou `to_sign` (à signer) ;
//    3. pré-remplit les données des documents générables depuis l'input ;
//    4. génère en séquence tous les PDF générables (`generateAllAuto`).
//
//  Il consomme — sans les modifier — documentCatalog.ts, pdf.ts et
//  l'API customs.ts. Repli démo crédible partout : aucun champ n'est requis.
// ════════════════════════════════════════════════════════════════════════

import {
  CatalogDoc,
  ShipmentKind,
  catalogByKind,
} from './documentCatalog';
import type { CountryRequirements } from '../api/customs';
import {
  generateCommercialInvoicePdf,
  generatePackingListPdf,
  generateExportDeclarationPdf,
  generateInsuranceCertificatePdf,
  generateCustomsMandatePdf,
  generateContractPdf,
  generateDossierPdf,
  type DossierItem as PdfDossierItem,
  type CommercialInvoicePdfData,
  type PackingListPdfData,
  type ExportDeclarationPdfData,
  type InsuranceCertificatePdfData,
  type CustomsMandatePdfData,
  type ContractPdfData,
} from './pdf';

// ─── Entrée : tout ce qu'on sait d'un envoi (tout est optionnel) ───────────
// L'idée : l'utilisateur remplit ces champs UNE fois (écran d'envoi), et
// tout le dossier s'en déduit. Chaque champ a un repli démo crédible.
export interface ShipmentParty {
  name?: string;
  address?: string;
  /** N° TVA / identifiant fiscal (expéditeur). */
  vat?: string;
  email?: string;
  /** Code pays ISO (destinataire), utile pour la déclaration. */
  country?: string;
}

export interface ShipmentGoods {
  /** Désignation libre de la marchandise. */
  designation?: string;
  /** Code SH / nomenclature douanière. */
  hsCode?: string;
  quantity?: number;
  unitPrice?: number;
}

export interface ShipmentInput {
  /** Type d'envoi : colis, marchandise commerciale ou véhicule. */
  kind: ShipmentKind;

  /** Pays d'origine (texte libre, ex « France (UE) »). */
  originCountry?: string;
  /** Pays de destination (nom lisible, ex « Sénégal »). */
  destinationCountry?: string;
  /** Code ISO destination (ex « SN »). */
  destinationCode?: string;

  /** Valeur déclarée totale de l'envoi. */
  declaredValue?: number;
  /** Devise (EUR, XOF…). */
  currency?: string;
  /** Incoterm (FOB Le Havre, CIF Dakar…). */
  incoterm?: string;

  sender?: ShipmentParty;
  recipient?: ShipmentParty;

  /** Lignes de marchandise (sinon une ligne synthétique est déduite). */
  goods?: ShipmentGoods[];

  /** Poids brut total (kg). */
  weightKg?: number;
  /** Dimensions globales « L×l×H » en cm. */
  dimensions?: string;
  /** Nombre de colis. */
  packageCount?: number;

  // ─── Véhicule ────────────────────────────────────────────────────────
  vehicleBrandModel?: string;
  vehiclePlate?: string;
  vehicleCategory?: string;

  // ─── Trajet / transport ──────────────────────────────────────────────
  /** Mode de transport principal. */
  transportMode?: 'AIR' | 'SEA' | 'ROAD';
  /** Trajet lisible (ex « Le Havre → Dakar »). */
  route?: string;

  // ─── Signature (si déjà capturée pour les documents à signer) ─────────
  signatureDataUrl?: string;
  signedDate?: string;
}

// ─── Statut prévu d'un document dans le dossier ────────────────────────────
//  auto      : Axis peut le générer immédiatement (source generated)
//  to_sign   : généré puis à signer électroniquement (source signed)
//  to_upload : doit être fourni par un tiers (source uploaded)
export type DossierStatus = 'auto' | 'to_sign' | 'to_upload';

export function statusForSource(source: CatalogDoc['source']): DossierStatus {
  if (source === 'generated') return 'auto';
  if (source === 'signed') return 'to_sign';
  return 'to_upload';
}

export const DOSSIER_STATUS_LABEL: Record<DossierStatus, string> = {
  auto: 'Généré automatiquement',
  to_sign: 'À signer',
  to_upload: 'À fournir',
};

// Une entrée du plan : le document du catalogue, son statut prévu, et —
// pour les documents générables — les données déjà pré-remplies.
export interface DossierItem {
  doc: CatalogDoc;
  status: DossierStatus;
  /** Données pré-remplies passées au générateur (si `auto`/`to_sign`). */
  prefilled?: GeneratorPayload;
}

export interface DossierPlan {
  input: ShipmentInput;
  items: DossierItem[];
  /** Documents générables maintenant (status `auto`). */
  auto: DossierItem[];
  /** Documents à signer (status `to_sign`). */
  toSign: DossierItem[];
  /** Documents à fournir par un tiers (status `to_upload`). */
  toUpload: DossierItem[];
}

// ─── Valeurs de démo crédibles (repli si l'input est incomplet) ────────────
const DEMO = {
  sender: { name: 'Axis Import SAS', address: '14 rue de la Logistique, 75015 Paris', vat: 'FR42 925487312' },
  recipient: { name: 'Sahel Trading SARL', address: 'Zone portuaire, Dakar' },
  originCountry: 'France (UE)',
  destinationCountry: 'Sénégal',
  currency: 'EUR',
  incoterm: 'FOB Le Havre',
  goods: 'Pièces détachées automobiles et matériel',
  hsCode: '8708.99',
  declaredValue: 2380,
  weightKg: 513,
  vehicleBrandModel: 'Toyota Hilux',
  vehiclePlate: 'AB-123-CD',
} as const;

const YEAR = () => new Date().getFullYear();
const TODAY = () =>
  new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

/** Référence pseudo-unique stable dans la session pour un préfixe donné. */
function ref(prefix: string): string {
  return `${prefix}-${YEAR()}-${String(Math.floor(1000 + Math.random() * 8999))}`;
}

// ─── Données d'entrée consolidées (input + replis démo) ────────────────────
interface Resolved {
  destinationCountry: string;
  originCountry: string;
  currency: string;
  incoterm: string;
  sender: Required<Pick<ShipmentParty, 'name' | 'address' | 'vat'>>;
  recipient: { name: string; address: string; country: string };
  goodsLabel: string;
  hsCode: string;
  declaredValue: number;
  weightKg: number;
  route: string;
  clientName: string;
  clientEmail?: string;
}

function resolve(input: ShipmentInput): Resolved {
  const destinationCountry =
    input.destinationCountry ?? input.recipient?.country ?? DEMO.destinationCountry;
  const currency = input.currency ?? DEMO.currency;
  const recipientName = input.recipient?.name ?? DEMO.recipient.name;
  return {
    destinationCountry,
    originCountry: input.originCountry ?? DEMO.originCountry,
    currency,
    incoterm: input.incoterm ?? DEMO.incoterm,
    sender: {
      name: input.sender?.name ?? DEMO.sender.name,
      address: input.sender?.address ?? DEMO.sender.address,
      vat: input.sender?.vat ?? DEMO.sender.vat,
    },
    recipient: {
      name: recipientName,
      address: input.recipient?.address ?? DEMO.recipient.address,
      country: input.recipient?.country ?? destinationCountry,
    },
    goodsLabel: input.goods?.[0]?.designation ?? input.vehicleBrandModel ?? DEMO.goods,
    hsCode: input.goods?.[0]?.hsCode ?? DEMO.hsCode,
    declaredValue: input.declaredValue ?? DEMO.declaredValue,
    weightKg: input.weightKg ?? DEMO.weightKg,
    route: input.route ?? `Le Havre (FR) → ${destinationCountry}`,
    clientName: recipientName,
    clientEmail: input.recipient?.email,
  };
}

// ─── Payload typé pour chaque générateur (union discriminée) ───────────────
export type GeneratorKey = CatalogDoc['generator'];

export type GeneratorPayload =
  | { kind: 'commercialInvoice'; data: CommercialInvoicePdfData }
  | { kind: 'proformaInvoice'; data: CommercialInvoicePdfData }
  | { kind: 'packingList'; data: PackingListPdfData }
  | { kind: 'exportDeclaration'; data: ExportDeclarationPdfData }
  | { kind: 'insuranceCertificate'; data: InsuranceCertificatePdfData }
  | { kind: 'customsMandate'; data: CustomsMandatePdfData }
  | { kind: 'contract'; data: ContractPdfData };

// Construit le payload pré-rempli pour un document générable, ou null si le
// générateur n'a pas de mapping PDF dédié (cmr, inspectionReport → contrat).
function buildPayload(doc: CatalogDoc, r: Resolved, input: ShipmentInput): GeneratorPayload | undefined {
  const lines = (input.goods ?? []).map((g) => ({
    designation: g.designation ?? r.goodsLabel,
    hsCode: g.hsCode,
    quantity: g.quantity,
    unitPrice: g.unitPrice,
  }));

  switch (doc.generator) {
    case 'commercialInvoice':
    case 'proformaInvoice': {
      const proforma = doc.generator === 'proformaInvoice';
      const data: CommercialInvoicePdfData = {
        number: ref(proforma ? 'PRO' : 'FC'),
        date: TODAY(),
        incoterm: r.incoterm,
        currency: r.currency,
        originCountry: r.originCountry,
        destinationCountry: r.destinationCountry,
        sender: { name: r.sender.name, address: r.sender.address, vat: r.sender.vat },
        recipient: { name: r.recipient.name, address: r.recipient.address, country: r.recipient.country },
        lines: lines.length ? lines : undefined,
        fobValue: input.declaredValue,
        notes: proforma
          ? 'Facture proforma émise avant expédition. Sert à l\'ouverture d\'une domiciliation bancaire à l\'import.'
          : undefined,
      };
      return { kind: doc.generator, data };
    }

    case 'packingList': {
      const data: PackingListPdfData = {
        number: ref('LC'),
        date: TODAY(),
        sender: { name: r.sender.name, address: r.sender.address },
        recipient: { name: r.recipient.name, address: r.recipient.address },
        packages: input.weightKg || input.dimensions
          ? [
              {
                contents: r.goodsLabel,
                dimensions: input.dimensions,
                grossKg: input.weightKg,
                netKg: input.weightKg ? Math.round(input.weightKg * 0.92) : undefined,
              },
            ]
          : undefined,
      };
      return { kind: 'packingList', data };
    }

    case 'exportDeclaration': {
      const data: ExportDeclarationPdfData = {
        number: ref('EX1'),
        date: TODAY(),
        exporter: { name: r.sender.name, address: r.sender.address },
        recipient: { name: r.recipient.name, address: r.recipient.address, country: r.recipient.country },
        goods: r.goodsLabel,
        hsCode: r.hsCode,
        value: r.declaredValue,
        currency: r.currency,
        destinationCountry: r.destinationCountry,
      };
      return { kind: 'exportDeclaration', data };
    }

    case 'insuranceCertificate': {
      const data: InsuranceCertificatePdfData = {
        number: ref('ASS'),
        date: TODAY(),
        insured: r.clientName,
        goods: `${r.goodsLabel} — ${r.weightKg} kg`,
        coverageAmount: Math.max(r.declaredValue, 25000),
        currency: r.currency,
        route: `${r.route}, ${input.transportMode === 'AIR' ? 'aérien' : 'maritime'}`,
      };
      return { kind: 'insuranceCertificate', data };
    }

    case 'customsMandate': {
      const data: CustomsMandatePdfData = {
        number: ref('MND'),
        date: TODAY(),
        principal: { name: r.clientName, address: r.recipient.address },
        destinationCountry: r.destinationCountry,
        signatureDataUrl: input.signatureDataUrl,
        signedDate: input.signedDate,
      };
      return { kind: 'customsMandate', data };
    }

    // cmr / contract / inspectionReport → format contrat officiel existant.
    case 'cmr':
    case 'contract':
    case 'inspectionReport': {
      const data: ContractPdfData = {
        reference: ref('CT'),
        copyLabel: 'EXEMPLAIRE\nCLIENT',
        clientName: r.clientName,
        vehicleBrandModel: input.vehicleBrandModel ?? DEMO.vehicleBrandModel,
        vehicleCategory: input.vehicleCategory,
        plate: input.vehiclePlate ?? DEMO.vehiclePlate,
        departureClientSigned: !!input.signatureDataUrl,
        departureClientSignedDate: input.signedDate,
        signatureDataUrl: input.signatureDataUrl,
        signedDate: input.signedDate,
      };
      return { kind: 'contract', data };
    }

    default:
      return undefined;
  }
}

// ════════════════════════════════════════════════════════════════════════
//  1. PLAN DU DOSSIER
// ════════════════════════════════════════════════════════════════════════

// Sélectionne les documents requis : catalogue filtré par type d'envoi,
// croisé avec la réglementation pays.
//  - documents obligatoires par défaut → toujours requis ;
//  - documents listés explicitement par la réglementation → requis ;
//  - bordereau de suivi → uniquement si le pays en exige un.
// (Même logique que l'écran existant, centralisée ici.)
function selectRequiredDocs(kind: ShipmentKind, req: CountryRequirements | null): CatalogDoc[] {
  const base = catalogByKind(kind);
  const regKeys = new Set((req?.checklist ?? []).map((i) => i.key));
  const hasTracking = !!req?.cargoTrackingType;

  return base.filter((doc) => {
    if (doc.key === 'cargo_tracking_note') return hasTracking;
    if (doc.mandatory) return true;
    return regKeys.has(doc.key);
  });
}

/**
 * Construit le plan complet du dossier pour un envoi donné.
 * Pour chaque document requis : statut prévu + données pré-remplies si
 * générable. Ne génère rien — c'est `generateAllAuto` qui produit les PDF.
 */
export function buildDossierPlan(
  input: ShipmentInput,
  requirements: CountryRequirements | null,
): DossierPlan {
  const r = resolve(input);
  const docs = selectRequiredDocs(input.kind, requirements);

  const items: DossierItem[] = docs.map((doc) => {
    const status = statusForSource(doc.source);
    // On pré-remplit les documents générés ET ceux à signer (un PDF est
    // produit, signé ensuite) — tous deux ont un générateur.
    const prefilled =
      status === 'auto' || status === 'to_sign' ? buildPayload(doc, r, input) : undefined;
    return { doc, status, prefilled };
  });

  return {
    input,
    items,
    auto: items.filter((i) => i.status === 'auto'),
    toSign: items.filter((i) => i.status === 'to_sign'),
    toUpload: items.filter((i) => i.status === 'to_upload'),
  };
}

// ════════════════════════════════════════════════════════════════════════
//  3. GÉNÉRATION GROUPÉE (un seul PDF dossier)
// ════════════════════════════════════════════════════════════════════════

export interface GenerateAllResult {
  /** Libellés des documents effectivement générés. */
  generated: string[];
  /** Libellés des documents générables qui ont échoué. */
  failed: string[];
  /** Ce qu'il reste à fournir / signer manuellement. */
  remaining: {
    toUpload: string[];
    toSign: string[];
  };
}

export interface GenerateAllOptions {
  /** Callback de progression : (index 1-based, total, document courant). */
  onProgress?: (done: number, total: number, current: DossierItem) => void;
}

/**
 * Génère EN SÉQUENCE tous les documents `source: generated` pré-remplis du
 * plan (les générateurs pdf.ts sont async et déclenchent un téléchargement).
 * Les documents à signer / à fournir ne sont pas générés ici : ils figurent
 * dans `remaining`. Retourne un résumé clair pour l'UI.
 */
export async function generateAllAuto(
  plan: DossierPlan,
  options: GenerateAllOptions = {},
): Promise<GenerateAllResult> {
  const generated: string[] = [];
  const failed: string[] = [];

  // On assemble tous les documents générables en UN SEUL PDF multi-pages.
  // (Safari iOS et la plupart des navigateurs bloquent les téléchargements
  //  multiples successifs : la boucle précédente ne sortait qu'un fichier.)
  const items: PdfDossierItem[] = [];
  for (const item of plan.auto) {
    if (item.prefilled) {
      items.push({ generator: item.prefilled.kind, data: item.prefilled.data });
      generated.push(item.doc.label);
    } else {
      failed.push(item.doc.label);
    }
  }

  if (items.length > 0) {
    const fname = `Dossier-Axis-${plan.input.destinationCode ?? 'export'}.pdf`;
    await generateDossierPdf(items, fname, (done, totalDocs) => {
      const current = plan.auto[Math.min(done - 1, plan.auto.length - 1)];
      if (current) options.onProgress?.(done, totalDocs, current);
    });
  }

  return {
    generated,
    failed,
    remaining: {
      toUpload: plan.toUpload.map((i) => i.doc.label),
      toSign: plan.toSign.map((i) => i.doc.label),
    },
  };
}

// ─── Petits helpers d'affichage réutilisables par l'UI ─────────────────────

/** Compteurs synthétiques pour le sous-titre de la carte. */
export function planCounts(plan: DossierPlan): { auto: number; toUpload: number; toSign: number } {
  return { auto: plan.auto.length, toUpload: plan.toUpload.length, toSign: plan.toSign.length };
}

/** Joint une liste de libellés en français (« A, B et C »). */
export function joinLabels(labels: string[]): string {
  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(', ')} et ${labels[labels.length - 1]}`;
}
