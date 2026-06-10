import { useFonts, Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen } from './src/screens/HomeScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { QuoteScreen } from './src/screens/QuoteScreen';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';

type Route = 'onboarding' | 'home' | 'quote';

function Root() {
  const { theme } = useTheme();
  const [route, setRoute] = useState<Route>('onboarding');

  switch (route) {
    case 'home':
      return <HomeScreen onNewRequest={() => setRoute('quote')} />;
    case 'quote':
      return <QuoteScreen onBack={() => setRoute('home')} />;
    case 'onboarding':
    default:
      return (
        <OnboardingScreen
          onClient={() => setRoute('home')}
          onDriver={() => setRoute('home')}
        />
      );
  }
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F1E8' }}>
        <ActivityIndicator color="#0B2545" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StatusBar style="auto" />
        <Root />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
