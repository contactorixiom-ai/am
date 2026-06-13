import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { isAxiosError } from 'axios';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { AxisLogo } from '../components/AxisLogo';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { ApiUrlHint, ServerStatusBanner } from '../components/ServerStatusBanner';
import { RootStackParamList } from '../navigation/types';
import { useSession } from '../state/SessionContext';
import { useTheme } from '../theme/ThemeProvider';
import { SPACING, TYPO } from '../theme/tokens';

export function LoginScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { login } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Email et mot de passe requis.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (e) {
      if (isAxiosError(e)) {
        if (e.response) {
          if (e.response.status === 401) {
            setError('Email ou mot de passe incorrect.');
          } else {
            const data = e.response.data as { message?: string | string[] };
            const m = data?.message ?? `Erreur serveur (${e.response.status})`;
            setError(Array.isArray(m) ? m.join('\n') : String(m));
          }
        } else if (e.code === 'ECONNABORTED') {
          setError('Le serveur met trop de temps à répondre. Réessaie dans un instant.');
        } else {
          setError(`Impossible de joindre le serveur (${e.code ?? 'réseau / CORS'}).`);
        }
      } else {
        setError('Une erreur inattendue est survenue.');
      }
    } finally {
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

          <ServerStatusBanner />

          <View>
            <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.displayM, letterSpacing: -0.5 }}>
              Bon retour
            </Text>
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.body, marginTop: 6 }}>
              Connecte-toi pour suivre tes missions et tes colis.
            </Text>
          </View>

          {error ? (
            <View
              style={{
                padding: 12,
                borderRadius: 10,
                backgroundColor: theme.bad + '18',
                borderWidth: 1,
                borderColor: theme.bad + '40',
              }}
            >
              <Text style={{ color: theme.bad, fontFamily: TYPO.weights.medium, fontSize: 13, lineHeight: 18 }}>
                {error}
              </Text>
            </View>
          ) : null}

          <View style={{ gap: SPACING.md }}>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              placeholder="prenom@exemple.com"
            />
            <Field
              label="Mot de passe"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
            />
          </View>

          <View style={{ gap: SPACING.md }}>
            <Button kind="primary" size="lg" fullWidth onPress={submit} loading={loading}>
              Se connecter
            </Button>
            <Button kind="ghost" onPress={() => nav.navigate('Register')}>
              Pas encore de compte ? Créer un compte
            </Button>
          </View>

          <ApiUrlHint />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
