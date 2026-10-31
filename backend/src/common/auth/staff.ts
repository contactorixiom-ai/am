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
