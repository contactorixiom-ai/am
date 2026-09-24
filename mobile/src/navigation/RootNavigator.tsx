import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { Platform } from 'react-native';
import { CustomTabBar } from '../components/CustomTabBar';
import { SplashScreen } from '../components/SplashScreen';
import { BookingConfirmationScreen } from '../screens/BookingConfirmationScreen';
import { CarRequestScreen } from '../screens/CarRequestScreen';
import { DocumentsScreen } from '../screens/DocumentsScreen';
import { HomePickupAddressScreen } from '../screens/HomePickupAddressScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { KycVerificationScreen } from '../screens/KycVerificationScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { ResetPasswordScreen } from '../screens/ResetPasswordScreen';
import { AdminScreen } from '../screens/AdminScreen';
import { ConversationsScreen } from '../screens/ConversationsScreen';
import { DriverModeScreen } from '../screens/DriverModeScreen';
import { MessagingScreen } from '../screens/MessagingScreen';
import { MissionDetailsScreen } from '../screens/MissionDetailsScreen';
import { NewsScreen } from '../screens/NewsScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { IntroSlidesScreen, shouldShowIntroSlides } from '../screens/IntroSlidesScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { ParcelRequestScreen } from '../screens/ParcelRequestScreen';
import { PickupModeScreen } from '../screens/PickupModeScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { QuoteReviewScreen } from '../screens/QuoteReviewScreen';
import { RecipientDetailsScreen } from '../screens/RecipientDetailsScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { RelayPointPickerScreen } from '../screens/RelayPointPickerScreen';
import { SecuritySettingsScreen } from '../screens/SecuritySettingsScreen';
import { ServicePickerScreen } from '../screens/ServicePickerScreen';
import { VehicleDocsScreen } from '../screens/VehicleDocsScreen';
import { TrackByReferenceScreen } from '../screens/TrackByReferenceScreen';
import { TrackingScreen } from '../screens/TrackingScreen';
import { TripsScreen } from '../screens/TripsScreen';
import { VehicleInspectionScreen } from '../screens/VehicleInspectionScreen';
import { CustomsRequirementsScreen } from '../screens/CustomsRequirementsScreen';
import { ShipmentInfoScreen } from '../screens/ShipmentInfoScreen';
import { useSession } from '../state/SessionContext';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';
import { AppTabParamList, RootStackParamList } from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<AppTabParamList>();

// Placeholder écran pour la position centrale (jamais affiché, juste pour
// que le custom tab bar puisse afficher le bouton "Demander" en or au milieu)
function NewCenterPlaceholder() {
  return null;
}

// Les onglets dépendent du rôle. Un convoyeur n'est pas un client : il ne
// commande pas de transport, et l'onglet Documents lui présentait les
// factures du client — avec un bouton « Régler » pour une mission qu'il
// conduit. À la place, il accède directement à ses missions.
function AppTabs() {
  const { user } = useSession();
  const isDriverOnly = user?.role === 'DRIVER';

  return (
    <Tabs.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="Trips" component={TripsScreen} />
      {isDriverOnly ? (
        <Tabs.Screen name="Missions" component={DriverModeScreen} />
      ) : (
        <>
          <Tabs.Screen name="NewCenter" component={NewCenterPlaceholder} />
          <Tabs.Screen name="Documents" component={DocumentsScreen} />
        </>
      )}
      <Tabs.Screen name="Profile" component={ProfileScreen} />
    </Tabs.Navigator>
  );
}

// Lien de réinitialisation ouvert dans le navigateur :
// …/app/?reinitialisation=JETON. Lu une seule fois au démarrage, puis
// retiré de la barre d'adresse (il ne doit pas rester dans l'historique ni
// être recopié par erreur).
function takeResetTokenFromUrl(): string | undefined {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
  try {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('reinitialisation') ?? undefined;
    if (token) {
      url.searchParams.delete('reinitialisation');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
    return token || undefined;
  } catch {
    return undefined;
  }
}

export function RootNavigator() {
  const { theme } = useTheme();
  const { user, initializing } = useSession();
  const [introSeen, setIntroSeen] = React.useState<boolean | null>(null);
  const [resetToken] = React.useState(takeResetTokenFromUrl);

  const [minElapsed, setMinElapsed] = React.useState(false);

  React.useEffect(() => {
    // Filet de sécurité : si shouldShowIntroSlides échoue (ex. AsyncStorage
    // bloqué en navigation privée Safari iOS), on saute l'intro pour ne
    // pas bloquer l'utilisateur sur un écran blanc.
    shouldShowIntroSlides()
      .then((needs) => setIntroSeen(!needs))
      .catch(() => setIntroSeen(true));
    // Durée minimale d'affichage du splash pour laisser jouer l'animation.
    const t = setTimeout(() => setMinElapsed(true), 1500);
    return () => clearTimeout(t);
  }, []);

  if (initializing || introSeen === null || !minElapsed) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: theme.bg },
          headerTitleStyle: { fontFamily: TYPO.weights.semibold, color: theme.ink },
          headerTintColor: theme.navy,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.bg },
          headerShown: false,
        }}
      >
        {resetToken && !user ? (
          // Arrivée par un lien : on va droit au choix du mot de passe,
          // sans passer par l'introduction.
          <RootStack.Screen
            name="ResetPassword"
            component={ResetPasswordScreen}
            initialParams={{ token: resetToken }}
          />
        ) : null}
        {user ? (
          <>
            <RootStack.Screen name="AppTabs" component={AppTabs} />
            <RootStack.Screen name="ServicePicker" component={ServicePickerScreen} />
            <RootStack.Screen name="CarRequest" component={CarRequestScreen} />
            <RootStack.Screen name="ParcelRequest" component={ParcelRequestScreen} />
            <RootStack.Screen name="PickupMode" component={PickupModeScreen} />
            <RootStack.Screen name="RelayPointPicker" component={RelayPointPickerScreen} />
            <RootStack.Screen name="HomePickupAddress" component={HomePickupAddressScreen} />
            <RootStack.Screen name="QuoteReview" component={QuoteReviewScreen} />
            <RootStack.Screen name="RecipientDetails" component={RecipientDetailsScreen} />
            <RootStack.Screen name="BookingConfirmation" component={BookingConfirmationScreen} options={{ gestureEnabled: false }} />
            <RootStack.Screen name="Tracking" component={TrackingScreen} />
            <RootStack.Screen name="MissionDetails" component={MissionDetailsScreen} />
            <RootStack.Screen name="Messaging" component={MessagingScreen} />
            <RootStack.Screen name="Conversations" component={ConversationsScreen} />
            <RootStack.Screen name="DriverMode" component={DriverModeScreen} />
            <RootStack.Screen name="Admin" component={AdminScreen} />
            <RootStack.Screen name="KycVerification" component={KycVerificationScreen} />
            <RootStack.Screen name="SecuritySettings" component={SecuritySettingsScreen} />
            <RootStack.Screen name="VehicleDocs" component={VehicleDocsScreen} />
            <RootStack.Screen name="VehicleInspection" component={VehicleInspectionScreen} />
            <RootStack.Screen name="CustomsRequirements" component={CustomsRequirementsScreen} />
            <RootStack.Screen name="ShipmentInfo" component={ShipmentInfoScreen} />
            <RootStack.Screen name="Notifications" component={NotificationsScreen} />
            <RootStack.Screen name="News" component={NewsScreen} />
          </>
        ) : (
          <>
            {!introSeen ? (
              <RootStack.Screen name="IntroSlides" component={IntroSlidesScreen} />
            ) : null}
            <RootStack.Screen name="Onboarding" component={OnboardingScreen} />
            <RootStack.Screen name="Login" component={LoginScreen} />
            <RootStack.Screen name="Register" component={RegisterScreen} />
            <RootStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            {!resetToken ? <RootStack.Screen name="ResetPassword" component={ResetPasswordScreen} /> : null}
            <RootStack.Screen name="TrackByReference" component={TrackByReferenceScreen} />
            <RootStack.Screen name="Tracking" component={TrackingScreen} />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
