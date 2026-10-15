import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { forgotPassword } from '../api/auth';
import { ApiError } from '../api/client';
import { AxisLogo } from '../components/AxisLogo';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { COMPANY } from '../config/company';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { SPACING, TYPO } from '../theme/tokens';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPasswordScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ForgotPassword'>>();
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // null tant que rien n'est envoyé ; sinon, l'e-mail est-il réellement parti ?
  const [sent, setSent] = useState<{ emailSent: boolean } | null>(null);

  const submit = async () => {
    setError(null);
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      setError('Indiquez une adresse e-mail valide.');
      return;
    }
    setLoading(true);
    try {
      setSent(await forgotPassword(value));
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        setError('Trop de demandes. Réessayez dans quelques minutes.');
      } else if (e instanceof ApiError && e.isNetworkError) {
        setError(`Impossible de joindre le serveur. ${e.message}`);
      } else {
        setError(e instanceof Error ? e.message : 'Une erreur inattendue est survenue.');
      }
    } finally {
      setLoading(false);
    }
  };

  const contact = [COMPANY.phone, COMPANY.email]
    .filter((v) => v && !v.includes('À COMPLÉTER'))
    .join(' · ');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: SPACING.xxl, gap: SPACING.lg }}>
          <View style={{ alignItems: 'center', marginTop: SPACING.lg }}>
            <AxisLogo size={64} />
          </View>

          <View>
            <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.displayM, letterSpacing: -0.5 }}>
              Mot de passe oublié
            </Text>
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.body, marginTop: 6, lineHeight: 21 }}>
              Indiquez l'adresse de votre compte : nous vous envoyons un lien pour choisir un nouveau mot de passe.
            </Text>
          </View>

          {error ? <Notice tone="bad" text={error} /> : null}

          {sent ? (
            <Notice
              tone="ok"
              text={
                sent.emailSent
                  ? "Si un compte existe à cette adresse, un e-mail vient de partir avec un lien valable 1 heure. Pensez à regarder dans les courriers indésirables."
                  : `Demande enregistrée. Pour recevoir votre lien d'accès, contactez Axis Import${contact ? ` : ${contact}` : ''} — il vous sera envoyé par WhatsApp ou SMS.`
              }
            />
          ) : (
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              placeholder="prenom@exemple.com"
              onSubmitEditing={submit}
            />
          )}

          <View style={{ gap: SPACING.md }}>
            {!sent ? (
              <Button kind="primary" size="lg" fullWidth onPress={submit} loading={loading}>
                Recevoir le lien
              </Button>
            ) : null}
            <Button kind="ghost" onPress={() => nav.navigate('Login')}>
              Retour à la connexion
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Notice({ tone, text }: { tone: 'ok' | 'bad'; text: string }) {
  const { theme } = useTheme();
  const color = tone === 'ok' ? theme.good : theme.bad;
  return (
    <View style={{ padding: 12, borderRadius: 10, backgroundColor: color + '18', borderWidth: 1, borderColor: color + '40' }}>
      <Text style={{ color, fontFamily: TYPO.weights.medium, fontSize: 13, lineHeight: 19 }}>{text}</Text>
    </View>
  );
}
