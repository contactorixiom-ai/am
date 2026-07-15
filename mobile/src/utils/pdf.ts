// Génération de PDF côté client — factures et contrats de convoyage.
// Fonctionne sur tous navigateurs modernes (Safari iOS inclus) : jsPDF
// produit un Blob, on déclenche le téléchargement via <a download>.
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { AXIS_LOGO_PDF } from './axisLogoPdf';
import {
  VEHICLE_SKETCH_CAR,
  VEHICLE_SKETCH_CAR_RATIO,
  VEHICLE_SKETCH_VAN,
  VEHICLE_SKETCH_VAN_RATIO,
} from './vehicleSketches';

// Palette neutre noir & blanc pour des documents officiels institutionnels
// (style transporteur classique). Plus aucun navy/doré dans les PDF — le
// logo neutre noir + structure en niveaux de gris est cohérent.
const INK = '#000000';        // texte principal / bandeaux / cadres
const SOFT_INK = '#3A3A3A';   // bandeaux secondaires
const MUTED = '#6B6B6B';      // libellés, mentions légales
const LINE = '#CCCCCC';       // séparateurs principaux
const LINE_SOFT = '#E5E5E5';  // séparateurs secondaires

// ─── Logo AXIS ────────────────────────────────────────────────────────────
// Le vrai logo neutre Axis (étoile dans cercle + flèche) est embarqué en
// base64 dans axisLogoPdf.ts. On le pose comme image sur le PDF.

function drawAxisLogo(doc: jsPDF, x: number, y: number, size = 8) {
  try {
    doc.addImage(AXIS_LOGO_PDF, 'PNG', x, y, size, size, undefined, 'FAST');
  } catch {
    // Fallback géométrique si l'image ne peut pas être chargée
    doc.setFillColor(0, 0, 0);
    doc.circle(x + size / 2, y + size / 2, size / 2 - 0.5, 'S');
  }
}

// ─── Helpers communs ──────────────────────────────────────────────────────

function triggerDownload(doc: jsPDF, filename: string) {
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

function setColor(doc: jsPDF, hex: string, kind: 'fill' | 'text' | 'draw') {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (kind === 'fill') doc.setFillColor(r, g, b);
  if (kind === 'text') doc.setTextColor(r, g, b);
  if (kind === 'draw') doc.setDrawColor(r, g, b);
}

// ─── Bandeau / footer communs ─────────────────────────────────────────────

function invoiceHeader(doc: jsPDF, title: string, subtitle?: string) {
  const W = doc.internal.pageSize.getWidth();

  // En-tête sobre, fond blanc, style document officiel (façon DHL/Geodis).
  drawAxisLogo(doc, 14, 10, 14);

  // Bloc identité Axis à gauche, en noir
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  setColor(doc, INK, 'text');
  doc.text('AXIS IMPORT', 32, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  setColor(doc, MUTED, 'text');
  doc.text('TRANSPORT · CONVOYAGE', 32, 21);

  // Titre et sous-titre à droite, en noir
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  setColor(doc, INK, 'text');
  const titleW = doc.getTextWidth(title);
  doc.text(title, W - 14 - titleW, 16);

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setColor(doc, MUTED, 'text');
    const subW = doc.getTextWidth(subtitle);
    doc.text(subtitle, W - 14 - subW, 21);
  }

  // Trait de séparation noir épais : signature graphique du document officiel
  setColor(doc, INK, 'draw');
  doc.setLineWidth(0.8);
  doc.line(14, 28, W - 14, 28);
}

function footer(doc: jsPDF) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  setColor(doc, LINE, 'draw');
  doc.setLineWidth(0.3);
  doc.line(14, h - 18, w - 14, h - 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  setColor(doc, MUTED, 'text');
  doc.text('Axis Import SAS · SIRET 925 487 312 00018 · TVA FR42 925487312 · 14 rue de la Logistique, 75015 Paris', 14, h - 13);
  doc.text('support@axis-import.com · +33 1 84 88 12 00 · axis-import.com', 14, h - 9);
}

// Génère un hash pseudo-unique du document pour l'URL de vérification.
// Pas crypto-fort (c'est côté client), suffisant pour la démo.
function docHash(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36).padStart(8, '0').slice(0, 10);
}

// Ajoute un bloc "Document vérifié" : QR + URL + hash + horodatage.
// À placer juste avant footer(). Le contrat est dense → version compacte
// (15mm de haut), la facture est aérée → version standard (30mm).
async function drawVerificationBlock(doc: jsPDF, reference: string, kind: 'invoice' | 'contract') {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const compact = kind === 'contract';
  const blockH = compact ? 14 : 30;
  const blockY = H - (compact ? 32 : 50);

  const hash = docHash(`${kind}:${reference}:${Date.now()}`);
  const url = `https://verify.axis-import.com/v/${hash}`;
  const now = new Date();
  const ts = now.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // Cadre
  setColor(doc, LINE, 'draw');
  doc.setLineWidth(0.3);
  doc.line(14, blockY - 2, W - 14, blockY - 2);

  // QR code
  let qrDataUrl: string | null = null;
  try {
    qrDataUrl = await QRCode.toDataURL(url, { width: 220, margin: 0, color: { dark: INK, light: '#FFFFFFFF' } });
  } catch {
    qrDataUrl = null;
  }
  if (qrDataUrl) {
    doc.addImage(qrDataUrl, 'PNG', 14, blockY, blockH, blockH);
  }

  // Texte à droite du QR
  const tx = 14 + blockH + 4;
  if (compact) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    setColor(doc, INK, 'text');
    doc.text('✓ Document à valeur légale · eIDAS', tx, blockY + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    setColor(doc, MUTED, 'text');
    doc.text(`Horodaté ${ts} · Empreinte ${hash.toUpperCase()}`, tx, blockY + 8);
    doc.text(`Scanner le QR pour vérifier · ${url}`, tx, blockY + 11.5);
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    setColor(doc, INK, 'text');
    doc.text('✓ Document à valeur légale', tx, blockY + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    setColor(doc, MUTED, 'text');
    doc.text('Facture conforme art. 289 CGI · conservée 10 ans', tx, blockY + 8);
    doc.text(`Horodaté le ${ts}`, tx, blockY + 12);
    doc.text(`Empreinte SHA · ${hash.toUpperCase()}`, tx, blockY + 15.5);
    doc.text('Scanner le QR code pour vérifier l\'authenticité sur', tx, blockY + 20);
    setColor(doc, INK, 'text');
    doc.setFont('helvetica', 'bold');
    doc.text(url, tx, blockY + 23.5);

    const rx = W - 14;
    setColor(doc, MUTED, 'text');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('CONFIDENTIEL', rx, blockY + 4, { align: 'right' });
    doc.setFontSize(6.5);
    doc.text('Ne pas reproduire sans accord.', rx, blockY + 8, { align: 'right' });
    doc.text('Chiffré AES-256 au repos.', rx, blockY + 11.5, { align: 'right' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTURE
// ═══════════════════════════════════════════════════════════════════════════

export interface InvoicePdfData {
  number: string;
  date: string;
  amountEur: number;
  paid: boolean;
  description: string;
  clientName: string;
  clientEmail?: string;
  vatRate?: number;
}

export async function generateInvoicePdf(data: InvoicePdfData, sharedDoc?: jsPDF): Promise<void> {
  const doc = sharedDoc ?? new jsPDF({ unit: 'mm', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  const vatRate = data.vatRate ?? 0.2;
  const ttc = data.amountEur;
  const ht = +(ttc / (1 + vatRate)).toFixed(2);
  const tva = +(ttc - ht).toFixed(2);

  invoiceHeader(doc, `Facture ${data.number}`, data.date);

  // Émetteur / Destinataire
  let y = 40;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setColor(doc, MUTED, 'text');
  doc.text('ÉMETTEUR', 14, y);
  doc.text('DESTINATAIRE', w / 2 + 4, y);
  setColor(doc, INK, 'draw');
  doc.setLineWidth(0.5);
  doc.line(14, y + 1.5, 32, y + 1.5);
  doc.line(w / 2 + 4, y + 1.5, w / 2 + 22, y + 1.5);

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setColor(doc, INK, 'text');
  doc.text('Axis Import SAS', 14, y);
  doc.text(data.clientName, w / 2 + 4, y);
  doc.text('14 rue de la Logistique', 14, y + 4);
  if (data.clientEmail) doc.text(data.clientEmail, w / 2 + 4, y + 4);
  doc.text('75015 Paris, France', 14, y + 8);
  doc.text('TVA intracom : FR42 925487312', 14, y + 12);

  // Tampon
  if (data.paid) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(46, 125, 50);
    doc.text('PAYÉE', w - 60, 78, { angle: -10 });
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(190, 130, 30);
    doc.text('À RÉGLER', w - 60, 78, { angle: -10 });
  }

  // Tableau
  y = 95;
  setColor(doc, INK, 'fill');
  doc.rect(14, y, w - 28, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('Description', 18, y + 6);
  doc.text('Quantité', 110, y + 6, { align: 'right' });
  doc.text('PU HT', 145, y + 6, { align: 'right' });
  doc.text('Montant HT', w - 18, y + 6, { align: 'right' });

  y += 13;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  setColor(doc, INK, 'text');
  doc.text(data.description, 18, y);
  doc.text('1', 110, y, { align: 'right' });
  doc.text(`${ht.toFixed(2).replace('.', ',')} €`, 145, y, { align: 'right' });
  doc.text(`${ht.toFixed(2).replace('.', ',')} €`, w - 18, y, { align: 'right' });

  y += 5;
  setColor(doc, LINE, 'draw');
  doc.line(14, y, w - 14, y);

  // Totaux
  y += 10;
  const totalsX = w - 80;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  setColor(doc, MUTED, 'text');
  doc.text('Sous-total HT', totalsX, y);
  setColor(doc, INK, 'text');
  doc.text(`${ht.toFixed(2).replace('.', ',')} €`, w - 18, y, { align: 'right' });

  y += 6;
  setColor(doc, MUTED, 'text');
  doc.text(`TVA ${(vatRate * 100).toFixed(0)} %`, totalsX, y);
  setColor(doc, INK, 'text');
  doc.text(`${tva.toFixed(2).replace('.', ',')} €`, w - 18, y, { align: 'right' });

  y += 4;
  setColor(doc, LINE, 'draw');
  doc.line(totalsX, y, w - 14, y);

  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  setColor(doc, INK, 'text');
  doc.text('Total TTC', totalsX, y);
  doc.text(`${ttc.toFixed(2).replace('.', ',')} €`, w - 18, y, { align: 'right' });

  // Mentions légales
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  setColor(doc, MUTED, 'text');
  const mention = data.paid
    ? `Facture réglée le ${data.date}. Conservez ce document pendant 10 ans (art. L123-22 C. com.).`
    : 'Paiement à 30 jours fin de mois. Pénalités de retard (3 fois le taux légal) et indemnité forfaitaire de 40 € (art. L441-10 C. com.).';
  doc.text(mention, 14, y, { maxWidth: w - 28 });

  await drawVerificationBlock(doc, data.number, 'invoice');
  footer(doc);
  if (!sharedDoc) triggerDownload(doc, `${data.number}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════════
// CHECKLIST DOUANIÈRE — documents requis à l'import par pays
// ═══════════════════════════════════════════════════════════════════════════

export interface CustomsChecklistItem {
  label: string;
  mandatory: boolean;
  provided?: boolean;
  note?: string;
}

export interface CustomsChecklistData {
  countryName: string;
  countryCode: string;
  trackingTypeLabel?: string;   // ex "Bordereau de Suivi de Cargaison (BSC)"
  authority?: string;           // ex "COSEC"
  cargoStatusLabel?: string;    // ex "À demander"
  customsNotes?: string;
  items: CustomsChecklistItem[];
}

export async function generateCustomsChecklistPdf(data: CustomsChecklistData, sharedDoc?: jsPDF): Promise<void> {
  const doc = sharedDoc ?? new jsPDF({ unit: 'mm', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();

  invoiceHeader(doc, 'Checklist douanière', `${data.countryName} · ${data.countryCode}`);

  let y = 40;

  // Encart bordereau requis
  if (data.trackingTypeLabel) {
    setColor(doc, INK, 'fill');
    doc.roundedRect(14, y, w - 28, 18, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    setColor(doc, INK, 'text');
    doc.text('BORDEREAU DE SUIVI DE CARGAISON REQUIS', 18, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(data.trackingTypeLabel, 18, y + 11.5, { maxWidth: w - 60 });
    if (data.authority) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(`Émis par ${data.authority}`, 18, y + 15.5);
    }
    if (data.cargoStatusLabel) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      setColor(doc, INK, 'text');
      doc.text(`Statut : ${data.cargoStatusLabel}`, w - 18, y + 11.5, { align: 'right' });
    }
    y += 24;
  }

  // En-tête tableau
  setColor(doc, INK, 'fill');
  doc.rect(14, y, w - 28, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('Document', 18, y + 6);
  doc.text('Obligatoire', w - 70, y + 6);
  doc.text('Statut', w - 18, y + 6, { align: 'right' });
  y += 13;

  data.items.forEach((item) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    setColor(doc, INK, 'text');
    doc.text(item.label, 18, y, { maxWidth: w - 95 });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    setColor(doc, item.mandatory ? INK : MUTED, 'text');
    doc.text(item.mandatory ? 'Oui' : 'Recommandé', w - 70, y);

    const provided = item.provided === true;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    if (provided) doc.setTextColor(31, 138, 91);
    else setColor(doc, item.mandatory ? '#B7791F' : MUTED, 'text');
    doc.text(provided ? '✓ Fourni' : 'Manquant', w - 18, y, { align: 'right' });

    if (item.note) {
      y += 4;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      setColor(doc, MUTED, 'text');
      const lines = doc.splitTextToSize(item.note, w - 95);
      doc.text(lines, 18, y);
      y += (lines.length - 1) * 3.5;
    }

    y += 6;
    setColor(doc, LINE, 'draw');
    doc.setLineWidth(0.2);
    doc.line(14, y - 2, w - 14, y - 2);
  });

  if (data.customsNotes) {
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    setColor(doc, INK, 'text');
    doc.text('Notes douanières', 14, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    setColor(doc, INK, 'text');
    const lines = doc.splitTextToSize(data.customsNotes, w - 28);
    doc.text(lines, 14, y);
  }

  footer(doc);
  if (!sharedDoc) triggerDownload(doc, `Checklist-douane-${data.countryCode}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTRAT DE CONVOYAGE + ÉTAT DES LIEUX
// Fidèle au modèle officiel Axis Import (départ + arrivée sur 1 page A4).
// ═══════════════════════════════════════════════════════════════════════════

export interface ContractPdfData {
  reference: string;                 // "2026-2847-FE12"
  copyLabel?: string;                // "EXEMPLAIRE CONVOYEUR" / "CLIENT"
  vehicleCategory?: string;          // "Berline", "Utilitaire", etc.

  driverName?: string;
  driverPhone?: string;
  driverLicense?: string;

  estimatedKm?: number;
  estimatedDuration?: string;        // "5 h"
  missionReference?: string;         // alias de reference si non fourni

  clientName: string;
  vehicleBrandModel?: string;        // "BMW Série 3"
  plate?: string;                    // "AB-123-CD"

  pickupDate?: string;               // "22/05/2026"
  pickupTime?: string;               // "08h30"
  pickupContact?: string;
  pickupAddress?: string;

  deliveryDate?: string;
  deliveryTime?: string;
  deliveryContact?: string;
  deliveryAddress?: string;

  departureKm?: number;
  departureFuel?: 0 | 0.25 | 0.5 | 0.75 | 1;
  departureDate?: string;
  departureTime?: string;
  departureObservations?: string;
  departureClientSigned?: boolean;
  departureClientSignedDate?: string;
  departureDriverSigned?: boolean;
  departureDamages?: PdfDamage[];

  arrivalKm?: number;
  arrivalFuel?: 0 | 0.25 | 0.5 | 0.75 | 1;
  arrivalDate?: string;
  arrivalTime?: string;
  arrivalObservations?: string;
  arrivalClientSigned?: boolean;
  arrivalClientSignedDate?: string;
  arrivalDriverSigned?: boolean;
  arrivalDamages?: PdfDamage[];

  // Compat ancienne API (peuvent être ignorés ici)
  title?: string;
  fromCity?: string;
  toCity?: string;
  vehicleLabel?: string;
  pickupDate2?: string;
  signatureDataUrl?: string;
  signedDate?: string;
  priceEur?: number;
}

export interface PdfDamage {
  view: 'top' | 'front' | 'rear' | 'left' | 'right';
  x: number; // 0..1
  y: number; // 0..1
  code: 'R' | 'F' | 'E' | 'C' | 'M';
}

const VEHICLE_CATEGORIES = [
  'Citadine', 'Berline', 'Break', 'Coupé', 'Monospace', 'SUV', '4×4', 'Utilitaire',
  'Camping-car', 'Poids lourd', 'Moto', 'Élec.', 'Hybride', 'Luxe', 'Collection',
];

export async function generateContractPdf(data: ContractPdfData, sharedDoc?: jsPDF): Promise<void> {
  const doc = sharedDoc ?? new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 8; // marge

  // Préfère pickupDate si fourni, sinon retombe sur ancien champ
  const pickupDate = data.pickupDate ?? data.pickupDate2;

  // ─── HEADER ─────────────────────────────────────────────────────────────
  // Bandeau logo gauche, titre centre, exemplaire droite
  drawAxisLogo(doc, M, M + 1, 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setColor(doc, INK, 'text');
  doc.text('AXIS IMPORT', M + 13, M + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  setColor(doc, MUTED, 'text');
  doc.text('T R A N S P O R T   ·   C O N V O Y A G E', M + 13, M + 9);

  // Titre centre
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  setColor(doc, INK, 'text');
  doc.text('CONTRAT DE CONVOYAGE', W / 2, M + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setColor(doc, MUTED, 'text');
  doc.text('État des lieux — Document contractuel', W / 2, M + 8, { align: 'center' });

  // N° encadré
  setColor(doc, INK, 'draw');
  doc.setLineWidth(0.4);
  const num = `N° ${data.reference || '2026-XXXX-XXXX'}`;
  const numW = doc.getTextWidth(num) + 6;
  doc.rect(W / 2 - numW / 2, M + 10, numW, 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  setColor(doc, INK, 'text');
  doc.text(num, W / 2, M + 13.5, { align: 'center' });

  // Exemplaire (encadré, droite)
  const copyLabel = data.copyLabel ?? 'EXEMPLAIRE\nCLIENT';
  doc.setLineWidth(0.4);
  doc.rect(W - M - 30, M, 30, 11);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  setColor(doc, INK, 'text');
  copyLabel.split('\n').forEach((line, i) => {
    doc.text(line, W - M - 15, M + 4.5 + i * 3.5, { align: 'center' });
  });

  // Trait horizontal sous header
  let y = M + 18;
  doc.setLineWidth(0.3);
  doc.line(M, y, W - M, y);

  // ─── CATÉGORIE VÉHICULE ─────────────────────────────────────────────────
  y += 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  setColor(doc, INK, 'text');
  doc.text('CATÉGORIE DU VÉHICULE', M, y);

  y += 3;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const col1 = VEHICLE_CATEGORIES.slice(0, 8);
  const col2 = VEHICLE_CATEGORIES.slice(8, 15);
  const colW = (W - 2 * M) / 8;
  col1.forEach((cat, i) => {
    drawCheckbox(doc, M + i * colW, y - 2.15, 2.5, cat === data.vehicleCategory);
    doc.text(cat, M + i * colW + 4, y);
  });
  y += 4;
  col2.forEach((cat, i) => {
    drawCheckbox(doc, M + i * colW, y - 2.15, 2.5, cat === data.vehicleCategory);
    doc.text(cat, M + i * colW + 4, y);
  });
  y += 4;
  drawCheckbox(doc, M, y - 2.15, 2.5, false);
  doc.text('Autre :', M + 4, y);
  doc.setDrawColor(180);
  doc.setLineWidth(0.2);
  doc.line(M + 16, y, W - M, y);

  y += 3;
  setColor(doc, INK, 'draw');
  doc.setLineWidth(0.3);
  doc.line(M, y, W - M, y);

  // ─── 3 COLONNES : CHAUFFEUR / MISSION / CLIENT ─────────────────────────
  y += 1;
  const c3W = (W - 2 * M) / 3;
  doc.setFillColor(245, 241, 232);
  doc.rect(M, y, W - 2 * M, 5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setColor(doc, INK, 'text');
  doc.text('CHAUFFEUR', M + c3W / 2, y + 3.5, { align: 'center' });
  doc.text('MISSION', M + c3W + c3W / 2, y + 3.5, { align: 'center' });
  doc.text('CLIENT / VÉHICULE', M + 2 * c3W + c3W / 2, y + 3.5, { align: 'center' });

  y += 8;
  // 3 lignes : libellé + valeur sous-lignée
  const drawField = (x: number, label: string, value?: string | number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    setColor(doc, MUTED, 'text');
    doc.text(label, x, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setColor(doc, INK, 'text');
    if (value !== undefined && value !== '') doc.text(String(value), x, y + 4.5);
    setColor(doc, INK, 'draw');
    doc.setLineWidth(0.2);
    doc.line(x, y + 5.5, x + c3W - 4, y + 5.5);
  };

  drawField(M + 1, 'NOM COMPLET', data.driverName);
  drawField(M + c3W + 1, 'KILOMÉTRAGE PRÉVU', data.estimatedKm ? `${data.estimatedKm} km` : '');
  drawField(M + 2 * c3W + 1, 'CLIENT', data.clientName);

  y += 8;
  drawField(M + 1, 'TÉLÉPHONE', data.driverPhone);
  drawField(M + c3W + 1, 'DURÉE ESTIMÉE', data.estimatedDuration);
  drawField(M + 2 * c3W + 1, 'MARQUE + MODÈLE', data.vehicleBrandModel ?? data.vehicleLabel);

  y += 8;
  drawField(M + 1, 'N° DE PERMIS', data.driverLicense);
  drawField(M + c3W + 1, 'RÉFÉRENCE MISSION', data.missionReference ?? data.reference);
  drawField(M + 2 * c3W + 1, 'IMMATRICULATION', data.plate);

  y += 6;
  setColor(doc, INK, 'draw');
  doc.setLineWidth(0.3);
  doc.line(M, y, W - M, y);

  // ─── PRISE / REMISE DU VÉHICULE ─────────────────────────────────────────
  y += 1;
  doc.setFillColor(245, 241, 232);
  doc.rect(M, y, W - 2 * M, 5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setColor(doc, INK, 'text');
  doc.text('PRISE DU VÉHICULE', M + (W - 2 * M) / 4, y + 3.5, { align: 'center' });
  doc.text('REMISE DU VÉHICULE', M + 3 * (W - 2 * M) / 4, y + 3.5, { align: 'center' });
  doc.setDrawColor(180);
  doc.setLineWidth(0.2);
  doc.line(W / 2, y, W / 2, y + 18);

  y += 8;
  drawDateTimeContact(doc, M + 4, y, pickupDate, data.pickupTime, data.pickupContact, data.pickupAddress);
  drawDateTimeContact(doc, W / 2 + 4, y, data.deliveryDate, data.deliveryTime, data.deliveryContact, data.deliveryAddress);

  y += 13;
  setColor(doc, INK, 'draw');
  doc.setLineWidth(0.3);
  doc.line(M, y, W - M, y);

  const cat = (data.vehicleCategory ?? '').toLowerCase();
  const vehicleKind: VehicleKind =
    cat.includes('moto') ? 'moto'
      : cat.includes('poids') ? 'truck'
        : (cat.includes('utilit') || cat.includes('camping')) ? 'van'
          : 'car';

  // ─── ÉTAT DES LIEUX — DÉPART ────────────────────────────────────────────
  y = drawEtatDesLieux(doc, y + 1, 'DÉPART', vehicleKind, {
    km: data.departureKm,
    fuel: data.departureFuel,
    date: data.departureDate,
    time: data.departureTime,
    obs: data.departureObservations,
    clientSigned: data.departureClientSigned ?? !!data.signatureDataUrl,
    clientSignedDate: data.departureClientSignedDate ?? data.signedDate,
    driverSigned: data.departureDriverSigned,
    damages: data.departureDamages,
  });

  // ─── ÉTAT DES LIEUX — ARRIVÉE ───────────────────────────────────────────
  y = drawEtatDesLieux(doc, y + 1, 'ARRIVÉE', vehicleKind, {
    km: data.arrivalKm,
    fuel: data.arrivalFuel,
    date: data.arrivalDate,
    time: data.arrivalTime,
    obs: data.arrivalObservations,
    clientSigned: data.arrivalClientSigned,
    clientSignedDate: data.arrivalClientSignedDate,
    driverSigned: data.arrivalDriverSigned,
    damages: data.arrivalDamages,
  });

  // ─── FOOTER ─────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  setColor(doc, MUTED, 'text');
  doc.text('AXIS IMPORT', M, H - 5);
  doc.text('Document contractuel — fait foi en cas de litige', W / 2, H - 5, { align: 'center' });
  doc.text('Page 1/1', W - M, H - 5, { align: 'right' });

  await drawVerificationBlock(doc, data.reference || 'demo', 'contract');
  if (!sharedDoc) triggerDownload(doc, `Contrat-Axis-${data.reference || 'demo'}.pdf`);
}

// ─── Sous-blocs ───────────────────────────────────────────────────────────

function drawCheckbox(doc: jsPDF, x: number, y: number, size: number, checked: boolean) {
  setColor(doc, INK, 'draw');
  doc.setLineWidth(0.25);
  doc.rect(x, y, size, size);
  if (checked) {
    setColor(doc, INK, 'fill');
    doc.rect(x + 0.4, y + 0.4, size - 0.8, size - 0.8, 'F');
  }
}

function drawDateTimeContact(doc: jsPDF, x: number, y: number, date?: string, time?: string, contact?: string, address?: string) {
  // Ligne 1 : __ / __ / ____ — __ h __
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setColor(doc, INK, 'text');
  const dateStr = date ? formatDateLine(date, time) : '____ / ____ / ________  —  ____ h ____';
  doc.text(dateStr, x, y);
  // Ligne 2 : Contact : ...
  doc.setFontSize(8);
  doc.text('Contact :', x, y + 5);
  if (contact) {
    setColor(doc, INK, 'text');
    doc.text(contact, x + 14, y + 5);
  } else {
    setColor(doc, MUTED, 'draw');
    doc.setLineWidth(0.2);
    doc.line(x + 14, y + 5.5, x + 80, y + 5.5);
  }
  // Ligne 3 : adresse
  if (address) {
    setColor(doc, INK, 'text');
    doc.setFontSize(8);
    doc.text(address, x, y + 10, { maxWidth: 85 });
  } else {
    setColor(doc, MUTED, 'draw');
    doc.setLineWidth(0.2);
    doc.line(x, y + 10.5, x + 85, y + 10.5);
  }
}

function formatDateLine(date: string, time?: string): string {
  // Accepte "22/05/2026" ou "22 mai 2026"
  return `${date}${time ? `  —  ${time}` : ''}`;
}

// Schéma véhicule vue de dessus, dessiné en vectoriel, avec repères de
// dommages positionnés en coordonnées normalisées (0..1) de la zone donnée.
type VehicleKind = 'car' | 'van' | 'truck' | 'moto';

// Croquis véhicule multi-vues (modèle « état des lieux ») : schéma professionnel
// (Dessus + Avant + Arrière + Côtés + habitacle) intégré depuis un visuel JPEG.
// La voiture et l'utilitaire disposent chacun de leur propre planche ; les
// dommages relevés lors de l'inspection sont consignés dans les OBSERVATIONS.
function drawVehicleSchematic(doc: jsPDF, x: number, y: number, w: number, h: number, kind: VehicleKind) {
  const isVan = kind === 'van' || kind === 'truck';
  const img = isVan ? VEHICLE_SKETCH_VAN : VEHICLE_SKETCH_CAR;
  const ratio = isVan ? VEHICLE_SKETCH_VAN_RATIO : VEHICLE_SKETCH_CAR_RATIO;

  // Ajustement « contain » : on préserve les proportions de la planche et on
  // centre le visuel dans le cadre réservé.
  let iw = w;
  let ih = w / ratio;
  if (ih > h) { ih = h; iw = h * ratio; }
  const ix = x + (w - iw) / 2;
  const iy = y + (h - ih) / 2;

  try {
    doc.addImage(img, 'JPEG', ix, iy, iw, ih, undefined, 'FAST');
  } catch {
    // Repli : simple cadre si le visuel ne peut être décodé.
    setColor(doc, LINE, 'draw');
    doc.setLineWidth(0.4);
    doc.roundedRect(ix, iy, iw, ih, 2, 2, 'S');
  }
}

interface EtatDesLieux {
  km?: number;
  fuel?: 0 | 0.25 | 0.5 | 0.75 | 1;
  date?: string;
  time?: string;
  obs?: string;
  clientSigned?: boolean;
  clientSignedDate?: string;
  driverSigned?: boolean;
  damages?: PdfDamage[];
}

function drawEtatDesLieux(doc: jsPDF, y: number, label: 'DÉPART' | 'ARRIVÉE', kind: VehicleKind, d: EtatDesLieux): number {
  const W = doc.internal.pageSize.getWidth();
  const M = 8;

  // Bandeau navy
  setColor(doc, INK, 'fill');
  doc.rect(M, y, W - 2 * M, 5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`ÉTAT DES LIEUX — ${label}`, W / 2, y + 3.5, { align: 'center' });

  y += 5;

  // Zone à 2 colonnes :
  // gauche  : schéma véhicule vectoriel + repères de dommages
  // droite  : km / carburant / date / heure / observations / signatures
  const blockH = 70;
  const leftW = (W - 2 * M) * 0.45;
  const rightW = (W - 2 * M) * 0.55;
  setColor(doc, INK, 'draw');
  doc.setLineWidth(0.3);
  doc.rect(M, y, leftW, blockH);
  doc.rect(M + leftW, y, rightW, blockH);

  // Croquis véhicule multi-vues (planche professionnelle voiture / utilitaire)
  drawVehicleSchematic(doc, M + 4, y + 4, leftW - 8, blockH - 8, kind);

  // Colonne droite : champs
  const rx = M + leftW + 3;
  let ry = y + 5;

  // KM
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  setColor(doc, MUTED, 'text');
  doc.text('KILOMÉTRAGE', rx, ry);
  doc.text('CARBURANT', rx + rightW / 2, ry);

  ry += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setColor(doc, INK, 'text');
  if (d.km !== undefined) doc.text(`${d.km.toLocaleString('fr-FR')} km`, rx, ry);
  setColor(doc, INK, 'draw');
  doc.setLineWidth(0.2);
  doc.line(rx, ry + 1, rx + rightW / 2 - 8, ry + 1);

  // Jauge carburant 0 ¼ ½ ¾ 1
  const gx = rx + rightW / 2;
  drawFuelGauge(doc, gx, ry - 4, d.fuel);

  ry += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  setColor(doc, MUTED, 'text');
  doc.text('DATE', rx, ry);
  doc.text('HEURE', rx + rightW / 2, ry);

  ry += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setColor(doc, INK, 'text');
  if (d.date) doc.text(d.date, rx, ry);
  if (d.time) doc.text(d.time, rx + rightW / 2, ry);
  setColor(doc, INK, 'draw');
  doc.setLineWidth(0.2);
  doc.line(rx, ry + 1, rx + rightW / 2 - 8, ry + 1);
  doc.line(rx + rightW / 2, ry + 1, rx + rightW - 8, ry + 1);

  ry += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  setColor(doc, MUTED, 'text');
  doc.text('OBSERVATIONS', rx, ry);

  ry += 3;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  setColor(doc, INK, 'text');
  if (d.obs) {
    const lines = doc.splitTextToSize(d.obs, rightW - 8);
    doc.text(lines, rx, ry + 3);
  }
  // 4 lignes de soulignement
  setColor(doc, MUTED, 'draw');
  doc.setLineWidth(0.15);
  for (let i = 0; i < 4; i += 1) {
    doc.line(rx, ry + 4 + i * 4, rx + rightW - 8, ry + 4 + i * 4);
  }

  // Signatures bas
  const sy = y + blockH - 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  setColor(doc, MUTED, 'text');
  doc.text('SIGN. CONDUCTEUR', rx, sy);
  doc.text('SIGN. CLIENT / TAMPON RESPONSABLE', rx + rightW / 2, sy);

  // Cadres signature
  setColor(doc, INK, 'draw');
  doc.setLineWidth(0.2);
  doc.rect(rx, sy + 2, rightW / 2 - 4, 12);
  doc.rect(rx + rightW / 2, sy + 2, rightW / 2 - 6, 12);

  // Tampon signé
  if (d.driverSigned) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(46, 125, 50);
    doc.text('✓ Signé', rx + 2, sy + 9);
  }
  if (d.clientSigned) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(46, 125, 50);
    doc.text('✓ Signé électroniquement', rx + rightW / 2 + 2, sy + 8);
    if (d.clientSignedDate) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      setColor(doc, MUTED, 'text');
      doc.text(`le ${d.clientSignedDate}`, rx + rightW / 2 + 2, sy + 12);
    }
  }

  y += blockH;

  // CODES bas
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  setColor(doc, INK, 'text');
  doc.text('CODES', M + 2, y + 4);
  const codes = [
    { l: 'R', t: 'Rayures' },
    { l: 'F', t: 'Fissures' },
    { l: 'E', t: 'Enfoncements' },
    { l: 'C', t: 'Cassés' },
    { l: 'M', t: 'Manquants' },
  ];
  let cx = M + 16;
  codes.forEach((c) => {
    setColor(doc, INK, 'fill');
    doc.rect(cx, y + 1, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(c.l, cx + 1.5, y + 3.3, { align: 'center' });
    setColor(doc, INK, 'text');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(c.t, cx + 5, y + 3.3);
    cx += 5 + doc.getTextWidth(c.t) + 4;
  });

  y += 6;
  return y;
}

function drawFuelGauge(doc: jsPDF, x: number, y: number, level?: number) {
  // Rangée de 5 cases régulièrement espacées : 0 · ¼ · ½ · ¾ · 1.
  // Chaque libellé est centré exactement sous sa case → aucun décalage.
  const labels = ['0', '¼', '½', '¾', '1'];
  const values = [0, 0.25, 0.5, 0.75, 1];
  const box = 2.6;
  const step = 7;
  labels.forEach((label, i) => {
    const bx = x + i * step;
    drawCheckbox(doc, bx, y + 1, box, level === values[i]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    setColor(doc, INK, 'text');
    doc.text(label, bx + box / 2, y + 7.4, { align: 'center' });
  });
  // Ligne de base sous la rangée
  setColor(doc, INK, 'draw');
  doc.setLineWidth(0.2);
  doc.line(x, y + 8.8, x + (labels.length - 1) * step + box, y + 8.8);
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS PARTAGÉS — documents douaniers / commerciaux
// (en-tête Axis + footer + QR déjà fournis par invoiceHeader/footer/
//  drawVerificationBlock ; ici de quoi composer des blocs « parties » et
//  des tableaux dans le même style noir & blanc.)
// ═══════════════════════════════════════════════════════════════════════════

// Bloc « libellé » (petit titre souligné, style ÉMETTEUR/DESTINATAIRE).
function blockLabel(doc: jsPDF, label: string, x: number, y: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setColor(doc, MUTED, 'text');
  doc.text(label, x, y);
  setColor(doc, INK, 'draw');
  doc.setLineWidth(0.5);
  doc.line(x, y + 1.5, x + Math.min(doc.getTextWidth(label) + 4, 60), y + 1.5);
}

// Écrit une pile de lignes de texte (valeur), renvoie le y final.
function textLines(doc: jsPDF, lines: (string | undefined)[], x: number, y: number, lh = 4.5): number {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setColor(doc, INK, 'text');
  let cy = y;
  lines.forEach((l) => {
    if (l !== undefined && l !== '') {
      doc.text(l, x, cy);
      cy += lh;
    }
  });
  return cy;
}

// Couple « libellé / valeur » sur une ligne, valeur alignée à droite.
function kv(doc: jsPDF, label: string, value: string, x: number, y: number, right: number) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setColor(doc, MUTED, 'text');
  doc.text(label, x, y);
  doc.setFont('helvetica', 'bold');
  setColor(doc, INK, 'text');
  doc.text(value, right, y, { align: 'right' });
}

interface TableCol {
  header: string;
  width: number;                    // largeur relative (somme libre, normalisée)
  align?: 'left' | 'right';
}

// Tableau générique en-tête noir + lignes, renvoie le y final.
function drawTable(
  doc: jsPDF,
  cols: TableCol[],
  rows: string[][],
  x: number,
  y: number,
  totalW: number,
): number {
  const sum = cols.reduce((s, c) => s + c.width, 0);
  const widths = cols.map((c) => (c.width / sum) * totalW);
  const xs: number[] = [];
  let acc = x;
  widths.forEach((w) => { xs.push(acc); acc += w; });

  // En-tête
  setColor(doc, INK, 'fill');
  doc.rect(x, y, totalW, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  cols.forEach((c, i) => {
    const right = c.align === 'right';
    doc.text(c.header, right ? xs[i] + widths[i] - 2 : xs[i] + 2, y + 5.3, { align: right ? 'right' : 'left' });
  });
  let cy = y + 12;

  // Lignes
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  rows.forEach((row) => {
    setColor(doc, INK, 'text');
    let rowH = 4;
    cols.forEach((c, i) => {
      const right = c.align === 'right';
      const cellLines = doc.splitTextToSize(row[i] ?? '', widths[i] - 4);
      doc.text(cellLines, right ? xs[i] + widths[i] - 2 : xs[i] + 2, cy, { align: right ? 'right' : 'left' });
      rowH = Math.max(rowH, cellLines.length * 4);
    });
    cy += rowH + 2;
    setColor(doc, LINE_SOFT, 'draw');
    doc.setLineWidth(0.2);
    doc.line(x, cy - 2, x + totalW, cy - 2);
  });
  return cy;
}

// Cadre de signature avec libellé. Renvoie rien (positionnement absolu).
function signatureBox(doc: jsPDF, label: string, x: number, y: number, w: number, signedLabel?: string) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  setColor(doc, MUTED, 'text');
  doc.text(label, x, y);
  setColor(doc, INK, 'draw');
  doc.setLineWidth(0.3);
  doc.rect(x, y + 2, w, 20);
  if (signedLabel) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(31, 138, 91);
    doc.text(signedLabel, x + 3, y + 13);
  }
}

const EURO = (n: number) => `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ═══════════════════════════════════════════════════════════════════════════
// FACTURE COMMERCIALE (export) — base du calcul des droits de douane
// ═══════════════════════════════════════════════════════════════════════════

export interface CommercialInvoiceLine {
  designation: string;
  hsCode?: string;        // code SH / nomenclature douanière
  quantity?: number;
  unitPrice?: number;     // PU dans la devise
  amount?: number;        // si absent : quantity * unitPrice
}

export interface CommercialInvoicePdfData {
  number?: string;
  date?: string;
  incoterm?: string;              // ex "FOB Le Havre", "CIF Dakar"
  currency?: string;              // ex "EUR"
  originCountry?: string;         // pays d'origine des marchandises
  destinationCountry?: string;
  sender?: { name?: string; address?: string; vat?: string };
  recipient?: { name?: string; address?: string; country?: string };
  lines?: CommercialInvoiceLine[];
  fobValue?: number;              // valeur FOB (sinon = total lignes)
  notes?: string;
}

export async function generateCommercialInvoicePdf(data: CommercialInvoicePdfData, sharedDoc?: jsPDF): Promise<void> {
  const doc = sharedDoc ?? new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 14;

  const number = data.number ?? `FC-${new Date().getFullYear()}-0001`;
  const date = data.date ?? new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const currency = data.currency ?? 'EUR';
  const incoterm = data.incoterm ?? 'FOB Le Havre';
  const lines: CommercialInvoiceLine[] = data.lines?.length
    ? data.lines
    : [
        { designation: 'Pièces détachées automobiles (lot)', hsCode: '8708.99', quantity: 12, unitPrice: 145 },
        { designation: 'Groupe électrogène 5 kVA', hsCode: '8502.11', quantity: 2, unitPrice: 820 },
      ];

  invoiceHeader(doc, 'Facture commerciale', `${number} · ${date}`);

  // Parties
  let y = 40;
  blockLabel(doc, 'EXPÉDITEUR', M, y);
  blockLabel(doc, 'DESTINATAIRE', W / 2 + 4, y);
  y += 6;
  const s = data.sender ?? {};
  const r = data.recipient ?? {};
  textLines(doc, [
    s.name ?? 'Axis Import SAS',
    s.address ?? '14 rue de la Logistique, 75015 Paris',
    `TVA : ${s.vat ?? 'FR42 925487312'}`,
  ], M, y);
  textLines(doc, [
    r.name ?? 'Sahel Trading SARL',
    r.address ?? 'Zone portuaire, Dakar',
    `Pays : ${r.country ?? data.destinationCountry ?? 'Sénégal'}`,
  ], W / 2 + 4, y);

  // Conditions (Incoterm / origine / devise)
  y += 18;
  setColor(doc, INK, 'fill');
  doc.roundedRect(M, y, W - 2 * M, 9, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(`INCOTERM ${incoterm}`, M + 3, y + 5.8);
  doc.text(`ORIGINE ${data.originCountry ?? 'France (UE)'}`, M + 70, y + 5.8);
  doc.text(`DEVISE ${currency}`, W - M - 3, y + 5.8, { align: 'right' });

  // Tableau lignes
  y += 14;
  const rows = lines.map((l) => {
    const amount = l.amount ?? (l.quantity ?? 1) * (l.unitPrice ?? 0);
    return [
      l.designation,
      l.hsCode ?? '—',
      String(l.quantity ?? 1),
      l.unitPrice !== undefined ? EURO(l.unitPrice) : '—',
      EURO(amount),
    ];
  });
  y = drawTable(
    doc,
    [
      { header: 'Désignation', width: 9 },
      { header: 'Code SH', width: 3 },
      { header: 'Qté', width: 2, align: 'right' },
      { header: `PU (${currency})`, width: 3, align: 'right' },
      { header: `Montant (${currency})`, width: 3.5, align: 'right' },
    ],
    rows,
    M,
    y,
    W - 2 * M,
  );

  const total = lines.reduce((sum, l) => sum + (l.amount ?? (l.quantity ?? 1) * (l.unitPrice ?? 0)), 0);
  const fob = data.fobValue ?? total;

  // Totaux
  y += 6;
  const tx = W - 80;
  kv(doc, `Total ${currency}`, EURO(total), tx, y, W - M);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setColor(doc, INK, 'text');
  doc.text(`Valeur FOB`, tx, y);
  doc.text(`${EURO(fob)} ${currency}`, W - M, y, { align: 'right' });
  setColor(doc, INK, 'draw');
  doc.setLineWidth(0.5);
  doc.line(tx, y + 2, W - M, y + 2);

  // Mentions export
  y += 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  setColor(doc, MUTED, 'text');
  const mention = data.notes
    ?? 'Marchandises destinées à l\'exportation. Origine attestée par certificat séparé. Valeur déclarée pour usage douanier exclusivement.';
  doc.text(doc.splitTextToSize(mention, W - 2 * M), M, y);

  await drawVerificationBlock(doc, number, 'contract');
  footer(doc);
  if (!sharedDoc) triggerDownload(doc, `Facture-commerciale-${number}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════════
// LISTE DE COLISAGE (Packing List)
// ═══════════════════════════════════════════════════════════════════════════

export interface PackingListPackage {
  contents?: string;
  dimensions?: string;     // "L×l×H" en cm, ex "120×80×100"
  grossKg?: number;
  netKg?: number;
}

export interface PackingListPdfData {
  number?: string;
  date?: string;
  sender?: { name?: string; address?: string };
  recipient?: { name?: string; address?: string };
  packages?: PackingListPackage[];
}

export async function generatePackingListPdf(data: PackingListPdfData, sharedDoc?: jsPDF): Promise<void> {
  const doc = sharedDoc ?? new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 14;

  const number = data.number ?? `LC-${new Date().getFullYear()}-0001`;
  const date = data.date ?? new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const pkgs: PackingListPackage[] = data.packages?.length
    ? data.packages
    : [
        { contents: 'Pièces détachées (cartons)', dimensions: '120×80×100', grossKg: 320, netKg: 295 },
        { contents: 'Groupe électrogène', dimensions: '90×60×80', grossKg: 145, netKg: 138 },
        { contents: 'Accessoires divers', dimensions: '60×40×40', grossKg: 48, netKg: 42 },
      ];

  invoiceHeader(doc, 'Liste de colisage', `${number} · ${date}`);

  let y = 40;
  blockLabel(doc, 'EXPÉDITEUR', M, y);
  blockLabel(doc, 'DESTINATAIRE', W / 2 + 4, y);
  y += 6;
  textLines(doc, [
    data.sender?.name ?? 'Axis Import SAS',
    data.sender?.address ?? '14 rue de la Logistique, 75015 Paris',
  ], M, y);
  textLines(doc, [
    data.recipient?.name ?? 'Sahel Trading SARL',
    data.recipient?.address ?? 'Zone portuaire, Dakar',
  ], W / 2 + 4, y);

  y += 16;
  const rows = pkgs.map((p, i) => [
    String(i + 1),
    p.contents ?? '—',
    p.dimensions ? `${p.dimensions} cm` : '—',
    p.grossKg !== undefined ? `${p.grossKg.toLocaleString('fr-FR')} kg` : '—',
    p.netKg !== undefined ? `${p.netKg.toLocaleString('fr-FR')} kg` : '—',
  ]);
  y = drawTable(
    doc,
    [
      { header: 'N°', width: 1.2 },
      { header: 'Contenu', width: 6 },
      { header: 'Dimensions (L×l×H)', width: 4 },
      { header: 'Poids brut', width: 3, align: 'right' },
      { header: 'Poids net', width: 3, align: 'right' },
    ],
    rows,
    M,
    y,
    W - 2 * M,
  );

  const gross = pkgs.reduce((s, p) => s + (p.grossKg ?? 0), 0);
  const net = pkgs.reduce((s, p) => s + (p.netKg ?? 0), 0);

  // Totaux
  y += 6;
  const tx = W - 90;
  kv(doc, 'Nombre de colis', String(pkgs.length), tx, y, W - M);
  y += 6;
  kv(doc, 'Poids brut total', `${gross.toLocaleString('fr-FR')} kg`, tx, y, W - M);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setColor(doc, INK, 'text');
  doc.text('Poids net total', tx, y);
  doc.text(`${net.toLocaleString('fr-FR')} kg`, W - M, y, { align: 'right' });
  setColor(doc, INK, 'draw');
  doc.setLineWidth(0.5);
  doc.line(tx, y + 2, W - M, y + 2);

  await drawVerificationBlock(doc, number, 'contract');
  footer(doc);
  if (!sharedDoc) triggerDownload(doc, `Liste-colisage-${number}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════════
// DÉCLARATION D'EXPORTATION SIMPLIFIÉE (DAU / EX1)
// ═══════════════════════════════════════════════════════════════════════════

export interface ExportDeclarationPdfData {
  number?: string;
  date?: string;
  exporter?: { name?: string; address?: string; eori?: string };
  recipient?: { name?: string; address?: string; country?: string };
  regime?: string;               // ex "Exportation définitive (régime 10)"
  customsOffice?: string;        // bureau de douane
  goods?: string;                // désignation marchandise
  hsCode?: string;
  value?: number;
  currency?: string;
  destinationCountry?: string;
}

export async function generateExportDeclarationPdf(data: ExportDeclarationPdfData, sharedDoc?: jsPDF): Promise<void> {
  const doc = sharedDoc ?? new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 14;

  const number = data.number ?? `EX1-${new Date().getFullYear()}-0001`;
  const date = data.date ?? new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const currency = data.currency ?? 'EUR';

  invoiceHeader(doc, 'Déclaration d\'exportation', `DAU / EX1 · ${number} · ${date}`);

  let y = 40;
  blockLabel(doc, 'EXPORTATEUR', M, y);
  blockLabel(doc, 'DESTINATAIRE', W / 2 + 4, y);
  y += 6;
  textLines(doc, [
    data.exporter?.name ?? 'Axis Import SAS',
    data.exporter?.address ?? '14 rue de la Logistique, 75015 Paris',
    `EORI : ${data.exporter?.eori ?? 'FR92548731200018'}`,
  ], M, y);
  textLines(doc, [
    data.recipient?.name ?? 'Sahel Trading SARL',
    data.recipient?.address ?? 'Zone portuaire, Dakar',
    `Pays : ${data.recipient?.country ?? data.destinationCountry ?? 'Sénégal'}`,
  ], W / 2 + 4, y);

  // Bloc régime / bureau
  y += 18;
  const half = (W - 2 * M - 6) / 2;
  const box = (label: string, value: string, x: number) => {
    setColor(doc, LINE, 'draw');
    doc.setLineWidth(0.3);
    doc.rect(x, y, half, 14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    setColor(doc, MUTED, 'text');
    doc.text(label, x + 3, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setColor(doc, INK, 'text');
    doc.text(doc.splitTextToSize(value, half - 6), x + 3, y + 10);
  };
  box('RÉGIME DOUANIER', data.regime ?? 'Exportation définitive (régime 10 00)', M);
  box('BUREAU DE DOUANE', data.customsOffice ?? 'Le Havre Port (FR LEH)', M + half + 6);

  // Marchandise
  y += 20;
  blockLabel(doc, 'MARCHANDISE', M, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setColor(doc, INK, 'text');
  doc.text(doc.splitTextToSize(data.goods ?? 'Pièces détachées automobiles et groupe électrogène', W - 2 * M), M, y);

  y += 10;
  const tx = M;
  kv(doc, 'Code SH (nomenclature)', data.hsCode ?? '8708.99', tx, y, W - M);
  y += 6;
  kv(doc, 'Pays de destination', data.destinationCountry ?? data.recipient?.country ?? 'Sénégal', tx, y, W - M);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setColor(doc, INK, 'text');
  doc.text('Valeur déclarée', tx, y);
  doc.text(`${EURO(data.value ?? 2380)} ${currency}`, W - M, y, { align: 'right' });
  setColor(doc, INK, 'draw');
  doc.setLineWidth(0.5);
  doc.line(tx, y + 2, W - M, y + 2);

  y += 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  setColor(doc, MUTED, 'text');
  doc.text(doc.splitTextToSize(
    'Déclaration simplifiée établie en vue de la sortie du territoire douanier de l\'Union. Document à présenter au bureau de douane d\'exportation.',
    W - 2 * M,
  ), M, y);

  await drawVerificationBlock(doc, number, 'contract');
  footer(doc);
  if (!sharedDoc) triggerDownload(doc, `Declaration-export-${number}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════════
// ATTESTATION D'ASSURANCE TRANSPORT
// ═══════════════════════════════════════════════════════════════════════════

export interface InsuranceCertificatePdfData {
  number?: string;
  date?: string;
  insurer?: string;
  policyNumber?: string;
  insured?: string;             // assuré (client / Axis)
  goods?: string;               // marchandise assurée
  coverageAmount?: number;      // plafond
  currency?: string;
  route?: string;               // trajet
  validFrom?: string;
  validTo?: string;
}

export async function generateInsuranceCertificatePdf(data: InsuranceCertificatePdfData, sharedDoc?: jsPDF): Promise<void> {
  const doc = sharedDoc ?? new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 14;

  const number = data.number ?? `ASS-${new Date().getFullYear()}-0001`;
  const date = data.date ?? new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const currency = data.currency ?? 'EUR';

  invoiceHeader(doc, 'Attestation d\'assurance', `Transport · ${number}`);

  let y = 42;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  setColor(doc, INK, 'text');
  doc.text(doc.splitTextToSize(
    `${data.insurer ?? 'AXA Transport & Logistique'} atteste que la marchandise désignée ci-dessous est couverte pendant toute la durée de son transport, conformément aux conditions générales de la police n° ${data.policyNumber ?? 'TRP-2026-44821'}.`,
    W - 2 * M,
  ), M, y);

  y += 18;
  const tx = M;
  const row = (label: string, value: string) => {
    kv(doc, label, value, tx, y, W - M);
    y += 7;
    setColor(doc, LINE_SOFT, 'draw');
    doc.setLineWidth(0.2);
    doc.line(M, y - 2.5, W - M, y - 2.5);
  };
  row('Assureur', data.insurer ?? 'AXA Transport & Logistique');
  row('N° de police', data.policyNumber ?? 'TRP-2026-44821');
  row('Assuré', data.insured ?? 'Axis Import SAS pour le compte de qui il appartiendra');
  row('Marchandise assurée', data.goods ?? 'Pièces détachées et matériel — 513 kg');
  row('Trajet couvert', data.route ?? 'Le Havre (FR) → Dakar (SN), maritime');
  row('Validité', `${data.validFrom ?? date} au ${data.validTo ?? '31 décembre 2026'}`);

  // Plafond mis en avant
  y += 4;
  setColor(doc, INK, 'fill');
  doc.roundedRect(M, y, W - 2 * M, 16, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('PLAFOND DE GARANTIE', M + 4, y + 6.5);
  doc.setFontSize(15);
  doc.text(`${EURO(data.coverageAmount ?? 25000)} ${currency}`, W - M - 4, y + 10.5, { align: 'right' });

  y += 24;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  setColor(doc, MUTED, 'text');
  doc.text(doc.splitTextToSize(
    'Garantie « tous risques transport » (clauses Institute Cargo Clauses A), sous réserve des exclusions des conditions générales. Attestation délivrée à titre justificatif.',
    W - 2 * M,
  ), M, y);

  await drawVerificationBlock(doc, number, 'contract');
  footer(doc);
  if (!sharedDoc) triggerDownload(doc, `Attestation-assurance-${number}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════════
// MANDAT DE DÉDOUANEMENT (avec zone de signature client)
// ═══════════════════════════════════════════════════════════════════════════

export interface CustomsMandatePdfData {
  number?: string;
  date?: string;
  principal?: { name?: string; address?: string };   // mandant = client
  agent?: string;                                     // mandataire = Axis / commissionnaire
  scope?: string;                                     // étendue du mandat
  destinationCountry?: string;
  signatureDataUrl?: string;                          // signature client (data URL)
  signedDate?: string;
}

export async function generateCustomsMandatePdf(data: CustomsMandatePdfData, sharedDoc?: jsPDF): Promise<void> {
  const doc = sharedDoc ?? new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 14;

  const number = data.number ?? `MND-${new Date().getFullYear()}-0001`;
  const date = data.date ?? new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  invoiceHeader(doc, 'Mandat de dédouanement', `${number} · ${date}`);

  let y = 42;
  blockLabel(doc, 'LE MANDANT (CLIENT)', M, y);
  y += 6;
  y = textLines(doc, [
    data.principal?.name ?? 'Sahel Trading SARL',
    data.principal?.address ?? 'Zone portuaire, Dakar',
  ], M, y);

  y += 4;
  blockLabel(doc, 'DONNE MANDAT À', M, y);
  y += 6;
  y = textLines(doc, [
    data.agent ?? 'Axis Import SAS — commissionnaire en douane agréé',
    '14 rue de la Logistique, 75015 Paris · agrément n° FR-OEA-2025-1182',
  ], M, y);

  // Étendue
  y += 6;
  blockLabel(doc, 'ÉTENDUE DU MANDAT', M, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setColor(doc, INK, 'text');
  doc.text(doc.splitTextToSize(
    data.scope
      ?? `Le mandant autorise le mandataire à accomplir en son nom et pour son compte l'ensemble des formalités douanières (déclaration, paiement des droits et taxes, enlèvement) relatives à l'opération à destination de ${data.destinationCountry ?? 'Sénégal'}, ainsi qu'à le représenter auprès de l'administration des douanes.`,
    W - 2 * M,
  ), M, y);

  // Clauses
  y += 24;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setColor(doc, MUTED, 'text');
  doc.text(doc.splitTextToSize(
    'Le présent mandat est consenti pour la durée de l\'opération. Le mandant déclare exactes les informations transmises et demeure responsable de la véracité des éléments déclarés. Le mandataire est tenu à une obligation de moyens et de confidentialité.',
    W - 2 * M,
  ), M, y);

  // Zone de signature
  y += 26;
  setColor(doc, INK, 'draw');
  doc.setLineWidth(0.3);
  doc.line(M, y - 4, W - M, y - 4);

  const halfW = (W - 2 * M - 10) / 2;
  signatureBox(doc, 'POUR AXIS IMPORT (MANDATAIRE)', M, y, halfW, '✓ Signé');

  // Signature client (image si fournie)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  setColor(doc, MUTED, 'text');
  doc.text('LE MANDANT — « Bon pour mandat »', M + halfW + 10, y);
  setColor(doc, INK, 'draw');
  doc.rect(M + halfW + 10, y + 2, halfW, 20);
  if (data.signatureDataUrl) {
    try {
      doc.addImage(data.signatureDataUrl, 'PNG', M + halfW + 12, y + 3, halfW - 4, 16);
    } catch {
      /* ignore image errors */
    }
  }
  if (data.signedDate) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    setColor(doc, MUTED, 'text');
    doc.text(`Signé le ${data.signedDate}`, M + halfW + 10, y + 26);
  }

  await drawVerificationBlock(doc, number, 'contract');
  footer(doc);
  if (!sharedDoc) triggerDownload(doc, `Mandat-dedouanement-${number}.pdf`);
}

// ════════════════════════════════════════════════════════════════════════
//  DOSSIER COMPLET — un seul PDF multi-pages
//  Les navigateurs (surtout Safari iOS) bloquent les téléchargements
//  multiples successifs. On assemble donc tous les documents générables
//  dans un unique PDF, téléchargé en une fois.
// ════════════════════════════════════════════════════════════════════════

export type DossierGenerator =
  | 'commercialInvoice'
  | 'proformaInvoice'
  | 'packingList'
  | 'exportDeclaration'
  | 'insuranceCertificate'
  | 'customsMandate'
  | 'contract';

export interface DossierItem {
  generator: DossierGenerator;
  data: any;
}

// Associe une clé de générateur à sa fonction (rend dans le doc partagé).
async function renderInto(doc: jsPDF, item: DossierItem): Promise<void> {
  switch (item.generator) {
    case 'commercialInvoice':
    case 'proformaInvoice':
      await generateCommercialInvoicePdf(item.data, doc);
      break;
    case 'packingList':
      await generatePackingListPdf(item.data, doc);
      break;
    case 'exportDeclaration':
      await generateExportDeclarationPdf(item.data, doc);
      break;
    case 'insuranceCertificate':
      await generateInsuranceCertificatePdf(item.data, doc);
      break;
    case 'customsMandate':
      await generateCustomsMandatePdf(item.data, doc);
      break;
    case 'contract':
      await generateContractPdf(item.data, doc);
      break;
  }
}

/**
 * Génère un dossier complet : tous les documents fournis dans un seul PDF
 * multi-pages, téléchargé une seule fois. Renvoie le nombre de documents
 * effectivement rendus.
 */
export async function generateDossierPdf(
  items: DossierItem[],
  filename = 'Dossier-Axis.pdf',
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  if (items.length === 0) return 0;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let rendered = 0;
  for (let i = 0; i < items.length; i += 1) {
    if (i > 0) doc.addPage();
    try {
      // eslint-disable-next-line no-await-in-loop
      await renderInto(doc, items[i]);
      rendered += 1;
    } catch {
      // En cas d'échec sur un document, on continue les autres.
    }
    onProgress?.(i + 1, items.length);
  }
  triggerDownload(doc, filename);
  return rendered;
}

// ════════════════════════════════════════════════════════════════════════
//  ÉTIQUETTE D'EXPÉDITION — à coller sur le colis
//  Style transporteur : référence énorme, QR scannable, blocs exp./dest.
// ════════════════════════════════════════════════════════════════════════

export interface ShippingLabelData {
  reference: string;
  fromName?: string;
  fromCity?: string;
  toName?: string;
  toCity?: string;
  toCountry?: string;
  weightKg?: number;
  transportMode?: 'AIR' | 'SEA' | 'ROAD';
  pickupMode?: string;
}

export async function generateShippingLabelPdf(data: ShippingLabelData): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 20;
  const labelW = W - 2 * M;
  const labelH = 130;
  const top = 30;

  // Traits de découpe
  setColor(doc, MUTED, 'draw');
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([2, 2], 0);
  doc.rect(M - 4, top - 4, labelW + 8, labelH + 8);
  doc.setLineDashPattern([], 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  setColor(doc, MUTED, 'text');
  doc.text('Découper et coller sur le colis, référence et QR visibles.', M - 4, top - 7);

  // Cadre étiquette
  setColor(doc, INK, 'draw');
  doc.setLineWidth(0.8);
  doc.rect(M, top, labelW, labelH);

  // Bandeau haut : logo + AXIS IMPORT + mode
  drawAxisLogo(doc, M + 4, top + 4, 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  setColor(doc, INK, 'text');
  doc.text('AXIS IMPORT', M + 19, top + 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  setColor(doc, MUTED, 'text');
  doc.text('TRANSPORT · CONVOYAGE', M + 19, top + 14);
  const modeLabel = data.transportMode === 'SEA' ? 'MARITIME' : data.transportMode === 'ROAD' ? 'ROUTIER' : 'AÉRIEN';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setColor(doc, INK, 'text');
  doc.text(modeLabel, M + labelW - 4, top + 10, { align: 'right' });
  setColor(doc, INK, 'draw');
  doc.setLineWidth(0.5);
  doc.line(M, top + 18, M + labelW, top + 18);

  // Référence énorme
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  setColor(doc, INK, 'text');
  doc.text(data.reference, M + 6, top + 32);

  // QR code à droite
  try {
    const qr = await QRCode.toDataURL(JSON.stringify({ ref: data.reference }), { width: 300, margin: 0, color: { dark: INK, light: '#FFFFFFFF' } });
    doc.addImage(qr, 'PNG', M + labelW - 42, top + 22, 36, 36);
  } catch { /* sans QR si échec */ }

  // Blocs expéditeur / destinataire
  let y = top + 46;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  setColor(doc, MUTED, 'text');
  doc.text('EXPÉDITEUR', M + 6, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  setColor(doc, INK, 'text');
  doc.text(`${data.fromName ?? 'Client Axis'} · ${data.fromCity ?? 'France'}`, M + 6, y + 5.5);

  y += 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  setColor(doc, MUTED, 'text');
  doc.text('DESTINATAIRE', M + 6, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  setColor(doc, INK, 'text');
  doc.text(data.toName ?? 'Destinataire', M + 6, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text(`${data.toCity ?? ''}${data.toCountry ? ` · ${data.toCountry}` : ''}`.trim(), M + 6, y + 14);

  // Pied d'étiquette : poids + remise + date
  const fy = top + labelH - 10;
  setColor(doc, INK, 'draw');
  doc.setLineWidth(0.5);
  doc.line(M, fy - 6, M + labelW, fy - 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  setColor(doc, INK, 'text');
  doc.text(data.weightKg ? `${data.weightKg} kg` : 'Poids : —', M + 6, fy);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  setColor(doc, MUTED, 'text');
  if (data.pickupMode) doc.text(data.pickupMode, M + labelW / 2, fy, { align: 'center' });
  doc.text(new Date().toLocaleDateString('fr-FR'), M + labelW - 6, fy, { align: 'right' });

  // Instructions sous l'étiquette
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  setColor(doc, MUTED, 'text');
  doc.text(doc.splitTextToSize(
    'Présente cette étiquette (papier ou écran) lors du dépôt en hub, en point relais ou au passage du transporteur. Le QR contient ta référence de suivi.',
    labelW,
  ), M, top + labelH + 14);

  footer(doc);
  triggerDownload(doc, `Etiquette-${data.reference}.pdf`);
}
