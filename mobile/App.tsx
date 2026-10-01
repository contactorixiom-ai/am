import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DotLoader } from './src/components/DotLoader';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { ToastProvider } from './src/components/PushToast';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ParcelDraftProvider } from './src/state/ParcelDraftContext';
import { SessionProvider } from './src/state/SessionContext';
import { ThemeProvider } from './src/theme/ThemeProvider';
import { notify } from './src/utils/notify';

// Retour de la page Stripe (?payment=success|cancel). Sur téléphone, Stripe
// s'ouvre dans le navigateur et y revient : sans message, le client restait
// sur un accueil web sans savoir si son paiement était passé.
function useStripeReturnNotice(ready: boolean) {
  useEffect(() => {
    if (!ready || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get('payment');
    if (!outcome) return;
    window.history.replaceState(null, '', window.location.pathname);
    setTimeout(() => {
      if (outcome === 'success') {
        notify('Paiement reçu ✓', 'Merci ! Ta commande est confirmée. Si tu as payé depuis l\'application, tu peux fermer cette page et y revenir.');
      } else {
        notify('Paiement annulé', 'Aucun montant n\'a été débité. Tu peux régler plus tard depuis l\'onglet Documents.');
      }
    }, 600);
  }, [ready]);
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });
  useStripeReturnNotice(fontsLoaded);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F1E8' }}>
        <DotLoader size={8} color="#0B2545" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            <SessionProvider>
              <ParcelDraftProvider>
                <ToastProvider>
                  <StatusBar style="auto" />
                  <RootNavigator />
                </ToastProvider>
              </ParcelDraftProvider>
            </SessionProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
