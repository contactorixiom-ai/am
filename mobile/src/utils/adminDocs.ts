// Espace admin (Roger) — logique du générateur de documents.
// Décrit chaque type de document (champs de formulaire, valeurs par défaut,
// activité) et route les valeurs saisies vers le bon générateur de pdf.ts.
// L'étiquette colis n'existe pas dans pdf.ts (fichier gelé) : elle est
// générée ici, en local, avec jsPDF + QRCode dans le même style N&B.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { AXIS_LOGO_PDF } from './axisLogoPdf';
import type { IconName } from '../components/Icons';
import {
  generateCommercialInvoicePdf,
  generateContractPdf,
  generateCustomsMandatePdf,
  generateExportDeclarationPdf,
  generateInsuranceCertificatePdf,
  generateInvoicePdf,
  generatePackingListPdf,
  patchDoc,
  signatureFromSvgDataUrl,} from './pdf';
import { INSURANCE } from '../config/company';
import { COMPANY, companyAddress, companyContactLine, companyLegalLine, companyRegistrationLine, orTodo } from '../config/company';

// ─── Types ──────────────────────────────────────────────────────────────────

export type AdminActivity = 'convoyage' | 'colis' | 'marchandise';

export type AdminDocTypeId =
  | 'invoice'
  | 'commercialInvoice'
  | 'packingList'
  | 'shippingInstructions'
  | 'cmr'
  | 'billOfLading'
  | 'airWaybill'
  | 'certificateOfOrigin'
  | 'deliveryNote'
  | 'contract'
  | 'insurance'
  | 'exportDeclaration'
  | 'customsMandate'
  | 'shippingLabel'
  | 'besc'
  | 'safetyDataSheet'
  | 'conformityCertificate';

export type AdminFieldType = 'text' | 'number' | 'multiline' | 'boolean' | 'select';

export interface AdminFieldSpec {
  key: string;
  label: string;
  type?: AdminFieldType;      // défaut : 'text'
  placeholder?: string;
  hint?: string;
  options?: string[];         // pour type 'select'
  half?: boolean;             // champ demi-largeur (2 par ligne)
  required?: boolean;
}

export type AdminValues = Record<string, string | boolean>;

// Qui délivre juridiquement l'original du document. C'est la distinction la
// plus importante du catalogue : un document « axis » fait foi tel qu'il sort
// de l'app ; les trois autres sont des dossiers préparés par Axis, que seul
// un tiers peut rendre opposables. Les confondre expose à présenter un faux.
export type DocIssuer = 'axis' | 'carrier' | 'authority' | 'supplier' | 'insurer';

export const ISSUER_LABEL: Record<DocIssuer, string> = {
  axis: 'Émis par Axis',
  carrier: 'Émis par le transporteur',
  authority: 'Validé par un organisme',
  supplier: 'Fourni par le fabricant',
  insurer: 'Émis par l\'assureur',
};

export const ISSUER_HELP: Record<DocIssuer, string> = {
  axis: 'Le PDF fait foi tel quel : il suffit de le signer et de le remettre.',
  carrier: 'Axis prépare les données ; l\'original est émis par la compagnie de transport.',
  authority: 'Axis prépare le dossier ; l\'original est délivré ou visé par un organisme officiel.',
  supplier: 'Le contenu vient du fabricant du produit ; Axis le met en forme pour le transmettre.',
  insurer: 'L\'attestation opposable est délivrée par la compagnie d\'assurance.',
};

export interface AdminDocType {
  id: AdminDocTypeId;
  label: string;
  description: string;
  icon: IconName;
  activity: AdminActivity;
  /** Qui délivre juridiquement l'original. */
  issuer: DocIssuer;
  /** Précision affichée sous le badge : qui délivre, et ce qu'il faut faire. */
  issuerNote?: string;
  /** Préfixe de la référence auto-incrémentée (vide = format AAAA-NNNN nu). */
  refPrefix: string;
  /** Clé du champ qui porte la référence du document. */
  refKey: string;
  fields: AdminFieldSpec[];
  /** Valeurs par défaut (la référence auto est injectée par buildDefaults). */
  defaults: (ctx: DefaultsContext) => AdminValues;
}

interface DefaultsContext {
  reference: string;   // référence auto-incrémentée pour ce type
  dateLong: string;    // "07 juillet 2026"
  dateShort: string;   // "07/07/2026"
  year: number;
}

// ─── Compteur de références AAAA-NNNN persisté (AsyncStorage) ───────────────

const SEQ_KEY = 'axis.admin.seq.v1';

type SeqMap = Partial<Record<AdminDocTypeId, { year: number; seq: number }>>;

async function readSeqMap(): Promise<SeqMap> {
  try {
    const raw = await AsyncStorage.getItem(SEQ_KEY);
    return raw ? (JSON.parse(raw) as SeqMap) : {};
  } catch {
    return {};
  }
}

function formatReference(prefix: string, year: number, seq: number): string {
  const num = `${year}-${String(seq).padStart(4, '0')}`;
  return prefix ? `${prefix}-${num}` : num;
}

/** Prochaine référence pour ce type, SANS consommer le compteur. */
export async function peekReference(typeId: AdminDocTypeId): Promise<string> {
  const type = adminDocTypeById(typeId);
  const year = new Date().getFullYear();
  const map = await readSeqMap();
  const cur = map[typeId];
  const seq = cur && cur.year === year ? cur.seq + 1 : 1;
  return formatReference(type?.refPrefix ?? '', year, seq);
}

/** Consomme le compteur après une génération réussie (repart chaque année). */
export async function commitReference(typeId: AdminDocTypeId): Promise<void> {
  try {
    const year = new Date().getFullYear();
    const map = await readSeqMap();
    const cur = map[typeId];
    map[typeId] = { year, seq: cur && cur.year === year ? cur.seq + 1 : 1 };
    await AsyncStorage.setItem(SEQ_KEY, JSON.stringify(map));
  } catch {
    // Quota / navigation privée : le compteur restera au même point, sans casse.
  }
}

// ─── Historique local des documents générés ────────────────────────────────

export const ADMIN_HISTORY_KEY = 'axis.admin.history.v1';
const HISTORY_MAX = 60;

export interface AdminHistoryEntry {
  id: string;
  typeId: AdminDocTypeId;
  typeLabel: string;
  reference: string;
  dateISO: string;
  activity: AdminActivity;
  values: AdminValues;
}

export async function readAdminHistory(): Promise<AdminHistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(ADMIN_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AdminHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export async function pushAdminHistory(entry: AdminHistoryEntry): Promise<AdminHistoryEntry[]> {
  const list = [entry, ...(await readAdminHistory())].slice(0, HISTORY_MAX);
  try {
    await AsyncStorage.setItem(ADMIN_HISTORY_KEY, JSON.stringify(list));
  } catch {
    // Persistance impossible : on renvoie quand même la liste pour l'UI.
  }
  return list;
}

// ─── Helpers de coercition des valeurs de formulaire ────────────────────────

function str(values: AdminValues, key: string): string {
  const v = values[key];
  return typeof v === 'string' ? v.trim() : '';
}

function orU(s: string): string | undefined {
  return s === '' ? undefined : s;
}

function num(values: AdminValues, key: string, fallback = 0): number {
  const raw = str(values, key).replace(/\s/g, '').replace(',', '.');
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

function numU(values: AdminValues, key: string): number | undefined {
  const raw = str(values, key);
  if (raw === '') return undefined;
  const n = parseFloat(raw.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

function bool(values: AdminValues, key: string): boolean {
  return values[key] === true;
}

// ─── Catalogue des types de documents ──────────────────────────────────────

const VEHICLE_CATEGORY_OPTIONS = [
  'Citadine', 'Berline', 'Break', 'SUV', '4×4', 'Utilitaire', 'Moto', 'Luxe',
];

export const ADMIN_DOC_TYPES: AdminDocType[] = [
  {
    id: 'invoice',
    label: 'Facture client',
    description: 'Facture TTC avec TVA, tampon payé/à régler',
    icon: 'card',
    activity: 'convoyage',
    issuer: 'axis',
    refPrefix: '',
    refKey: 'number',
    fields: [
      { key: 'number', label: 'N° de facture', half: true, required: true },
      { key: 'date', label: 'Date', half: true },
      { key: 'clientName', label: 'Client', required: true, placeholder: 'Nom du client' },
      { key: 'clientAddress', label: 'Adresse du client', required: true, placeholder: '12 rue…, 75000 Paris' },
      { key: 'clientEmail', label: 'Email client', half: true, placeholder: 'client@exemple.com' },
      { key: 'clientSiren', label: 'SIREN client (si pro)', half: true, placeholder: '9 chiffres' },
      { key: 'serviceDate', label: 'Date de la prestation', half: true },
      { key: 'dueDate', label: 'Échéance de paiement', half: true },
      { key: 'operationCategory', label: 'Nature de l\'opération', type: 'select', options: ['Prestation de services', 'Livraison de biens', 'Mixte (biens et services)'], half: true },
      { key: 'description', label: 'Description', required: true, placeholder: 'Convoyage Paris → Lisbonne' },
      { key: 'amountEur', label: 'Montant TTC (€)', type: 'number', half: true, required: true },
      { key: 'paid', label: 'Facture payée', type: 'boolean', half: true },
    ],
    defaults: (ctx) => ({
      number: ctx.reference,
      date: ctx.dateLong,
      clientName: '',
      clientAddress: '',
      clientEmail: '',
      clientSiren: '',
      serviceDate: ctx.dateShort ?? '',
      dueDate: '',
      operationCategory: 'Prestation de services',
      description: '',
      amountEur: '',
      paid: false,
    }),
  },
  {
    id: 'commercialInvoice',
    label: 'Facture commerciale export',
    description: 'Base du calcul des droits de douane (Incoterm, code SH)',
    icon: 'globe',
    activity: 'marchandise',
    issuer: 'axis',
    issuerNote: 'Signée et cachetée par l\'exportateur ; elle sert de base au calcul des droits.',
    refPrefix: 'FC',
    refKey: 'number',
    fields: [
      { key: 'number', label: 'N°', half: true, required: true },
      { key: 'date', label: 'Date', half: true },
      { key: 'incoterm', label: 'Incoterm', half: true, placeholder: 'FOB Le Havre' },
      { key: 'currency', label: 'Devise', half: true, placeholder: 'EUR' },
      { key: 'senderName', label: 'Expéditeur', placeholder: COMPANY.name },
      { key: 'senderAddress', label: 'Adresse expéditeur' },
      { key: 'recipientName', label: 'Destinataire', required: true },
      { key: 'recipientAddress', label: 'Adresse destinataire' },
      { key: 'originCountry', label: 'Pays d\'origine', half: true },
      { key: 'destinationCountry', label: 'Pays de destination', half: true },
      { key: 'designation', label: 'Désignation marchandise', required: true },
      { key: 'hsCode', label: 'Code SH', half: true, placeholder: '8708.99' },
      { key: 'quantity', label: 'Quantité', type: 'number', half: true },
      { key: 'unitPrice', label: 'PU (devise)', type: 'number', half: true },
      { key: 'notes', label: 'Mentions export', type: 'multiline' },
    ],
    defaults: (ctx) => ({
      number: ctx.reference,
      date: ctx.dateLong,
      incoterm: 'FOB Le Havre',
      currency: 'EUR',
      senderName: COMPANY.name,
      senderAddress: companyAddress(),
      recipientName: '',
      recipientAddress: '',
      originCountry: 'France (UE)',
      destinationCountry: 'Sénégal',
      designation: '',
      hsCode: '',
      quantity: '1',
      unitPrice: '',
      notes: '',
    }),
  },
  {
    id: 'packingList',
    label: 'Liste de colisage',
    description: 'Packing list : colis, dimensions, poids brut/net',
    icon: 'pallet',
    activity: 'marchandise',
    issuer: 'axis',
    refPrefix: 'LC',
    refKey: 'number',
    fields: [
      { key: 'number', label: 'N°', half: true, required: true },
      { key: 'date', label: 'Date', half: true },
      { key: 'senderName', label: 'Expéditeur' },
      { key: 'senderAddress', label: 'Adresse expéditeur' },
      { key: 'recipientName', label: 'Destinataire', required: true },
      { key: 'recipientAddress', label: 'Adresse destinataire' },
      {
        key: 'packagesText',
        label: 'Colis (1 par ligne)',
        type: 'multiline',
        required: true,
        hint: 'Format : contenu ; L×l×H (cm) ; brut kg ; net kg',
        placeholder: 'Pièces détachées ; 120×80×100 ; 320 ; 295',
      },
    ],
    defaults: (ctx) => ({
      number: ctx.reference,
      date: ctx.dateLong,
      senderName: COMPANY.name,
      senderAddress: companyAddress(),
      recipientName: '',
      recipientAddress: '',
      packagesText: '',
    }),
  },
  {
    id: 'shippingInstructions',
    label: 'Instructions au transitaire',
    description: 'Lettre d\'ordre d\'expédition (Shipping Instructions)',
    icon: 'truck',
    activity: 'marchandise',
    issuer: 'axis',
    refPrefix: 'SI',
    refKey: 'number',
    fields: [
      { key: 'number', label: 'N°', half: true, required: true },
      { key: 'date', label: 'Date', half: true },
      { key: 'forwarder', label: 'À l\'attention de (transitaire)', required: true, placeholder: 'Bolloré Logistics, Grimaldi…' },
      { key: 'invoiceRef', label: 'Facture liée', half: true, placeholder: 'FC-2026-0001' },
      { key: 'senderName', label: 'Expéditeur' },
      { key: 'senderAddress', label: 'Adresse expéditeur' },
      { key: 'senderContact', label: 'Contact expéditeur', placeholder: orTodo(COMPANY.phone) },
      { key: 'recipientName', label: 'Destinataire', required: true },
      { key: 'recipientAddress', label: 'Adresse destinataire' },
      { key: 'recipientContact', label: 'Contact destinataire' },
      { key: 'pickupLocation', label: 'Lieu d\'enlèvement', placeholder: 'Entrepôt, 75015 Paris' },
      { key: 'deliveryLocation', label: 'Lieu de livraison', placeholder: 'Port de Dakar' },
      { key: 'incoterm', label: 'Incoterm applicable', half: true, placeholder: 'CIF Dakar' },
      { key: 'goodsNature', label: 'Nature de la marchandise', placeholder: 'Prêt-à-porter' },
      { key: 'packages', label: 'Colis / palettes', half: true, placeholder: '2 palettes' },
      { key: 'grossWeight', label: 'Poids brut (kg)', type: 'number', half: true },
      { key: 'volume', label: 'Volume (m³)', type: 'number', half: true },
      { key: 'docInvoice', label: 'Facture commerciale jointe', type: 'boolean', half: true },
      { key: 'docPackingList', label: 'Packing list jointe', type: 'boolean', half: true },
      { key: 'customsByAxis', label: 'Dédouanement export par Axis', type: 'boolean', half: true },
      { key: 'insuranceByAxis', label: 'Assurance transport par Axis', type: 'boolean', half: true },
      { key: 'signatory', label: 'Signataire', half: true, placeholder: 'R. Diallo' },
    ],
    defaults: (ctx) => ({
      number: ctx.reference,
      date: ctx.dateLong,
      forwarder: '',
      invoiceRef: '',
      senderName: COMPANY.name,
      senderAddress: companyAddress(),
      senderContact: orTodo(COMPANY.phone),
      recipientName: '',
      recipientAddress: '',
      recipientContact: '',
      pickupLocation: '',
      deliveryLocation: '',
      incoterm: 'CIF Dakar',
      goodsNature: '',
      packages: '',
      grossWeight: '',
      volume: '',
      docInvoice: true,
      docPackingList: true,
      customsByAxis: true,
      insuranceByAxis: true,
      signatory: '',
    }),
  },
  {
    id: 'cmr',
    label: 'Lettre de voiture CMR',
    description: 'Contrat de transport routier international (24 cases)',
    icon: 'truck',
    activity: 'marchandise',
    issuer: 'axis',
    issuerNote: 'Établie par l\'expéditeur, signée par l\'expéditeur, le transporteur et le destinataire.',
    refPrefix: 'CMR',
    refKey: 'number',
    fields: [
      { key: 'number', label: 'N° CMR', half: true, required: true },
      { key: 'date', label: 'Date', half: true },
      { key: 'senderName', label: '1 · Expéditeur' },
      { key: 'senderAddress', label: 'Adresse expéditeur' },
      { key: 'recipientName', label: '2 · Destinataire', required: true },
      { key: 'recipientAddress', label: 'Adresse destinataire' },
      { key: 'deliveryPlace', label: '3 · Lieu de livraison' },
      { key: 'takingOverPlace', label: '4 · Lieu de prise en charge', half: true },
      { key: 'takingOverDate', label: 'Date de prise en charge', half: true },
      { key: 'carrierName', label: '16 · Transporteur' },
      { key: 'plate', label: 'Immatriculation', half: true, placeholder: 'AB-123-CD' },
      { key: 'documentsAttached', label: '5 · Documents annexés', half: true },
      { key: 'goods', label: '9 · Nature de la marchandise', required: true },
      { key: 'packages', label: '7 · Nombre de colis', type: 'number', half: true },
      { key: 'packaging', label: '8 · Emballage', half: true },
      { key: 'hsCode', label: '10 · Code SH', half: true, placeholder: '8708.99' },
      { key: 'grossWeight', label: '11 · Poids brut (kg)', type: 'number', half: true },
      { key: 'volume', label: '12 · Cubage (m³)', type: 'number', half: true },
      { key: 'marks', label: '6 · Marques & n°', half: true },
      { key: 'franking', label: '14 · Affranchissement', type: 'select', options: ['Franco', 'Non franco'] },
      { key: 'cashOnDelivery', label: '15 · Remboursement', half: true, placeholder: 'Néant' },
      { key: 'carrierReservations', label: '18 · Réserves du transporteur', type: 'multiline', hint: 'Constat à l\'enlèvement — fait foi en cas de litige' },
      { key: 'senderInstructions', label: '13 · Instructions expéditeur', type: 'multiline' },
      { key: 'specialAgreements', label: '19 · Conventions particulières', type: 'multiline' },
      { key: 'establishedAt', label: '21 · Établi à', half: true, placeholder: 'Paris' },
      { key: 'toPay', label: '20 · À payer', half: true },
    ],
    defaults: (ctx) => ({
      number: ctx.reference,
      date: ctx.dateShort,
      senderName: COMPANY.name,
      senderAddress: companyAddress(),
      recipientName: '',
      recipientAddress: '',
      deliveryPlace: '',
      takingOverPlace: 'Paris, France',
      takingOverDate: ctx.dateShort,
      carrierName: `${COMPANY.name} — ${companyAddress()}`,
      plate: '',
      documentsAttached: 'Facture commerciale, liste de colisage',
      goods: '',
      packages: '',
      packaging: '',
      hsCode: '',
      grossWeight: '',
      volume: '',
      marks: '',
      franking: 'Franco',
      senderInstructions: '',
      specialAgreements: '',
      establishedAt: 'Paris',
      toPay: '',
    }),
  },
  {
    id: 'billOfLading',
    label: 'Connaissement (B/L)',
    description: 'Bill of Lading — transport maritime, titre de propriété',
    icon: 'globe',
    activity: 'marchandise',
    issuer: 'carrier',
    issuerNote: 'L\'original négociable est émis par la compagnie maritime : c\'est lui qui donne droit à la marchandise.',
    refPrefix: 'BOL',
    refKey: 'number',
    fields: [
      { key: 'number', label: 'N° B/L', half: true, required: true },
      { key: 'date', label: 'Date', half: true },
      { key: 'shipperName', label: 'Chargeur / Shipper' },
      { key: 'shipperAddress', label: 'Adresse chargeur' },
      { key: 'consigneeName', label: 'Destinataire / Consignee', required: true },
      { key: 'consigneeAddress', label: 'Adresse destinataire' },
      { key: 'notifyParty', label: 'Partie à notifier / Notify' },
      { key: 'carrier', label: 'Transporteur maritime' },
      { key: 'vessel', label: 'Navire / Vessel', half: true },
      { key: 'voyageNo', label: 'N° voyage', half: true },
      { key: 'portOfLoading', label: 'Port de chargement', half: true, placeholder: 'Le Havre' },
      { key: 'portOfDischarge', label: 'Port de déchargement', half: true, placeholder: 'Dakar' },
      { key: 'placeOfReceipt', label: 'Lieu de réception', half: true },
      { key: 'placeOfDelivery', label: 'Lieu de livraison', half: true },
      { key: 'containerNo', label: 'Conteneur / N° plomb', half: true, placeholder: 'MSKU1234567' },
      { key: 'marks', label: 'Marques & n°', half: true },
      { key: 'packages', label: 'Nombre et nature des colis', half: true },
      { key: 'goods', label: 'Description des marchandises', required: true },
      { key: 'grossWeight', label: 'Poids brut (kg)', type: 'number', half: true },
      { key: 'measurement', label: 'Cubage (m³)', type: 'number', half: true },
      { key: 'freightTerms', label: 'Fret', type: 'select', options: ['Prépayé (Prepaid)', 'Payable à destination (Collect)'] },
      { key: 'numberOfOriginals', label: 'Nombre d\'originaux', half: true },
      { key: 'shippedOnBoardDate', label: 'Date embarquement', half: true },
    ],
    defaults: (ctx) => ({
      number: ctx.reference,
      date: ctx.dateShort,
      shipperName: COMPANY.name,
      shipperAddress: companyAddress(),
      consigneeName: '',
      consigneeAddress: '',
      notifyParty: '',
      carrier: 'Compagnie maritime (à préciser)',
      vessel: '',
      voyageNo: '',
      portOfLoading: 'Le Havre (FR)',
      portOfDischarge: 'Dakar (SN)',
      placeOfReceipt: '',
      placeOfDelivery: '',
      containerNo: '',
      marks: '',
      packages: '',
      goods: '',
      grossWeight: '',
      measurement: '',
      freightTerms: 'Prépayé (Prepaid)',
      numberOfOriginals: '3',
      shippedOnBoardDate: '',
    }),
  },
  {
    id: 'airWaybill',
    label: 'Lettre de transport aérien (LTA)',
    description: 'Air Waybill (AWB) — transport aérien, format IATA',
    icon: 'bolt',
    activity: 'marchandise',
    issuer: 'carrier',
    issuerNote: 'L\'original est émis par la compagnie aérienne ou l\'agent IATA.',
    refPrefix: 'AWB',
    refKey: 'number',
    fields: [
      { key: 'number', label: 'N° LTA / AWB', half: true, required: true },
      { key: 'date', label: 'Date', half: true },
      { key: 'shipperName', label: 'Expéditeur / Shipper' },
      { key: 'shipperAddress', label: 'Adresse expéditeur' },
      { key: 'consigneeName', label: 'Destinataire / Consignee', required: true },
      { key: 'consigneeAddress', label: 'Adresse destinataire' },
      { key: 'issuingAgent', label: 'Agent émetteur' },
      { key: 'airportDeparture', label: 'Aéroport de départ', half: true, placeholder: 'Paris CDG' },
      { key: 'airportDestination', label: 'Aéroport de destination', half: true, placeholder: 'Dakar DSS' },
      { key: 'routing', label: 'Acheminement / Vol', half: true, placeholder: 'AF718' },
      { key: 'flightDate', label: 'Date de vol', half: true },
      { key: 'currency', label: 'Devise', half: true, placeholder: 'EUR' },
      { key: 'declaredValueCarriage', label: 'Valeur décl. transport', half: true },
      { key: 'declaredValueCustoms', label: 'Valeur décl. douane', half: true },
      { key: 'handlingInfo', label: 'Informations de manutention', half: true },
      { key: 'goods', label: 'Nature et quantité des marchandises', required: true },
      { key: 'pieces', label: 'Nb colis', type: 'number', half: true },
      { key: 'grossWeight', label: 'Poids brut (kg)', type: 'number', half: true },
      { key: 'chargeableWeight', label: 'Poids taxable (kg)', type: 'number', half: true },
      { key: 'volume', label: 'Cubage (m³)', type: 'number', half: true },
      { key: 'chargesTerms', label: 'Frais', type: 'select', options: ['Prépayé (Prepaid)', 'Port dû (Collect)'] },
      { key: 'executedPlace', label: 'Émis à', half: true, placeholder: 'Paris' },
    ],
    defaults: (ctx) => ({
      number: ctx.reference,
      date: ctx.dateShort,
      shipperName: COMPANY.name,
      shipperAddress: companyAddress(),
      consigneeName: '',
      consigneeAddress: '',
      issuingAgent: COMPANY.name,
      airportDeparture: 'Paris CDG (FR)',
      airportDestination: 'Dakar DSS (SN)',
      routing: '',
      flightDate: '',
      currency: 'EUR',
      declaredValueCarriage: '',
      declaredValueCustoms: '',
      handlingInfo: '',
      goods: '',
      pieces: '',
      grossWeight: '',
      chargeableWeight: '',
      volume: '',
      chargesTerms: 'Prépayé (Prepaid)',
      executedPlace: 'Paris',
    }),
  },
  {
    id: 'certificateOfOrigin',
    label: 'Certificat d\'origine',
    description: 'Atteste l\'origine des marchandises (modèle UE)',
    icon: 'flag',
    activity: 'marchandise',
    issuer: 'authority',
    issuerNote: 'À faire viser par la chambre de commerce et d\'industrie : sans son visa, le certificat n\'a aucune valeur.',
    refPrefix: 'CO',
    refKey: 'number',
    fields: [
      { key: 'number', label: 'N°', half: true, required: true },
      { key: 'date', label: 'Date', half: true },
      { key: 'exporterName', label: 'Expéditeur / Exportateur' },
      { key: 'exporterAddress', label: 'Adresse exportateur' },
      { key: 'consigneeName', label: 'Destinataire', required: true },
      { key: 'consigneeAddress', label: 'Adresse destinataire' },
      { key: 'originCountry', label: 'Pays d\'origine', half: true },
      { key: 'transportInfo', label: 'Transport', half: true, placeholder: 'Maritime — Le Havre → Dakar' },
      { key: 'goods', label: 'Désignation des marchandises', required: true },
      { key: 'packages', label: 'Marques, nombre et nature des colis' },
      { key: 'quantity', label: 'Quantité', half: true },
      { key: 'remarks', label: 'Observations', half: true },
      { key: 'signatoryPlace', label: 'Fait à', half: true, placeholder: 'Paris' },
      { key: 'signatory', label: 'Signataire', half: true },
    ],
    defaults: (ctx) => ({
      number: ctx.reference,
      date: ctx.dateLong,
      exporterName: COMPANY.name,
      exporterAddress: companyAddress(),
      consigneeName: '',
      consigneeAddress: '',
      originCountry: 'Union européenne (France)',
      transportInfo: '',
      goods: '',
      packages: '',
      quantity: '',
      remarks: '',
      signatoryPlace: 'Paris',
      signatory: '',
    }),
  },
  {
    id: 'deliveryNote',
    label: 'Bon de livraison (POD)',
    description: 'Justificatif de livraison signé par le destinataire',
    icon: 'box',
    activity: 'colis',
    issuer: 'axis',
    refPrefix: 'BL',
    refKey: 'number',
    fields: [
      { key: 'number', label: 'N°', half: true, required: true },
      { key: 'date', label: 'Date', half: true },
      { key: 'orderRef', label: 'Commande / référence liée', placeholder: 'AX-2026-8841' },
      { key: 'senderName', label: 'Expéditeur' },
      { key: 'senderAddress', label: 'Adresse expéditeur' },
      { key: 'recipientName', label: 'Destinataire', required: true },
      { key: 'recipientAddress', label: 'Adresse destinataire' },
      { key: 'deliveryAddress', label: 'Adresse de livraison' },
      { key: 'itemsText', label: 'Articles (1 par ligne)', type: 'multiline', required: true, hint: 'Format : désignation ; quantité', placeholder: 'Cartons de vêtements ; 4' },
      { key: 'carrier', label: 'Transporteur', half: true },
      { key: 'driverName', label: 'Livré par', half: true },
      { key: 'deliveryDate', label: 'Date livraison', half: true },
      { key: 'deliveryTime', label: 'Heure', half: true },
      { key: 'reserves', label: 'Réserves à la livraison', type: 'multiline' },
    ],
    defaults: (ctx) => ({
      number: ctx.reference,
      date: ctx.dateShort,
      orderRef: '',
      senderName: COMPANY.name,
      senderAddress: companyAddress(),
      recipientName: '',
      recipientAddress: '',
      deliveryAddress: '',
      itemsText: '',
      carrier: 'Axis Import',
      driverName: '',
      deliveryDate: ctx.dateShort,
      deliveryTime: '',
      reserves: '',
    }),
  },
  {
    id: 'contract',
    label: 'Contrat de convoyage',
    description: 'Contrat + état des lieux départ/arrivée (PV)',
    icon: 'sig',
    activity: 'convoyage',
    issuer: 'axis',
    refPrefix: 'CV',
    refKey: 'reference',
    fields: [
      { key: 'reference', label: 'Référence', half: true, required: true },
      { key: 'vehicleCategory', label: 'Catégorie', type: 'select', options: VEHICLE_CATEGORY_OPTIONS },
      { key: 'clientName', label: 'Client', required: true },
      { key: 'driverName', label: 'Chauffeur', half: true },
      { key: 'driverPhone', label: 'Tél. chauffeur', half: true },
      { key: 'vehicleBrandModel', label: 'Marque + modèle', half: true, placeholder: 'BMW Série 3' },
      { key: 'plate', label: 'Immatriculation', half: true, placeholder: 'AB-123-CD' },
      { key: 'pickupAddress', label: 'Prise en charge (ville, adresse)', placeholder: 'Paris' },
      { key: 'deliveryAddress', label: 'Remise (ville, adresse)', placeholder: 'Lisbonne' },
      { key: 'pickupDate', label: 'Date de prise', half: true, placeholder: '22/05/2026' },
      { key: 'pickupTime', label: 'Heure de prise', half: true, placeholder: '08h30' },
      { key: 'deliveryDate', label: 'Date de remise', half: true },
      { key: 'deliveryTime', label: 'Heure de remise', half: true },
      { key: 'estimatedKm', label: 'Km prévus', type: 'number', half: true },
      { key: 'estimatedDuration', label: 'Durée estimée', half: true, placeholder: '5 h' },
      { key: 'priceEur', label: 'Prix (€)', type: 'number', half: true },
    ],
    defaults: (ctx) => ({
      reference: ctx.reference,
      vehicleCategory: 'Berline',
      clientName: '',
      driverName: '',
      driverPhone: '',
      vehicleBrandModel: '',
      plate: '',
      pickupAddress: '',
      deliveryAddress: '',
      pickupDate: ctx.dateShort,
      pickupTime: '',
      deliveryDate: '',
      deliveryTime: '',
      estimatedKm: '',
      estimatedDuration: '',
      priceEur: '',
    }),
  },
  {
    id: 'insurance',
    label: 'Attestation d\'assurance',
    description: 'Couverture transport, police et plafond de garantie',
    icon: 'shield',
    activity: 'marchandise',
    issuer: 'insurer',
    issuerNote: 'L\'attestation opposable est délivrée par l\'assureur ; ce document reprend les termes de la police.',
    refPrefix: 'ASS',
    refKey: 'number',
    fields: [
      { key: 'number', label: 'N°', half: true, required: true },
      { key: 'date', label: 'Date', half: true },
      { key: 'insurer', label: 'Assureur' },
      { key: 'policyNumber', label: 'N° de police', half: true },
      { key: 'coverageAmount', label: 'Plafond (€)', type: 'number', half: true },
      { key: 'insured', label: 'Assuré' },
      { key: 'goods', label: 'Marchandise assurée', required: true },
      { key: 'route', label: 'Trajet couvert', placeholder: 'Le Havre (FR) → Dakar (SN), maritime' },
      { key: 'validFrom', label: 'Valide du', half: true },
      { key: 'validTo', label: 'Valide au', half: true },
    ],
    defaults: (ctx) => ({
      number: ctx.reference,
      date: ctx.dateLong,
      // Pré-remplis depuis la police réellement souscrite (app.json), vides
      // tant qu'elle n'est pas renseignée.
      insurer: INSURANCE.insurer,
      policyNumber: INSURANCE.policyNumber,
      coverageAmount: INSURANCE.coverageEur > 0 ? String(INSURANCE.coverageEur) : '',
      insured: 'Axis Import SAS pour le compte de qui il appartiendra',
      goods: '',
      route: '',
      validFrom: ctx.dateLong,
      validTo: `31 décembre ${ctx.year}`,
    }),
  },
  {
    id: 'exportDeclaration',
    label: 'Déclaration d\'export',
    description: 'DAU / EX1 simplifié : régime, bureau, valeur déclarée',
    icon: 'flag',
    activity: 'marchandise',
    issuer: 'authority',
    issuerNote: 'La déclaration légale se dépose sur DELTA. Ce document est le récapitulatif préparatoire.',
    refPrefix: 'EX1',
    refKey: 'number',
    fields: [
      { key: 'number', label: 'N°', half: true, required: true },
      { key: 'date', label: 'Date', half: true },
      { key: 'exporterName', label: 'Exportateur' },
      { key: 'exporterAddress', label: 'Adresse exportateur' },
      { key: 'eori', label: 'N° EORI', half: true },
      { key: 'destinationCountry', label: 'Pays de destination', half: true, required: true },
      { key: 'recipientName', label: 'Destinataire' },
      { key: 'recipientAddress', label: 'Adresse destinataire' },
      { key: 'regime', label: 'Régime douanier' },
      { key: 'customsOffice', label: 'Bureau de douane' },
      { key: 'goods', label: 'Marchandise', required: true },
      { key: 'hsCode', label: 'Code SH', half: true },
      { key: 'value', label: 'Valeur déclarée (€)', type: 'number', half: true },
    ],
    defaults: (ctx) => ({
      number: ctx.reference,
      date: ctx.dateLong,
      exporterName: COMPANY.name,
      exporterAddress: companyAddress(),
      eori: orTodo(COMPANY.eori),
      destinationCountry: 'Sénégal',
      recipientName: '',
      recipientAddress: '',
      regime: 'Exportation définitive (régime 10 00)',
      customsOffice: 'Le Havre Port (FR LEH)',
      goods: '',
      hsCode: '',
      value: '',
    }),
  },
  {
    id: 'customsMandate',
    label: 'Mandat de dédouanement',
    description: 'Le client mandate Axis pour les formalités douanières',
    icon: 'doc',
    activity: 'marchandise',
    issuer: 'axis',
    issuerNote: 'Acte entre le client et Axis : il prend effet à la signature du mandant.',
    refPrefix: 'MND',
    refKey: 'number',
    fields: [
      { key: 'number', label: 'N°', half: true, required: true },
      { key: 'date', label: 'Date', half: true },
      { key: 'principalName', label: 'Mandant (client)', required: true },
      { key: 'principalAddress', label: 'Adresse du mandant' },
      { key: 'principalEori', label: 'N° EORI du mandant', half: true, placeholder: 'FR89412356700024' },
      { key: 'agent', label: 'Mandataire' },
      { key: 'agentRegistration', label: 'N° représentant en douane enregistré (RDE)', half: true, hint: 'Laisser vide si non détenu' },
      { key: 'representation', label: 'Nature de la représentation', type: 'select', options: ['directe', 'indirecte'], half: true },
      { key: 'destinationCountry', label: 'Pays de destination', half: true },
      { key: 'scope', label: 'Étendue du mandat (facultatif)', type: 'multiline', hint: 'Vide = clause standard' },
    ],
    defaults: (ctx) => ({
      number: ctx.reference,
      date: ctx.dateLong,
      principalName: '',
      principalAddress: '',
      principalEori: '',
      agent: COMPANY.name,
      agentRegistration: '',
      representation: 'directe',
      destinationCountry: 'Sénégal',
      scope: '',
    }),
  },
  {
    id: 'shippingLabel',
    label: 'Étiquette colis',
    description: 'Étiquette A6 avec QR de suivi, prête à imprimer',
    icon: 'box',
    activity: 'colis',
    issuer: 'axis',
    refPrefix: 'AX',
    refKey: 'reference',
    fields: [
      { key: 'reference', label: 'Référence colis', required: true },
      { key: 'originCity', label: 'Ville de départ', half: true, required: true },
      { key: 'destinationCity', label: 'Ville d\'arrivée', half: true, required: true },
      { key: 'destinationCountry', label: 'Pays de destination', half: true },
      { key: 'weightKg', label: 'Poids (kg)', type: 'number', half: true },
      { key: 'recipientName', label: 'Destinataire', required: true },
      { key: 'recipientPhone', label: 'Tél. destinataire' },
      { key: 'transportMode', label: 'Mode', type: 'select', options: ['Aérien', 'Maritime'] },
    ],
    defaults: (ctx) => ({
      reference: ctx.reference,
      originCity: '',
      destinationCity: '',
      destinationCountry: '',
      weightKg: '',
      recipientName: '',
      recipientPhone: '',
      transportMode: 'Aérien',
    }),
  },
  {
    // Le BESC est délivré par le COSEC (Sénégal) / l'OIC (Côte d'Ivoire) sur
    // leur portail : Axis ne peut pas l'émettre. Ce document rassemble toutes
    // les données que le portail réclame, prêt à saisir ou à remettre à
    // l'agent, et garde trace du numéro obtenu.
    id: 'besc',
    label: 'Demande de BESC / BSC',
    description: 'Bordereau électronique de suivi des cargaisons — dossier à déposer sur le portail',
    icon: 'shield',
    activity: 'marchandise',
    issuer: 'authority',
    issuerNote: 'Le bordereau est délivré par le COSEC (Sénégal) ou l\'OIC (Côte d\'Ivoire) après dépôt sur leur portail.',
    refPrefix: 'BESC',
    refKey: 'number',
    fields: [
      { key: 'number', label: 'N° de dossier interne', half: true, required: true },
      { key: 'date', label: 'Date', half: true },
      { key: 'destinationCountry', label: 'Pays de destination', type: 'select', half: true, required: true, options: ['Sénégal', 'Côte d\'Ivoire', 'Mali', 'Burkina Faso', 'Niger', 'Togo', 'Bénin', 'Cameroun', 'Congo', 'Madagascar'] },
      { key: 'bescNumber', label: 'N° BESC obtenu', half: true, hint: 'À compléter après validation du portail' },
      { key: 'shipperName', label: 'Chargeur / Exportateur', required: true },
      { key: 'shipperAddress', label: 'Adresse chargeur' },
      { key: 'consigneeName', label: 'Destinataire / Importateur', required: true },
      { key: 'consigneeAddress', label: 'Adresse destinataire' },
      { key: 'consigneeTaxId', label: 'N° contribuable destinataire', half: true, hint: 'NINEA au Sénégal, CC en Côte d\'Ivoire' },
      { key: 'forwarder', label: 'Transitaire', half: true },
      { key: 'carrier', label: 'Compagnie maritime', half: true },
      { key: 'blNumber', label: 'N° de connaissement (B/L)', half: true, required: true },
      { key: 'blDate', label: 'Date du B/L', half: true },
      { key: 'vessel', label: 'Navire', half: true },
      { key: 'voyageNo', label: 'N° voyage', half: true },
      { key: 'portOfLoading', label: 'Port de chargement', half: true, placeholder: 'Le Havre' },
      { key: 'portOfDischarge', label: 'Port de déchargement', half: true, placeholder: 'Dakar' },
      { key: 'sailingDate', label: 'Date de départ du navire', half: true, hint: 'Le BESC doit être validé avant' },
      { key: 'containerNo', label: 'Conteneur / n° de plomb', half: true },
      { key: 'goods', label: 'Désignation des marchandises', required: true },
      { key: 'hsCode', label: 'Code SH', half: true, placeholder: '8708.30' },
      { key: 'packages', label: 'Nombre et nature des colis', half: true },
      { key: 'grossWeight', label: 'Poids brut (kg)', type: 'number', half: true },
      { key: 'volume', label: 'Cubage (m³)', type: 'number', half: true },
      { key: 'incoterm', label: 'Incoterm', half: true, placeholder: 'FOB Le Havre' },
      { key: 'currency', label: 'Devise', half: true, placeholder: 'EUR' },
      { key: 'goodsValue', label: 'Valeur de la marchandise', type: 'number', half: true, required: true },
      { key: 'freightValue', label: 'Montant du fret', type: 'number', half: true },
      { key: 'invoiceRef', label: 'Facture commerciale liée', half: true },
    ],
    defaults: (ctx) => ({
      number: ctx.reference,
      date: ctx.dateShort,
      destinationCountry: 'Sénégal',
      bescNumber: '',
      shipperName: COMPANY.name,
      shipperAddress: companyAddress(),
      consigneeName: '',
      consigneeAddress: '',
      consigneeTaxId: '',
      forwarder: '',
      carrier: '',
      blNumber: '',
      blDate: '',
      vessel: '',
      voyageNo: '',
      portOfLoading: 'Le Havre',
      portOfDischarge: '',
      sailingDate: '',
      containerNo: '',
      goods: '',
      hsCode: '',
      packages: '',
      grossWeight: '',
      volume: '',
      incoterm: '',
      currency: 'EUR',
      goodsValue: '',
      freightValue: '',
      invoiceRef: '',
    }),
  },
  {
    // La FDS est établie par le fabricant ou le fournisseur du produit
    // (règlement REACH). Axis la reprend pour la transmettre au transporteur
    // et aux autorités : la rubrique 14 (transport) est la partie critique.
    id: 'safetyDataSheet',
    label: 'Fiche de données de sécurité (FDS)',
    description: 'Produits dangereux — 16 rubriques, format REACH annexe II',
    icon: 'shield',
    activity: 'marchandise',
    issuer: 'supplier',
    issuerNote: 'Établie par le fabricant du produit, sous sa responsabilité. Axis la reprend pour la transmettre.',
    refPrefix: 'FDS',
    refKey: 'number',
    fields: [
      { key: 'number', label: 'N° de fiche', half: true, required: true },
      { key: 'date', label: 'Date de révision', half: true },
      { key: 'version', label: 'Version', half: true, placeholder: '1.0' },
      { key: 'productName', label: 'Nom du produit', required: true },
      { key: 'productUse', label: 'Utilisation identifiée', placeholder: 'Nettoyant industriel' },
      { key: 'supplierName', label: 'Fournisseur / fabricant', required: true, hint: 'C\'est lui qui établit la FDS' },
      { key: 'supplierAddress', label: 'Adresse du fournisseur' },
      { key: 'emergencyPhone', label: 'Téléphone d\'urgence', half: true, placeholder: '+33 1 45 42 59 59 (ORFILA)' },
      { key: 'composition', label: '2 · Composants dangereux', type: 'multiline', hint: 'Nom ; n° CAS ; n° CE ; %' },
      { key: 'hazardClass', label: '3 · Classes de danger', type: 'multiline', placeholder: 'Liquide inflammable, cat. 2 (H225)' },
      { key: 'signalWord', label: 'Mention d\'avertissement', type: 'select', half: true, options: ['Danger', 'Attention', 'Sans objet'] },
      { key: 'hazardStatements', label: 'Mentions de danger (H)', half: true, placeholder: 'H225, H319' },
      { key: 'precautionary', label: 'Conseils de prudence (P)', half: true, placeholder: 'P210, P280' },
      { key: 'firstAid', label: '4 · Premiers secours', type: 'multiline' },
      { key: 'fireFighting', label: '5 · Lutte contre l\'incendie', type: 'multiline' },
      { key: 'accidentalRelease', label: '6 · Dispersion accidentelle', type: 'multiline' },
      { key: 'handlingStorage', label: '7 · Manipulation et stockage', type: 'multiline' },
      { key: 'exposureControl', label: '8 · Protection individuelle', type: 'multiline' },
      { key: 'physicalProps', label: '9 · Propriétés physico-chimiques', type: 'multiline' },
      { key: 'stability', label: '10 · Stabilité et réactivité', type: 'multiline' },
      { key: 'toxicology', label: '11 · Informations toxicologiques', type: 'multiline' },
      { key: 'ecology', label: '12 · Informations écologiques', type: 'multiline' },
      { key: 'disposal', label: '13 · Élimination', type: 'multiline' },
      { key: 'unNumber', label: '14 · N° ONU', half: true, required: true, placeholder: 'UN1993' },
      { key: 'properShippingName', label: 'Désignation officielle de transport', required: true, placeholder: 'LIQUIDE INFLAMMABLE, N.S.A.' },
      { key: 'transportClass', label: 'Classe de danger', half: true, placeholder: '3' },
      { key: 'packingGroup', label: 'Groupe d\'emballage', type: 'select', half: true, options: ['I', 'II', 'III', 'Sans objet'] },
      { key: 'marinePollutant', label: 'Polluant marin', type: 'boolean', half: true },
      { key: 'limitedQuantity', label: 'Quantité limitée (LQ)', type: 'boolean', half: true },
      { key: 'regulatory', label: '15 · Informations réglementaires', type: 'multiline' },
      { key: 'otherInfo', label: '16 · Autres informations', type: 'multiline' },
    ],
    defaults: (ctx) => ({
      number: ctx.reference,
      date: ctx.dateShort,
      version: '1.0',
      productName: '',
      productUse: '',
      supplierName: '',
      supplierAddress: '',
      emergencyPhone: '+33 1 45 42 59 59 (Centre antipoison ORFILA)',
      composition: '',
      hazardClass: '',
      signalWord: 'Danger',
      hazardStatements: '',
      precautionary: '',
      firstAid: '',
      fireFighting: '',
      accidentalRelease: '',
      handlingStorage: '',
      exposureControl: '',
      physicalProps: '',
      stability: '',
      toxicology: '',
      ecology: '',
      disposal: '',
      unNumber: '',
      properShippingName: '',
      transportClass: '',
      packingGroup: 'II',
      marinePollutant: false,
      limitedQuantity: false,
      regulatory: 'Règlement (CE) n° 1907/2006 (REACH) · Règlement (CE) n° 1272/2008 (CLP).',
      otherInfo: '',
    }),
  },
  {
    // Le COC est délivré par un organisme agréé (SGS, Intertek, Cotecna,
    // Bureau Veritas) après inspection avant embarquement. Axis prépare la
    // demande et enregistre le numéro de certificat une fois obtenu.
    id: 'conformityCertificate',
    label: 'Demande de certificat de conformité (COC)',
    description: 'Programme PVoC / VoC — inspection avant embarquement',
    icon: 'shield',
    activity: 'marchandise',
    issuer: 'authority',
    issuerNote: 'Le certificat est délivré par l\'organisme d\'inspection agréé après contrôle avant embarquement.',
    refPrefix: 'COC',
    refKey: 'number',
    fields: [
      { key: 'number', label: 'N° de demande', half: true, required: true },
      { key: 'date', label: 'Date', half: true },
      { key: 'destinationCountry', label: 'Pays de destination', type: 'select', half: true, required: true, options: ['Côte d\'Ivoire', 'Sénégal', 'Cameroun', 'Bénin', 'Togo', 'Nigeria', 'Algérie', 'Kenya', 'Tanzanie', 'Ouganda'] },
      { key: 'inspectionBody', label: 'Organisme d\'inspection', type: 'select', half: true, required: true, options: ['SGS', 'Intertek', 'Cotecna', 'Bureau Veritas', 'TÜV Rheinland'] },
      { key: 'cocNumber', label: 'N° de certificat obtenu', half: true, hint: 'À compléter après inspection' },
      { key: 'route', label: 'Filière', type: 'select', half: true, options: ['Route A — expédition ponctuelle', 'Route B — exportateur régulier', 'Route C — homologation produit'] },
      { key: 'exporterName', label: 'Exportateur', required: true },
      { key: 'exporterAddress', label: 'Adresse exportateur' },
      { key: 'importerName', label: 'Importateur', required: true },
      { key: 'importerAddress', label: 'Adresse importateur' },
      { key: 'importerTaxId', label: 'N° contribuable importateur', half: true },
      { key: 'invoiceRef', label: 'Facture commerciale', half: true },
      { key: 'goods', label: 'Désignation des produits', required: true },
      { key: 'hsCode', label: 'Code SH', half: true, placeholder: '8708.30' },
      { key: 'brand', label: 'Marque / modèle', half: true },
      { key: 'quantity', label: 'Quantité', half: true },
      { key: 'goodsValue', label: 'Valeur (devise)', type: 'number', half: true },
      { key: 'currency', label: 'Devise', half: true, placeholder: 'EUR' },
      { key: 'standards', label: 'Normes applicables', type: 'multiline', placeholder: 'CEI 60598-1, NF EN 60335-1' },
      { key: 'inspectionPlace', label: 'Lieu d\'inspection', half: true, placeholder: 'Entrepôt, 75015 Paris' },
      { key: 'inspectionDate', label: 'Date souhaitée', half: true },
      { key: 'contactName', label: 'Contact sur place', half: true },
      { key: 'contactPhone', label: 'Téléphone du contact', half: true },
      { key: 'notes', label: 'Observations', type: 'multiline' },
    ],
    defaults: (ctx) => ({
      number: ctx.reference,
      date: ctx.dateShort,
      destinationCountry: 'Côte d\'Ivoire',
      inspectionBody: 'SGS',
      cocNumber: '',
      route: 'Route A — expédition ponctuelle',
      exporterName: COMPANY.name,
      exporterAddress: companyAddress(),
      importerName: '',
      importerAddress: '',
      importerTaxId: '',
      invoiceRef: '',
      goods: '',
      hsCode: '',
      brand: '',
      quantity: '',
      goodsValue: '',
      currency: 'EUR',
      standards: '',
      inspectionPlace: companyAddress(),
      inspectionDate: '',
      contactName: '',
      contactPhone: '',
      notes: '',
    }),
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// LIASSES DOCUMENTAIRES — ce qu'il faut réellement fournir par type d'opération
// Roger ne pense pas « facture n° 42 » mais « mon envoi maritime vers Dakar ».
// Chaque liasse liste les documents exigés pour ce corridor, plus les
// démarches externes que l'app ne peut pas émettre (BSC, visa CCI…).
// ═══════════════════════════════════════════════════════════════════════════

export interface DocPackItem {
  typeId: AdminDocTypeId;
  required: boolean;
  note?: string;
}

export interface DocPackExternalStep {
  label: string;
  note: string;
  url?: string;
}

export interface DocPack {
  id: string;
  label: string;
  subtitle: string;
  activity: AdminActivity;
  items: DocPackItem[];
  externalSteps?: DocPackExternalStep[];
}

export const DOC_PACKS: DocPack[] = [
  {
    id: 'exportSeaAfrica',
    label: 'Export maritime — Afrique de l\'Ouest',
    subtitle: 'Conteneur / palettes vers Dakar, Abidjan…',
    activity: 'marchandise',
    items: [
      { typeId: 'commercialInvoice', required: true, note: 'Base du calcul des droits de douane' },
      { typeId: 'packingList', required: true },
      { typeId: 'certificateOfOrigin', required: true, note: 'À faire viser par la CCI' },
      { typeId: 'billOfLading', required: true, note: 'Émis par la compagnie maritime' },
      { typeId: 'exportDeclaration', required: true, note: 'Déclaration réelle via DELTA' },
      { typeId: 'customsMandate', required: true, note: 'Si Axis dédouane pour le client' },
      { typeId: 'besc', required: true, note: 'Dossier à déposer sur le portail avant l\'embarquement' },
      { typeId: 'conformityCertificate', required: false, note: 'Si le produit relève du programme PVoC' },
      { typeId: 'safetyDataSheet', required: false, note: 'Obligatoire si la marchandise est classée dangereuse' },
      { typeId: 'insurance', required: false },
      { typeId: 'shippingInstructions', required: false },
    ],
    externalSteps: [
      {
        label: 'Validation du BESC sur le portail officiel',
        note: 'Le bordereau est délivré par le COSEC (Sénégal) ou l\'OIC (Côte d\'Ivoire) : l\'app prépare le dossier, la validation se fait sur leur portail AVANT le départ du navire. Passé 10 jours après l\'appareillage, il ne peut plus être validé — marchandise bloquée au port, surestaries et amende douanière.',
        url: 'https://cosec.besc-senegal.net',
      },
      {
        label: 'Inspection avant embarquement (COC)',
        note: 'Pour les produits réglementés, le certificat de conformité est délivré par un organisme agréé (SGS, Intertek, Cotecna, Bureau Veritas) après inspection en France. Il est valable 3 mois. Sans lui, la marchandise est refusée au dédouanement.',
      },
    ],
  },
  {
    id: 'exportAirAfrica',
    label: 'Export aérien — Afrique',
    subtitle: 'Colis et marchandises par avion',
    activity: 'marchandise',
    items: [
      { typeId: 'commercialInvoice', required: true },
      { typeId: 'packingList', required: true },
      { typeId: 'airWaybill', required: true, note: 'Émise par la compagnie / l\'agent IATA' },
      { typeId: 'certificateOfOrigin', required: false },
      { typeId: 'exportDeclaration', required: true },
      { typeId: 'customsMandate', required: false },
      { typeId: 'safetyDataSheet', required: false, note: 'Obligatoire si la marchandise est classée dangereuse (IATA-DGR)' },
      { typeId: 'conformityCertificate', required: false, note: 'Si le produit relève du programme PVoC' },
      { typeId: 'insurance', required: false },
    ],
  },
  {
    id: 'convoyEurope',
    label: 'Convoyage véhicule — Europe',
    subtitle: 'Mission de convoyage France / Europe',
    activity: 'convoyage',
    items: [
      { typeId: 'contract', required: true, note: 'Contrat + état des lieux départ/arrivée' },
      { typeId: 'invoice', required: true },
      { typeId: 'insurance', required: false },
      { typeId: 'deliveryNote', required: false, note: 'Preuve de remise du véhicule' },
    ],
  },
  {
    id: 'parcelDiaspora',
    label: 'Colis diaspora',
    subtitle: 'Envoi de colis France → Afrique',
    activity: 'colis',
    items: [
      { typeId: 'shippingLabel', required: true },
      { typeId: 'invoice', required: true },
      { typeId: 'deliveryNote', required: false },
      { typeId: 'commercialInvoice', required: false, note: 'Si contenu commercial' },
    ],
  },
];

export function docPackById(id: string): DocPack | undefined {
  return DOC_PACKS.find((p) => p.id === id);
}

export function adminDocTypeById(id: AdminDocTypeId | string): AdminDocType | undefined {
  return ADMIN_DOC_TYPES.find((t) => t.id === id);
}

/** Valeurs par défaut d'un type (référence auto-incrémentée incluse). */
export async function buildDefaults(type: AdminDocType): Promise<AdminValues> {
  const now = new Date();
  const ctx: DefaultsContext = {
    reference: await peekReference(type.id),
    dateLong: now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
    dateShort: now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    year: now.getFullYear(),
  };
  return type.defaults(ctx);
}

// ─── Étiquette colis (générée localement — pdf.ts est gelé) ─────────────────

export interface ShippingLabelData {
  reference: string;
  originCity?: string;
  destinationCity?: string;
  destinationCountry?: string;
  recipientName?: string;
  recipientPhone?: string;
  weightKg?: number;
  transportMode?: string;
}

function labelDownload(doc: jsPDF, filename: string) {
  if (typeof window === 'undefined') return;
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function generateShippingLabelPdf(data: ShippingLabelData): Promise<void> {
  // A6 portrait (105 × 148 mm) : format standard d'étiquette d'expédition.
  const doc = patchDoc(new jsPDF({ unit: 'mm', format: 'a6' }));
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 6;

  // Cadre général
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.8);
  doc.rect(M, M, W - 2 * M, H - 2 * M);

  // Bandeau haut
  doc.setFillColor(0, 0, 0);
  doc.rect(M, M, W - 2 * M, 12, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('AXIS IMPORT', M + 3, M + 7.5);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text((data.transportMode ?? 'COLIS').toUpperCase(), W - M - 3, M + 7.5, { align: 'right' });

  // Référence
  let y = M + 20;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('RÉFÉRENCE', M + 3, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(data.reference, M + 3, y);

  // Trajet
  y += 9;
  doc.setLineWidth(0.3);
  doc.line(M, y - 4, W - M, y - 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('TRAJET', M + 3, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const dest = [data.destinationCity, data.destinationCountry].filter(Boolean).join(', ');
  doc.text(`${data.originCity || '—'} → ${dest || '—'}`, M + 3, y, { maxWidth: W - 2 * M - 6 });

  // Destinataire + poids
  y += 9;
  doc.line(M, y - 4, W - M, y - 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('DESTINATAIRE', M + 3, y);
  doc.text('POIDS', W - M - 3, y, { align: 'right' });
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(data.recipientName || '—', M + 3, y, { maxWidth: W - 2 * M - 26 });
  doc.text(data.weightKg ? `${data.weightKg.toLocaleString('fr-FR')} kg` : '—', W - M - 3, y, { align: 'right' });
  if (data.recipientPhone) {
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(data.recipientPhone, M + 3, y);
  }

  // QR de suivi
  const qrSize = 34;
  const qrY = H - M - qrSize - 10;
  doc.setLineWidth(0.3);
  doc.line(M, qrY - 4, W - M, qrY - 4);
  const trackUrl = `${orTodo(COMPANY.website)}/t/${encodeURIComponent(data.reference)}`;
  try {
    const qr = await QRCode.toDataURL(trackUrl, { width: 300, margin: 0, color: { dark: '#000000', light: '#FFFFFFFF' } });
    doc.addImage(qr, 'PNG', M + 3, qrY, qrSize, qrSize);
  } catch {
    doc.rect(M + 3, qrY, qrSize, qrSize);
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('SUIVI EN LIGNE', M + qrSize + 7, qrY + 5);
  doc.setFont('helvetica', 'bold');
  // 7 pt : l'URL de suivi tient sur une seule ligne, la référence n'est pas coupée.
  doc.setFontSize(7);
  doc.text(doc.splitTextToSize(trackUrl, W - M - (M + qrSize + 7) - 3), M + qrSize + 7, qrY + 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('Scanner pour suivre le colis', M + qrSize + 7, qrY + 24);

  // Pied
  doc.setFontSize(6.5);
  doc.text(`${COMPANY.name} · ${orTodo(COMPANY.email)} · ${orTodo(COMPANY.phone)}`, W / 2, H - M - 3, { align: 'center' });

  labelDownload(doc, `Etiquette-${data.reference}.pdf`);
}

// ─── Helpers A4 partagés (en-tête avec logo Axis, pied, cases) ──────────────

const A4_M = 16; // marge

/** En-tête officiel avec logo Axis. Renvoie le Y de départ du contenu. */
function axisLetterhead(doc: jsPDF, title: string, subtitle?: string): number {
  const W = doc.internal.pageSize.getWidth();
  const M = A4_M;
  try {
    doc.addImage(AXIS_LOGO_PDF, 'PNG', M, 9, 13, 13, undefined, 'FAST');
  } catch { /* logo indisponible → on continue sans */ }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(0, 0, 0);
  doc.text('AXIS IMPORT', M + 17, 15.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.3);
  doc.setTextColor(107, 107, 107);
  doc.text('CONVOYAGE · IMPORT-EXPORT EUROPE \u2013 AFRIQUE', M + 17, 20);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  doc.text(title.toUpperCase(), W - M, 15, { align: 'right' });
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(107, 107, 107);
    doc.text(subtitle, W - M, 20, { align: 'right' });
  }
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.8);
  doc.line(M, 25, W - M, 25);
  return 33;
}

function axisFooter(doc: jsPDF) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = A4_M;
  doc.setDrawColor(204, 204, 204);
  doc.setLineWidth(0.3);
  doc.line(M, H - 18, W - M, H - 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(107, 107, 107);
  doc.text(companyLegalLine(), M, H - 13);
  doc.text(companyContactLine(), M, H - 9);
}

/** Case bordée numérotée (style formulaire officiel type CMR). */
function formBox(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  num: string | null, label: string, value?: string,
) {
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(x, y, w, h);
  let tx = x + 2;
  if (num) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(0, 0, 0);
    doc.text(num, x + 1.5, y + 4);
    tx = x + 6;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.3);
  doc.setTextColor(90, 90, 90);
  doc.text(label.toUpperCase(), tx, y + 4, { maxWidth: w - (tx - x) - 2 });
  if (value) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    // Valeur calée sous le libellé et bornée à la hauteur de la case pour
    // éviter tout débordement sur la case suivante.
    const maxLines = Math.max(1, Math.floor((h - 6) / 3.4));
    const lines = (doc.splitTextToSize(value, w - 4) as string[]).slice(0, maxLines);
    doc.text(lines, x + 2, y + 8);
  }
}

// ─── Lettre d'instructions au transitaire (générée localement) ──────────────

export interface ShippingInstructionsData {
  number: string;
  date?: string;
  forwarder?: string;
  invoiceRef?: string;
  sender?: { name?: string; address?: string; contact?: string };
  recipient?: { name?: string; address?: string; contact?: string };
  pickupLocation?: string;
  deliveryLocation?: string;
  incoterm?: string;
  goodsNature?: string;
  packages?: string;
  grossWeightKg?: number;
  volumeM3?: number;
  docInvoice?: boolean;
  docPackingList?: boolean;
  customsByAxis?: boolean;
  insuranceByAxis?: boolean;
  signatory?: string;
}

export async function generateShippingInstructionsPdf(data: ShippingInstructionsData): Promise<void> {
  const doc = patchDoc(new jsPDF({ unit: 'mm', format: 'a4' }));
  const W = doc.internal.pageSize.getWidth();
  const M = A4_M;
  const DASH = '—';
  const COL = M + 60; // colonne des valeurs des sections numérotées

  let y = axisLetterhead(doc, 'Instructions d\'expédition', `N° ${data.number}`) + 4;

  // ── À l'attention de / Date ──
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('À l\'attention de :', M, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.forwarder || DASH, M + 32, y);
  doc.setFont('helvetica', 'bold');
  doc.text('Date :', W - M - 42, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.date || DASH, W - M - 30, y);
  y += 10;

  // ── Objet ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('OBJET : Instructions d\'expédition pour l\'exportation', M, y);
  y += 6;
  if (data.invoiceRef) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(107, 107, 107);
    doc.text(`Réf. facture commerciale liée : ${data.invoiceRef}`, M, y);
    y += 5;
  }
  y += 3;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(58, 58, 58);
  doc.text(
    'Madame, Monsieur, veuillez trouver ci-dessous nos instructions pour l\'acheminement du lot suivant :',
    M, y, { maxWidth: W - 2 * M },
  );
  y += 10;

  // ── Sections numérotées 1 à 7 ──
  const joinParts = (...p: (string | undefined)[]) => p.filter(Boolean).join(' — ') || DASH;
  const row = (n: number, label: string, value: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text(`${n}. ${label}`, M, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(58, 58, 58);
    const lines = doc.splitTextToSize(value, W - COL - M) as string[];
    doc.text(lines, COL, y);
    y += Math.max(6, lines.length * 4.6) + 1.5;
  };

  const logistics = [
    data.packages,
    data.grossWeightKg != null ? `Poids brut ${data.grossWeightKg.toLocaleString('fr-FR')} kg` : undefined,
    data.volumeM3 != null ? `Volume ${data.volumeM3.toLocaleString('fr-FR')} m³` : undefined,
  ].filter(Boolean).join(' · ') || DASH;

  row(1, 'EXPÉDITEUR', joinParts(data.sender?.name, data.sender?.address, data.sender?.contact));
  row(2, 'DESTINATAIRE', joinParts(data.recipient?.name, data.recipient?.address, data.recipient?.contact));
  row(3, 'LIEU D\'ENLÈVEMENT', data.pickupLocation || DASH);
  row(4, 'LIEU DE LIVRAISON', data.deliveryLocation || DASH);
  row(5, 'INCOTERM', data.incoterm || DASH);
  row(6, 'MARCHANDISE', data.goodsNature || DASH);
  row(7, 'LOGISTIQUE', logistics);

  // ── Cases à cocher (8, 9, 10) ──
  const checkbox = (x: number, yy: number, checked: boolean) => {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.rect(x, yy - 3, 3.4, 3.4);
    if (checked) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      doc.text('X', x + 0.75, yy - 0.35);
    }
  };
  const checkText = (x: number, label: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(58, 58, 58);
    doc.text(label, x, y);
  };
  const sectionTitle = (text: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text(text, M, y);
    y += 6;
  };

  y += 2;
  sectionTitle('8. DOCUMENTS JOINTS');
  checkbox(M + 4, y, !!data.docInvoice); checkText(M + 10, 'Facture commerciale');
  checkbox(M + 78, y, !!data.docPackingList); checkText(M + 84, 'Liste de colisage (packing list)');
  y += 8;

  sectionTitle('9. FORMALITÉS DOUANIÈRES');
  checkbox(M + 4, y, !!data.customsByAxis); checkText(M + 10, 'Dédouanement export effectué par Axis pour votre compte');
  y += 6;
  checkbox(M + 4, y, !data.customsByAxis); checkText(M + 10, 'Dédouanement géré par le client');
  y += 8;

  sectionTitle('10. ASSURANCE TRANSPORT');
  checkbox(M + 4, y, !!data.insuranceByAxis); checkText(M + 10, 'Oui — merci de couvrir la marchandise');
  y += 6;
  checkbox(M + 4, y, !data.insuranceByAxis); checkText(M + 10, 'Non — assurance souscrite par nos soins');
  y += 12;

  // ── Clôture + signature ──
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(58, 58, 58);
  doc.text('Nous restons à votre disposition pour tout complément. Cordialement,', M, y, { maxWidth: W - 2 * M });
  y += 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(data.signatory || data.sender?.name || COMPANY.name, M, y);
  doc.setDrawColor(204, 204, 204);
  doc.setLineWidth(0.3);
  doc.line(M, y + 9, M + 62, y + 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(107, 107, 107);
  doc.text('Signature & cachet de l\'entreprise', M, y + 13);

  axisFooter(doc);
  labelDownload(doc, `Instructions-transitaire-${data.number}.pdf`);
}

// ─── Lettre de voiture CMR (transport international par route) ──────────────

export interface CmrData {
  number: string;
  date?: string;
  sender?: { name?: string; address?: string };
  recipient?: { name?: string; address?: string };
  deliveryPlace?: string;
  takingOverPlace?: string;
  takingOverDate?: string;
  carrier?: { name?: string; address?: string };
  plate?: string;
  documentsAttached?: string;
  marks?: string;
  packages?: string;
  packaging?: string;
  goods?: string;
  hsCode?: string;
  grossWeightKg?: number;
  volumeM3?: number;
  senderInstructions?: string;
  franking?: string;
  cashOnDelivery?: string;        // case 15 — remboursement
  carrierReservations?: string;   // case 18 — réserves et observations du transporteur
  specialAgreements?: string;
  toPay?: string;
  establishedAt?: string;
}

export async function generateCmrPdf(data: CmrData): Promise<void> {
  const doc = patchDoc(new jsPDF({ unit: 'mm', format: 'a4' }));
  const W = doc.internal.pageSize.getWidth();
  const M = A4_M;
  const CW = W - 2 * M;
  const half = CW / 2;
  const g = (v?: string) => v || '';
  let y = axisLetterhead(doc, 'Lettre de voiture', `CMR N° ${data.number}`) + 1;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.3);
  doc.setTextColor(107, 107, 107);
  doc.text('Transport international de marchandises par route — Convention CMR (Genève, 19 mai 1956, art. 6)', M, y);
  y += 4;

  const sender = [g(data.sender?.name), g(data.sender?.address)].filter(Boolean).join('\n');
  const recip = [g(data.recipient?.name), g(data.recipient?.address)].filter(Boolean).join('\n');
  const carrier = [g(data.carrier?.name), g(data.carrier?.address)].filter(Boolean).join('\n');

  formBox(doc, M, y, half, 20, '1', 'Expéditeur (nom, adresse, pays)', sender);
  formBox(doc, M + half, y, half, 20, '16', 'Transporteur (nom, adresse, pays)', carrier);
  y += 20;
  formBox(doc, M, y, half, 20, '2', 'Destinataire (nom, adresse, pays)', recip);
  formBox(doc, M + half, y, half, 20, '17', 'Transporteurs successifs', '');
  y += 20;
  formBox(doc, M, y, half, 13, '3', 'Lieu prévu pour la livraison', g(data.deliveryPlace));
  formBox(doc, M + half, y, half, 13, null, 'Immatriculation véhicule', g(data.plate));
  y += 13;
  formBox(doc, M, y, half, 13, '4', 'Lieu et date de prise en charge', [g(data.takingOverPlace), g(data.takingOverDate)].filter(Boolean).join(' — '));
  formBox(doc, M + half, y, half, 13, '5', 'Documents annexés', g(data.documentsAttached));
  y += 13;

  // Tableau marchandises (cases 6 à 12)
  const cols = [
    { n: '6', l: 'Marques & n°', w: 28 },
    { n: '7', l: 'Nb colis', w: 15 },
    { n: '8', l: 'Emballage', w: 23 },
    { n: '9', l: 'Nature de la marchandise', w: 52 },
    { n: '10', l: 'N° stat. (SH)', w: 18 },
    { n: '11', l: 'Poids brut kg', w: 22 },
    { n: '12', l: 'Cubage m³', w: CW - 28 - 15 - 23 - 52 - 18 - 22 },
  ];
  const rowH = 22;
  let cx = M;
  cols.forEach((c) => { formBox(doc, cx, y, c.w, rowH, c.n, c.l, ''); cx += c.w; });
  const vals = [
    g(data.marks), g(data.packages), g(data.packaging), g(data.goods), g(data.hsCode),
    data.grossWeightKg != null ? String(data.grossWeightKg) : '',
    data.volumeM3 != null ? String(data.volumeM3) : '',
  ];
  cx = M;
  cols.forEach((c, i) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    doc.setTextColor(0, 0, 0);
    doc.text(doc.splitTextToSize(vals[i], c.w - 3) as string[], cx + 1.5, y + 10);
    cx += c.w;
  });
  y += rowH;

  formBox(doc, M, y, half, 15, '13', 'Instructions de l\'expéditeur (douane, etc.)', g(data.senderInstructions));
  formBox(doc, M + half, y, half, 15, '14', 'Prescriptions d\'affranchissement', g(data.franking));
  y += 15;
  // Case 15 (remboursement) et case 18 (réserves du transporteur) — la 18 est
  // celle qui fait foi en cas de litige sur l'état de la marchandise.
  const t3 = CW / 3;
  formBox(doc, M, y, t3, 16, '15', 'Remboursement', g(data.cashOnDelivery));
  formBox(doc, M + t3, y, CW - t3, 16, '18', 'Réserves et observations du transporteur', g(data.carrierReservations));
  y += 16;

  formBox(doc, M, y, half, 15, '19', 'Conventions particulières', g(data.specialAgreements));
  formBox(doc, M + half, y, half, 15, '20', 'À payer (prix de transport)', g(data.toPay));
  y += 15;
  formBox(doc, M, y, CW, 12, '21', 'Établi à / le', [g(data.establishedAt), g(data.date)].filter(Boolean).join(', le '));
  y += 12;

  const third = CW / 3;
  formBox(doc, M, y, third, 22, '22', 'Signature & timbre de l\'expéditeur', '');
  formBox(doc, M + third, y, third, 22, '23', 'Signature & timbre du transporteur', '');
  formBox(doc, M + 2 * third, y, third, 22, '24', 'Marchandises reçues (destinataire, date)', '');

  axisFooter(doc);
  labelDownload(doc, `CMR-${data.number}.pdf`);
}

// ─── Certificat d'origine (modèle communautaire UE) ─────────────────────────

export interface CertificateOfOriginData {
  number: string;
  date?: string;
  exporter?: { name?: string; address?: string };
  consignee?: { name?: string; address?: string };
  originCountry?: string;
  transportInfo?: string;
  remarks?: string;
  packages?: string;
  goods?: string;
  quantity?: string;
  signatoryPlace?: string;
  signatory?: string;
}

// « Émis à Le Havre » est fautif : l'article se contracte. Ce helper produit
// « au Havre », « aux Sables-d'Olonne », et « à Paris » dans tous les autres cas.
function atPlace(place: string): string {
  const p = place.trim();
  if (!p) return 'à ...';
  if (/^le\s+/i.test(p)) return `au ${p.slice(3).trim()}`;
  if (/^les\s+/i.test(p)) return `aux ${p.slice(4).trim()}`;
  return `à ${p}`;
}

export async function generateCertificateOfOriginPdf(data: CertificateOfOriginData): Promise<void> {
  const doc = patchDoc(new jsPDF({ unit: 'mm', format: 'a4' }));
  const W = doc.internal.pageSize.getWidth();
  const M = A4_M;
  const CW = W - 2 * M;
  const half = CW / 2;
  const g = (v?: string) => v || '';
  let y = axisLetterhead(doc, 'Certificat d\'origine', `N° ${data.number}`) + 1;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.3);
  doc.setTextColor(107, 107, 107);
  doc.text('Certificat d\'origine des marchandises — modèle communautaire (Union européenne)', M, y);
  y += 4;

  formBox(doc, M, y, half, 22, '1', 'Expéditeur / Exportateur', [g(data.exporter?.name), g(data.exporter?.address)].filter(Boolean).join('\n'));
  formBox(doc, M + half, y, half, 22, '2', 'Destinataire', [g(data.consignee?.name), g(data.consignee?.address)].filter(Boolean).join('\n'));
  y += 22;
  formBox(doc, M, y, half, 14, '3', 'Pays d\'origine', g(data.originCountry));
  formBox(doc, M + half, y, half, 14, '4', 'Renseignements relatifs au transport', g(data.transportInfo));
  y += 14;
  formBox(doc, M, y, CW, 12, '5', 'Observations', g(data.remarks));
  y += 12;
  formBox(doc, M, y, CW, 42, '6', 'Marques, numéros, nombre et nature des colis — désignation des marchandises', [g(data.packages), g(data.goods)].filter(Boolean).join('\n'));
  y += 42;
  formBox(doc, M, y, CW, 12, '7', 'Quantité', g(data.quantity));
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(doc.splitTextToSize('Le soussigné certifie que les marchandises désignées ci-dessus sont originaires du pays indiqué en case 3.', CW) as string[], M, y);
  y += 12;
  doc.text(`Fait ${atPlace(g(data.signatoryPlace))}, le ${g(data.date) || '...'}`, M, y);
  doc.setFont('helvetica', 'bold');
  doc.text(g(data.signatory) || COMPANY.name, W - M, y, { align: 'right' });
  doc.setDrawColor(204, 204, 204);
  doc.setLineWidth(0.3);
  doc.line(W - M - 62, y + 9, W - M, y + 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(107, 107, 107);
  doc.text('Signature & cachet de l\'entreprise', W - M - 62, y + 13);

  // Cadre réservé au visa : sans lui, le certificat n'a aucune valeur.
  y += 22;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(M, y, CW / 2 - 3, 26);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(90, 90, 90);
  doc.text('VISA DE LA CHAMBRE DE COMMERCE ET D\'INDUSTRIE', M + 2.5, y + 5);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  doc.text('Cachet et signature', M + 2.5, y + 23);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(107, 107, 107);
  doc.text(
    doc.splitTextToSize(
      'Ce certificat n\'est opposable qu\'après visa de la chambre de commerce et d\'industrie compétente. Non visé, il ne vaut pas preuve de l\'origine des marchandises.',
      CW / 2 - 6,
    ) as string[],
    M + CW / 2 + 3, y + 5,
  );

  axisFooter(doc);
  labelDownload(doc, `Certificat-origine-${data.number}.pdf`);
}

// ─── Demande de BESC / BSC (bordereau de suivi des cargaisons) ──────────────
// Le bordereau lui-même est délivré par le COSEC (Sénégal) ou l'OIC (Côte
// d'Ivoire) sur leur portail. Ce document rassemble, sur une page, toutes les
// données que le portail réclame : Roger le remet à son agent ou s'en sert
// pour saisir la demande sans rien oublier.

export interface BescData {
  number: string;
  date?: string;
  destinationCountry?: string;
  bescNumber?: string;
  shipper?: { name?: string; address?: string };
  consignee?: { name?: string; address?: string; taxId?: string };
  forwarder?: string;
  carrier?: string;
  blNumber?: string;
  blDate?: string;
  vessel?: string;
  voyageNo?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  sailingDate?: string;
  containerNo?: string;
  goods?: string;
  hsCode?: string;
  packages?: string;
  grossWeight?: string;
  volume?: string;
  incoterm?: string;
  currency?: string;
  goodsValue?: string;
  freightValue?: string;
  invoiceRef?: string;
}

export async function generateBescPdf(data: BescData): Promise<void> {
  const doc = patchDoc(new jsPDF({ unit: 'mm', format: 'a4' }));
  const W = doc.internal.pageSize.getWidth();
  const M = A4_M;
  const CW = W - 2 * M;
  const half = CW / 2;
  const third = CW / 3;
  const g = (v?: string) => v || '';
  let y = axisLetterhead(doc, 'Demande de BESC', `Dossier ${data.number}`) + 1;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.3);
  doc.setTextColor(107, 107, 107);
  doc.text(
    'Bordereau électronique de suivi des cargaisons — dossier de demande à déposer sur le portail officiel',
    M, y,
  );
  y += 5;

  formBox(doc, M, y, half, 12, null, 'Pays de destination', g(data.destinationCountry));
  formBox(doc, M + half, y, half, 12, null, 'N° BESC obtenu', g(data.bescNumber) || '—  (à compléter après validation)');
  y += 12;

  formBox(doc, M, y, half, 20, '1', 'Chargeur / Exportateur', [g(data.shipper?.name), g(data.shipper?.address)].filter(Boolean).join('\n'));
  formBox(doc, M + half, y, half, 20, '2', 'Destinataire / Importateur', [g(data.consignee?.name), g(data.consignee?.address)].filter(Boolean).join('\n'));
  y += 20;

  formBox(doc, M, y, half, 11, '3', 'N° contribuable du destinataire', g(data.consignee?.taxId));
  formBox(doc, M + half, y, half, 11, '4', 'Transitaire', g(data.forwarder));
  y += 11;

  formBox(doc, M, y, half, 11, '5', 'Compagnie maritime', g(data.carrier));
  formBox(doc, M + half, y, half / 2, 11, '6', 'N° B/L', g(data.blNumber));
  formBox(doc, M + half + half / 2, y, half / 2, 11, null, 'Date du B/L', g(data.blDate));
  y += 11;

  formBox(doc, M, y, third, 11, '7', 'Navire', g(data.vessel));
  formBox(doc, M + third, y, third / 2, 11, null, 'Voyage', g(data.voyageNo));
  formBox(doc, M + third + third / 2, y, third + third / 2, 11, '8', 'Départ du navire', g(data.sailingDate));
  y += 11;

  formBox(doc, M, y, half, 11, '9', 'Port de chargement', g(data.portOfLoading));
  formBox(doc, M + half, y, half, 11, '10', 'Port de déchargement', g(data.portOfDischarge));
  y += 11;

  formBox(doc, M, y, CW, 11, '11', 'Conteneur / n° de plomb', g(data.containerNo));
  y += 11;

  formBox(doc, M, y, CW, 22, '12', 'Désignation des marchandises', g(data.goods));
  y += 22;

  const q = CW / 4;
  formBox(doc, M, y, q, 11, '13', 'Code SH', g(data.hsCode));
  formBox(doc, M + q, y, q, 11, '14', 'Colis', g(data.packages));
  formBox(doc, M + 2 * q, y, q, 11, '15', 'Poids brut kg', g(data.grossWeight));
  formBox(doc, M + 3 * q, y, q, 11, '16', 'Cubage m³', g(data.volume));
  y += 11;

  const cur = g(data.currency) || 'EUR';
  formBox(doc, M, y, q, 11, '17', 'Incoterm', g(data.incoterm));
  formBox(doc, M + q, y, q, 11, '18', `Valeur marchandise ${cur}`, g(data.goodsValue));
  formBox(doc, M + 2 * q, y, q, 11, '19', `Fret ${cur}`, g(data.freightValue));
  formBox(doc, M + 3 * q, y, q, 11, '20', 'Facture liée', g(data.invoiceRef));
  y += 17;

  // Rappel des délais : c'est ce qui bloque la marchandise au port.
  doc.setDrawColor(193, 138, 45);
  doc.setFillColor(252, 246, 234);
  doc.setLineWidth(0.4);
  doc.rect(M, y, CW, 30, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(140, 94, 15);
  doc.text('DÉLAIS À RESPECTER', M + 3, y + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(60, 60, 60);
  const rappel = [
    'La demande doit être validée AVANT le départ du navire. Un dossier pré-validé non complété sous 5 jours ouvrables est annulé.',
    'Passé 10 jours après le départ du navire, le bordereau ne peut plus être validé : la marchandise est alors bloquée au port,',
    'avec surestaries, frais de stockage et amende douanière jusqu\'à présentation d\'un bordereau valide.',
    'Pièces à joindre au portail : connaissement, facture commerciale, liste de colisage et facture de fret.',
  ];
  rappel.forEach((line, i) => doc.text(line, M + 3, y + 11 + i * 4.2, { maxWidth: CW - 6 }));
  y += 36;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(107, 107, 107);
  doc.text(
    doc.splitTextToSize(
      'Document interne Axis Import : il ne remplace pas le bordereau officiel, délivré par l\'organisme chargeur du pays de destination.',
      CW,
    ) as string[],
    M, y,
  );

  axisFooter(doc);
  labelDownload(doc, `Demande-BESC-${data.number}.pdf`);
}

// ─── Fiche de données de sécurité (FDS) ─────────────────────────────────────
// Format imposé par l'annexe II du règlement REACH (CE 1907/2006), révisée
// par le règlement (UE) 2020/878 : 16 rubriques, dans cet ordre exact.
// La FDS est établie par le fabricant ou le fournisseur du produit ; Axis la
// reprend pour la transmettre au transporteur et aux autorités. La rubrique 14
// est la partie critique pour le transport.

export interface SafetyDataSheetData {
  number: string;
  date?: string;
  version?: string;
  productName?: string;
  productUse?: string;
  supplierName?: string;
  supplierAddress?: string;
  emergencyPhone?: string;
  composition?: string;
  hazardClass?: string;
  signalWord?: string;
  hazardStatements?: string;
  precautionary?: string;
  firstAid?: string;
  fireFighting?: string;
  accidentalRelease?: string;
  handlingStorage?: string;
  exposureControl?: string;
  physicalProps?: string;
  stability?: string;
  toxicology?: string;
  ecology?: string;
  disposal?: string;
  unNumber?: string;
  properShippingName?: string;
  transportClass?: string;
  packingGroup?: string;
  marinePollutant?: boolean;
  limitedQuantity?: boolean;
  regulatory?: string;
  otherInfo?: string;
}

export async function generateSafetyDataSheetPdf(data: SafetyDataSheetData): Promise<void> {
  const doc = patchDoc(new jsPDF({ unit: 'mm', format: 'a4' }));
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = A4_M;
  const CW = W - 2 * M;
  const g = (v?: string) => (v && v.trim() ? v.trim() : 'Non renseigné par le fournisseur.');
  let y = axisLetterhead(doc, 'Fiche de données de sécurité', `${data.number}${data.version ? ` · version ${data.version}` : ''}`) + 1;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.3);
  doc.setTextColor(107, 107, 107);
  doc.text(
    'Conforme au règlement (CE) n° 1907/2006 (REACH), annexe II modifiée par le règlement (UE) 2020/878',
    M, y,
  );
  y += 6;

  // Une rubrique = un titre en bandeau + son contenu, avec saut de page
  // automatique pour que jamais un titre ne se retrouve seul en bas de page.
  // Pas de ligne fixe : jsPDF espace ses lignes selon la police, pas selon la
  // valeur qu'on lui suppose. En dessinant ligne à ligne on maîtrise l'écart
  // exact — sinon le décalage s'accumule et les rubriques respirent de façon
  // inégale selon leur longueur.
  const LINE = 3.6;      // interligne du corps de texte
  const GAP = 5;         // respiration avant la rubrique suivante
  const BAND = 5.6;      // hauteur du bandeau de titre
  const TEXT_X = M + 2.5; // aligné sur le libellé du bandeau

  const section = (num: number, title: string, body: string) => {
    const lines = doc.splitTextToSize(body, CW - 5) as string[];
    const needed = BAND + 2.4 + lines.length * LINE + GAP;
    if (y + needed > H - 24) {
      axisFooter(doc);
      doc.addPage();
      // Bandeau de continuation : une FDS circule page par page, chacune doit
      // porter l'identification du produit.
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(0, 0, 0);
      doc.text('AXIS IMPORT', M, 14);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(107, 107, 107);
      doc.text(
        `Fiche de données de sécurité ${data.number}${data.productName ? ` — ${data.productName}` : ''} (suite)`,
        W - M, 14, { align: 'right' },
      );
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(M, 17, W - M, 17);
      y = 24;
    }
    doc.setFillColor(11, 37, 69);
    doc.rect(M, y, CW, BAND, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(245, 241, 232);
    doc.text(`RUBRIQUE ${num} — ${title.toUpperCase()}`, TEXT_X, y + 3.9);
    y += BAND + 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.3);
    doc.setTextColor(0, 0, 0);
    lines.forEach((line, i) => doc.text(line, TEXT_X, y + i * LINE));
    y += lines.length * LINE + GAP;
  };

  section(1, 'Identification du produit et du fournisseur', [
    `Nom du produit : ${g(data.productName)}`,
    `Utilisation identifiée : ${g(data.productUse)}`,
    `Fournisseur : ${g(data.supplierName)}`,
    data.supplierAddress ? `Adresse : ${data.supplierAddress}` : '',
    `Téléphone d'urgence : ${g(data.emergencyPhone)}`,
    `Expéditeur du lot : ${COMPANY.name}, ${companyAddress()}.`,
  ].filter(Boolean).join('\n'));

  section(2, 'Composition / informations sur les composants', g(data.composition));

  section(3, 'Identification des dangers', [
    `Classes et catégories de danger : ${g(data.hazardClass)}`,
    data.signalWord ? `Mention d'avertissement : ${data.signalWord}` : '',
    data.hazardStatements ? `Mentions de danger : ${data.hazardStatements}` : '',
    data.precautionary ? `Conseils de prudence : ${data.precautionary}` : '',
  ].filter(Boolean).join('\n'));

  section(4, 'Premiers secours', g(data.firstAid));
  section(5, 'Mesures de lutte contre l\'incendie', g(data.fireFighting));
  section(6, 'Mesures en cas de dispersion accidentelle', g(data.accidentalRelease));
  section(7, 'Manipulation et stockage', g(data.handlingStorage));
  section(8, 'Contrôle de l\'exposition / protection individuelle', g(data.exposureControl));
  section(9, 'Propriétés physiques et chimiques', g(data.physicalProps));
  section(10, 'Stabilité et réactivité', g(data.stability));
  section(11, 'Informations toxicologiques', g(data.toxicology));
  section(12, 'Informations écologiques', g(data.ecology));
  section(13, 'Considérations relatives à l\'élimination', g(data.disposal));

  // Rubrique 14 : c'est celle que lisent le transporteur et la douane.
  const mentions: string[] = [];
  if (data.marinePollutant) mentions.push('Polluant marin (IMDG)');
  if (data.limitedQuantity) mentions.push('Quantité limitée (LQ)');
  section(14, 'Informations relatives au transport', [
    `N° ONU : ${g(data.unNumber)}`,
    `Désignation officielle de transport : ${g(data.properShippingName)}`,
    `Classe de danger pour le transport : ${g(data.transportClass)}`,
    `Groupe d'emballage : ${g(data.packingGroup)}`,
    mentions.length > 0 ? `Mentions particulières : ${mentions.join(' · ')}` : 'Mentions particulières : néant',
    'Réglementations applicables : ADR (route), IMDG (maritime), IATA-DGR (aérien).',
  ].join('\n'));

  section(15, 'Informations réglementaires', g(data.regulatory));
  section(16, 'Autres informations', [
    g(data.otherInfo),
    '',
    `Fiche établie le ${data.date || '...'}${data.version ? ` — version ${data.version}` : ''}.`,
    'Les informations de cette fiche proviennent du fabricant ou du fournisseur du produit. Axis Import',
    'les reproduit pour les besoins du transport et n\'en garantit ni l\'exhaustivité ni la mise à jour.',
  ].join('\n'));

  axisFooter(doc);

  // Numérotation « Page x/y » sur toutes les pages, une fois leur nombre connu.
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(107, 107, 107);
    doc.text(`Page ${i}/${pages}`, W - M, H - 9, { align: 'right' });
  }

  labelDownload(doc, `FDS-${data.number}.pdf`);
}

// ─── Demande de certificat de conformité (COC / PVoC) ───────────────────────
// Le certificat est délivré par un organisme agréé (SGS, Intertek, Cotecna,
// Bureau Veritas) après inspection avant embarquement. Axis ne peut pas
// l'émettre : ce document est la demande d'inspection, et il enregistre le
// numéro de certificat une fois celui-ci obtenu.

export interface ConformityCertificateData {
  number: string;
  date?: string;
  destinationCountry?: string;
  inspectionBody?: string;
  cocNumber?: string;
  route?: string;
  exporter?: { name?: string; address?: string };
  importer?: { name?: string; address?: string; taxId?: string };
  invoiceRef?: string;
  goods?: string;
  hsCode?: string;
  brand?: string;
  quantity?: string;
  goodsValue?: string;
  currency?: string;
  standards?: string;
  inspectionPlace?: string;
  inspectionDate?: string;
  contactName?: string;
  contactPhone?: string;
  notes?: string;
}

export async function generateConformityCertificatePdf(data: ConformityCertificateData): Promise<void> {
  const doc = patchDoc(new jsPDF({ unit: 'mm', format: 'a4' }));
  const W = doc.internal.pageSize.getWidth();
  const M = A4_M;
  const CW = W - 2 * M;
  const half = CW / 2;
  const g = (v?: string) => v || '';
  let y = axisLetterhead(doc, 'Demande de COC', `Dossier ${data.number}`) + 1;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.3);
  doc.setTextColor(107, 107, 107);
  doc.text(
    'Demande d\'inspection avant embarquement — programme de vérification de conformité aux normes (PVoC / VoC)',
    M, y,
  );
  y += 5;

  formBox(doc, M, y, half, 12, null, 'Pays de destination', g(data.destinationCountry));
  formBox(doc, M + half, y, half, 12, null, 'Organisme d\'inspection', g(data.inspectionBody));
  y += 12;

  formBox(doc, M, y, half, 12, null, 'Filière retenue', g(data.route));
  formBox(doc, M + half, y, half, 12, null, 'N° de certificat obtenu', g(data.cocNumber) || '—  (à compléter après inspection)');
  y += 12;

  formBox(doc, M, y, half, 20, '1', 'Exportateur', [g(data.exporter?.name), g(data.exporter?.address)].filter(Boolean).join('\n'));
  formBox(doc, M + half, y, half, 20, '2', 'Importateur', [g(data.importer?.name), g(data.importer?.address)].filter(Boolean).join('\n'));
  y += 20;

  formBox(doc, M, y, half, 11, '3', 'N° contribuable de l\'importateur', g(data.importer?.taxId));
  formBox(doc, M + half, y, half, 11, '4', 'Facture commerciale', g(data.invoiceRef));
  y += 11;

  formBox(doc, M, y, CW, 20, '5', 'Désignation des produits à inspecter', g(data.goods));
  y += 20;

  const q = CW / 4;
  const cur = g(data.currency) || 'EUR';
  formBox(doc, M, y, q, 11, '6', 'Code SH', g(data.hsCode));
  formBox(doc, M + q, y, q, 11, '7', 'Marque / modèle', g(data.brand));
  formBox(doc, M + 2 * q, y, q, 11, '8', 'Quantité', g(data.quantity));
  formBox(doc, M + 3 * q, y, q, 11, '9', `Valeur ${cur}`, g(data.goodsValue));
  y += 11;

  formBox(doc, M, y, CW, 20, '10', 'Normes et règlements techniques applicables', g(data.standards));
  y += 20;

  formBox(doc, M, y, half, 11, '11', 'Lieu d\'inspection', g(data.inspectionPlace));
  formBox(doc, M + half, y, half, 11, '12', 'Date souhaitée', g(data.inspectionDate));
  y += 11;

  formBox(doc, M, y, half, 11, '13', 'Contact sur place', g(data.contactName));
  formBox(doc, M + half, y, half, 11, null, 'Téléphone', g(data.contactPhone));
  y += 11;

  if (data.notes) {
    formBox(doc, M, y, CW, 14, '14', 'Observations', data.notes);
    y += 14;
  }
  y += 6;

  // Ce que Roger risque s'il embarque sans certificat.
  doc.setDrawColor(193, 138, 45);
  doc.setFillColor(252, 246, 234);
  doc.setLineWidth(0.4);
  doc.rect(M, y, CW, 26, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(140, 94, 15);
  doc.text('À SAVOIR', M + 3, y + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(60, 60, 60);
  [
    'L\'inspection doit avoir lieu AVANT l\'embarquement : un certificat obtenu à destination n\'est pas accepté.',
    'Sans certificat, la marchandise est refusée au dédouanement ou taxée d\'une pénalité, et peut être réexpédiée.',
    'Le certificat est valable 3 mois à compter de sa date d\'émission — vérifier qu\'il couvre la date d\'arrivée.',
  ].forEach((line, i) => doc.text(line, M + 3, y + 11 + i * 4.4, { maxWidth: CW - 6 }));
  y += 32;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text(`Fait ${atPlace('Paris')}, le ${g(data.date) || '...'}`, M, y);
  doc.setFont('helvetica', 'bold');
  doc.text(g(data.exporter?.name) || COMPANY.name, W - M, y, { align: 'right' });
  doc.setDrawColor(204, 204, 204);
  doc.setLineWidth(0.3);
  doc.line(W - M - 62, y + 9, W - M, y + 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(107, 107, 107);
  doc.text('Signature & cachet de l\'exportateur', W - M - 62, y + 13);

  doc.setFontSize(7.5);
  doc.text(
    doc.splitTextToSize(
      'Ce document est une demande d\'inspection : il ne constitue pas le certificat de conformité, seul délivré par l\'organisme agréé après contrôle.',
      CW,
    ) as string[],
    M, y + 24,
  );

  axisFooter(doc);
  labelDownload(doc, `Demande-COC-${data.number}.pdf`);
}

// ─── Bon de livraison / Justificatif de livraison (POD) ─────────────────────

export interface DeliveryNoteData {
  number: string;
  date?: string;
  orderRef?: string;
  sender?: { name?: string; address?: string };
  recipient?: { name?: string; address?: string };
  deliveryAddress?: string;
  itemsText?: string;
  carrier?: string;
  driverName?: string;
  deliveryDate?: string;
  deliveryTime?: string;
  reserves?: string;
}

export async function generateDeliveryNotePdf(data: DeliveryNoteData): Promise<void> {
  const doc = patchDoc(new jsPDF({ unit: 'mm', format: 'a4' }));
  const W = doc.internal.pageSize.getWidth();
  const M = A4_M;
  const CW = W - 2 * M;
  const half = CW / 2;
  let y = axisLetterhead(doc, 'Bon de livraison', `N° ${data.number}`) + 4;

  formBox(doc, M, y, half, 20, null, 'Expéditeur', [data.sender?.name, data.sender?.address].filter(Boolean).join('\n') || '—');
  formBox(doc, M + half, y, half, 20, null, 'Destinataire', [data.recipient?.name, data.recipient?.address].filter(Boolean).join('\n') || '—');
  y += 20;
  formBox(doc, M, y, half, 12, null, 'Adresse de livraison', data.deliveryAddress || '—');
  formBox(doc, M + half, y, half, 12, null, 'Commande / référence liée', data.orderRef || '—');
  y += 16;

  // Tableau articles
  const tableTop = y;
  const qtyX = W - M - 28;
  doc.setFillColor(240, 240, 240);
  doc.rect(M, y, CW, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text('DÉSIGNATION', M + 2, y + 4.7);
  doc.text('QUANTITÉ', W - M - 2, y + 4.7, { align: 'right' });
  y += 7;
  const items = (data.itemsText || '').split('\n').map((l) => l.trim()).filter(Boolean);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  if (items.length === 0) {
    doc.setTextColor(150, 150, 150);
    doc.text('—', M + 2, y + 5);
    y += 8;
    doc.setTextColor(0, 0, 0);
  }
  items.forEach((line) => {
    const parts = line.split(';').map((s) => s.trim());
    doc.text(doc.splitTextToSize(parts[0] || '', qtyX - M - 4) as string[], M + 2, y + 5);
    doc.text(parts[1] || '', W - M - 2, y + 5, { align: 'right' });
    y += 8;
    doc.setDrawColor(224, 224, 224);
    doc.setLineWidth(0.2);
    doc.line(M, y, W - M, y);
  });
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(M, tableTop, CW, y - tableTop);
  doc.line(qtyX, tableTop, qtyX, y);
  y += 6;

  formBox(doc, M, y, CW, 12, null, 'Réserves à la livraison', data.reserves || 'Aucune — marchandise reçue en bon état.');
  y += 16;

  formBox(doc, M, y, half - 3, 26, null, `Livré par${data.driverName ? ' · ' + data.driverName : ''}`, [data.carrier, data.deliveryDate, data.deliveryTime].filter(Boolean).join(' · '));
  formBox(doc, M + half + 3, y, half - 3, 26, null, 'Reçu par le destinataire (nom, date, signature)', '');
  y += 26;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(107, 107, 107);
  doc.text('La signature du destinataire vaut justificatif de livraison (Proof of Delivery — POD).', M, y + 5);

  axisFooter(doc);
  labelDownload(doc, `Bon-livraison-${data.number}.pdf`);
}

// ─── Connaissement maritime (Bill of Lading) ───────────────────────────────

export interface BillOfLadingData {
  number: string;
  date?: string;
  placeOfIssue?: string;
  shipper?: { name?: string; address?: string };
  consignee?: { name?: string; address?: string };
  notifyParty?: string;
  carrier?: string;
  vessel?: string;
  voyageNo?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  placeOfReceipt?: string;
  placeOfDelivery?: string;
  containerNo?: string;
  marks?: string;
  packages?: string;
  goods?: string;
  grossWeightKg?: number;
  measurementM3?: number;
  freightTerms?: string;
  numberOfOriginals?: string;
  shippedOnBoardDate?: string;
}

export async function generateBillOfLadingPdf(data: BillOfLadingData): Promise<void> {
  const doc = patchDoc(new jsPDF({ unit: 'mm', format: 'a4' }));
  const W = doc.internal.pageSize.getWidth();
  const M = A4_M;
  const CW = W - 2 * M;
  const half = CW / 2;
  const g = (v?: string) => v || '';
  let y = axisLetterhead(doc, 'Connaissement', `B/L N° ${data.number}`) + 1;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.3);
  doc.setTextColor(107, 107, 107);
  doc.text('Connaissement maritime — Bill of Lading (titre de transport et de propriété de la marchandise)', M, y);
  y += 4;

  formBox(doc, M, y, half, 20, null, 'Chargeur / Shipper', [g(data.shipper?.name), g(data.shipper?.address)].filter(Boolean).join('\n'));
  formBox(doc, M + half, y, half, 20, null, 'Transporteur maritime / Carrier', g(data.carrier));
  y += 20;
  formBox(doc, M, y, half, 18, null, 'Destinataire / Consignee', [g(data.consignee?.name), g(data.consignee?.address)].filter(Boolean).join('\n'));
  formBox(doc, M + half, y, half, 18, null, 'Partie à notifier / Notify party', g(data.notifyParty));
  y += 18;
  formBox(doc, M, y, half, 12, null, 'Navire / Vessel · Voyage', [g(data.vessel), data.voyageNo ? 'Voy. ' + data.voyageNo : ''].filter(Boolean).join(' · '));
  formBox(doc, M + half, y, half, 12, null, 'Lieu de réception / livraison', [g(data.placeOfReceipt), g(data.placeOfDelivery)].filter(Boolean).join(' → '));
  y += 12;
  formBox(doc, M, y, half, 12, null, 'Port de chargement / Port of loading', g(data.portOfLoading));
  formBox(doc, M + half, y, half, 12, null, 'Port de déchargement / Port of discharge', g(data.portOfDischarge));
  y += 12;
  formBox(doc, M, y, CW, 12, null, 'Conteneur / N° de plomb', g(data.containerNo));
  y += 12;

  const cols = [
    { l: 'Marques & n°', w: 32 },
    { l: 'Nombre et nature des colis', w: 46 },
    { l: 'Description des marchandises', w: CW - 32 - 46 - 26 - 24 },
    { l: 'Poids brut kg', w: 26 },
    { l: 'Cubage m³', w: 24 },
  ];
  const rowH = 26;
  let cx = M;
  cols.forEach((c) => { formBox(doc, cx, y, c.w, rowH, null, c.l, ''); cx += c.w; });
  const vals = [g(data.marks), g(data.packages), g(data.goods), data.grossWeightKg != null ? String(data.grossWeightKg) : '', data.measurementM3 != null ? String(data.measurementM3) : ''];
  cx = M;
  cols.forEach((c, i) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(7.6); doc.setTextColor(0, 0, 0); doc.text(doc.splitTextToSize(vals[i], c.w - 3) as string[], cx + 1.5, y + 11); cx += c.w; });
  y += rowH;

  formBox(doc, M, y, half, 12, null, 'Fret & frais / Freight', g(data.freightTerms));
  formBox(doc, M + half, y, half, 12, null, 'Nombre d\'originaux / No. of originals', g(data.numberOfOriginals));
  y += 12;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(`SHIPPED ON BOARD / Embarqué : ${g(data.shippedOnBoardDate) || g(data.date) || '...'}`, M, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Émis ${atPlace(g(data.placeOfIssue))}, le ${g(data.date) || '...'}`, M, y + 12);
  doc.setDrawColor(204, 204, 204);
  doc.setLineWidth(0.3);
  doc.line(W - M - 62, y + 15, W - M, y + 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(107, 107, 107);
  doc.text('Signature & cachet du transporteur', W - M - 62, y + 19);

  axisFooter(doc);
  labelDownload(doc, `Connaissement-BL-${data.number}.pdf`);
}

// ─── Lettre de transport aérien (LTA / Air Waybill, IATA) ───────────────────

export interface AirWaybillData {
  number: string;
  date?: string;
  shipper?: { name?: string; address?: string };
  consignee?: { name?: string; address?: string };
  issuingAgent?: string;
  airportDeparture?: string;
  airportDestination?: string;
  routing?: string;
  flightDate?: string;
  currency?: string;
  declaredValueCarriage?: string;
  declaredValueCustoms?: string;
  handlingInfo?: string;
  pieces?: string;
  grossWeightKg?: number;
  chargeableWeightKg?: number;
  goods?: string;
  volumeM3?: number;
  chargesTerms?: string;
  executedPlace?: string;
}

export async function generateAirWaybillPdf(data: AirWaybillData): Promise<void> {
  const doc = patchDoc(new jsPDF({ unit: 'mm', format: 'a4' }));
  const W = doc.internal.pageSize.getWidth();
  const M = A4_M;
  const CW = W - 2 * M;
  const half = CW / 2;
  const g = (v?: string) => v || '';
  let y = axisLetterhead(doc, 'Lettre de transport aérien', `LTA / AWB N° ${data.number}`) + 1;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.3);
  doc.setTextColor(107, 107, 107);
  doc.text('Air Waybill (AWB) — contrat de transport aérien, format normalisé IATA', M, y);
  y += 4;

  formBox(doc, M, y, half, 20, null, 'Expéditeur / Shipper', [g(data.shipper?.name), g(data.shipper?.address)].filter(Boolean).join('\n'));
  formBox(doc, M + half, y, half, 20, null, 'Agent émetteur / Issuing carrier\'s agent', g(data.issuingAgent));
  y += 20;
  formBox(doc, M, y, CW, 16, null, 'Destinataire / Consignee', [g(data.consignee?.name), g(data.consignee?.address)].filter(Boolean).join('\n'));
  y += 16;
  formBox(doc, M, y, half, 12, null, 'Aéroport de départ / of departure', g(data.airportDeparture));
  formBox(doc, M + half, y, half, 12, null, 'Aéroport de destination', g(data.airportDestination));
  y += 12;
  formBox(doc, M, y, half, 12, null, 'Acheminement / Vol · date', [g(data.routing), g(data.flightDate)].filter(Boolean).join(' · '));
  formBox(doc, M + half, y, half, 12, null, 'Devise & valeurs déclarées (transport / douane)', [data.currency ? 'Devise ' + data.currency : '', data.declaredValueCarriage ? 'Transp. ' + data.declaredValueCarriage : '', data.declaredValueCustoms ? 'Douane ' + data.declaredValueCustoms : ''].filter(Boolean).join(' · '));
  y += 12;
  formBox(doc, M, y, CW, 12, null, 'Informations de manutention / Handling information', g(data.handlingInfo));
  y += 12;

  const cols = [
    { l: 'Nb colis', w: 22 },
    { l: 'Poids brut kg', w: 26 },
    { l: 'Poids taxable kg', w: 28 },
    { l: 'Cubage m³', w: 22 },
    { l: 'Nature et quantité des marchandises', w: CW - 22 - 26 - 28 - 22 },
  ];
  const rowH = 24;
  let cx = M;
  cols.forEach((c) => { formBox(doc, cx, y, c.w, rowH, null, c.l, ''); cx += c.w; });
  const vals = [g(data.pieces), data.grossWeightKg != null ? String(data.grossWeightKg) : '', data.chargeableWeightKg != null ? String(data.chargeableWeightKg) : '', data.volumeM3 != null ? String(data.volumeM3) : '', g(data.goods)];
  cx = M;
  cols.forEach((c, i) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(7.6); doc.setTextColor(0, 0, 0); doc.text(doc.splitTextToSize(vals[i], c.w - 3) as string[], cx + 1.5, y + 11); cx += c.w; });
  y += rowH;

  formBox(doc, M, y, CW, 12, null, 'Frais / Charges', g(data.chargesTerms));
  y += 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(`Émis ${atPlace(g(data.executedPlace))}, le ${g(data.date) || '...'}`, M, y + 7);
  doc.setDrawColor(204, 204, 204);
  doc.setLineWidth(0.3);
  doc.line(M, y + 17, M + 60, y + 17);
  doc.line(W - M - 62, y + 17, W - M, y + 17);
  doc.setFontSize(7.5);
  doc.setTextColor(107, 107, 107);
  doc.text('Signature de l\'expéditeur', M, y + 21);
  doc.text('Signature du transporteur / agent émetteur', W - M - 62, y + 21);

  axisFooter(doc);
  labelDownload(doc, `LTA-AWB-${data.number}.pdf`);
}

// ─── Routage type de document → générateur PDF ──────────────────────────────

function parsePackages(text: string) {
  // "contenu ; 120×80×100 ; 320 ; 295" — une ligne par colis, champs optionnels.
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(';').map((p) => p.trim());
      const g = parseFloat((parts[2] ?? '').replace(',', '.'));
      const n = parseFloat((parts[3] ?? '').replace(',', '.'));
      return {
        contents: parts[0] || undefined,
        dimensions: parts[1] || undefined,
        grossKg: Number.isFinite(g) ? g : undefined,
        netKg: Number.isFinite(n) ? n : undefined,
      };
    });
}

/**
 * Génère le PDF correspondant au type + valeurs saisies.
 * Renvoie la référence effectivement utilisée (pour l'historique).
 */
export async function generateAdminDocument(type: AdminDocType, values: AdminValues): Promise<string> {
  const reference = str(values, type.refKey) || `${type.refPrefix || 'DOC'}-${Date.now()}`;

  switch (type.id) {
    case 'invoice':
      await generateInvoicePdf({
        number: reference,
        date: str(values, 'date') || new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
        amountEur: num(values, 'amountEur', 0),
        paid: bool(values, 'paid'),
        description: str(values, 'description') || 'Prestation de transport',
        clientName: str(values, 'clientName') || 'Client Axis',
        clientAddress: orU(str(values, 'clientAddress')),
        clientEmail: orU(str(values, 'clientEmail')),
        clientSiren: orU(str(values, 'clientSiren')),
        serviceDate: orU(str(values, 'serviceDate')),
        dueDate: orU(str(values, 'dueDate')),
        operationCategory: orU(str(values, 'operationCategory')),
      });
      break;

    case 'commercialInvoice':
      await generateCommercialInvoicePdf({
        number: reference,
        date: orU(str(values, 'date')),
        incoterm: orU(str(values, 'incoterm')),
        currency: orU(str(values, 'currency')),
        originCountry: orU(str(values, 'originCountry')),
        destinationCountry: orU(str(values, 'destinationCountry')),
        sender: {
          name: orU(str(values, 'senderName')),
          address: orU(str(values, 'senderAddress')),
        },
        recipient: {
          name: orU(str(values, 'recipientName')),
          address: orU(str(values, 'recipientAddress')),
          country: orU(str(values, 'destinationCountry')),
        },
        lines: [{
          designation: str(values, 'designation') || 'Marchandises diverses',
          hsCode: orU(str(values, 'hsCode')),
          quantity: num(values, 'quantity', 1),
          unitPrice: num(values, 'unitPrice', 0),
        }],
        notes: orU(str(values, 'notes')),
      });
      break;

    case 'packingList':
      await generatePackingListPdf({
        number: reference,
        date: orU(str(values, 'date')),
        sender: {
          name: orU(str(values, 'senderName')),
          address: orU(str(values, 'senderAddress')),
        },
        recipient: {
          name: orU(str(values, 'recipientName')),
          address: orU(str(values, 'recipientAddress')),
        },
        packages: parsePackages(str(values, 'packagesText')),
      });
      break;

    case 'contract':
      await generateContractPdf({
        reference,
        copyLabel: 'EXEMPLAIRE\nAXIS',
        vehicleCategory: orU(str(values, 'vehicleCategory')),
        clientName: str(values, 'clientName') || 'Client Axis',
        driverName: orU(str(values, 'driverName')),
        driverPhone: orU(str(values, 'driverPhone')),
        vehicleBrandModel: orU(str(values, 'vehicleBrandModel')),
        plate: orU(str(values, 'plate')),
        pickupAddress: orU(str(values, 'pickupAddress')),
        deliveryAddress: orU(str(values, 'deliveryAddress')),
        pickupDate: orU(str(values, 'pickupDate')),
        pickupTime: orU(str(values, 'pickupTime')),
        deliveryDate: orU(str(values, 'deliveryDate')),
        deliveryTime: orU(str(values, 'deliveryTime')),
        estimatedKm: numU(values, 'estimatedKm'),
        estimatedDuration: orU(str(values, 'estimatedDuration')),
        priceEur: numU(values, 'priceEur'),
        // Signature déjà apposée par le client depuis son espace : elle est
        // reprise telle quelle sur l'exemplaire d'Axis. Ces clés ne sont pas
        // des champs du formulaire, elles viennent de l'envoi sélectionné.
        departureClientSignature: signatureFromSvgDataUrl(str(values, 'clientSignatureDataUrl')),
        departureClientSigned: !!str(values, 'clientSignatureDataUrl'),
        departureClientSignedDate: orU(str(values, 'clientSignedDate')),
        // Preuve émise par le serveur : QR de vérification et empreinte des
        // termes du dossier. Absente si le client n'a pas encore signé.
        proof:
          str(values, 'proofHash') && str(values, 'proofSignedAt') && str(values, 'proofUrl')
            ? {
                hash: str(values, 'proofHash'),
                signedAt: str(values, 'proofSignedAt'),
                verifyUrl: str(values, 'proofUrl'),
              }
            : undefined,
      });
      break;

    case 'insurance':
      await generateInsuranceCertificatePdf({
        number: reference,
        date: orU(str(values, 'date')),
        insurer: orU(str(values, 'insurer')),
        policyNumber: orU(str(values, 'policyNumber')),
        insured: orU(str(values, 'insured')),
        goods: orU(str(values, 'goods')),
        coverageAmount: numU(values, 'coverageAmount'),
        route: orU(str(values, 'route')),
        validFrom: orU(str(values, 'validFrom')),
        validTo: orU(str(values, 'validTo')),
      });
      break;

    case 'exportDeclaration':
      await generateExportDeclarationPdf({
        number: reference,
        date: orU(str(values, 'date')),
        exporter: {
          name: orU(str(values, 'exporterName')),
          address: orU(str(values, 'exporterAddress')),
          eori: orU(str(values, 'eori')),
        },
        recipient: {
          name: orU(str(values, 'recipientName')),
          address: orU(str(values, 'recipientAddress')),
          country: orU(str(values, 'destinationCountry')),
        },
        regime: orU(str(values, 'regime')),
        customsOffice: orU(str(values, 'customsOffice')),
        goods: orU(str(values, 'goods')),
        hsCode: orU(str(values, 'hsCode')),
        value: numU(values, 'value'),
        destinationCountry: orU(str(values, 'destinationCountry')),
      });
      break;

    case 'customsMandate':
      await generateCustomsMandatePdf({
        number: reference,
        date: orU(str(values, 'date')),
        principal: {
          name: orU(str(values, 'principalName')),
          address: orU(str(values, 'principalAddress')),
        },
        principalEori: orU(str(values, 'principalEori')),
        agent: orU(str(values, 'agent')),
        agentRegistration: orU(str(values, 'agentRegistration')),
        representation: str(values, 'representation') === 'indirecte' ? 'indirecte' : 'directe',
        scope: orU(str(values, 'scope')),
        destinationCountry: orU(str(values, 'destinationCountry')),
      });
      break;

    case 'shippingInstructions':
      await generateShippingInstructionsPdf({
        number: reference,
        date: orU(str(values, 'date')),
        forwarder: orU(str(values, 'forwarder')),
        invoiceRef: orU(str(values, 'invoiceRef')),
        sender: {
          name: orU(str(values, 'senderName')),
          address: orU(str(values, 'senderAddress')),
          contact: orU(str(values, 'senderContact')),
        },
        recipient: {
          name: orU(str(values, 'recipientName')),
          address: orU(str(values, 'recipientAddress')),
          contact: orU(str(values, 'recipientContact')),
        },
        pickupLocation: orU(str(values, 'pickupLocation')),
        deliveryLocation: orU(str(values, 'deliveryLocation')),
        incoterm: orU(str(values, 'incoterm')),
        goodsNature: orU(str(values, 'goodsNature')),
        packages: orU(str(values, 'packages')),
        grossWeightKg: numU(values, 'grossWeight'),
        volumeM3: numU(values, 'volume'),
        docInvoice: bool(values, 'docInvoice'),
        docPackingList: bool(values, 'docPackingList'),
        customsByAxis: bool(values, 'customsByAxis'),
        insuranceByAxis: bool(values, 'insuranceByAxis'),
        signatory: orU(str(values, 'signatory')),
      });
      break;

    case 'cmr':
      await generateCmrPdf({
        number: reference,
        date: orU(str(values, 'date')),
        sender: { name: orU(str(values, 'senderName')), address: orU(str(values, 'senderAddress')) },
        recipient: { name: orU(str(values, 'recipientName')), address: orU(str(values, 'recipientAddress')) },
        deliveryPlace: orU(str(values, 'deliveryPlace')),
        takingOverPlace: orU(str(values, 'takingOverPlace')),
        takingOverDate: orU(str(values, 'takingOverDate')),
        carrier: { name: orU(str(values, 'carrierName')) },
        plate: orU(str(values, 'plate')),
        documentsAttached: orU(str(values, 'documentsAttached')),
        marks: orU(str(values, 'marks')),
        packages: orU(str(values, 'packages')),
        packaging: orU(str(values, 'packaging')),
        goods: orU(str(values, 'goods')),
        hsCode: orU(str(values, 'hsCode')),
        grossWeightKg: numU(values, 'grossWeight'),
        volumeM3: numU(values, 'volume'),
        senderInstructions: orU(str(values, 'senderInstructions')),
        franking: orU(str(values, 'franking')),
        cashOnDelivery: orU(str(values, 'cashOnDelivery')),
        carrierReservations: orU(str(values, 'carrierReservations')),
        specialAgreements: orU(str(values, 'specialAgreements')),
        toPay: orU(str(values, 'toPay')),
        establishedAt: orU(str(values, 'establishedAt')),
      });
      break;

    case 'billOfLading':
      await generateBillOfLadingPdf({
        number: reference,
        date: orU(str(values, 'date')),
        placeOfIssue: orU(str(values, 'portOfLoading')),
        shipper: { name: orU(str(values, 'shipperName')), address: orU(str(values, 'shipperAddress')) },
        consignee: { name: orU(str(values, 'consigneeName')), address: orU(str(values, 'consigneeAddress')) },
        notifyParty: orU(str(values, 'notifyParty')),
        carrier: orU(str(values, 'carrier')),
        vessel: orU(str(values, 'vessel')),
        voyageNo: orU(str(values, 'voyageNo')),
        portOfLoading: orU(str(values, 'portOfLoading')),
        portOfDischarge: orU(str(values, 'portOfDischarge')),
        placeOfReceipt: orU(str(values, 'placeOfReceipt')),
        placeOfDelivery: orU(str(values, 'placeOfDelivery')),
        containerNo: orU(str(values, 'containerNo')),
        marks: orU(str(values, 'marks')),
        packages: orU(str(values, 'packages')),
        goods: orU(str(values, 'goods')),
        grossWeightKg: numU(values, 'grossWeight'),
        measurementM3: numU(values, 'measurement'),
        freightTerms: orU(str(values, 'freightTerms')),
        numberOfOriginals: orU(str(values, 'numberOfOriginals')),
        shippedOnBoardDate: orU(str(values, 'shippedOnBoardDate')),
      });
      break;

    case 'airWaybill':
      await generateAirWaybillPdf({
        number: reference,
        date: orU(str(values, 'date')),
        shipper: { name: orU(str(values, 'shipperName')), address: orU(str(values, 'shipperAddress')) },
        consignee: { name: orU(str(values, 'consigneeName')), address: orU(str(values, 'consigneeAddress')) },
        issuingAgent: orU(str(values, 'issuingAgent')),
        airportDeparture: orU(str(values, 'airportDeparture')),
        airportDestination: orU(str(values, 'airportDestination')),
        routing: orU(str(values, 'routing')),
        flightDate: orU(str(values, 'flightDate')),
        currency: orU(str(values, 'currency')),
        declaredValueCarriage: orU(str(values, 'declaredValueCarriage')),
        declaredValueCustoms: orU(str(values, 'declaredValueCustoms')),
        handlingInfo: orU(str(values, 'handlingInfo')),
        pieces: orU(str(values, 'pieces')),
        grossWeightKg: numU(values, 'grossWeight'),
        chargeableWeightKg: numU(values, 'chargeableWeight'),
        goods: orU(str(values, 'goods')),
        volumeM3: numU(values, 'volume'),
        chargesTerms: orU(str(values, 'chargesTerms')),
        executedPlace: orU(str(values, 'executedPlace')),
      });
      break;

    case 'certificateOfOrigin':
      await generateCertificateOfOriginPdf({
        number: reference,
        date: orU(str(values, 'date')),
        exporter: { name: orU(str(values, 'exporterName')), address: orU(str(values, 'exporterAddress')) },
        consignee: { name: orU(str(values, 'consigneeName')), address: orU(str(values, 'consigneeAddress')) },
        originCountry: orU(str(values, 'originCountry')),
        transportInfo: orU(str(values, 'transportInfo')),
        remarks: orU(str(values, 'remarks')),
        packages: orU(str(values, 'packages')),
        goods: orU(str(values, 'goods')),
        quantity: orU(str(values, 'quantity')),
        signatoryPlace: orU(str(values, 'signatoryPlace')),
        signatory: orU(str(values, 'signatory')),
      });
      break;

    case 'deliveryNote':
      await generateDeliveryNotePdf({
        number: reference,
        date: orU(str(values, 'date')),
        orderRef: orU(str(values, 'orderRef')),
        sender: { name: orU(str(values, 'senderName')), address: orU(str(values, 'senderAddress')) },
        recipient: { name: orU(str(values, 'recipientName')), address: orU(str(values, 'recipientAddress')) },
        deliveryAddress: orU(str(values, 'deliveryAddress')),
        itemsText: orU(str(values, 'itemsText')),
        carrier: orU(str(values, 'carrier')),
        driverName: orU(str(values, 'driverName')),
        deliveryDate: orU(str(values, 'deliveryDate')),
        deliveryTime: orU(str(values, 'deliveryTime')),
        reserves: orU(str(values, 'reserves')),
      });
      break;

    case 'shippingLabel':
      await generateShippingLabelPdf({
        reference,
        originCity: orU(str(values, 'originCity')),
        destinationCity: orU(str(values, 'destinationCity')),
        destinationCountry: orU(str(values, 'destinationCountry')),
        recipientName: orU(str(values, 'recipientName')),
        recipientPhone: orU(str(values, 'recipientPhone')),
        weightKg: numU(values, 'weightKg'),
        transportMode: orU(str(values, 'transportMode')),
      });
      break;
    case 'besc':
      await generateBescPdf({
        number: reference,
        date: orU(str(values, 'date')),
        destinationCountry: orU(str(values, 'destinationCountry')),
        bescNumber: orU(str(values, 'bescNumber')),
        shipper: { name: orU(str(values, 'shipperName')), address: orU(str(values, 'shipperAddress')) },
        consignee: {
          name: orU(str(values, 'consigneeName')),
          address: orU(str(values, 'consigneeAddress')),
          taxId: orU(str(values, 'consigneeTaxId')),
        },
        forwarder: orU(str(values, 'forwarder')),
        carrier: orU(str(values, 'carrier')),
        blNumber: orU(str(values, 'blNumber')),
        blDate: orU(str(values, 'blDate')),
        vessel: orU(str(values, 'vessel')),
        voyageNo: orU(str(values, 'voyageNo')),
        portOfLoading: orU(str(values, 'portOfLoading')),
        portOfDischarge: orU(str(values, 'portOfDischarge')),
        sailingDate: orU(str(values, 'sailingDate')),
        containerNo: orU(str(values, 'containerNo')),
        goods: orU(str(values, 'goods')),
        hsCode: orU(str(values, 'hsCode')),
        packages: orU(str(values, 'packages')),
        grossWeight: orU(str(values, 'grossWeight')),
        volume: orU(str(values, 'volume')),
        incoterm: orU(str(values, 'incoterm')),
        currency: orU(str(values, 'currency')),
        goodsValue: orU(str(values, 'goodsValue')),
        freightValue: orU(str(values, 'freightValue')),
        invoiceRef: orU(str(values, 'invoiceRef')),
      });
      break;
    case 'safetyDataSheet':
      await generateSafetyDataSheetPdf({
        number: reference,
        date: orU(str(values, 'date')),
        version: orU(str(values, 'version')),
        productName: orU(str(values, 'productName')),
        productUse: orU(str(values, 'productUse')),
        supplierName: orU(str(values, 'supplierName')),
        supplierAddress: orU(str(values, 'supplierAddress')),
        emergencyPhone: orU(str(values, 'emergencyPhone')),
        composition: orU(str(values, 'composition')),
        hazardClass: orU(str(values, 'hazardClass')),
        signalWord: orU(str(values, 'signalWord')),
        hazardStatements: orU(str(values, 'hazardStatements')),
        precautionary: orU(str(values, 'precautionary')),
        firstAid: orU(str(values, 'firstAid')),
        fireFighting: orU(str(values, 'fireFighting')),
        accidentalRelease: orU(str(values, 'accidentalRelease')),
        handlingStorage: orU(str(values, 'handlingStorage')),
        exposureControl: orU(str(values, 'exposureControl')),
        physicalProps: orU(str(values, 'physicalProps')),
        stability: orU(str(values, 'stability')),
        toxicology: orU(str(values, 'toxicology')),
        ecology: orU(str(values, 'ecology')),
        disposal: orU(str(values, 'disposal')),
        unNumber: orU(str(values, 'unNumber')),
        properShippingName: orU(str(values, 'properShippingName')),
        transportClass: orU(str(values, 'transportClass')),
        packingGroup: orU(str(values, 'packingGroup')),
        marinePollutant: bool(values, 'marinePollutant'),
        limitedQuantity: bool(values, 'limitedQuantity'),
        regulatory: orU(str(values, 'regulatory')),
        otherInfo: orU(str(values, 'otherInfo')),
      });
      break;
    case 'conformityCertificate':
      await generateConformityCertificatePdf({
        number: reference,
        date: orU(str(values, 'date')),
        destinationCountry: orU(str(values, 'destinationCountry')),
        inspectionBody: orU(str(values, 'inspectionBody')),
        cocNumber: orU(str(values, 'cocNumber')),
        route: orU(str(values, 'route')),
        exporter: { name: orU(str(values, 'exporterName')), address: orU(str(values, 'exporterAddress')) },
        importer: {
          name: orU(str(values, 'importerName')),
          address: orU(str(values, 'importerAddress')),
          taxId: orU(str(values, 'importerTaxId')),
        },
        invoiceRef: orU(str(values, 'invoiceRef')),
        goods: orU(str(values, 'goods')),
        hsCode: orU(str(values, 'hsCode')),
        brand: orU(str(values, 'brand')),
        quantity: orU(str(values, 'quantity')),
        goodsValue: orU(str(values, 'goodsValue')),
        currency: orU(str(values, 'currency')),
        standards: orU(str(values, 'standards')),
        inspectionPlace: orU(str(values, 'inspectionPlace')),
        inspectionDate: orU(str(values, 'inspectionDate')),
        contactName: orU(str(values, 'contactName')),
        contactPhone: orU(str(values, 'contactPhone')),
        notes: orU(str(values, 'notes')),
      });
      break;
  }

  return reference;
}
