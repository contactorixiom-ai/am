import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { ApiError } from '../api/client';
import { ParcelSummary, trackParcel } from '../api/parcels';
import { AxisLogo } from '../components/AxisLogo';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { ParcelJourney } from '../components/ParcelJourney';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { SPACING, TYPO } from '../theme/tokens';
import { notify } from '../utils/notify';

// Suivi public d'un colis, sans compte : c'est la page qu'ouvre le
// destinataire quand l'expéditeur lui envoie le lien de suivi
// (…/app/?suivi=AXP-…). Seul le trajet est montré, jamais le contenu ni
// les coordonnées.
export function TrackByReferenceScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'TrackByReference'>>();
  const initialRef = route.params?.reference ?? '';
  const [reference, setReference] = useState(initialRef);
  const [loading, setLoading] = useState(false);
  const [parcel, setParcel] = useState<ParcelSummary | null>(null);

  const lookup = useCallback(async (raw: string) => {
    const ref = raw.trim().toUpperCase();
    if (!ref) {
      notify('Référence manquante', 'Saisis la référence du colis (AXP-...)');
      return;
    }
    setLoading(true);
    try {
      setParcel(await trackParcel(ref));
    } catch (e) {
      setParcel(null);
      if (e instanceof ApiError && e.status === 404) {
        notify('Référence introuvable', 'Vérifie la référence (elle commence par AXP-).');
      } else {
        notify('Suivi indisponible', 'Impossible de joindre Axis pour le moment. Réessaie dans un instant.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Arrivée par un lien de suivi : on affiche le voyage tout de suite.
  useEffect(() => {
    if (initialRef) void lookup(initialRef);
  }, [initialRef, lookup]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: SPACING.xl, paddingBottom: 24, gap: SPACING.lg }}>
          <View style={{ alignItems: parcel ? 'flex-start' : 'center', marginTop: parcel ? 0 : SPACING.xl }}>
            <AxisLogo size={parcel ? 40 : 64} />
          </View>

          <View>
            <Text
              style={{
                color: theme.muted,
                fontFamily: TYPO.weights.medium,
                fontSize: TYPO.sizes.label,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
              }}
            >
              {parcel ? parcel.reference : 'Suivi colis'}
            </Text>
            <Text
              style={{
                color: theme.ink,
                fontFamily: TYPO.weights.bold,
                fontSize: TYPO.sizes.displayM,
                marginTop: 4,
                letterSpacing: -0.5,
              }}
            >
              {parcel ? 'Le voyage du colis' : 'Suivre un envoi'}
            </Text>
            {!parcel ? (
              <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.body, marginTop: 8 }}>
                Pas besoin de compte. Saisis la référence de l'envoi (elle figure sur la confirmation).
              </Text>
            ) : null}
          </View>

          {parcel ? <ParcelJourney parcel={parcel} title="Étapes du voyage" /> : null}

          {!parcel ? (
            <>
              <Surface>
                <Field
                  label="Référence colis"
                  value={reference}
                  onChangeText={setReference}
                  autoCapitalize="characters"
                  placeholder="AXP-XXXXXX-XXXX"
                  hint="Format AXP suivi de la suite de caractères"
                />
              </Surface>
              <Button kind="primary" size="lg" fullWidth onPress={() => lookup(reference)} loading={loading}>
                Afficher le suivi
              </Button>
            </>
          ) : (
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: 12.5, lineHeight: 18 }}>
              Axis Import met à jour chaque étape. Le destinataire est appelé par Axis pour organiser la remise.
            </Text>
          )}

          <Pressable
            onPress={() => (parcel ? setParcel(null) : nav.canGoBack() ? nav.goBack() : nav.navigate('Onboarding'))}
            style={{ alignItems: 'center', paddingVertical: SPACING.md }}
          >
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.bodySm }}>
              {parcel ? 'Suivre un autre envoi' : nav.canGoBack() ? 'Retour' : 'Découvrir Axis Import'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
