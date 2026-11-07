// Shipper's Declaration for Dangerous Goods (DGD) — IATA DGR 8.1.
// Le formulaire reprend la disposition IATA (figure 8.1.A, format en
// colonnes) : imprimé en noir et rouge sur fond blanc, marges verticales
// gauche et droite hachurées en diagonale ROUGE, entièrement en anglais.
// Deux exemplaires signés sont remis à la compagnie : le PDF les contient.
// La signature reste manuscrite (DGR 8.1.4.1 : signature tapée refusée).
import { jsPDF } from 'jspdf';
import { AXIS_LOGO_PDF } from './axisLogoPdf';
import { patchDoc } from './pdf';

// ─── Données ────────────────────────────────────────────────────────────────

export interface DgdItem {
  /** « UN 1266 » ou « ID 8000 ». */
  un: string;
  /** Proper Shipping Name (+ nom technique entre parenthèses si exigé). */
  name: string;
  /** Classe ou division, danger subsidiaire entre parenthèses : « 3 (8) ». */
  hazardClass: string;
  /** I, II, III ou vide (gaz, piles au lithium…). */
  packingGroup: string;
  /** Nombre et type d'emballages + quantité nette : « 1 Fibreboard box x 2 L ». */
  quantity: string;
  /** Instruction d'emballage : « 353 », « Y341 », « 966 II »… */
  packingInstruction: string;
  /** Autorisations, dispositions particulières : « A1 »… */
  authorization: string;
}

export type DgdLogo = 'iata' | 'axis' | 'none';

export interface DgdData {
  /** Nom, adresse et pays (en anglais) de l'expéditeur, une info par ligne. */
  shipper: string;
  consignee: string;
  awbNumber?: string;
  shipperReference?: string;
  /** Limites appliquées : avion passagers et cargo, ou cargo uniquement. */
  aircraft: 'PAX' | 'CAO';
  airportDeparture?: string;
  airportDestination?: string;
  radioactive: boolean;
  items: DgdItem[];
  handlingInfo?: string;
  signatoryName?: string;
  date?: string;
  /** 2 au minimum (DGR 8.1.2), 3 si la compagnie le demande. */
  copies: number;
  logo: DgdLogo;
}

// ─── Mise en forme anglaise et contrôles ───────────────────────────────────

function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘`]/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9']+/g, ' ')
    .trim();
}

// Pays tels que Roger les tape (français, codes ISO) → nom anglais.
const COUNTRY_EN: Record<string, string> = {
  france: 'FRANCE', fr: 'FRANCE',
  senegal: 'SENEGAL', sn: 'SENEGAL',
  "cote d'ivoire": "COTE D'IVOIRE", 'cote divoire': "COTE D'IVOIRE", ci: "COTE D'IVOIRE", 'ivory coast': "COTE D'IVOIRE",
  cameroun: 'CAMEROON', cameroon: 'CAMEROON', cm: 'CAMEROON',
  mali: 'MALI', ml: 'MALI',
  'burkina faso': 'BURKINA FASO', burkina: 'BURKINA FASO', bf: 'BURKINA FASO',
  guinee: 'GUINEA', guinea: 'GUINEA', gn: 'GUINEA',
  'guinee bissau': 'GUINEA-BISSAU', gw: 'GUINEA-BISSAU',
  'guinee equatoriale': 'EQUATORIAL GUINEA', gq: 'EQUATORIAL GUINEA',
  benin: 'BENIN', bj: 'BENIN',
  togo: 'TOGO', tg: 'TOGO',
  niger: 'NIGER', ne: 'NIGER',
  nigeria: 'NIGERIA', ng: 'NIGERIA',
  ghana: 'GHANA', gh: 'GHANA',
  gabon: 'GABON', ga: 'GABON',
  congo: 'CONGO', 'republique du congo': 'CONGO', 'congo brazzaville': 'CONGO', cg: 'CONGO',
  rdc: 'DEMOCRATIC REPUBLIC OF THE CONGO', 'republique democratique du congo': 'DEMOCRATIC REPUBLIC OF THE CONGO',
  'congo kinshasa': 'DEMOCRATIC REPUBLIC OF THE CONGO', cd: 'DEMOCRATIC REPUBLIC OF THE CONGO',
  tchad: 'CHAD', chad: 'CHAD', td: 'CHAD',
  centrafrique: 'CENTRAL AFRICAN REPUBLIC', 'republique centrafricaine': 'CENTRAL AFRICAN REPUBLIC', cf: 'CENTRAL AFRICAN REPUBLIC',
  mauritanie: 'MAURITANIA', mr: 'MAURITANIA',
  maroc: 'MOROCCO', ma: 'MOROCCO',
  algerie: 'ALGERIA', dz: 'ALGERIA',
  tunisie: 'TUNISIA', tn: 'TUNISIA',
  libye: 'LIBYA', ly: 'LIBYA',
  egypte: 'EGYPT', eg: 'EGYPT',
  madagascar: 'MADAGASCAR', mg: 'MADAGASCAR',
  comores: 'COMOROS', km: 'COMOROS',
  maurice: 'MAURITIUS', 'ile maurice': 'MAURITIUS', mu: 'MAURITIUS',
  djibouti: 'DJIBOUTI', dj: 'DJIBOUTI',
  rwanda: 'RWANDA', rw: 'RWANDA',
  burundi: 'BURUNDI', bi: 'BURUNDI',
  gambie: 'GAMBIA', gm: 'GAMBIA',
  'sierra leone': 'SIERRA LEONE', sl: 'SIERRA LEONE',
  liberia: 'LIBERIA', lr: 'LIBERIA',
  'cap vert': 'CABO VERDE', cv: 'CABO VERDE',
  angola: 'ANGOLA', ao: 'ANGOLA',
  kenya: 'KENYA', ke: 'KENYA',
  ethiopie: 'ETHIOPIA', et: 'ETHIOPIA',
  'afrique du sud': 'SOUTH AFRICA', za: 'SOUTH AFRICA',
  belgique: 'BELGIUM', be: 'BELGIUM',
  allemagne: 'GERMANY', de: 'GERMANY',
  espagne: 'SPAIN', es: 'SPAIN',
  italie: 'ITALY', it: 'ITALY',
  suisse: 'SWITZERLAND', ch: 'SWITZERLAND',
  'pays bas': 'NETHERLANDS', nl: 'NETHERLANDS',
  'royaume uni': 'UNITED KINGDOM', angleterre: 'UNITED KINGDOM', uk: 'UNITED KINGDOM', gb: 'UNITED KINGDOM',
  luxembourg: 'LUXEMBOURG', lu: 'LUXEMBOURG',
  portugal: 'PORTUGAL', pt: 'PORTUGAL',
  'etats unis': 'UNITED STATES', usa: 'UNITED STATES', us: 'UNITED STATES',
  canada: 'CANADA', ca: 'CANADA',
  chine: 'CHINA', cn: 'CHINA',
  turquie: 'TURKIYE', tr: 'TURKIYE',
  'emirats arabes unis': 'UNITED ARAB EMIRATES', ae: 'UNITED ARAB EMIRATES',
  haiti: 'HAITI', ht: 'HAITI',
};

/** Pays en anglais, en capitales (« Sénégal » → « SENEGAL »). */
export function countryInEnglish(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  return COUNTRY_EN[fold(s)] ?? fold(s).toUpperCase();
}

// Villes dont le nom anglais diffère du nom français.
const CITY_EN: Record<string, string> = {
  bruxelles: 'BRUSSELS', geneve: 'GENEVA', londres: 'LONDON', alger: 'ALGIERS',
  'le caire': 'CAIRO', anvers: 'ANTWERP', bale: 'BASEL', lisbonne: 'LISBON',
  varsovie: 'WARSAW', venise: 'VENICE', moscou: 'MOSCOW', 'le cap': 'CAPE TOWN',
  johannesbourg: 'JOHANNESBURG', 'addis abeba': 'ADDIS ABABA', ndjamena: "N'DJAMENA",
  "n'djamena": "N'DJAMENA",
};

/** Aéroport / ville en anglais, en capitales, sans accents. */
export function airportInEnglish(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  const f = fold(s);
  if (CITY_EN[f]) return CITY_EN[f];
  // Garde la ponctuation utile (parenthèses du code IATA, tirets).
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
}

const MONTHS_FR_EN: [RegExp, string][] = [
  [/janv(ier|\.)?/i, 'Jan'], [/f[ée]vr?(ier|\.)?/i, 'Feb'], [/mars/i, 'Mar'],
  [/avr(il|\.)?/i, 'Apr'], [/mai/i, 'May'], [/juin/i, 'Jun'], [/juil(let|\.)?/i, 'Jul'],
  [/ao[uû]t/i, 'Aug'], [/sept(embre|\.)?/i, 'Sep'], [/oct(obre|\.)?/i, 'Oct'],
  [/nov(embre|\.)?/i, 'Nov'], [/d[ée]c(embre|\.)?/i, 'Dec'],
];

/** Date en anglais : « 8 octobre 2026 » → « 8 Oct 2026 ». */
export function dateInEnglish(raw: string): string {
  let s = raw.trim();
  for (const [re, en] of MONTHS_FR_EN) s = s.replace(new RegExp(`\\b${re.source}`, 'i'), en);
  return s;
}

/** Date du jour au format anglais du formulaire : « 08 Oct 2026 ». */
export function todayInEnglish(now = new Date()): string {
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][now.getMonth()];
  return `${String(now.getDate()).padStart(2, '0')} ${m} ${now.getFullYear()}`;
}

/** « 1266 », « un1266 », « UN-1266 » → « UN 1266 » ; vide si illisible. */
export function normalizeUnNumber(raw: string): string {
  const s = raw.trim().toUpperCase().replace(/[\s-]+/g, '');
  const m = /^(UN|ID)?(\d{4})$/.exec(s);
  if (!m) return raw.trim().toUpperCase();
  return `${m[1] ?? 'UN'} ${m[2]}`;
}

export function isValidUnNumber(s: string): boolean {
  return /^(UN|ID) \d{4}$/.test(s);
}

// « 3 », « 6.1 », « 1.4S », « 3 (8) », « 8 (6.1, 3) ».
const HAZARD_CLASS_RE = /^[1-9](\.[1-6])?[A-S]?(\s*\(\s*[1-9](\.[1-6])?(\s*,\s*[1-9](\.[1-6])?)*\s*\))?$/i;

export function isValidHazardClass(s: string): boolean {
  return HAZARD_CLASS_RE.test(s.trim());
}

// Mots français fréquents dans une saisie de marchandises dangereuses.
const FRENCH_WORDS = /\b(parfums?|batterie|peintures?|bo[iî]tes?|bidons?|f[uû]ts?|bouteilles?|colis|produits?|liquides?|mati[eè]res?|a[ée]rosols?|gaz|et|avec|sans|pour)\b/i;
const ACCENTS = /[àâäçéèêëîïôöùûüÿœæ]/i;

/** Raison pour laquelle le texte n'est pas en anglais, ou null. */
export function notEnglishReason(s: string): string | null {
  if (!s.trim()) return null;
  if (ACCENTS.test(s)) return 'accents français détectés';
  const m = FRENCH_WORDS.exec(s);
  if (m) return `mot français « ${m[0]} »`;
  return null;
}

// ─── Dessin ─────────────────────────────────────────────────────────────────

const RED: [number, number, number] = [200, 16, 46];

const PAGE = { W: 210, H: 297 };
const FX = 17;               // bord gauche du formulaire
const FW = 176;              // largeur du formulaire
const FR = FX + FW;          // bord droit
const LW = 96;               // colonne gauche (Shipper, Consignee, transport)
const SPLIT = FX + LW;

const Y = {
  top: 22,          // haut de la grille
  consignee: 51,
  twoCopies: 80,
  transport: 87,
  transportSub: 93,
  destination: 113,
  goodsTitle: 124,
  tableHead: 131,
  tableHeadCols: 136,
  body: 145,
  handling: 222,
  declaration: 244,
  bottom: 278,
};

const COLS = [
  { key: 'un', w: 17 },
  { key: 'name', w: 54 },
  { key: 'hazardClass', w: 22 },
  { key: 'packingGroup', w: 13 },
  { key: 'quantity', w: 38 },
  { key: 'packingInstruction', w: 14 },
  { key: 'authorization', w: 18 },
] as const;

const DECLARATION_TEXT =
  'I hereby declare that the contents of this consignment are fully and accurately described above by the proper ' +
  'shipping name, and are classified, packaged, marked and labelled/placarded, and are in all respects in proper ' +
  'condition for transport according to applicable international and national governmental regulations. ' +
  'I declare that all of the applicable air transport requirements have been met.';

const WARNING_TEXT =
  'Failure to comply in all respects with the applicable Dangerous Goods Regulations may be in breach of ' +
  'the applicable law, subject to legal penalties.';

function setFont(doc: jsPDF, style: 'normal' | 'bold' | 'italic' | 'bolditalic', size: number) {
  doc.setFont('helvetica', style);
  doc.setFontSize(size);
  doc.setTextColor(0, 0, 0);
}

/** Hachures diagonales rouges d'une marge verticale (exigence DGR). */
function drawHatching(doc: jsPDF, x: number, y0: number, y1: number) {
  const w = 4.6;      // largeur de la bande
  const h = 7.4;      // hauteur d'un trait
  const slope = 2.6;  // décalage vertical du bord biseauté
  const period = 10.4;
  doc.setFillColor(...RED);
  for (let y = y0; y + slope + h <= y1 + 0.01; y += period) {
    doc.lines([[w, slope], [0, h], [-w, -slope]], x, y, [1, 1], 'F', true);
  }
}

/** Marque IATA : globe quadrillé, ailes, sigle en capitales italiques. */
function drawIataMark(doc: jsPDF, cx: number, top: number, width: number) {
  const r = width * 0.15;
  const gy = top + r;               // centre du globe
  doc.setFillColor(0, 0, 0);
  // Ailes : trois plumes par côté, de plus en plus courtes vers le bas.
  for (let i = 0; i < 3; i++) {
    const t = r * 0.3;
    const yt = gy - r * 0.05 + i * r * 0.42;
    const inner = r * 0.92;
    const outer = r * (2.85 - i * 0.48);
    const cut = t * 0.9;
    doc.lines([[-(outer - inner), 0], [cut, t], [outer - inner - cut, 0]], cx - inner, yt, [1, 1], 'F', true);
    doc.lines([[outer - inner, 0], [-cut, t], [-(outer - inner - cut), 0]], cx + inner, yt, [1, 1], 'F', true);
  }
  // Globe plein, liseré blanc pour le détacher des ailes, quadrillage blanc.
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(r * 0.16);
  doc.circle(cx, gy, r, 'FD');
  doc.setLineWidth(r * 0.07);
  doc.line(cx - r, gy, cx + r, gy);
  for (const k of [-0.5, 0.5]) {
    const dy = r * k;
    const half = Math.sqrt(r * r - dy * dy);
    doc.line(cx - half, gy + dy, cx + half, gy + dy);
  }
  doc.line(cx, gy - r, cx, gy + r);
  doc.ellipse(cx, gy, r * 0.5, r, 'S');
  // Sigle
  doc.setFont('helvetica', 'bolditalic');
  doc.setTextColor(0, 0, 0);
  let size = 20;
  doc.setFontSize(size);
  const target = width * 0.78;
  const w0 = doc.getTextWidth('IATA');
  size = (size * target) / w0;
  doc.setFontSize(size);
  doc.text('IATA', cx, gy + r * 1.35 + size * 0.3528 * 0.72, { align: 'center' });
}

function drawLogo(doc: jsPDF, logo: DgdLogo) {
  if (logo === 'iata') {
    drawIataMark(doc, FR - 9, 6.5, 17);
  } else if (logo === 'axis') {
    try {
      doc.addImage(AXIS_LOGO_PDF, 'PNG', FR - 13, 6, 13, 13, undefined, 'FAST');
    } catch { /* logo indisponible : en-tête sans logo */ }
  }
}

/**
 * Biffe une case non applicable (« delete non-applicable ») : une rangée de X
 * tapée sur chaque ligne du libellé, comme à la machine sur le formulaire.
 */
function strikeLines(doc: jsPDF, x: number, w: number, baselines: number[], size: number) {
  setFont(doc, 'bold', size);
  const unit = doc.getTextWidth('X');
  const n = Math.max(3, Math.floor((w - 1.2) / unit));
  baselines.forEach((b) => doc.text('X'.repeat(n), x + w / 2, b + size * 0.3528 * 0.12, { align: 'center' }));
}

/** Texte multiligne qui tient dans une case : réduit la police si besoin. */
function fitText(
  doc: jsPDF, text: string, x: number, y: number, w: number, maxH: number,
  sizes: number[] = [9, 8.5, 8, 7.5, 7],
) {
  if (!text.trim()) return;
  for (const size of sizes) {
    setFont(doc, 'normal', size);
    const lh = size * 0.3528 * 1.18;
    const lines = doc.splitTextToSize(text, w) as string[];
    if (lines.length * lh <= maxH || size === sizes[sizes.length - 1]) {
      const max = Math.max(1, Math.floor(maxH / lh));
      doc.text(lines.slice(0, max), x, y, { lineHeightFactor: 1.18 });
      return;
    }
  }
}

function lineH(size: number) {
  return size * 0.3528 * 1.18;
}

// Mesure d'une ligne du tableau (hauteur en mm à 8,5 pt).
const BODY_SIZE = 8.5;

function cellLines(doc: jsPDF, item: DgdItem): string[][] {
  setFont(doc, 'normal', BODY_SIZE);
  return COLS.map((c) => doc.splitTextToSize((item[c.key] ?? '').trim(), c.w - 3) as string[]);
}

function itemHeight(doc: jsPDF, item: DgdItem): number {
  const lines = cellLines(doc, item);
  return Math.max(1, ...lines.map((l) => l.length)) * lineH(BODY_SIZE) + 2.6;
}

/** Répartit les marchandises sur des pages de déclaration. */
function paginate(doc: jsPDF, items: DgdItem[]): DgdItem[][] {
  const capacity = Y.handling - Y.body - 4;
  const pages: DgdItem[][] = [[]];
  let used = 0;
  for (const it of items) {
    const h = itemHeight(doc, it);
    if (used + h > capacity && pages[pages.length - 1].length > 0) {
      pages.push([]);
      used = 0;
    }
    pages[pages.length - 1].push(it);
    used += h;
  }
  return pages;
}

function drawPage(doc: jsPDF, data: DgdData, items: DgdItem[], pageNo: number, pageCount: number) {
  // Marges hachurées rouges, sur toute la hauteur du formulaire.
  drawHatching(doc, 7.5, 6, 290);
  drawHatching(doc, PAGE.W - 7.5 - 4.6, 6, 290);

  // Titre + logo
  setFont(doc, 'bold', 10.5);
  doc.text("SHIPPER'S DECLARATION FOR DANGEROUS GOODS", FX, Y.top - 2.5);
  drawLogo(doc, data.logo);

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);

  // ── Bloc haut ────────────────────────────────────────────────────────────
  doc.rect(FX, Y.top, FW, Y.goodsTitle - Y.top);
  doc.line(SPLIT, Y.top, SPLIT, Y.goodsTitle);
  doc.line(FX, Y.consignee, FR, Y.consignee);
  doc.line(FX, Y.twoCopies, FR, Y.twoCopies);
  doc.line(FX, Y.transport, SPLIT, Y.transport);
  doc.line(FX, Y.transportSub, SPLIT, Y.transportSub);
  doc.line(FX, Y.destination, SPLIT, Y.destination);

  // Shipper
  setFont(doc, 'bold', 9);
  doc.text('Shipper', FX + 2, Y.top + 4.5);
  fitText(doc, data.shipper, FX + 3, Y.top + 9.5, LW - 6, Y.consignee - Y.top - 10.5);

  // Air Waybill / Page / Shipper's Reference
  const rx = SPLIT + 2.5;
  setFont(doc, 'normal', 8);
  doc.text('Air Waybill No.', rx, Y.top + 5.5);
  setFont(doc, 'bold', 9.5);
  doc.text((data.awbNumber ?? '').trim(), rx + 23, Y.top + 5.5);
  setFont(doc, 'normal', 8);
  doc.text('Page', rx, Y.top + 13);
  doc.text('of', rx + 17, Y.top + 13);
  doc.text('Pages', rx + 32, Y.top + 13);
  setFont(doc, 'bold', 9.5);
  doc.text(String(pageNo), rx + 11, Y.top + 13, { align: 'center' });
  doc.text(String(pageCount), rx + 26, Y.top + 13, { align: 'center' });
  setFont(doc, 'normal', 8);
  doc.text("Shipper's Reference No.", rx, Y.top + 20.5);
  doc.text('(optional)', rx, Y.top + 24);
  setFont(doc, 'bold', 9);
  doc.text((data.shipperReference ?? '').trim(), rx + 36, Y.top + 20.5, { maxWidth: FR - rx - 37 });

  // Consignee
  setFont(doc, 'bold', 9);
  doc.text('Consignee', FX + 2, Y.consignee + 4.5);
  fitText(doc, data.consignee, FX + 3, Y.consignee + 9.5, LW - 6, Y.twoCopies - Y.consignee - 10.5);

  // Deux exemplaires
  setFont(doc, 'italic', 6.6);
  doc.text('Two completed and signed copies of this Declaration must be handed to the operator.', FX + 2, Y.twoCopies + 4.4);

  // Transport details
  setFont(doc, 'bold', 8.5);
  doc.text('TRANSPORT DETAILS', FX + 2, Y.transport + 4.4);

  const limW = 52;
  doc.line(FX + limW, Y.transportSub, FX + limW, Y.destination);
  setFont(doc, 'normal', 6.4);
  doc.text('This shipment is within the limitations', FX + 2, Y.transportSub + 3.4);
  doc.text('prescribed for:', FX + 2, Y.transportSub + 6.2);
  doc.text('(delete non-applicable)', FX + 2, Y.transportSub + 9.6);

  const boxY = Y.destination - 8.5;
  const boxW = (limW - 2) / 2;
  const paxX = FX + 1;
  const caoX = FX + 1 + boxW;
  doc.rect(paxX, boxY, boxW, 7.5);
  doc.rect(caoX, boxY, boxW, 7.5);
  setFont(doc, 'bold', 5.9);
  doc.text('PASSENGER AND', paxX + boxW / 2, boxY + 3.1, { align: 'center' });
  doc.text('CARGO AIRCRAFT', paxX + boxW / 2, boxY + 5.9, { align: 'center' });
  doc.text('CARGO', caoX + boxW / 2, boxY + 3.1, { align: 'center' });
  doc.text('AIRCRAFT ONLY', caoX + boxW / 2, boxY + 5.9, { align: 'center' });
  if (data.aircraft === 'PAX') strikeLines(doc, caoX, boxW, [boxY + 3.1, boxY + 5.9], 7.6);
  else strikeLines(doc, paxX, boxW, [boxY + 3.1, boxY + 5.9], 7.6);

  setFont(doc, 'normal', 8);
  doc.text('Airport of Departure (optional):', FX + limW + 2, Y.transportSub + 4);
  setFont(doc, 'bold', 9.5);
  fitText(doc, (data.airportDeparture ?? '').trim(), FX + limW + 2.5, Y.transportSub + 11, LW - limW - 5, 8, [9.5, 8.5, 7.5]);

  setFont(doc, 'normal', 8);
  doc.text('Airport of Destination (optional):', FX + 2, Y.destination + 4);
  fitText(doc, (data.airportDestination ?? '').trim(), FX + 8, Y.destination + 8.8, LW - 10, 4.5, [9.5, 8.5, 7.5]);

  // WARNING
  setFont(doc, 'bold', 9);
  doc.text('WARNING', rx, Y.twoCopies + 5.5);
  setFont(doc, 'bold', 8.2);
  doc.text(WARNING_TEXT, rx, Y.twoCopies + 11.5, { maxWidth: FR - rx - 2.5, align: 'justify', lineHeightFactor: 1.25 });

  // Shipment type
  const stY = Y.goodsTitle - 12;
  doc.line(SPLIT, stY, FR, stY);
  setFont(doc, 'normal', 8);
  doc.text('Shipment type:', rx, stY + 4.2);
  setFont(doc, 'italic', 8);
  doc.text('(delete non-applicable)', rx + doc.getTextWidth('Shipment type: ') + 1.2, stY + 4.2);
  const stBoxY = stY + 5.6;
  const stBoxW = 29;
  const nrX = SPLIT + (FR - SPLIT) / 2 - stBoxW;
  const raX = nrX + stBoxW;
  doc.rect(nrX, stBoxY, stBoxW, 5.6);
  doc.rect(raX, stBoxY, stBoxW, 5.6);
  setFont(doc, 'bold', 7.4);
  doc.text('NON-RADIOACTIVE', nrX + stBoxW / 2, stBoxY + 3.9, { align: 'center' });
  doc.text('RADIOACTIVE', raX + stBoxW / 2, stBoxY + 3.9, { align: 'center' });
  if (data.radioactive) strikeLines(doc, nrX, stBoxW, [stBoxY + 3.9], 9);
  else strikeLines(doc, raX, stBoxW, [stBoxY + 3.9], 9);

  // ── Nature et quantité ─────────────────────────────────────────────────────
  doc.rect(FX, Y.goodsTitle, FW, Y.tableHead - Y.goodsTitle);
  setFont(doc, 'bold', 9);
  doc.text('NATURE AND QUANTITY OF DANGEROUS GOODS', FX + 2, Y.goodsTitle + 4.8);

  // En-têtes de colonnes
  doc.rect(FX, Y.tableHead, FW, Y.handling - Y.tableHead);
  const identW = COLS[0].w + COLS[1].w + COLS[2].w + COLS[3].w;
  doc.line(FX, Y.tableHeadCols, FX + identW, Y.tableHeadCols);
  doc.line(FX, Y.body, FR, Y.body);
  setFont(doc, 'bold', 7.6);
  doc.text('Dangerous Goods Identification', FX + identW / 2, Y.tableHead + 3.6, { align: 'center' });

  const headers: string[][] = [
    ['UN or', 'ID No.'],
    ['Proper Shipping Name'],
    ['Class or Division', '(subsidiary hazard)'],
    ['Packing', 'Group'],
    ['Quantity and', 'Type of Packing'],
    ['Packing', 'Inst.'],
    ['Authorization'],
  ];
  let cx = FX;
  COLS.forEach((c, i) => {
    if (i > 0) doc.line(cx, i < 4 ? Y.tableHeadCols : Y.tableHead, cx, Y.handling);
    const inIdent = i < 4;
    const top = inIdent ? Y.tableHeadCols : Y.tableHead;
    const mid = (top + Y.body) / 2;
    setFont(doc, 'normal', 6.9);
    const lines = headers[i];
    const lh = 2.8;
    const startY = mid - ((lines.length - 1) * lh) / 2 + 1;
    lines.forEach((l, k) => doc.text(l, cx + c.w / 2, startY + k * lh, { align: 'center' }));
    cx += c.w;
  });

  // Lignes de marchandises
  let y = Y.body + 4.6;
  items.forEach((it) => {
    const lines = cellLines(doc, it);
    let x = FX;
    COLS.forEach((c, i) => {
      setFont(doc, 'normal', BODY_SIZE);
      if (lines[i].length) doc.text(lines[i], x + 1.5, y, { lineHeightFactor: 1.18 });
      x += c.w;
    });
    y += itemHeight(doc, it);
  });

  // ── Additional Handling Information ──────────────────────────────────────
  doc.rect(FX, Y.handling, FW, Y.declaration - Y.handling);
  setFont(doc, 'normal', 8);
  doc.text('Additional Handling Information', FX + 2, Y.handling + 4.2);
  fitText(doc, (data.handlingInfo ?? '').trim(), FX + 3, Y.handling + 9.4, FW - 6, Y.declaration - Y.handling - 10.4);

  // ── Déclaration et signature ──────────────────────────────────────────────
  doc.setLineWidth(0.35);
  doc.rect(FX, Y.declaration, FW, Y.bottom - Y.declaration);
  doc.line(FX, Y.declaration + 0.9, FR, Y.declaration + 0.9);
  const declW = 108;
  doc.line(FX + declW, Y.declaration + 0.9, FX + declW, Y.bottom);
  setFont(doc, 'normal', 8.4);
  doc.text(DECLARATION_TEXT, FX + 2.5, Y.declaration + 6.2, {
    maxWidth: declW - 5, align: 'justify', lineHeightFactor: 1.3,
  });

  const sx = FX + declW + 2.5;
  setFont(doc, 'normal', 8);
  doc.text('Name of Signatory', sx, Y.declaration + 5.6);
  setFont(doc, 'bold', 9.5);
  fitText(doc, (data.signatoryName ?? '').trim(), sx + 1, Y.declaration + 10.6, FR - sx - 3, 4.5, [9.5, 8.5, 7.5]);
  setFont(doc, 'normal', 8);
  doc.text('Date', sx, Y.declaration + 17.4);
  setFont(doc, 'normal', 9.5);
  doc.text((data.date ?? '').trim(), sx + 9, Y.declaration + 17.4);
  setFont(doc, 'normal', 8);
  doc.text('Signature', sx, Y.declaration + 26.4);
  setFont(doc, 'italic', 7.4);
  doc.text('(See warning above)', sx, Y.declaration + 29.6);
}

/** Construit le PDF complet : n exemplaires × pages de déclaration. */
export function buildDgdPdf(data: DgdData): jsPDF {
  const doc = patchDoc(new jsPDF({ unit: 'mm', format: 'a4' }));
  doc.setProperties({
    title: "Shipper's Declaration for Dangerous Goods",
    subject: 'IATA Dangerous Goods Regulations, Section 8',
    creator: 'Axis Import',
  });
  const pages = paginate(doc, data.items.length ? data.items : []);
  const copies = Math.max(2, Math.min(3, Math.round(data.copies || 2)));
  let first = true;
  for (let c = 0; c < copies; c++) {
    pages.forEach((items, i) => {
      if (!first) doc.addPage();
      first = false;
      drawPage(doc, data, items, i + 1, pages.length);
    });
  }
  return doc;
}
