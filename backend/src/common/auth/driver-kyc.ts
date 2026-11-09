/**
 * Pièces justificatives d'un convoyeur. Une seule liste, utilisée par
 * l'acceptation des missions, le dossier RH et l'application.
 *
 * `verified` : la pièce doit avoir été validée par Axis (identité, permis).
 * Les autres doivent avoir été envoyées : leur vérification par la RH ne
 * bloque pas le convoyeur.
 */
export const DRIVER_REQUIRED_KYC = [
  { key: 'ID', label: 'Pièce d\'identité (recto-verso)', types: ['IDENTITY_CARD', 'PASSPORT'], verified: true },
  { key: 'ADDRESS', label: 'Justificatif de domicile', types: ['PROOF_OF_ADDRESS'], verified: false },
  { key: 'LICENSE', label: 'Permis de conduire (recto-verso)', types: ['DRIVER_LICENSE'], verified: true },
  { key: 'RIB', label: 'RIB', types: ['BANK_DETAILS'], verified: false },
  { key: 'VITALE', label: 'Carte Vitale', types: ['VITALE_CARD'], verified: false },
  { key: 'HEALTH', label: 'Attestation de droits à l\'assurance maladie', types: ['HEALTH_INSURANCE_RIGHTS'], verified: false },
  { key: 'SELFIE', label: 'Photo faciale', types: ['SELFIE'], verified: false },
] as const;

/**
 * Salariés de l'équipe interne : les mêmes pièces que les convoyeurs, sans
 * le permis de conduire (identité, domicile, RIB, hébergement si besoin,
 * carte Vitale, attestation de droits, photo faciale).
 */
export const TEAM_REQUIRED_KYC = DRIVER_REQUIRED_KYC.filter((r) => r.key !== 'LICENSE');

/** Convoyeur hébergé : attestation d'hébergement + pièce d'identité de l'hébergeant. */
export const HOSTING_KYC = [
  { key: 'HOSTING', label: 'Attestation d\'hébergement', types: ['HOSTING_CERTIFICATE'] },
  { key: 'HOST_ID', label: 'Pièce d\'identité de l\'hébergeant', types: ['HOST_IDENTITY'] },
] as const;

type Doc = { type: string; status: string };
type ItemStatus = 'APPROVED' | 'PENDING' | 'REJECTED' | 'MISSING';

function statusOf(docs: Doc[], types: readonly string[]): ItemStatus {
  const mine = docs.filter((d) => types.includes(d.type));
  if (mine.some((d) => d.status === 'APPROVED')) return 'APPROVED';
  if (mine.some((d) => d.status === 'PENDING')) return 'PENDING';
  if (mine.some((d) => d.status === 'REJECTED')) return 'REJECTED';
  return 'MISSING';
}

/** État du dossier : chaque pièce, et ce qui manque pour accepter une mission. */
export function driverCompliance(docs: Doc[], required: readonly (typeof DRIVER_REQUIRED_KYC)[number][] = DRIVER_REQUIRED_KYC) {
  const items: { key: string; label: string; status: ItemStatus }[] = required.map((r) => ({
    key: r.key,
    label: r.label,
    status: statusOf(docs, r.types),
  }));
  // Hébergé : dès qu'une attestation d'hébergement est envoyée, la pièce
  // d'identité de l'hébergeant devient obligatoire.
  const hosted = statusOf(docs, HOSTING_KYC[0].types) !== 'MISSING';
  if (hosted) for (const h of HOSTING_KYC) items.push({ key: h.key, label: h.label, status: statusOf(docs, h.types) });

  const blocking: string[] = [];
  for (const it of items) {
    const rule = DRIVER_REQUIRED_KYC.find((r) => r.key === it.key);
    const ok = rule?.verified ? it.status === 'APPROVED' : it.status === 'APPROVED' || it.status === 'PENDING';
    if (!ok) blocking.push(it.label);
  }
  return { complete: items.every((i) => i.status === 'APPROVED'), canWork: blocking.length === 0, blocking, items };
}

/** Dossier d'une personne : convoyeur (avec permis) ou salarié de l'équipe. */
export function personnelCompliance(role: string, docs: Doc[]) {
  return driverCompliance(docs, role === 'DRIVER' ? DRIVER_REQUIRED_KYC : TEAM_REQUIRED_KYC);
}
