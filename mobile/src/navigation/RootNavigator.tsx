import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { Platform, View } from 'react-native';
import { CustomTabBar } from '../components/CustomTabBar';
import { SideNav } from '../components/SideNav';
import { APP_MAX_WIDTH, useLayout } from '../theme/layout';
import { SplashScreen } from '../components/SplashScreen';
import { BookingConfirmationScreen } from '../screens/BookingConfirmationScreen';
import { CarRequestScreen } from '../screens/CarRequestScreen';
import { DocumentsScreen } from '../screens/DocumentsScreen';
import { HomePickupAddressScreen } from '../screens/HomePickupAddressScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ClientHomeScreen } from '../screens/ClientHomeScreen';
import { KycVerificationScreen } from '../screens/KycVerificationScreen';
import { MySpaceScreen } from '../screens/MySpaceScreen';
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
import { TariffsScreen } from '../screens/TariffsScreen';
import { TrackByReferenceScreen } from '../screens/TrackByReferenceScreen';
import { TrackingScreen } from '../screens/TrackingScreen';
import { TripsScreen } from '../screens/TripsScreen';
import { VehicleInspectionScreen } from '../screens/VehicleInspectionScreen';
import { CustomsRequirementsScreen } from '../screens/CustomsRequirementsScreen';
import { ProfileInfoScreen } from '../screens/ProfileInfoScreen';
import { useSession } from '../state/SessionContext';
import { onNotificationTap } from '../utils/push';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';
import { screenTitle } from './titles';
import { notificationTarget } from './notificationTarget';
import { AppTabParamList, RootStackParamList } from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();
const Tabs = createBottomTabNavigator<AppTabParamList>();


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
      {/* Barre du bas : Mes envois · Commander · Documents · Messages · Compte
          (convoyeur : Accueil · Missions · Messages · Compte). « Suivi » reste
          joignable depuis l'accueil et le menu PC, sans onglet. */}
      <Tabs.Screen name="Home" component={user?.role === 'CLIENT' ? ClientHomeScreen : HomeScreen} />
      {isDriverOnly ? (
        <Tabs.Screen name="Missions" component={DriverModeScreen} />
      ) : (
        <>
          <Tabs.Screen name="Commander" component={ServicePickerScreen} />
          <Tabs.Screen name="Documents" component={DocumentsScreen} />
        </>
      )}
      <Tabs.Screen name="Messages" component={ConversationsScreen} />
      <Tabs.Screen name="Profile" component={ProfileScreen} />
      <Tabs.Screen name="Trips" component={TripsScreen} />
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

// Lien de suivi partagé au destinataire : …/app/?suivi=AXP-XXXX. Lu une
// fois au démarrage ; la référence reste dans l'adresse (rien de secret).
function takeTrackingRefFromUrl(): string | undefined {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
  try {
    const ref = new URL(window.location.href).searchParams.get('suivi');
    return ref && /^[A-Z0-9-]{6,40}$/i.test(ref) ? ref.toUpperCase() : undefined;
  } catch {
    return undefined;
  }
}

export function RootNavigator() {
  const { wide } = useLayout();
  const { theme } = useTheme();
  const { user, initializing } = useSession();
  const [resetToken] = React.useState(takeResetTokenFromUrl);
  const [trackingRef] = React.useState(takeTrackingRefFromUrl);

  // Appui sur une notification : on ouvre l'écran qui la concerne.
  const signedIn = !!user;
  React.useEffect(() => {
    if (!signedIn) return;
    return onNotificationTap((data) => {
      const go = () => {
        if (!navigationRef.isReady()) return false;
        const target = notificationTarget(String(data.type ?? ''), data as Record<string, unknown>);
        // @ts-expect-error — navigation dynamique sur des routes typées
        if (target) navigationRef.navigate(target.screen, target.params);
        else navigationRef.navigate('Notifications');
        return true;
      };
      // Au lancement à froid, la navigation n'est pas encore montée.
      if (!go()) setTimeout(go, 800);
    });
  }, [signedIn]);

  const [minElapsed, setMinElapsed] = React.useState(false);

  React.useEffect(() => {
    // Durée minimale d'affichage du splash pour laisser jouer l'animation.
    const t = setTimeout(() => setMinElapsed(true), 1500);
    return () => clearTimeout(t);
  }, []);

  if (initializing || !minElapsed) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer ref={navigationRef} documentTitle={{ formatter: (_options, route) => screenTitle(route?.name) }}>
      <View style={{ flex: 1, flexDirection: 'row' }}>
      {wide && user ? <SideNav navigationRef={navigationRef} /> : null}
      {/* À droite du menu : contenu limité à une largeur lisible, sans cadre. */}
      <View style={{ flex: 1, minWidth: 0, maxWidth: wide ? APP_MAX_WIDTH : undefined }}>
      <RootStack.Navigator
        initialRouteName={trackingRef && !resetToken ? 'TrackByReference' : undefined}
        screenOptions={{
          headerStyle: { backgroundColor: theme.bg },
          headerTitleStyle: { fontFamily: TYPO.weights.semibold, color: theme.ink },
          headerTintColor: theme.link,
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
            <RootStack.Screen name="Tariffs" component={TariffsScreen} />
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
            <RootStack.Screen name="MySpace" component={MySpaceScreen} />
            <RootStack.Screen name="SecuritySettings" component={SecuritySettingsScreen} />
            <RootStack.Screen name="VehicleInspection" component={VehicleInspectionScreen} />
            <RootStack.Screen name="CustomsRequirements" component={CustomsRequirementsScreen} />
            <RootStack.Screen name="ProfileInfo" component={ProfileInfoScreen} />
            <RootStack.Screen name="Notifications" component={NotificationsScreen} />
            <RootStack.Screen name="News" component={NewsScreen} />
            <RootStack.Screen name="TrackByReference" component={TrackByReferenceScreen} initialParams={trackingRef ? { reference: trackingRef } : undefined} />
          </>
        ) : (
          <>
            {/* Sans compte : l'écran de connexion d'abord (créer un compte,
                rejoindre comme convoyeur et suivre un colis y sont proposés). */}
            <RootStack.Screen name="Login" component={LoginScreen} />
            <RootStack.Screen name="Onboarding" component={OnboardingScreen} />
            {/* Grille tarifaire : réservée aux comptes connectés (plus de lien public). */}
            <RootStack.Screen name="Register" component={RegisterScreen} />
            <RootStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            {!resetToken ? <RootStack.Screen name="ResetPassword" component={ResetPasswordScreen} /> : null}
            <RootStack.Screen name="TrackByReference" component={TrackByReferenceScreen} initialParams={trackingRef ? { reference: trackingRef } : undefined} />
            <RootStack.Screen name="Tracking" component={TrackingScreen} />
          </>
        )}
      </RootStack.Navigator>
      </View>
      </View>
    </NavigationContainer>
  );
}
