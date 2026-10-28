import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { map, Observable } from 'rxjs';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * Le responsable d'exploitation ne voit aucun prix ni aucun montant : on
 * retire des réponses tous les champs en centimes (prix, règlements, devis,
 * rémunération des convoyeurs…) et les montants saisis dans les documents.
 *
 * Restent visibles les valeurs déclarées des marchandises, nécessaires aux
 * formalités douanières (déclaration, facture commerciale, BESC).
 */
const KEEP = new Set(['declaredValueCents', 'valueCents', 'fobValueCents']);
const HIDDEN_DOC_VALUES = new Set(['amountEur', 'priceEur']);

function isHidden(key: string): boolean {
  if (KEEP.has(key)) return false;
  return key.endsWith('Cents') || HIDDEN_DOC_VALUES.has(key);
}

export function stripAmounts(value: unknown, depth = 0): unknown {
  if (depth > 12 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => stripAmounts(v, depth + 1));
  const proto = Object.getPrototypeOf(value);
  // Dates, Decimal, Buffer, flux de fichiers : laissés tels quels.
  if (proto !== Object.prototype && proto !== null) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (isHidden(k)) continue;
    out[k] = stripAmounts(v, depth + 1);
  }
  return out;
}

@Injectable()
export class HideAmountsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const user = context.switchToHttp().getRequest().user as AuthenticatedUser | undefined;
    if (user?.role !== UserRole.MANAGER) return next.handle();
    return next.handle().pipe(map((body) => stripAmounts(body)));
  }
}
