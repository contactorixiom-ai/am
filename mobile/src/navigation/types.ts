import { City, PickupMode, QuoteResponse } from '../api/quotes';

export interface ParcelDraft {
  from: City;
  to: City;
  weightKg: number;
  category: string;
  transportMode: 'AIR' | 'SEA';
}

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  TrackByReference: undefined;
  AppTabs: undefined;
  ServicePicker: undefined;
  CarRequest: undefined;
  ParcelRequest: undefined;
  PickupMode: { draft: ParcelDraft };
  RelayPointPicker: { draft: ParcelDraft };
  HomePickupAddress: { draft: ParcelDraft };
  QuoteReview: { quote: QuoteResponse };
  RecipientDetails: { quote: QuoteResponse };
  BookingConfirmation: { kind: 'mission' | 'parcel'; reference: string; id: string };
  Tracking: { kind: 'mission' | 'parcel'; id: string; reference: string };
};

export type AppTabParamList = {
  Home: undefined;
  Trips: undefined;
  Documents: undefined;
  Profile: undefined;
};
