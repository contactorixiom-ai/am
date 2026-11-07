import { BadRequestException } from '@nestjs/common';

/** SIRET : 14 chiffres, clé de Luhn (sauf établissements de La Poste). */
export function normalizeSiret(raw: string): string {
  const digits = raw.replace(/\s/g, '');
  if (!/^\d{14}$/.test(digits)) {
    throw new BadRequestException('SIRET invalide : 14 chiffres attendus.');
  }
  // La Poste (SIREN 356000000) a une règle propre : on ne la vérifie pas.
  if (!digits.startsWith('356000000') && !luhn(digits)) {
    throw new BadRequestException('SIRET invalide : vérifiez les chiffres saisis.');
  }
  return digits;
}

/** N° de TVA intracommunautaire : code pays + 2 à 13 caractères. */
export function normalizeVat(raw: string): string {
  const v = raw.replace(/[\s.-]/g, '').toUpperCase();
  if (!/^[A-Z]{2}[A-Z0-9]{2,13}$/.test(v)) {
    throw new BadRequestException('Numéro de TVA invalide (ex. FR12345678901).');
  }
  if (v.startsWith('FR') && !/^FR[A-Z0-9]{2}\d{9}$/.test(v)) {
    throw new BadRequestException('Numéro de TVA français invalide : FR + 2 caractères + SIREN (9 chiffres).');
  }
  return v;
}

function luhn(num: string): boolean {
  let sum = 0;
  for (let i = 0; i < num.length; i++) {
    let d = Number(num[num.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}
