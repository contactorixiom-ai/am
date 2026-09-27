// Prises de vue de l'état des lieux, au départ comme à l'arrivée. La liste
// suit la pratique des convoyeurs professionnels : les 8 angles du tour du
// véhicule, les jantes, puis l'habitacle, le compteur, les clés et les
// documents. Chaque photo est horodatée et rattachée au PV sur le serveur.

import type { SketchKind } from './vehicleViews';

export type ShotGroup = 'Extérieur' | 'Roues' | 'Coffre, vitrages et intérieur';

export interface Shot {
  key: string;
  label: string;
  /** Où se placer, quoi cadrer : affiché avant d'ouvrir l'appareil photo. */
  hint: string;
  /** Catégorie côté serveur (InspectionPhotoTag). */
  tag: 'FRONT' | 'REAR' | 'LEFT_SIDE' | 'RIGHT_SIDE' | 'INTERIOR' | 'DASHBOARD' | 'ENGINE' | 'TRUNK' | 'ODOMETER' | 'DOCUMENT' | 'OTHER';
  group: ShotGroup;
  /** Photo facultative : le convoyeur peut la passer (« non concerné »). */
  optional?: string;
}

// Liste validée par Roger (Axis Import), dans son ordre de prise de vue.
const ROGER_LIST = (van: boolean): Shot[] => [
  { key: 'front', label: 'Face avant', hint: 'Face au véhicule, à 3 m : plaque, calandre et pare-chocs entiers.', tag: 'FRONT', group: 'Extérieur' },
  { key: 'frontLeft', label: 'Angle avant gauche', hint: 'À l\'angle avant gauche : face avant et flanc gauche visibles ensemble.', tag: 'FRONT', group: 'Extérieur' },
  { key: 'frontRight', label: 'Angle avant droit', hint: 'À l\'angle avant droit : face avant et flanc droit visibles ensemble.', tag: 'FRONT', group: 'Extérieur' },
  { key: 'rearLeft', label: 'Angle arrière gauche', hint: 'À l\'angle arrière gauche : flanc gauche et face arrière ensemble.', tag: 'REAR', group: 'Extérieur' },
  { key: 'rear', label: 'Face arrière', hint: 'Derrière le véhicule, à 3 m : plaque et pare-chocs entiers.', tag: 'REAR', group: 'Extérieur' },
  { key: 'rearRight', label: 'Angle arrière droit', hint: 'À l\'angle arrière droit : face arrière et flanc droit ensemble.', tag: 'REAR', group: 'Extérieur' },
  { key: 'wheelFR', label: 'Roue avant droite', hint: 'Accroupi, jante et pneu entiers : rayures de trottoir visibles.', tag: 'OTHER', group: 'Roues' },
  { key: 'wheelFL', label: 'Roue avant gauche', hint: 'Accroupi, jante et pneu entiers.', tag: 'OTHER', group: 'Roues' },
  { key: 'wheelRR', label: 'Roue arrière droite', hint: 'Accroupi, jante et pneu entiers.', tag: 'OTHER', group: 'Roues' },
  { key: 'wheelRL', label: 'Roue arrière gauche', hint: 'Accroupi, jante et pneu entiers.', tag: 'OTHER', group: 'Roues' },
  { key: 'trunk', label: van ? 'Zone de chargement (intérieur)' : 'Coffre (intérieur)', hint: van ? 'Portes arrière ouvertes : plancher, parois et contenu.' : 'Coffre ouvert : contenu, tapis et roue de secours ou kit.', tag: 'TRUNK', group: 'Coffre, vitrages et intérieur' },
  { key: 'windshieldOut', label: 'Pare-brise extérieur', hint: 'De l\'extérieur, tout le pare-brise : impacts et fissures.', tag: 'FRONT', group: 'Coffre, vitrages et intérieur' },
  { key: 'windshieldIn', label: 'Pare-brise intérieur', hint: 'Depuis le siège conducteur : pare-brise, rétroviseur central, tableau de bord.', tag: 'INTERIOR', group: 'Coffre, vitrages et intérieur' },
  { key: 'rearWindow', label: 'Pare-brise arrière', hint: 'De l\'extérieur, toute la lunette arrière.', tag: 'REAR', group: 'Coffre, vitrages et intérieur', ...(van ? { optional: 'si portes vitrées' } : {}) },
  { key: 'mirrorLeft', label: 'Coque rétro gauche', hint: 'De près, la coque et le miroir du rétroviseur gauche.', tag: 'LEFT_SIDE', group: 'Coffre, vitrages et intérieur' },
  { key: 'mirrorRight', label: 'Coque rétro droite', hint: 'De près, la coque et le miroir du rétroviseur droit.', tag: 'RIGHT_SIDE', group: 'Coffre, vitrages et intérieur' },
  { key: 'roof', label: 'Toit du véhicule', hint: 'Bras levé ou depuis une marche : la surface du toit.', tag: 'OTHER', group: 'Coffre, vitrages et intérieur', optional: 'si possible' },
  { key: 'chargingCable', label: 'Câble de recharge', hint: 'Le câble de recharge déroulé, prises visibles.', tag: 'OTHER', group: 'Coffre, vitrages et intérieur', optional: 'si véhicule électrique' },
  { key: 'interiorFront', label: 'Intérieur avant', hint: 'Depuis la portière : sièges avant, volant, console.', tag: 'INTERIOR', group: 'Coffre, vitrages et intérieur' },
  { key: 'rearSeat', label: van ? 'Banquette / cabine arrière' : 'Banquette arrière', hint: 'Portière arrière ouverte : assise, dossier et plancher.', tag: 'INTERIOR', group: 'Coffre, vitrages et intérieur', ...(van ? { optional: 'si présente' } : {}) },
];

const MOTO: Shot[] = [
  { key: 'front', label: 'Face avant', hint: 'Face à la moto, à 2 m : optique, garde-boue, fourche.', tag: 'FRONT', group: 'Extérieur' },
  { key: 'frontLeft', label: 'Angle avant gauche', hint: 'À l\'angle avant gauche : avant et flanc gauche ensemble.', tag: 'FRONT', group: 'Extérieur' },
  { key: 'sideLeft', label: 'Flanc gauche', hint: 'Perpendiculaire au côté gauche, moto entière.', tag: 'LEFT_SIDE', group: 'Extérieur' },
  { key: 'rearLeft', label: 'Angle arrière gauche', hint: 'À l\'angle arrière gauche.', tag: 'REAR', group: 'Extérieur' },
  { key: 'rear', label: 'Face arrière', hint: 'Derrière la moto : feu, plaque, garde-boue.', tag: 'REAR', group: 'Extérieur' },
  { key: 'rearRight', label: 'Angle arrière droit', hint: 'À l\'angle arrière droit.', tag: 'REAR', group: 'Extérieur' },
  { key: 'sideRight', label: 'Flanc droit', hint: 'Perpendiculaire au côté droit, moto entière.', tag: 'RIGHT_SIDE', group: 'Extérieur' },
  { key: 'frontRight', label: 'Angle avant droit', hint: 'À l\'angle avant droit.', tag: 'FRONT', group: 'Extérieur' },
  { key: 'wheelF', label: 'Roue avant', hint: 'Jante, pneu, disque et fourche.', tag: 'OTHER', group: 'Roues' },
  { key: 'wheelR', label: 'Roue arrière', hint: 'Jante, pneu, chaîne ou cardan.', tag: 'OTHER', group: 'Roues' },
  { key: 'dashboard', label: 'Compteur allumé', hint: 'Contact mis : kilométrage, carburant et voyants lisibles.', tag: 'ODOMETER', group: 'Coffre, vitrages et intérieur' },
  { key: 'tank', label: 'Réservoir et selle', hint: 'De dessus : réservoir, bouchon et selle.', tag: 'OTHER', group: 'Coffre, vitrages et intérieur' },
  { key: 'keys', label: 'Clés remises', hint: 'Toutes les clés remises, posées côte à côte.', tag: 'OTHER', group: 'Coffre, vitrages et intérieur' },
  { key: 'documents', label: 'Documents de bord', hint: 'Carte grise (ou copie) et attestation d\'assurance, lisibles.', tag: 'DOCUMENT', group: 'Coffre, vitrages et intérieur' },
];

/** Voiture et utilitaire : liste de Roger (20). Moto : 14. */
export function shotsFor(kind: SketchKind): Shot[] {
  if (kind === 'moto') return MOTO;
  return ROGER_LIST(kind === 'van');
}

export const SHOT_GROUPS: ShotGroup[] = ['Extérieur', 'Roues', 'Coffre, vitrages et intérieur'];
