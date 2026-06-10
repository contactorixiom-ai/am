import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { isAxiosError } from 'axios';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { AxisLogo } from '../components/AxisLogo';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
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

  const submit = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Champs manquants', 'Email et mot de passe requis.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      // Navigation auto via RootNavigator quand user devient non-null
    } catch (e) {
      const msg = isAxiosError(e)
        ? (e.response?.data?.message ?? 'Identifiants incorrects.')
        : 'Connexion impossible.';
      Alert.alert('Erreur', Array.isArray(msg) ? msg.join('\n') : String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: SPACING.xxl, gap: SPACING.xl }}>
          <View style={{ alignItems: 'center', marginTop: SPACING.lg }}>
            <AxisLogo size={64} />
          </View>
          <View>
            <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.displayM, letterSpacing: -0.5 }}>
              Bon retour
            </Text>
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.body, marginTop: 6 }}>
              Connecte-toi pour suivre tes missions et tes colis.
            </Text>
          </View>

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

          <View style={{ gap: SPACING.md, marginTop: 'auto' }}>
            <Button kind="primary" size="lg" fullWidth onPress={submit} loading={loading}>
              Se connecter
            </Button>
            <Button kind="ghost" onPress={() => nav.navigate('Register')}>
              Pas encore de compte ? Créer un compte
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
