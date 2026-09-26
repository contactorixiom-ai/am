// Prises de vue de l'état des lieux, au départ comme à l'arrivée. La liste
// suit la pratique des convoyeurs professionnels : les 8 angles du tour du
// véhicule, les jantes, puis l'habitacle, le compteur, les clés et les
// documents. Chaque photo est horodatée et rattachée au PV sur le serveur.

import type { SketchKind } from './vehicleViews';

export type ShotGroup = 'Tour du véhicule' | 'Roues' | 'Habitacle et équipements';

export interface Shot {
  key: string;
  label: string;
  /** Où se placer, quoi cadrer : affiché avant d'ouvrir l'appareil photo. */
  hint: string;
  /** Catégorie côté serveur (InspectionPhotoTag). */
  tag: 'FRONT' | 'REAR' | 'LEFT_SIDE' | 'RIGHT_SIDE' | 'INTERIOR' | 'DASHBOARD' | 'ENGINE' | 'TRUNK' | 'ODOMETER' | 'DOCUMENT' | 'OTHER';
  group: ShotGroup;
}

const TOUR: Shot[] = [
  { key: 'front', label: 'Face avant', hint: 'Face au véhicule, à 3 m, plaque et pare-chocs entiers dans le cadre.', tag: 'FRONT', group: 'Tour du véhicule' },
  { key: 'frontLeft', label: '3/4 avant gauche', hint: 'À l\'angle avant gauche : face avant et côté gauche visibles ensemble.', tag: 'FRONT', group: 'Tour du véhicule' },
  { key: 'sideLeft', label: 'Côté gauche', hint: 'Perpendiculaire au côté conducteur, du pare-chocs avant au pare-chocs arrière.', tag: 'LEFT_SIDE', group: 'Tour du véhicule' },
  { key: 'rearLeft', label: '3/4 arrière gauche', hint: 'À l\'angle arrière gauche : côté gauche et face arrière ensemble.', tag: 'REAR', group: 'Tour du véhicule' },
  { key: 'rear', label: 'Face arrière', hint: 'Derrière le véhicule, à 3 m, plaque et pare-chocs entiers.', tag: 'REAR', group: 'Tour du véhicule' },
  { key: 'rearRight', label: '3/4 arrière droit', hint: 'À l\'angle arrière droit : face arrière et côté droit ensemble.', tag: 'REAR', group: 'Tour du véhicule' },
  { key: 'sideRight', label: 'Côté droit', hint: 'Perpendiculaire au côté passager, d\'un pare-chocs à l\'autre.', tag: 'RIGHT_SIDE', group: 'Tour du véhicule' },
  { key: 'frontRight', label: '3/4 avant droit', hint: 'À l\'angle avant droit : côté droit et face avant ensemble.', tag: 'FRONT', group: 'Tour du véhicule' },
];

const WHEELS_4: Shot[] = [
  { key: 'wheelFL', label: 'Jante avant gauche', hint: 'Accroupi, la jante et le pneu entiers : rayures de trottoir visibles.', tag: 'OTHER', group: 'Roues' },
  { key: 'wheelRL', label: 'Jante arrière gauche', hint: 'Accroupi, la jante et le pneu entiers.', tag: 'OTHER', group: 'Roues' },
  { key: 'wheelRR', label: 'Jante arrière droite', hint: 'Accroupi, la jante et le pneu entiers.', tag: 'OTHER', group: 'Roues' },
  { key: 'wheelFR', label: 'Jante avant droite', hint: 'Accroupi, la jante et le pneu entiers.', tag: 'OTHER', group: 'Roues' },
];

const CAR_DETAILS: Shot[] = [
  { key: 'windshield', label: 'Pare-brise', hint: 'De l\'extérieur, tout le pare-brise : impacts et fissures.', tag: 'FRONT', group: 'Habitacle et équipements' },
  { key: 'roof', label: 'Toit', hint: 'Bras levé ou depuis une marche : la surface du toit.', tag: 'OTHER', group: 'Habitacle et équipements' },
  { key: 'dashboard', label: 'Compteur allumé', hint: 'Contact mis : kilométrage, jauge de carburant et voyants lisibles.', tag: 'ODOMETER', group: 'Habitacle et équipements' },
  { key: 'interiorFront', label: 'Intérieur avant', hint: 'Depuis la portière conducteur : sièges avant, volant, tableau de bord.', tag: 'INTERIOR', group: 'Habitacle et équipements' },
  { key: 'interiorRear', label: 'Intérieur arrière', hint: 'Banquette et plancher arrière, portière ouverte.', tag: 'INTERIOR', group: 'Habitacle et équipements' },
  { key: 'trunk', label: 'Coffre ouvert', hint: 'Coffre ouvert : contenu, tapis, roue de secours ou kit anti-crevaison.', tag: 'TRUNK', group: 'Habitacle et équipements' },
  { key: 'keys', label: 'Clés remises', hint: 'Toutes les clés et cartes remises, posées côte à côte.', tag: 'OTHER', group: 'Habitacle et équipements' },
  { key: 'documents', label: 'Documents de bord', hint: 'Carte grise (ou copie) et attestation d\'assurance, lisibles.', tag: 'DOCUMENT', group: 'Habitacle et équipements' },
];

const VAN_DETAILS: Shot[] = [
  { key: 'windshield', label: 'Pare-brise', hint: 'De l\'extérieur, tout le pare-brise : impacts et fissures.', tag: 'FRONT', group: 'Habitacle et équipements' },
  { key: 'roof', label: 'Toit / haut de caisse', hint: 'Depuis une marche ou bras levé : haut de caisse et toit.', tag: 'OTHER', group: 'Habitacle et équipements' },
  { key: 'dashboard', label: 'Compteur allumé', hint: 'Contact mis : kilométrage, jauge de carburant et voyants lisibles.', tag: 'ODOMETER', group: 'Habitacle et équipements' },
  { key: 'interiorFront', label: 'Cabine', hint: 'Depuis la portière conducteur : sièges, volant, tableau de bord.', tag: 'INTERIOR', group: 'Habitacle et équipements' },
  { key: 'cargo', label: 'Zone de chargement', hint: 'Portes arrière ouvertes : plancher, parois et contenu.', tag: 'TRUNK', group: 'Habitacle et équipements' },
  { key: 'sideDoor', label: 'Porte latérale ouverte', hint: 'Porte coulissante ouverte : seuil, rail et paroi.', tag: 'OTHER', group: 'Habitacle et équipements' },
  { key: 'keys', label: 'Clés remises', hint: 'Toutes les clés et cartes remises, posées côte à côte.', tag: 'OTHER', group: 'Habitacle et équipements' },
  { key: 'documents', label: 'Documents de bord', hint: 'Carte grise (ou copie) et attestation d\'assurance, lisibles.', tag: 'DOCUMENT', group: 'Habitacle et équipements' },
];

const MOTO: Shot[] = [
  ...TOUR,
  { key: 'wheelF', label: 'Roue avant', hint: 'Jante, pneu, disque et fourche.', tag: 'OTHER', group: 'Roues' },
  { key: 'wheelR', label: 'Roue arrière', hint: 'Jante, pneu, chaîne ou cardan.', tag: 'OTHER', group: 'Roues' },
  { key: 'dashboard', label: 'Compteur allumé', hint: 'Contact mis : kilométrage, carburant et voyants lisibles.', tag: 'ODOMETER', group: 'Habitacle et équipements' },
  { key: 'tank', label: 'Réservoir et selle', hint: 'De dessus : réservoir, bouchon et selle.', tag: 'OTHER', group: 'Habitacle et équipements' },
  { key: 'keys', label: 'Clés remises', hint: 'Toutes les clés remises, posées côte à côte.', tag: 'OTHER', group: 'Habitacle et équipements' },
  { key: 'documents', label: 'Documents de bord', hint: 'Carte grise (ou copie) et attestation d\'assurance, lisibles.', tag: 'DOCUMENT', group: 'Habitacle et équipements' },
];

/** Voiture et utilitaire : 20 photos. Moto : 14. */
export function shotsFor(kind: SketchKind): Shot[] {
  if (kind === 'moto') return MOTO;
  return [...TOUR, ...WHEELS_4, ...(kind === 'van' ? VAN_DETAILS : CAR_DETAILS)];
}

export const SHOT_GROUPS: ShotGroup[] = ['Tour du véhicule', 'Roues', 'Habitacle et équipements'];
