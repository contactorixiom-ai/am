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
  Register: undefined;
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
  BookingConfirmation: { kind: 'mission' | 'parcel'; reference: string; id: string };
  Tracking: { kind: 'mission' | 'parcel'; id: string; reference: string };
  MissionDetails: { reference?: string } | undefined;
  Messaging: { driverName?: string; subtitle?: string; conversationId?: string } | undefined;
  Conversations: undefined;
  DriverMode: undefined;
  KycVerification: undefined;
  SecuritySettings: undefined;
  VehicleDocs: undefined;
  VehicleInspection: { phase?: 'DÉPART' | 'ARRIVÉE'; reference?: string; vehicleLabel?: string } | undefined;
  CustomsRequirements: { countryCode?: string; parcelId?: string; kind?: 'parcel' | 'commercial' | 'vehicle' | 'personalParcel' } | undefined;
  ShipmentInfo: undefined;
  Notifications: undefined;
  News: undefined;
};

export type AppTabParamList = {
  Home: undefined;
  Trips: undefined;
  NewCenter: undefined;
  Documents: undefined;
  Profile: undefined;
};
