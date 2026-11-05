// L'équipe Axis : l'administrateur (Roger) et les responsables
// d'exploitation. Les seconds pilotent l'activité ; seul le premier gère
// l'équipe, les remboursements et le chiffre d'affaires.
export function isStaff(role?: string | null): boolean {
  return role === 'ADMIN' || role === 'MANAGER';
}

export function isAdmin(role?: string | null): boolean {
  return role === 'ADMIN';
}

/** Ressources humaines : pièces des convoyeurs et documents administratifs, sans montants. */
export function isHR(role?: string | null): boolean {
  return role === 'HR';
}

/** Pièces des convoyeurs et documents officiels : admin, responsables, RH. */
export function handlesPaperwork(role?: string | null): boolean {
  return isStaff(role) || isHR(role);
}

export function isSecretary(role?: string | null): boolean {
  return role === 'SECRETARY';
}

export function isAccountant(role?: string | null): boolean {
  return role === 'ACCOUNTANT';
}

/** Membres de l'équipe créés par l'administrateur. */
export const TEAM_ROLES = ['MANAGER', 'HR', 'SECRETARY', 'ACCOUNTANT'] as const;

/** Accès à l'espace de travail interne (admin, responsable, RH, secrétariat, comptabilité). */
export function hasBackOffice(role?: string | null): boolean {
  return isStaff(role) || isHR(role) || isSecretary(role) || isAccountant(role);
}

/** Convoyeurs et salariés : ont « Mon espace » (billets, frais, documents RH). */
export function hasPersonnelSpace(role?: string | null): boolean {
  return role === 'DRIVER' || (TEAM_ROLES as readonly string[]).includes(role ?? '');
}

/** Titre de l'espace de travail selon le rôle. */
export function backOfficeTitle(role?: string | null): string {
  switch (role) {
    case 'HR': return 'Espace RH';
    case 'SECRETARY': return 'Espace secrétariat';
    case 'ACCOUNTANT': return 'Espace comptabilité';
    default: return 'Espace admin';
  }
}

export function roleLabel(role?: string | null): string {
  switch (role) {
    case 'ADMIN': return 'Administrateur';
    case 'MANAGER': return 'Responsable d\'exploitation';
    case 'HR': return 'Ressources humaines';
    case 'SECRETARY': return 'Secrétariat';
    case 'ACCOUNTANT': return 'Comptabilité';
    case 'DRIVER': return 'Convoyeur';
    default: return 'Client';
  }
}
