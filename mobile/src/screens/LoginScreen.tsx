import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ApiError } from '../api/client';
import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Linking, Platform, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { LEGAL_PRIVACY_URL, LEGAL_TERMS_URL } from '../config/company';
import { useLayout } from '../theme/layout';
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
      setError('E-mail (ou téléphone) et mot de passe requis.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 401) {
          setError('Identifiant ou mot de passe incorrect. Compte créé par Axis ? Utilisez « Mot de passe oublié » pour choisir votre mot de passe.');
        } else if (e.status === 429) {
          setError('Trop de tentatives. Patientez une minute avant de réessayer.');
        } else if (e.isNetworkError) {
          setError(`Impossible de joindre le serveur. ${e.message}`);
        } else {
          setError(e.message);
        }
      } else {
        setError('Une erreur inattendue est survenue.');
      }
    } finally {
      setLoading(false);
    }
  };

  const { wide } = useLayout();
  const link = (label: string, onPress: () => void) => (
    <Text onPress={onPress} accessibilityRole="link" style={{ color: theme.gold, textDecorationLine: 'underline', fontFamily: TYPO.weights.semibold }}>{label}</Text>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: SPACING.xl, paddingVertical: 40, gap: 22 }}
          keyboardShouldPersistTaps="handled"
        >
          <ServerStatusBanner />
          {/* Ordinateur : la marque à gauche, le formulaire à droite. */}
          <View style={wide ? { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 80, width: '100%', maxWidth: 1100, alignSelf: 'center' } : { gap: 22 }}>
          {/* Le vrai logo, entier (flèche comprise), au-dessus du nom. */}
          <View style={wide ? { flex: 1, maxWidth: 480, gap: 14 } : { alignItems: 'center', gap: 10 }}>
            <Image source={require('../../assets/axis-mark.png')} style={{ width: wide ? 104 : 92, height: wide ? 104 : 92 }} resizeMode="contain" accessibilityLabel="Logo Axis Import" />
            <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: wide ? 46 : 34, letterSpacing: -0.5, marginTop: 6 }}>Axis Import</Text>
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: wide ? 17 : 14.5, textAlign: wide ? 'left' : 'center' }}>
              Convoyage · Import-export Europe ↔ Afrique
            </Text>
            {wide ? (
              <View style={{ gap: 12, marginTop: 18 }}>
                {[
                  'Convoyage de voitures, motos, bus, sur plateau',
                  'Colis, fûts, palettes et véhicules vers l\u2019Afrique',
                  'Prix affiché tout de suite, suivi en temps réel',
                ].map((t) => (
                  <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.gold }} />
                    <Text style={{ color: theme.inkSoft, fontFamily: TYPO.weights.medium, fontSize: 15.5 }}>{t}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>


          <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center', flexShrink: 0, gap: 16, padding: 22, borderRadius: 22, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface }}>
            {error ? (
              <View style={{ padding: 12, borderRadius: 10, backgroundColor: theme.bad + '18', borderWidth: 1, borderColor: theme.bad + '40' }}>
                <Text style={{ color: theme.bad, fontFamily: TYPO.weights.medium, fontSize: 13, lineHeight: 18 }}>{error}</Text>
              </View>
            ) : null}
            <Field
              label="E-mail ou téléphone"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="username"
              keyboardType="email-address"
              placeholder="prenom@exemple.com ou 06 12 34 56 78"
            />
            <Field
              label="Mot de passe"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              onSubmitEditing={() => void submit()}
              returnKeyType="go"
            />
            <Button kind="gold" size="lg" fullWidth onPress={submit} loading={loading}>
              Se connecter
            </Button>
            <Text style={{ textAlign: 'center', fontSize: 14 }}>
              {link('Mot de passe oublié ?', () => nav.navigate('ForgotPassword', { email: email.includes('@') ? email.trim() : undefined }))}
            </Text>
            <Text style={{ textAlign: 'center', fontSize: 14, color: theme.muted, fontFamily: TYPO.weights.medium }}>
              Nouveau client ? {link('Créer un compte', () => nav.navigate('Register', { role: 'CLIENT' }))}
            </Text>
            <Text style={{ textAlign: 'center', fontSize: 13, color: theme.muted, fontFamily: TYPO.weights.medium }}>
              Convoyeur ? {link('Rejoindre Axis', () => nav.navigate('Register', { role: 'DRIVER' }))}
            </Text>
          </View>
          </View>

          <View style={{ alignItems: 'center', gap: 10 }}>
            <Text onPress={() => nav.navigate('TrackByReference')} style={{ fontSize: 13, color: theme.inkSoft, fontFamily: TYPO.weights.medium }}>
              Suivre un colis sans compte →
            </Text>
            <Text style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium, textAlign: 'center' }}>
              <Text onPress={() => void Linking.openURL(LEGAL_TERMS_URL)} style={{ textDecorationLine: 'underline' }}>Mentions légales</Text>
              {' · '}
              <Text onPress={() => void Linking.openURL(LEGAL_TERMS_URL)} style={{ textDecorationLine: 'underline' }}>CGV</Text>
              {' · '}
              <Text onPress={() => void Linking.openURL(LEGAL_PRIVACY_URL)} style={{ textDecorationLine: 'underline' }}>Confidentialité</Text>
            </Text>
          </View>

          <ApiUrlHint />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
