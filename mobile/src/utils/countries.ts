// Pays desservis : nom français et drapeau, pour parler aux clients de
// « Dakar 🇸🇳 Sénégal » plutôt que de « SN ».

const NAMES: Record<string, string> = {
  // Europe
  FR: 'France', BE: 'Belgique', LU: 'Luxembourg', CH: 'Suisse', DE: 'Allemagne', NL: 'Pays-Bas',
  ES: 'Espagne', PT: 'Portugal', IT: 'Italie', GB: 'Royaume-Uni', IE: 'Irlande', AT: 'Autriche',
  PL: 'Pologne', MC: 'Monaco',
  // Afrique
  SN: 'Sénégal', CI: 'Côte d\'Ivoire', CM: 'Cameroun', GA: 'Gabon', CG: 'Congo', CD: 'RD Congo',
  ML: 'Mali', BF: 'Burkina Faso', TG: 'Togo', BJ: 'Bénin', NE: 'Niger', TD: 'Tchad',
  CF: 'Centrafrique', GN: 'Guinée', MG: 'Madagascar', DJ: 'Djibouti', MA: 'Maroc', DZ: 'Algérie',
  TN: 'Tunisie', MR: 'Mauritanie', GM: 'Gambie', GW: 'Guinée-Bissau', CV: 'Cap-Vert', NG: 'Nigeria',
  GH: 'Ghana', KM: 'Comores', RW: 'Rwanda', BI: 'Burundi', GQ: 'Guinée équatoriale',
  LY: 'Libye', EG: 'Égypte', SL: 'Sierra Leone', LR: 'Liberia', ST: 'Sao Tomé-et-Principe',
  KE: 'Kenya', TZ: 'Tanzanie', UG: 'Ouganda', SD: 'Soudan', SS: 'Soudan du Sud', ET: 'Éthiopie',
  ER: 'Érythrée', SO: 'Somalie', SC: 'Seychelles', ZA: 'Afrique du Sud', NA: 'Namibie',
  BW: 'Botswana', ZW: 'Zimbabwe', ZM: 'Zambie', MW: 'Malawi', MZ: 'Mozambique', AO: 'Angola',
  LS: 'Lesotho', SZ: 'Eswatini', MU: 'Maurice',
  // Europe (suite)
  DK: 'Danemark', CZ: 'Tchéquie', SE: 'Suède', FI: 'Finlande', NO: 'Norvège', GR: 'Grèce',
};

/** « 🇸🇳 » à partir du code ISO à deux lettres ; chaîne vide si inconnu. */
export function countryFlag(code?: string | null): string {
  const c = (code ?? '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return '';
  return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

/** « Sénégal » ; le code lui-même si le pays n'est pas dans la liste. */
export function countryName(code?: string | null): string {
  const c = (code ?? '').trim().toUpperCase();
  return NAMES[c] ?? c;
}

const EUROPE = new Set(['FR', 'BE', 'LU', 'CH', 'DE', 'NL', 'ES', 'PT', 'IT', 'GB', 'IE', 'AT', 'PL', 'MC']);

/** Pays d'Europe desservi (sens de l'envoi : import si la destination y est). */
export function isEuropean(code?: string | null): boolean {
  return EUROPE.has((code ?? '').trim().toUpperCase());
}
