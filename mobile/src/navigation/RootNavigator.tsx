import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { View } from 'react-native';
import { CustomTabBar } from '../components/CustomTabBar';
import { DotLoader } from '../components/DotLoader';
import { BookingConfirmationScreen } from '../screens/BookingConfirmationScreen';
import { CarRequestScreen } from '../screens/CarRequestScreen';
import { DocumentsScreen } from '../screens/DocumentsScreen';
import { HomePickupAddressScreen } from '../screens/HomePickupAddressScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { KycVerificationScreen } from '../screens/KycVerificationScreen';
import { LoginScreen } from '../screens/LoginScreen';
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

function AppTabs() {
  return (
    <Tabs.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="Trips" component={TripsScreen} />
      <Tabs.Screen name="NewCenter" component={NewCenterPlaceholder} />
      <Tabs.Screen name="Documents" component={DocumentsScreen} />
      <Tabs.Screen name="Profile" component={ProfileScreen} />
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  const { theme } = useTheme();
  const { user, initializing } = useSession();
  const [introSeen, setIntroSeen] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    shouldShowIntroSlides().then((needs) => setIntroSeen(!needs));
  }, []);

  if (initializing || introSeen === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>
        <DotLoader size={8} />
      </View>
    );
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
            <RootStack.Screen name="KycVerification" component={KycVerificationScreen} />
            <RootStack.Screen name="SecuritySettings" component={SecuritySettingsScreen} />
            <RootStack.Screen name="VehicleDocs" component={VehicleDocsScreen} />
            <RootStack.Screen name="VehicleInspection" component={VehicleInspectionScreen} />
            <RootStack.Screen name="CustomsRequirements" component={CustomsRequirementsScreen} />
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
            <RootStack.Screen name="TrackByReference" component={TrackByReferenceScreen} />
            <RootStack.Screen name="Tracking" component={TrackingScreen} />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
