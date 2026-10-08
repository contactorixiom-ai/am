import { normalizeSiret, normalizeVat } from './company-ids';

describe('identifiants société', () => {
  it('accepte un SIRET valide, espaces compris', () => {
    expect(normalizeSiret('732 829 320 00074')).toBe('73282932000074');
  });
  it('refuse un SIRET dont la clé est fausse ou la longueur incorrecte', () => {
    expect(() => normalizeSiret('73282932000075')).toThrow();
    expect(() => normalizeSiret('1234')).toThrow();
  });
  it('normalise un numéro de TVA', () => {
    expect(normalizeVat('fr 44 732829320')).toBe('FR44732829320');
    expect(normalizeVat('BE0123456789')).toBe('BE0123456789');
    expect(() => normalizeVat('FR123')).toThrow();
  });
});
