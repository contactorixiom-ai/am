import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { ApiError } from '../api/client';
import { AxisLogo } from '../components/AxisLogo';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { TermsCheckbox } from '../components/TermsCheckbox';
import { TERMS_VERSION } from '../config/company';
import { RootStackParamList } from '../navigation/types';
import { useSession } from '../state/SessionContext';
import { useTheme } from '../theme/ThemeProvider';
import { SPACING, TYPO } from '../theme/tokens';
import { Notice } from './ForgotPasswordScreen';

/**
 * Écran ouvert par un lien de réinitialisation (e-mail, WhatsApp ou SMS).
 * Sert aussi à activer les comptes créés par Axis lors d'une commande prise
 * au téléphone : le client y choisit son premier mot de passe.
 */
export function ResetPasswordScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ResetPassword'>>();
  const { resetPassword } = useSession();
  const token = route.params?.token ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    if (!accepted) {
      setError('Merci d\'accepter les conditions générales et la politique de confidentialité.');
      return;
    }
    setLoading(true);
    try {
      // En cas de succès, la session s'ouvre et la navigation bascule
      // d'elle-même vers l'application.
      await resetPassword(token, password, TERMS_VERSION);
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        setError('Trop de tentatives. Réessayez dans quelques minutes.');
      } else if (e instanceof ApiError && e.isNetworkError) {
        setError(`Impossible de joindre le serveur. ${e.message}`);
      } else {
        setError(e instanceof Error ? e.message : 'Une erreur inattendue est survenue.');
      }
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: SPACING.xxl, gap: SPACING.lg }}>
          <View style={{ alignItems: 'center', marginTop: SPACING.lg }}>
            <AxisLogo size={64} />
          </View>

          <View>
            <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.displayM, letterSpacing: -0.5 }}>
              Choisir mon mot de passe
            </Text>
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.body, marginTop: 6, lineHeight: 21 }}>
              Il vous servira à vous connecter pour suivre vos transports, signer vos documents et régler vos factures.
            </Text>
          </View>

          {!token ? (
            <Notice tone="bad" text="Ce lien est incomplet. Ouvrez-le à nouveau depuis le message reçu, ou demandez-en un nouveau." />
          ) : null}
          {error ? <Notice tone="bad" text={error} /> : null}

          {token ? (
            <View style={{ gap: SPACING.md }}>
              <Field
                label="Nouveau mot de passe"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="new-password"
                placeholder="8 caractères minimum"
              />
              <Field
                label="Confirmer"
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
                autoComplete="new-password"
                placeholder="••••••••"
                onSubmitEditing={submit}
              />
              <TermsCheckbox checked={accepted} onChange={setAccepted} />
            </View>
          ) : null}

          <View style={{ gap: SPACING.md }}>
            {token ? (
              <Button kind="primary" size="lg" fullWidth onPress={submit} loading={loading}>
                Valider et me connecter
              </Button>
            ) : null}
            <Button kind="ghost" onPress={() => nav.navigate('ForgotPassword')}>
              Demander un nouveau lien
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
