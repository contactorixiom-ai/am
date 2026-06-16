// Génération de PDF côté client — factures et contrats de convoyage.
// Fonctionne sur tous navigateurs modernes (Safari iOS inclus) : jsPDF
// produit un Blob, on déclenche le téléchargement via <a download>.
import { jsPDF } from 'jspdf';

const NAVY = '#0B2545';
const GOLD = '#C9A55C';
const INK = '#1B1B1F';
const MUTED = '#6F6E6B';
const LINE = '#E5DDC8';
const LINE_DARK = '#1B1B1F';

// ─── Logo AXIS (vector) ───────────────────────────────────────────────────

function drawAxisLogo(doc: jsPDF, x: number, y: number, size = 8) {
  // Cercle doré + "A" stylisé
  doc.setFillColor(NAVY);
  doc.circle(x + size / 2, y + size / 2, size / 2, 'F');
  doc.setDrawColor(GOLD);
  doc.setLineWidth(0.4);
  doc.circle(x + size / 2, y + size / 2, size / 2 - 0.4, 'S');
  // Trait stylisé central
  doc.setLineWidth(0.6);
  doc.line(x + size * 0.32, y + size * 0.7, x + size * 0.5, y + size * 0.32);
  doc.line(x + size * 0.5, y + size * 0.32, x + size * 0.68, y + size * 0.7);
  doc.line(x + size * 0.4, y + size * 0.56, x + size * 0.6, y + size * 0.56);
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
  setColor(doc, NAVY, 'fill');
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 28, 'F');

  drawAxisLogo(doc, 14, 9, 10);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  setColor(doc, GOLD, 'text');
  doc.text('AXIS IMPORT', 28, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('TRANSPORT · CONVOYAGE', 28, 19);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setColor(doc, GOLD, 'text');
  const titleW = doc.getTextWidth(title);
  doc.text(title, doc.internal.pageSize.getWidth() - 14 - titleW, 14);

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    const subW = doc.getTextWidth(subtitle);
    doc.text(subtitle, doc.internal.pageSize.getWidth() - 14 - subW, 19);
  }
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

export function generateInvoicePdf(data: InvoicePdfData): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
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
  setColor(doc, GOLD, 'draw');
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
  setColor(doc, NAVY, 'fill');
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
  setColor(doc, NAVY, 'text');
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

  footer(doc);
  triggerDownload(doc, `${data.number}.pdf`);
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

const DAMAGE_COLOR: Record<string, string> = {
  R: '#C9A55C', F: '#E0A04D', E: '#D97A4E', C: '#C0524B', M: '#8E5BAE',
};

const VEHICLE_CATEGORIES = [
  'Citadine', 'Berline', 'Break', 'Coupé', 'Monospace', 'SUV', '4×4', 'Utilitaire',
  'Camping-car', 'Poids lourd', 'Moto', 'Élec.', 'Hybride', 'Luxe', 'Collection',
];

export function generateContractPdf(data: ContractPdfData): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
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
  setColor(doc, LINE_DARK, 'draw');
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
    drawCheckbox(doc, M + i * colW, y - 2.5, 2.5, cat === data.vehicleCategory);
    doc.text(cat, M + i * colW + 4, y);
  });
  y += 4;
  col2.forEach((cat, i) => {
    drawCheckbox(doc, M + i * colW, y - 2.5, 2.5, cat === data.vehicleCategory);
    doc.text(cat, M + i * colW + 4, y);
  });
  y += 4;
  drawCheckbox(doc, M, y - 2.5, 2.5, false);
  doc.text('Autre :', M + 4, y);
  doc.setDrawColor(180);
  doc.setLineWidth(0.2);
  doc.line(M + 16, y, W - M, y);

  y += 3;
  setColor(doc, LINE_DARK, 'draw');
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
  setColor(doc, LINE_DARK, 'draw');
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
  setColor(doc, LINE_DARK, 'draw');
  doc.setLineWidth(0.3);
  doc.line(M, y, W - M, y);

  const cat = (data.vehicleCategory ?? '').toLowerCase();
  const isVan = cat.includes('utilit') || cat.includes('camping') || cat.includes('poids');

  // ─── ÉTAT DES LIEUX — DÉPART ────────────────────────────────────────────
  y = drawEtatDesLieux(doc, y + 1, 'DÉPART', isVan, {
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
  y = drawEtatDesLieux(doc, y + 1, 'ARRIVÉE', isVan, {
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

  triggerDownload(doc, `Contrat-Axis-${data.reference || 'demo'}.pdf`);
}

// ─── Sous-blocs ───────────────────────────────────────────────────────────

function drawCheckbox(doc: jsPDF, x: number, y: number, size: number, checked: boolean) {
  setColor(doc, INK, 'draw');
  doc.setLineWidth(0.25);
  doc.rect(x, y, size, size);
  if (checked) {
    setColor(doc, NAVY, 'fill');
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
function drawCarTopVector(doc: jsPDF, x: number, y: number, w: number, h: number, isVan: boolean, damages: PdfDamage[]) {
  // Le repère "top" sert au schéma ; les autres vues sont listées en légende.
  const topDamages = damages.filter((d) => d.view === 'top');
  const otherDamages = damages.filter((d) => d.view !== 'top');

  // Cadre du véhicule (vue de dessus) centré
  const carW = w * 0.5;
  const carH = h * 0.82;
  const cx = x + w * 0.32;
  const cy = y + h / 2;
  const left = cx - carW / 2;
  const top = cy - carH / 2;

  setColor(doc, NAVY, 'draw');
  doc.setLineWidth(0.5);
  // Carrosserie arrondie
  doc.roundedRect(left, top, carW, carH, 6, 6, 'S');
  // Pare-brise / lunette
  setColor(doc, LINE, 'draw');
  doc.setLineWidth(0.3);
  doc.line(left + 2, top + carH * 0.22, left + carW - 2, top + carH * 0.22);
  doc.line(left + 2, top + carH * 0.74, left + carW - 2, top + carH * 0.74);
  // Toit
  doc.roundedRect(left + carW * 0.18, top + carH * 0.30, carW * 0.64, carH * 0.40, 2, 2, 'S');
  if (isVan) {
    // Caisson cargo : trait supplémentaire
    doc.line(left + 2, top + carH * 0.5, left + carW - 2, top + carH * 0.5);
  }

  // Repères dommages (sur la vue de dessus)
  topDamages.forEach((dmg) => {
    const px = left + dmg.x * carW;
    const py = top + dmg.y * carH;
    setColor(doc, DAMAGE_COLOR[dmg.code] ?? GOLD, 'fill');
    doc.circle(px, py, 2.4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5);
    doc.text(dmg.code, px, py + 1, { align: 'center' });
  });

  // Légende des dommages des autres vues (avant/arrière/côtés)
  const lx = x + w * 0.66;
  let ly = y + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  setColor(doc, MUTED, 'text');
  if (otherDamages.length > 0) {
    doc.text('AUTRES VUES', lx, ly);
    ly += 3.5;
    const viewLabel: Record<string, string> = { front: 'Avant', rear: 'Arr.', left: 'Gauche', right: 'Droite', top: 'Dessus' };
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    otherDamages.slice(0, 10).forEach((dmg) => {
      setColor(doc, DAMAGE_COLOR[dmg.code] ?? GOLD, 'fill');
      doc.circle(lx + 1, ly - 1, 1.6, 'F');
      setColor(doc, INK, 'text');
      doc.text(`${dmg.code} · ${viewLabel[dmg.view]}`, lx + 4, ly);
      ly += 3.2;
    });
  } else if (damages.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6);
    setColor(doc, MUTED, 'text');
    doc.text('Aucun', lx, ly + 2);
    doc.text('dommage', lx, ly + 5);
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

function drawEtatDesLieux(doc: jsPDF, y: number, label: 'DÉPART' | 'ARRIVÉE', isVan: boolean, d: EtatDesLieux): number {
  const W = doc.internal.pageSize.getWidth();
  const M = 8;

  // Bandeau navy
  setColor(doc, NAVY, 'fill');
  doc.rect(M, y, W - 2 * M, 5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`ÉTAT DES LIEUX — ${label}`, W / 2, y + 3.5, { align: 'center' });

  y += 5;

  // Zone à 2 colonnes :
  // gauche  : schéma véhicule vectoriel + repères de dommages
  // droite  : km / carburant / date / heure / observations / signatures
  const blockH = 76;
  const leftW = (W - 2 * M) * 0.45;
  const rightW = (W - 2 * M) * 0.55;
  setColor(doc, LINE_DARK, 'draw');
  doc.setLineWidth(0.3);
  doc.rect(M, y, leftW, blockH);
  doc.rect(M + leftW, y, rightW, blockH);

  // Schéma véhicule vectoriel (vue de dessus) + repères de dommages
  drawCarTopVector(doc, M + 4, y + 4, leftW - 8, blockH - 8, isVan, d.damages ?? []);

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
  setColor(doc, LINE_DARK, 'draw');
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
    setColor(doc, NAVY, 'fill');
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
  // Affichage type "0 ☐ ¼ ☐ ½ ☐ ¾ ☐ 1" avec celui correspondant rempli
  const labels = ['0', '¼', '½', '¾', '1'];
  const values = [0, 0.25, 0.5, 0.75, 1];
  let cx = x;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setColor(doc, INK, 'text');
  labels.forEach((label, i) => {
    if (i === 0 || i === labels.length - 1) {
      doc.text(label, cx, y + 4);
      cx += 4;
    }
    drawCheckbox(doc, cx, y + 1, 2.5, level === values[i]);
    cx += 5;
    if (i !== 0 && i !== labels.length - 1) {
      doc.text(label, cx - 4, y + 4);
    }
  });
  // Ligne sous-jacente
  setColor(doc, INK, 'draw');
  doc.setLineWidth(0.2);
  doc.line(x, y + 6, x + 32, y + 6);
}
