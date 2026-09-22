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

/**
 * Couverture d'assurance réellement souscrite par Axis.
 *
 * L'application annonçait « Assurance tous risques incluse · jusqu'à
 * 250 000 € · AXA Transport / Allianz Marine » au moment où le client choisit
 * son service et paie, et le générateur d'attestation produisait un document
 * au nom d'AXA avec un numéro de police inventé. Promettre une couverture
 * qu'on n'a pas, en nommant un assureur tiers, engage lourdement — et
 * l'annonce intervient précisément au moment de la décision d'achat.
 *
 * Tant que ces valeurs ne sont pas renseignées, l'application n'annonce
 * aucune assurance : mieux vaut ne rien promettre que promettre à faux.
 */
export interface InsuranceCover {
  /** Nom de l'assureur, tel qu'il figure sur la police. */
  insurer: string;
  /** Numéro de la police souscrite. */
  policyNumber: string;
  /** Plafond d'indemnisation, en euros. 0 = non renseigné. */
  coverageEur: number;
}

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

const EMPTY_COVER: InsuranceCover = { insurer: '', policyNumber: '', coverageEur: 0 };

function coverFromAppConfig(): Partial<InsuranceCover> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Constants = require('expo-constants').default;
    const extra = Constants?.expoConfig?.extra as { insurance?: Partial<InsuranceCover> } | undefined;
    return extra?.insurance ?? {};
  } catch {
    return {};
  }
}

export const INSURANCE: InsuranceCover = { ...EMPTY_COVER, ...coverFromAppConfig() };

/** Vrai seulement si une couverture réelle a été renseignée. */
export function hasInsurance(): boolean {
  return Boolean(INSURANCE.insurer.trim()) && INSURANCE.coverageEur > 0;
}

/** « 250 000 € » — à n'appeler que si hasInsurance() est vrai. */
export function coverageLabel(): string {
  return `${INSURANCE.coverageEur.toLocaleString('fr-FR')} €`;
}

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

// Pages légales publiées avec le site : l'App Store exige une politique de
// confidentialité accessible, et l'application y renvoie directement.
const LEGAL_BASE = 'https://contactorixiom-ai.github.io/am';
export const LEGAL_PRIVACY_URL = `${LEGAL_BASE}/confidentialite.html`;
export const LEGAL_TERMS_URL = `${LEGAL_BASE}/cgu.html`;
