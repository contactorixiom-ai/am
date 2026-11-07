import { UserRole } from '@prisma/client';

/**
 * L'équipe Axis : l'administrateur (Roger) et les responsables
 * d'exploitation. Ils pilotent l'activité ; seul l'administrateur gère
 * l'équipe, les remboursements et le chiffre d'affaires.
 */
export const STAFF_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.MANAGER];

export function isStaff(role: UserRole | string | undefined | null): boolean {
  return role === UserRole.ADMIN || role === UserRole.MANAGER;
}

/**
 * Qui traite les documents administratifs (pièces des convoyeurs, documents
 * officiels) : l'équipe Axis et les ressources humaines. La RH n'a accès ni
 * à l'exploitation (missions, envois) ni aux montants.
 */
export const PAPERWORK_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.MANAGER, UserRole.HR];

export function handlesPaperwork(role: UserRole | string | undefined | null): boolean {
  return isStaff(role) || role === UserRole.HR;
}

/** Comptes d'équipe que l'administrateur crée et dont il gère l'accès. */
export const TEAM_ROLES: UserRole[] = [
  UserRole.MANAGER, UserRole.HR, UserRole.SECRETARY, UserRole.ACCOUNTANT, UserRole.WEB_DESIGNER, UserRole.SPONSORSHIP,
];

export function isTeamRole(role: UserRole | string | undefined | null): boolean {
  return TEAM_ROLES.includes(role as UserRole);
}

/**
 * Rôles qui ne voient aucun montant (prix, paiements, chiffre d'affaires).
 * La comptabilité, elle, voit les montants.
 */
export function hidesAmounts(role: UserRole | string | undefined | null): boolean {
  return role === UserRole.MANAGER || role === UserRole.HR || role === UserRole.SECRETARY
    || role === UserRole.WEB_DESIGNER || role === UserRole.SPONSORSHIP;
}

// ─── Dossier du personnel ───────────────────────────────────────────────────

/** Personnes qui ont un dossier : convoyeurs et salariés de l'équipe. */
export const PERSONNEL_ROLES: UserRole[] = [UserRole.DRIVER, ...TEAM_ROLES];

/** Déposent billets de train, de bus et réservations d'hébergement. */
export const TRAVEL_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.MANAGER, UserRole.HR, UserRole.SECRETARY];

/** Administration du personnel : contrats, assurances, demandes de pièces. */
export const HR_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.HR];

/** Reçoivent et traitent les justificatifs de frais. */
export const EXPENSE_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.ACCOUNTANT];

/**
 * Relaient les informations à l'équipe (annonces). Les responsables
 * d'exploitation s'en servent aussi pour prévenir les convoyeurs de leurs
 * missions ; la communication et le sponsoring pour l'information interne.
 */
export const ANNOUNCE_ROLES: UserRole[] = [
  UserRole.ADMIN, UserRole.MANAGER, UserRole.SECRETARY, UserRole.HR, UserRole.WEB_DESIGNER, UserRole.SPONSORSHIP,
];

/** Consultent la liste du personnel (pour y déposer une pièce ou écrire). */
export const PERSONNEL_VIEWERS: UserRole[] = [UserRole.ADMIN, UserRole.MANAGER, UserRole.HR, UserRole.SECRETARY, UserRole.ACCOUNTANT];

export function hasRole(list: UserRole[], role: UserRole | string | undefined | null): boolean {
  return list.includes(role as UserRole);
}

/** Tous les comptes internes : administrateur, équipe et convoyeurs (messagerie interne). */
export const INTERNAL_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.DRIVER, ...TEAM_ROLES];
