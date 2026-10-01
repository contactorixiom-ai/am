import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ApiError } from '../api/client';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { AxisLogo } from '../components/AxisLogo';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { TermsCheckbox } from '../components/TermsCheckbox';
import { TERMS_VERSION } from '../config/company';
import { ApiUrlHint, ServerStatusBanner } from '../components/ServerStatusBanner';
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
  const [accepted, setAccepted] = useState(false);
  // Client professionnel (garage, concession, loueur, importateur…) : la
  // société figure sur ses contrats et factures.
  const [isPro, setIsPro] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companySiret, setCompanySiret] = useState('');
  const [companyVatId, setCompanyVatId] = useState('');
  // « Je suis chauffeur » crée un compte convoyeur : sans cela, tous les
  // comptes étaient créés comme clients et aucun convoyeur inscrit par
  // l'application ne pouvait accepter de mission.
  const route = useRoute<RouteProp<RootStackParamList, 'Register'>>();
  const role = route.params?.role === 'DRIVER' ? 'DRIVER' : 'CLIENT';
  const isDriver = role === 'DRIVER';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      setError('Prénom, nom, email et mot de passe sont requis.');
      return;
    }
    if (isDriver && !phone.trim()) {
      setError('Le téléphone est nécessaire pour qu\'Axis puisse te joindre pendant une mission.');
      return;
    }
    if (password.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères.');
      return;
    }
    if (!isDriver && isPro && (!companyName.trim() || !companySiret.trim())) {
      setError('Compte professionnel : raison sociale et SIRET obligatoires.');
      return;
    }
    if (!accepted) {
      setError('Merci d\'accepter les conditions générales et la politique de confidentialité.');
      return;
    }
    setLoading(true);
    try {
      await register({
        role,
        acceptedTermsVersion: TERMS_VERSION,
        ...(!isDriver && isPro
          ? {
              accountType: 'PROFESSIONAL' as const,
              companyName: companyName.trim(),
              companySiret: companySiret.trim(),
              companyVatId: companyVatId.trim() || undefined,
            }
          : {}),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        password,
      });
      // Succès → le RootNavigator bascule automatiquement vers l'app
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.isNetworkError) {
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: SPACING.xxl, gap: SPACING.lg }}>
          <View style={{ alignItems: 'center', marginTop: SPACING.lg }}>
            <AxisLogo size={64} />
          </View>

          <ServerStatusBanner />

          <View>
            <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.displayM, letterSpacing: -0.5 }}>
              {isDriver ? 'Devenir convoyeur' : 'Créer un compte'}
            </Text>
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.body, marginTop: 6, lineHeight: 21 }}>
              {isDriver
                ? 'Crée ton compte, puis envoie ta pièce d\'identité et ton permis : une fois vérifiés par Axis, tu pourras accepter des missions.'
                : 'Quelques infos et tu peux commander un convoyage ou un envoi de colis.'}
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

          {!isDriver ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[{ v: false, l: 'Particulier' }, { v: true, l: 'Professionnel' }].map((o) => (
                <Pressable
                  key={o.l}
                  onPress={() => setIsPro(o.v)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isPro === o.v }}
                  style={{
                    flex: 1, paddingVertical: 11, alignItems: 'center', borderRadius: 12, borderWidth: 1.5,
                    borderColor: isPro === o.v ? theme.navy : theme.line,
                    backgroundColor: isPro === o.v ? theme.navy : theme.surface,
                  }}
                >
                  <Text style={{ fontSize: 14, color: isPro === o.v ? theme.bg : theme.ink, fontFamily: TYPO.weights.semibold }}>{o.l}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={{ gap: SPACING.md }}>
            {!isDriver && isPro ? (
              <>
                <Field label="Raison sociale" value={companyName} onChangeText={setCompanyName} placeholder="Garage Martin SARL" />
                <Field label="SIRET" value={companySiret} onChangeText={setCompanySiret} keyboardType="number-pad" placeholder="14 chiffres" />
                <Field label="N° de TVA (facultatif)" value={companyVatId} onChangeText={setCompanyVatId} autoCapitalize="characters" placeholder="FR12345678901" />
              </>
            ) : null}
            <View style={{ flexDirection: 'row', gap: SPACING.md }}>
              <Field containerStyle={{ flex: 1 }} label="Prénom" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
              <Field containerStyle={{ flex: 1 }} label="Nom" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
            </View>
            <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
            <Field label={isDriver ? 'Téléphone' : 'Téléphone (optionnel)'} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+33 6 12 34 56 78" />
            <Field label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry hint="Au moins 8 caractères" />
          </View>

          <TermsCheckbox checked={accepted} onChange={setAccepted} />

          <View style={{ gap: SPACING.md }}>
            <Button kind="primary" size="lg" fullWidth onPress={submit} loading={loading}>
              Créer mon compte
            </Button>
            <Button kind="ghost" onPress={() => nav.navigate('Login')}>
              Déjà inscrit ? Se connecter
            </Button>
          </View>

          <ApiUrlHint />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
