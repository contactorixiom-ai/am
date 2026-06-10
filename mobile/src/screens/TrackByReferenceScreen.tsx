import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { isAxiosError } from 'axios';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { trackParcel } from '../api/parcels';
import { AxisLogo } from '../components/AxisLogo';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { SPACING, TYPO } from '../theme/tokens';

export function TrackByReferenceScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const ref = reference.trim().toUpperCase();
    if (!ref) {
      Alert.alert('Référence manquante', 'Saisis la référence du colis (AXP-...)');
      return;
    }
    setLoading(true);
    try {
      const p = await trackParcel(ref);
      nav.navigate('Tracking', { kind: 'parcel', id: p.id, reference: p.reference });
    } catch (e) {
      const msg = isAxiosError(e) && e.response?.status === 404
        ? 'Aucun colis avec cette référence.'
        : 'Impossible de récupérer ce colis.';
      Alert.alert('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: SPACING.xxl, gap: SPACING.xl }}>
          <View style={{ alignItems: 'center', marginTop: SPACING.lg }}>
            <AxisLogo size={64} />
          </View>
          <View>
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.label, letterSpacing: 1.2, textTransform: 'uppercase' }}>
              Suivi colis
            </Text>
            <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.displayM, marginTop: 4, letterSpacing: -0.5 }}>
              Suivre un envoi
            </Text>
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.body, marginTop: 8 }}>
              Pas besoin de compte. Saisis la référence reçue par SMS.
            </Text>
          </View>

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

          <Button kind="primary" size="lg" fullWidth onPress={submit} loading={loading}>
            Voir le suivi
          </Button>

          <Button kind="ghost" onPress={() => nav.goBack()}>
            Retour
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
