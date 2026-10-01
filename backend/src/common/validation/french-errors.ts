import { BadRequestException, ValidationError } from '@nestjs/common';

// Libellés des champs les plus courants, tels que l'utilisateur les voit.
const FIELDS: Record<string, string> = {
  email: 'E-mail',
  password: 'Mot de passe',
  firstName: 'Prénom',
  lastName: 'Nom',
  phone: 'Téléphone',
  companyName: 'Société',
  token: 'Lien',
  make: 'Marque',
  model: 'Modèle',
  plate: 'Immatriculation',
  vin: 'Numéro de série (VIN)',
  pickupAddress: 'Adresse de départ',
  pickupCity: 'Ville de départ',
  deliveryAddress: 'Adresse de livraison',
  deliveryCity: 'Ville de livraison',
  pickupAt: 'Date de prise en charge',
  reason: 'Motif',
};

type Translator = (field: string, error: ValidationError) => string;

const RULES: Record<string, Translator> = {
  isEmail: (f) => `${f} : adresse e-mail invalide.`,
  isNotEmpty: (f) => `${f} : champ obligatoire.`,
  isDefined: (f) => `${f} : champ obligatoire.`,
  minLength: (f, e) => `${f} : ${lengthOf(e, 'minLength', 'au moins')}`,
  maxLength: (f, e) => `${f} : ${lengthOf(e, 'maxLength', 'au plus')}`,
  isLength: (f) => `${f} : longueur invalide.`,
  matches: (f) => `${f} : format invalide.`,
  isUUID: (f) => `${f} : identifiant invalide.`,
  isEnum: (f) => `${f} : valeur non reconnue.`,
  isIn: (f) => `${f} : valeur non autorisée.`,
  isInt: (f) => `${f} : nombre entier attendu.`,
  isNumber: (f) => `${f} : nombre attendu.`,
  min: (f) => `${f} : valeur trop petite.`,
  max: (f) => `${f} : valeur trop grande.`,
  isDateString: (f) => `${f} : date invalide.`,
  isDate: (f) => `${f} : date invalide.`,
  isBoolean: (f) => `${f} : oui ou non attendu.`,
  isString: (f) => `${f} : texte attendu.`,
  whitelistValidation: (f) => `Champ non reconnu : ${f}.`,
};

function lengthOf(e: ValidationError, key: string, word: string): string {
  // Le nombre est dans le message d'origine (« …longer than or equal to 8 characters »).
  const n = e.constraints?.[key]?.match(/(\d+)/)?.[1];
  return n ? `${word} ${n} caractères.` : 'longueur invalide.';
}

function flatten(errors: ValidationError[], parent = ''): string[] {
  return errors.flatMap((e) => {
    const path = parent ? `${parent}.${e.property}` : e.property;
    const label = FIELDS[e.property] ?? path;
    const own = Object.entries(e.constraints ?? {}).map(([rule, original]) => {
      const t = RULES[rule];
      // Les messages déjà rédigés en français dans les DTO sont gardés.
      if (!t || /[éèàêç«]/.test(original)) return original;
      return t(label, e);
    });
    return [...own, ...flatten(e.children ?? [], path)];
  });
}

/** Remplace les messages anglais de class-validator par du français. */
export function frenchValidationErrors(errors: ValidationError[]): BadRequestException {
  return new BadRequestException(flatten(errors));
}
