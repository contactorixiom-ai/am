// Espace admin (Roger) — logique du générateur de documents.
// Décrit chaque type de document (champs de formulaire, valeurs par défaut,
// activité) et route les valeurs saisies vers le bon générateur de pdf.ts.
// L'étiquette colis n'existe pas dans pdf.ts (fichier gelé) : elle est
// générée ici, en local, avec jsPDF + QRCode dans le même style N&B.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
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
