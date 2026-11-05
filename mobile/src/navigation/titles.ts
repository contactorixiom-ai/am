// Titre de l'onglet du navigateur (version web). Sans cette table, React
// Navigation affichait le nom technique de l'écran (« Tariffs », « AppTabs »…).
const TITLES: Record<string, string> = {
  Onboarding: 'Bienvenue',
  Login: 'Connexion',
  Register: 'Créer un compte',
  ForgotPassword: 'Mot de passe oublié',
  ResetPassword: 'Nouveau mot de passe',
  TrackByReference: 'Suivre un envoi',
  AppTabs: 'Accueil',
  Home: 'Accueil',
  Trips: 'Suivi',
  NewCenter: 'Nouvelle demande',
  Documents: 'Documents',
  Missions: 'Mes missions',
  Profile: 'Profil',
  ServicePicker: 'Nouvelle demande',
  Tariffs: 'Tarifs',
  CarRequest: 'Convoyage',
  ParcelRequest: 'Envoi de colis',
  PickupMode: 'Remise du colis',
  RelayPointPicker: 'Point de dépôt',
  HomePickupAddress: 'Adresse d\'enlèvement',
  QuoteReview: 'Devis',
  RecipientDetails: 'Destinataire',
  BookingConfirmation: 'Commande confirmée',
  Tracking: 'Suivi',
  MissionDetails: 'Mission',
  Messaging: 'Messages',
  Conversations: 'Messages',
  DriverMode: 'Mes missions',
  Admin: 'Espace de travail',
  MySpace: 'Mon espace',
  KycVerification: 'Mes pièces justificatives',
  SecuritySettings: 'Sécurité',
  VehicleInspection: 'État des lieux',
  CustomsRequirements: 'Douane',
  ProfileInfo: 'Mes informations',
  Notifications: 'Notifications',
  News: 'Actualités',
};

export function screenTitle(name?: string): string {
  const t = name ? TITLES[name] : undefined;
  return t ? `${t} · Axis Import` : 'Axis Import';
}
