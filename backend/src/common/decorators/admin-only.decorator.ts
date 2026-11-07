import { SetMetadata } from '@nestjs/common';

export const ADMIN_ONLY_KEY = 'adminOnly';

/**
 * Réservé à l'administrateur : un responsable d'exploitation, admis partout
 * où l'administrateur l'est, n'y a pas accès (gestion de l'équipe,
 * remboursements, chiffre d'affaires).
 */
export const AdminOnly = () => SetMetadata(ADMIN_ONLY_KEY, true);
