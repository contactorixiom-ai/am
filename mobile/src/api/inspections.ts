import { apiFetch } from './client';
import { uploadFile } from './kyc';
import { extOfMime, mimeOfDataUrl, uriToDataUrl } from '../utils/imageData';

// État des lieux contradictoire — la pièce qui tranche un litige de dommages.
// Tout doit vivre côté serveur : le téléphone du convoyeur n'est pas une
// archive, et ni le client ni Axis n'y ont accès.

export type InspectionType = 'PRE_DEPARTURE' | 'POST_DELIVERY' | 'INTERIM';
export type InspectionStatus = 'DRAFT' | 'SUBMITTED' | 'SIGNED' | 'DISPUTED';
export type DamageView = 'top' | 'front' | 'rear' | 'left' | 'right';
export type DamageCode = 'R' | 'F' | 'E' | 'C' | 'M';

export interface DamagePoint {
  view: DamageView;
  x: number;
  y: number;
  code: DamageCode;
}

export interface InspectionPhoto {
  id: string;
  url: string;
  tag?: string | null;
  caption?: string | null;
}

export interface Inspection {
  id: string;
  missionId: string;
  type: InspectionType;
  status: InspectionStatus;
  mileage?: number | null;
  fuelLevel?: number | null;
  generalNotes?: string | null;
  damageNotes?: string | null;
  damages?: DamagePoint[] | null;
  controls?: Record<string, boolean> | null;
  clientSignatureUrl?: string | null;
  driverSignatureUrl?: string | null;
  clientSignedAt?: string | null;
  driverSignedAt?: string | null;
  /** Signature du client recueillie sur l'appareil du convoyeur. */
  clientSignedInPerson?: boolean;
  createdAt: string;
  photos?: InspectionPhoto[];
}

export interface CreateInspectionInput {
  type: InspectionType;
  mileage?: number;
  /** Niveau de carburant en pourcentage (0 à 100). */
  fuelLevel?: number;
  generalNotes?: string;
  damageNotes?: string;
  damages?: DamagePoint[];
  controls?: Record<string, boolean>;
}

export async function createInspection(
  missionId: string,
  input: CreateInspectionInput,
): Promise<Inspection> {
  return apiFetch<Inspection>(`/missions/${missionId}/inspections`, { method: 'POST', body: input });
}

export async function listInspections(missionId: string): Promise<Inspection[]> {
  const res = await apiFetch<Inspection[]>(`/missions/${missionId}/inspections`);
  return Array.isArray(res) ? res : [];
}

export async function submitInspection(id: string): Promise<Inspection> {
  return apiFetch<Inspection>(`/inspections/${id}/submit`, { method: 'POST' });
}

export async function signInspection(
  id: string,
  party: 'CLIENT' | 'DRIVER',
  signatureUrl: string,
): Promise<Inspection> {
  return apiFetch<Inspection>(`/inspections/${id}/sign`, {
    method: 'POST',
    body: { party, signatureUrl },
  });
}

/**
 * Envoie une photo prise sur le terrain : upload du fichier puis
 * rattachement à l'état des lieux. Renvoie false si la photo n'a pas pu
 * partir — le reste du PV ne doit pas être perdu pour autant.
 */
export async function attachInspectionPhoto(
  inspectionId: string,
  uri: string,
  tag: string,
  caption?: string,
): Promise<boolean> {
  try {
    const dataUrl = await uriToDataUrl(uri);
    if (!dataUrl) return false;
    const mimeType = mimeOfDataUrl(dataUrl);
    const uploaded = await uploadFile({
      fileName: `${tag.toLowerCase()}.${extOfMime(mimeType)}`,
      mimeType,
      data: dataUrl,
      folder: 'documents',
    });
    await apiFetch(`/inspections/${inspectionId}/photos`, {
      method: 'POST',
      body: { url: uploaded.url, tag, caption },
    });
    return true;
  } catch {
    return false;
  }
}
