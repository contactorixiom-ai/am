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

/** Accès à l'espace de travail interne (admin, responsable ou RH). */
export function hasBackOffice(role?: string | null): boolean {
  return isStaff(role) || isHR(role);
}

export function roleLabel(role?: string | null): string {
  switch (role) {
    case 'ADMIN': return 'Administrateur';
    case 'MANAGER': return 'Responsable d\'exploitation';
    case 'HR': return 'Ressources humaines';
    case 'DRIVER': return 'Convoyeur';
    default: return 'Client';
  }
}
