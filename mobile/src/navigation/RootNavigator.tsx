import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { BookingConfirmationScreen } from '../screens/BookingConfirmationScreen';
import { CarRequestScreen } from '../screens/CarRequestScreen';
import { DocumentsScreen } from '../screens/DocumentsScreen';
import { HomePickupAddressScreen } from '../screens/HomePickupAddressScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { ParcelRequestScreen } from '../screens/ParcelRequestScreen';
import { PickupModeScreen } from '../screens/PickupModeScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { QuoteReviewScreen } from '../screens/QuoteReviewScreen';
import { RecipientDetailsScreen } from '../screens/RecipientDetailsScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { RelayPointPickerScreen } from '../screens/RelayPointPickerScreen';
import { ServicePickerScreen } from '../screens/ServicePickerScreen';
import { TrackingScreen } from '../screens/TrackingScreen';
import { TripsScreen } from '../screens/TripsScreen';
import { useSession } from '../state/SessionContext';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';
import { AppTabParamList, RootStackParamList } from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<AppTabParamList>();

function TabIcon({ label, focused, color }: { label: string; focused: boolean; color: string }) {
  return (
    <Text style={{ fontSize: focused ? 22 : 20, opacity: focused ? 1 : 0.6, color }}>{label}</Text>
  );
}

function AppTabs() {
  const { theme } = useTheme();
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.select,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.line,
          height: 84,
          paddingTop: 8,
          paddingBottom: 28,
        },
        tabBarLabelStyle: { fontFamily: TYPO.weights.semibold, fontSize: 11, letterSpacing: 0.3 },
      }}
    >
      <Tabs.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Accueil',
          tabBarIcon: ({ focused, color }) => <TabIcon label="🏠" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="Trips"
        component={TripsScreen}
        options={{
          title: 'Envois',
          tabBarIcon: ({ focused, color }) => <TabIcon label="📦" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="Documents"
        component={DocumentsScreen}
        options={{
          title: 'Documents',
          tabBarIcon: ({ focused, color }) => <TabIcon label="📄" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profil',
          tabBarIcon: ({ focused, color }) => <TabIcon label="👤" focused={focused} color={color} />,
        }}
      />
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  const { theme } = useTheme();
  const { user, initializing } = useSession();

  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>
        <ActivityIndicator color={theme.navy} />
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
        }}
      >
        {user ? (
          <>
            <RootStack.Screen name="AppTabs" component={AppTabs} options={{ headerShown: false }} />
            <RootStack.Screen name="ServicePicker" component={ServicePickerScreen} options={{ title: 'Nouvelle demande' }} />
            <RootStack.Screen name="CarRequest" component={CarRequestScreen} options={{ title: 'Convoyage voiture' }} />
            <RootStack.Screen name="ParcelRequest" component={ParcelRequestScreen} options={{ title: 'Envoi colis' }} />
            <RootStack.Screen name="PickupMode" component={PickupModeScreen} options={{ title: 'Récupération' }} />
            <RootStack.Screen name="RelayPointPicker" component={RelayPointPickerScreen} options={{ title: 'Point relais' }} />
            <RootStack.Screen name="HomePickupAddress" component={HomePickupAddressScreen} options={{ title: 'Adresse d\'enlèvement' }} />
            <RootStack.Screen name="QuoteReview" component={QuoteReviewScreen} options={{ title: 'Devis' }} />
            <RootStack.Screen name="RecipientDetails" component={RecipientDetailsScreen} options={{ title: 'Destinataire' }} />
            <RootStack.Screen name="BookingConfirmation" component={BookingConfirmationScreen} options={{ headerShown: false, gestureEnabled: false }} />
            <RootStack.Screen name="Tracking" component={TrackingScreen} options={{ title: 'Suivi' }} />
          </>
        ) : (
          <>
            <RootStack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
            <RootStack.Screen name="Login" component={LoginScreen} options={{ title: 'Connexion' }} />
            <RootStack.Screen name="Register" component={RegisterScreen} options={{ title: 'Inscription' }} />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
