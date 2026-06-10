import { QuoteResponse } from '../api/quotes';

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  AppTabs: undefined;
  ServicePicker: undefined;
  CarRequest: undefined;
  ParcelRequest: undefined;
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
