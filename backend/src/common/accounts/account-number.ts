/** Numéro de compte lisible : AX-000123. */
export function formatAccountNo(n: number | null | undefined): string | null {
  return typeof n === 'number' ? `AX-${String(n).padStart(6, '0')}` : null;
}

/**
 * Recherche par numéro de compte : « AX-000123 », « ax123 », « 123 ».
 * Renvoie un filtre Prisma à ajouter au OR d'une recherche, ou rien.
 */
export function accountNoFilter(term?: string | null): { accountNo: number }[] {
  const m = term?.trim().match(/^(?:AX[\s-]?)?0*(\d{1,9})$/i);
  if (!m) return [];
  const n = Number(m[1]);
  return Number.isSafeInteger(n) && n > 0 && n <= 2147483647 ? [{ accountNo: n }] : [];
}
