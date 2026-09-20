// Identité de l'émetteur, imprimée sur les factures, les documents douaniers
// et les contrats.
//
// Ces valeurs étaient codées en dur dans les générateurs de PDF : SIRET
// « 925 487 312 00018 », TVA « FR42 925487312 », EORI « FR92548731200018 »,
// adresse « 14 rue de la Logistique, 75015 Paris ». Elles étaient inventées —
// le SIREN ne passe pas la clé de Luhn et la clé de TVA imprimée (42) ne
// correspond pas à celle calculée depuis ce SIREN (05). Une facture portant
// un numéro de TVA introuvable dans VIES n'est pas une facture conforme, et
// c'est exactement le genre de détail qui immobilise une marchandise en
// douane.
//
// On les lit donc dans app.json (`expo.extra.company`). Tant qu'une valeur
// n'est pas renseignée, le document affiche « [À COMPLÉTER] » : visible,
// impossible à envoyer par inadvertance, contrairement à un faux numéro
// parfaitement crédible.

export interface CompanyIdentity {
  name: string;
  address: string;
  postalCity: string;
  country: string;
  siret: string;
  siren: string;
  vat: string;
  eori: string;
  rcs: string;
  email: string;
  phone: string;
  website: string;
  /** Forme et capital, ex. « SAS au capital de 10 000 EUR ». */
  legalForm: string;
  /** N° d'enregistrement de représentant en douane, si Axis en est un. */
  customsRegistration: string;
}

const EMPTY: CompanyIdentity = {
  name: 'Axis Import',
  address: '', postalCity: '', country: 'France',
  siret: '', siren: '', vat: '', eori: '', rcs: '',
  email: '', phone: '', website: '',
  legalForm: '', customsRegistration: '',
};

function fromAppConfig(): Partial<CompanyIdentity> {
  try {
    // require plutôt qu'import : ce module est aussi chargé hors Expo par les
    // outils de rendu PDF, où expo-constants n'existe pas.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Constants = require('expo-constants').default;
    const extra = Constants?.expoConfig?.extra as { company?: Partial<CompanyIdentity> } | undefined;
    return extra?.company ?? {};
  } catch {
    return {};
  }
}

export const COMPANY: CompanyIdentity = { ...EMPTY, ...fromAppConfig() };

export const TODO = '[À COMPLÉTER]';

/** Valeur renseignée, ou marqueur visible pour qu'on la remarque. */
export function orTodo(value: string | undefined | null): string {
  const v = (value ?? '').trim();
  return v || TODO;
}

/** « 14 rue X, 75015 Paris, France » — les parties vides sont omises. */
export function companyAddress(): string {
  const parts = [COMPANY.address, COMPANY.postalCity, COMPANY.country].map((p) => (p ?? '').trim()).filter(Boolean);
  return parts.length > 1 ? parts.join(', ') : TODO;
}

/** Ligne d'identification légale du pied de page. */
export function companyLegalLine(): string {
  return [
    orTodo(COMPANY.name),
    `SIRET ${orTodo(COMPANY.siret)}`,
    `TVA ${orTodo(COMPANY.vat)}`,
    companyAddress(),
  ].join(' · ');
}

/** Ligne de contact du pied de page. */
export function companyContactLine(): string {
  return [orTodo(COMPANY.email), orTodo(COMPANY.phone), orTodo(COMPANY.website)].join(' · ');
}

/** « RCS Paris 123 456 789 · SIRET … » pour l'en-tête des factures. */
export function companyRegistrationLine(): string {
  return `RCS ${orTodo(COMPANY.rcs)} · SIRET ${orTodo(COMPANY.siret)}`;
}
