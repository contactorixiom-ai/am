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

export function RegisterScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { register } = useSession();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      Alert.alert('Champs manquants', 'Prénom, nom, email et mot de passe requis.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Mot de passe trop court', 'Au moins 8 caractères.');
      return;
    }
    setLoading(true);
    try {
      await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
      });
    } catch (e) {
      const msg = isAxiosError(e)
        ? (e.response?.data?.message ?? 'Inscription impossible.')
        : 'Erreur réseau.';
      Alert.alert('Erreur', Array.isArray(msg) ? msg.join('\n') : String(msg));
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
            <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.displayM, letterSpacing: -0.5 }}>
              Créer un compte
            </Text>
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.body, marginTop: 6 }}>
              Quelques infos et tu peux commander un convoyage ou un envoi de colis.
            </Text>
          </View>

          <View style={{ gap: SPACING.md }}>
            <View style={{ flexDirection: 'row', gap: SPACING.md }}>
              <Field containerStyle={{ flex: 1 }} label="Prénom" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
              <Field containerStyle={{ flex: 1 }} label="Nom" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
            </View>
            <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
            <Field label="Téléphone (optionnel)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+33 6 12 34 56 78" />
            <Field label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry hint="Au moins 8 caractères" />
          </View>

          <View style={{ gap: SPACING.md }}>
            <Button kind="primary" size="lg" fullWidth onPress={submit} loading={loading}>
              Créer mon compte
            </Button>
            <Button kind="ghost" onPress={() => nav.navigate('Login')}>
              Déjà inscrit ? Se connecter
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
