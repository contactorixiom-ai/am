import { City, PickupMode, QuoteResponse } from '../api/quotes';

export interface ParcelDraft {
  from: City;
  to: City;
  weightKg: number;
  category: string;
  transportMode: 'AIR' | 'SEA';
  /** PARCEL (colis < 30 kg) ou MERCHANDISE (palettes, volumineux). */
  service?: 'PARCEL' | 'MERCHANDISE';
}

export type RootStackParamList = {
  IntroSlides: undefined;
  Onboarding: undefined;
  Login: undefined;
  Register: { role?: 'CLIENT' | 'DRIVER' } | undefined;
  ForgotPassword: { email?: string } | undefined;
  ResetPassword: { token?: string } | undefined;
  TrackByReference: undefined;
  AppTabs: undefined;
  ServicePicker: undefined;
  CarRequest: { service?: 'CONVOY_CAR' | 'CONVOY_MOTO' } | undefined;
  ParcelRequest: { service?: 'PARCEL' | 'MERCHANDISE' } | undefined;
  PickupMode: { draft: ParcelDraft };
  RelayPointPicker: { draft: ParcelDraft };
  HomePickupAddress: { draft: ParcelDraft };
  QuoteReview: { quote: QuoteResponse };
  RecipientDetails: { quote: QuoteResponse };
  BookingConfirmation: { kind: 'mission' | 'parcel'; reference: string; id: string; unpaid?: boolean };
  Tracking: { kind: 'mission' | 'parcel'; id: string; reference: string };
  MissionDetails: { reference?: string } | undefined;
  Messaging:
    | {
        driverName?: string;
        subtitle?: string;
        conversationId?: string;
        /** À défaut de conversationId, on retrouve le fil rattaché au dossier. */
        missionId?: string;
        parcelId?: string;
      }
    | undefined;
  Conversations: undefined;
  DriverMode: undefined;
  Admin: undefined;
  KycVerification: undefined;
  SecuritySettings: undefined;
  VehicleInspection: { phase?: 'DÉPART' | 'ARRIVÉE'; missionId?: string; reference?: string; vehicleLabel?: string; clientName?: string } | undefined;
  CustomsRequirements: { countryCode?: string; parcelId?: string; kind?: 'parcel' | 'commercial' | 'vehicle' | 'personalParcel' } | undefined;
  ProfileInfo: undefined;
  Notifications: undefined;
  News: undefined;
};

export type AppTabParamList = {
  Home: undefined;
  Trips: undefined;
  NewCenter: undefined;
  Documents: undefined;
  /** Onglet convoyeur : ses missions affectées et le suivi GPS. */
  Missions: undefined;
  Profile: undefined;
};
