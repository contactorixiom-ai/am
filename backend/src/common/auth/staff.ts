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
export const TEAM_ROLES: UserRole[] = [UserRole.MANAGER, UserRole.HR];

/** Rôles qui ne voient aucun montant (prix, paiements, chiffre d'affaires). */
export function hidesAmounts(role: UserRole | string | undefined | null): boolean {
  return role === UserRole.MANAGER || role === UserRole.HR;
}
