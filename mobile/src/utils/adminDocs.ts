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
} from './pdf';

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
  | 'shippingLabel';

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

export interface AdminDocType {
  id: AdminDocTypeId;
  label: string;
  description: string;
  icon: IconName;
  activity: AdminActivity;
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
    refPrefix: '',
    refKey: 'number',
    fields: [
      { key: 'number', label: 'N° de facture', half: true, required: true },
      { key: 'date', label: 'Date', half: true },
      { key: 'clientName', label: 'Client', required: true, placeholder: 'Nom du client' },
      { key: 'clientEmail', label: 'Email client', placeholder: 'client@exemple.com' },
      { key: 'description', label: 'Description', required: true, placeholder: 'Convoyage Paris → Lisbonne' },
      { key: 'amountEur', label: 'Montant TTC (€)', type: 'number', half: true, required: true },
      { key: 'paid', label: 'Facture payée', type: 'boolean', half: true },
    ],
    defaults: (ctx) => ({
      number: ctx.reference,
      date: ctx.dateLong,
      clientName: '',
      clientEmail: '',
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
    refPrefix: 'FC',
    refKey: 'number',
    fields: [
      { key: 'number', label: 'N°', half: true, required: true },
      { key: 'date', label: 'Date', half: true },
      { key: 'incoterm', label: 'Incoterm', half: true, placeholder: 'FOB Le Havre' },
      { key: 'currency', label: 'Devise', half: true, placeholder: 'EUR' },
      { key: 'senderName', label: 'Expéditeur', placeholder: 'Axis Import SAS' },
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
      senderName: 'Axis Import SAS',
      senderAddress: '14 rue de la Logistique, 75015 Paris',
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
      senderName: 'Axis Import SAS',
      senderAddress: '14 rue de la Logistique, 75015 Paris',
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
    refPrefix: 'SI',
    refKey: 'number',
    fields: [
      { key: 'number', label: 'N°', half: true, required: true },
      { key: 'date', label: 'Date', half: true },
      { key: 'forwarder', label: 'À l\'attention de (transitaire)', required: true, placeholder: 'Bolloré Logistics, Grimaldi…' },
      { key: 'invoiceRef', label: 'Facture liée', half: true, placeholder: 'FC-2026-0001' },
      { key: 'senderName', label: 'Expéditeur' },
      { key: 'senderAddress', label: 'Adresse expéditeur' },
      { key: 'senderContact', label: 'Contact expéditeur', placeholder: '+33 1 84 88 12 00' },
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
      senderName: 'Axis Import SAS',
      senderAddress: '14 rue de la Logistique, 75015 Paris',
      senderContact: '+33 1 84 88 12 00',
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
      { key: 'senderInstructions', label: '13 · Instructions expéditeur', type: 'multiline' },
      { key: 'specialAgreements', label: '19 · Conventions particulières', type: 'multiline' },
      { key: 'establishedAt', label: '21 · Établi à', half: true, placeholder: 'Paris' },
      { key: 'toPay', label: '20 · À payer', half: true },
    ],
    defaults: (ctx) => ({
      number: ctx.reference,
      date: ctx.dateShort,
      senderName: 'Axis Import SAS',
      senderAddress: '14 rue de la Logistique, 75015 Paris, France',
      recipientName: '',
      recipientAddress: '',
      deliveryPlace: '',
      takingOverPlace: 'Paris, France',
      takingOverDate: ctx.dateShort,
      carrierName: 'Axis Import SAS — 14 rue de la Logistique, 75015 Paris',
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
      shipperName: 'Axis Import SAS',
      shipperAddress: '14 rue de la Logistique, 75015 Paris, France',
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
      shipperName: 'Axis Import SAS',
      shipperAddress: '14 rue de la Logistique, 75015 Paris, France',
      consigneeName: '',
      consigneeAddress: '',
      issuingAgent: 'Axis Import SAS',
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
      exporterName: 'Axis Import SAS',
      exporterAddress: '14 rue de la Logistique, 75015 Paris, France',
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
      senderName: 'Axis Import SAS',
      senderAddress: '14 rue de la Logistique, 75015 Paris',
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
      insurer: 'AXA Transport & Logistique',
      policyNumber: 'TRP-2026-44821',
      coverageAmount: '25000',
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
      exporterName: 'Axis Import SAS',
      exporterAddress: '14 rue de la Logistique, 75015 Paris',
      eori: 'FR92548731200018',
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
    refPrefix: 'MND',
    refKey: 'number',
    fields: [
      { key: 'number', label: 'N°', half: true, required: true },
      { key: 'date', label: 'Date', half: true },
      { key: 'principalName', label: 'Mandant (client)', required: true },
      { key: 'principalAddress', label: 'Adresse du mandant' },
      { key: 'agent', label: 'Mandataire' },
      { key: 'destinationCountry', label: 'Pays de destination', half: true },
      { key: 'scope', label: 'Étendue du mandat (optionnel)', type: 'multiline', hint: 'Vide = clause standard' },
    ],
    defaults: (ctx) => ({
      number: ctx.reference,
      date: ctx.dateLong,
      principalName: '',
      principalAddress: '',
      agent: 'Axis Import SAS — commissionnaire en douane agréé',
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
];

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
  const doc = new jsPDF({ unit: 'mm', format: 'a6' });
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
  doc.text(`${data.originCity || '—'}  →  ${dest || '—'}`, M + 3, y, { maxWidth: W - 2 * M - 6 });

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
  const trackUrl = `https://axis-import.com/t/${encodeURIComponent(data.reference)}`;
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
  doc.setFontSize(8);
  doc.text(doc.splitTextToSize(trackUrl, W - M - (M + qrSize + 7) - 3), M + qrSize + 7, qrY + 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('Scanner pour suivre le colis', M + qrSize + 7, qrY + 24);

  // Pied
  doc.setFontSize(6.5);
  doc.text('Axis Import SAS · support@axis-import.com · +33 1 84 88 12 00', W / 2, H - M - 3, { align: 'center' });

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
  doc.text('CONVOYAGE · IMPORT-EXPORT EUROPE - AFRIQUE', M + 17, 20);

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
  doc.text('Axis Import SAS · SIRET 925 487 312 00018 · TVA FR42 925487312 · 14 rue de la Logistique, 75015 Paris', M, H - 13);
  doc.text('support@axis-import.com · +33 1 84 88 12 00 · axis-import.com', M, H - 9);
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
    doc.setFontSize(8.2);
    doc.setTextColor(0, 0, 0);
    const lines = doc.splitTextToSize(value, w - 4) as string[];
    doc.text(lines, x + 2, y + 9.5);
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
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
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
  doc.text(data.signatory || data.sender?.name || 'Axis Import SAS', M, y);
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
  specialAgreements?: string;
  toPay?: string;
  establishedAt?: string;
}

export async function generateCmrPdf(data: CmrData): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
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
  formBox(doc, M, y, half, 15, '19', 'Conventions particulières', g(data.specialAgreements));
  formBox(doc, M + half, y, half, 15, '20', 'À payer (prix de transport)', g(data.toPay));
  y += 15;
  formBox(doc, M, y, CW, 9, '21', 'Établi à / le', [g(data.establishedAt), g(data.date)].filter(Boolean).join(', le '));
  y += 9;

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

export async function generateCertificateOfOriginPdf(data: CertificateOfOriginData): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
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
  formBox(doc, M, y, CW, 42, '6', 'Marques, n°s, nombre et nature des colis — désignation des marchandises', [g(data.packages), g(data.goods)].filter(Boolean).join('\n'));
  y += 42;
  formBox(doc, M, y, CW, 12, '7', 'Quantité', g(data.quantity));
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(doc.splitTextToSize('Le soussigné certifie que les marchandises désignées ci-dessus sont originaires du pays indiqué en case 3.', CW) as string[], M, y);
  y += 12;
  doc.text(`Fait à ${g(data.signatoryPlace) || '...'}, le ${g(data.date) || '...'}`, M, y);
  doc.setFont('helvetica', 'bold');
  doc.text(g(data.signatory) || 'Axis Import SAS', W - M, y, { align: 'right' });
  doc.setDrawColor(204, 204, 204);
  doc.setLineWidth(0.3);
  doc.line(W - M - 62, y + 9, W - M, y + 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(107, 107, 107);
  doc.text('Signature & cachet de l\'entreprise', W - M - 62, y + 13);

  axisFooter(doc);
  labelDownload(doc, `Certificat-origine-${data.number}.pdf`);
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
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
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
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
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
  formBox(doc, M + half, y, half, 12, null, 'Lieu de réception → livraison', [g(data.placeOfReceipt), g(data.placeOfDelivery)].filter(Boolean).join(' → '));
  y += 12;
  formBox(doc, M, y, half, 12, null, 'Port de chargement / Port of loading', g(data.portOfLoading));
  formBox(doc, M + half, y, half, 12, null, 'Port de déchargement / of discharge', g(data.portOfDischarge));
  y += 12;
  formBox(doc, M, y, CW, 9, null, 'Conteneur / N° de plomb', g(data.containerNo));
  y += 9;

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

  formBox(doc, M, y, half, 11, null, 'Fret & frais / Freight', g(data.freightTerms));
  formBox(doc, M + half, y, half, 11, null, 'Nombre d\'originaux / No. of originals', g(data.numberOfOriginals));
  y += 11;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(`SHIPPED ON BOARD / Embarqué : ${g(data.shippedOnBoardDate) || g(data.date) || '...'}`, M, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Émis à ${g(data.placeOfIssue) || '...'}, le ${g(data.date) || '...'}`, M, y + 12);
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
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
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
  formBox(doc, M, y, CW, 9, null, 'Informations de manutention / Handling information', g(data.handlingInfo));
  y += 9;

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

  formBox(doc, M, y, CW, 9, null, 'Frais / Charges', g(data.chargesTerms));
  y += 9;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(`Émis à ${g(data.executedPlace) || '...'}, le ${g(data.date) || '...'}`, M, y + 7);
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
        clientEmail: orU(str(values, 'clientEmail')),
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
        agent: orU(str(values, 'agent')),
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
  }

  return reference;
}
