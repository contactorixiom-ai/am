import { apiFetch } from './client';

// ─── Types (miroir des enums Prisma backend) ───────────────────────────────
export type CargoTrackingType =
  | 'BSC' | 'BESC' | 'ECTN' | 'BIETC' | 'FERI' | 'CARGO_WAIVER';

export type CargoTrackingStatus =
  | 'NOT_REQUIRED' | 'TO_REQUEST' | 'DRAFT' | 'SUBMITTED'
  | 'VALIDATED' | 'REJECTED' | 'ISSUED';

export interface RequiredDocument {
  key: string;
  label: string;
  mandatory: boolean;
  note?: string;
  /**
   * Statut "fourni" du document pour le colis interrogé.
   * Renseigné par l'API quand un parcelId est passé (sinon undefined).
   */
  provided?: boolean;
}

export interface CargoTrackingNote {
  id: string;
  parcelId?: string | null;
  type: CargoTrackingType;
  status: CargoTrackingStatus;
  number?: string | null;
  destinationCountry: string;
  blNumber?: string | null;
  hsCode?: string | null;
  fobValueCents?: number | null;
  feeCents?: number | null;
  issuedAt?: string | null;
  validatedAt?: string | null;
}

export interface CountryRequirements {
  countryCode: string;
  countryName: string;
  cargoTrackingType: CargoTrackingType | null;
  cargoMandatory: boolean;
  authority: string | null;
  currency: string;
  customsNotes: string | null;
  checklist: RequiredDocument[];
  cargoNote: CargoTrackingNote | null;
}

// ─── Libellés FR des types de bordereau ────────────────────────────────────
export const CARGO_TYPE_LABEL: Record<CargoTrackingType, string> = {
  BSC: 'Bordereau de Suivi de Cargaison (BSC)',
  BESC: 'Bordereau Électronique de Suivi de Cargaison (BESC)',
  ECTN: 'Electronic Cargo Tracking Note (ECTN)',
  BIETC: 'Bordereau d\'Identification Électronique du Transport de Cargaison (BIETC)',
  FERI: 'Fiche Électronique de Renseignement à l\'Importation (FERI)',
  CARGO_WAIVER: 'Cargo Tracking Note',
};

export const CARGO_STATUS_LABEL: Record<CargoTrackingStatus, string> = {
  NOT_REQUIRED: 'Non requis',
  TO_REQUEST: 'À demander',
  DRAFT: 'Brouillon',
  SUBMITTED: 'Soumis',
  VALIDATED: 'Validé',
  REJECTED: 'Rejeté',
  ISSUED: 'Émis',
};

// ─── Appels API ────────────────────────────────────────────────────────────
export async function getRequirements(
  countryCode: string,
  parcelId?: string,
): Promise<CountryRequirements> {
  return apiFetch<CountryRequirements>(`/customs/requirements/${countryCode}`, {
    skipAuth: true,
    params: { parcelId },
  });
}

export async function listRegulations(): Promise<CountryRequirements[]> {
  return apiFetch<CountryRequirements[]>('/customs/regulations', { skipAuth: true });
}

export interface CreateCargoNoteInput {
  parcelId?: string;
  destinationCountry: string;
  type?: CargoTrackingType;
  blNumber?: string;
  hsCode?: string;
  fobValueCents?: number;
}

export async function createCargoNote(
  input: CreateCargoNoteInput,
): Promise<CargoTrackingNote> {
  return apiFetch<CargoTrackingNote>('/customs/cargo-notes', {
    method: 'POST',
    body: input,
  });
}

export async function listCargoNotes(parcelId?: string): Promise<CargoTrackingNote[]> {
  return apiFetch<CargoTrackingNote[]>('/customs/cargo-notes', { params: { parcelId } });
}

export async function updateCargoNoteStatus(
  id: string,
  status: CargoTrackingStatus,
  extra?: { number?: string; feeCents?: number },
): Promise<CargoTrackingNote> {
  return apiFetch<CargoTrackingNote>(`/customs/cargo-notes/${id}/status`, {
    method: 'PATCH',
    body: { status, ...extra },
  });
}

// ─── Fallback démo (si API indisponible) ───────────────────────────────────
// Reproduit la matrice pilote côté client pour une dégradation gracieuse.
const DEMO_REGULATIONS: Record<string, Omit<CountryRequirements, 'cargoNote'>> = {
  SN: {
    countryCode: 'SN', countryName: 'Sénégal', cargoTrackingType: 'BSC', cargoMandatory: true,
    authority: 'COSEC (Conseil Sénégalais des Chargeurs)', currency: 'XOF',
    customsNotes: 'Le BSC doit être validé avant l\'arrivée au port de Dakar.',
    checklist: demoChecklist('Bordereau de Suivi de Cargaison (BSC)', 'le COSEC'),
  },
  CI: {
    countryCode: 'CI', countryName: 'Côte d\'Ivoire', cargoTrackingType: 'BSC', cargoMandatory: true,
    authority: 'OIC (Office Ivoirien des Chargeurs)', currency: 'XOF',
    customsNotes: 'BSC obligatoire pour les ports d\'Abidjan et de San Pedro.',
    checklist: demoChecklist('Bordereau de Suivi de Cargaison (BSC)', 'l\'OIC'),
  },
  CM: {
    countryCode: 'CM', countryName: 'Cameroun', cargoTrackingType: 'BESC', cargoMandatory: true,
    authority: 'CNCC (Conseil National des Chargeurs du Cameroun)', currency: 'XAF',
    customsNotes: 'Le BESC est exigé pour le port de Douala.',
    checklist: demoChecklist('Bordereau Électronique de Suivi de Cargaison (BESC)', 'le CNCC'),
  },
  BJ: {
    countryCode: 'BJ', countryName: 'Bénin', cargoTrackingType: 'ECTN', cargoMandatory: true,
    authority: 'CNCC (Conseil National des Chargeurs du Bénin)', currency: 'XOF',
    customsNotes: 'ECTN obligatoire pour le port de Cotonou.',
    checklist: demoChecklist('Electronic Cargo Tracking Note (ECTN)', 'le CNCC'),
  },
  TG: {
    countryCode: 'TG', countryName: 'Togo', cargoTrackingType: 'ECTN', cargoMandatory: true,
    authority: 'CNCC (Conseil National des Chargeurs du Togo)', currency: 'XOF',
    customsNotes: 'ECTN obligatoire pour le port de Lomé.',
    checklist: demoChecklist('Electronic Cargo Tracking Note (ECTN)', 'le CNCC'),
  },
  GA: {
    countryCode: 'GA', countryName: 'Gabon', cargoTrackingType: 'BIETC', cargoMandatory: true,
    authority: 'Conseil Gabonais des Chargeurs', currency: 'XAF',
    customsNotes: 'Le BIETC est exigé pour le port d\'Owendo / Libreville.',
    checklist: demoChecklist('Bordereau d\'Identification Électronique du Transport de Cargaison (BIETC)', 'le Conseil Gabonais des Chargeurs'),
  },
  CD: {
    countryCode: 'CD', countryName: 'République Démocratique du Congo', cargoTrackingType: 'FERI', cargoMandatory: true,
    authority: 'OGEFREM (Office de Gestion du Fret Multimodal)', currency: 'CDF',
    customsNotes: 'La FERI est délivrée par l\'OGEFREM, indispensable au dédouanement à Matadi.',
    checklist: demoChecklist('Fiche Électronique de Renseignement à l\'Importation (FERI)', 'l\'OGEFREM'),
  },
};

function demoChecklist(trackingLabel: string, authority: string): RequiredDocument[] {
  return [
    { key: 'commercial_invoice', label: 'Facture commerciale', mandatory: true, note: '3 exemplaires originaux.' },
    { key: 'packing_list', label: 'Liste de colisage', mandatory: true },
    { key: 'bill_of_lading', label: 'Connaissement (B/L) ou LTA', mandatory: true },
    { key: 'certificate_of_origin', label: 'Certificat d\'origine', mandatory: true },
    { key: 'insurance_certificate', label: 'Attestation d\'assurance', mandatory: false },
    { key: 'cargo_tracking_note', label: trackingLabel, mandatory: true, note: `Obligatoire — émis par ${authority}.` },
  ];
}

export function getDemoRequirements(countryCode: string): CountryRequirements | null {
  const reg = DEMO_REGULATIONS[countryCode.toUpperCase()];
  if (!reg) return null;
  return { ...reg, cargoNote: null };
}

export function listDemoRegulations(): CountryRequirements[] {
  return Object.values(DEMO_REGULATIONS).map((r) => ({ ...r, cargoNote: null }));
}
