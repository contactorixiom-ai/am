import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { updateProfile } from '../api/auth';
import { AppBar } from '../components/AppBar';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Surface } from '../components/Surface';
import { useSession } from '../state/SessionContext';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';
import { notify } from '../utils/notify';

/**
 * Informations du compte, enregistrées sur le serveur : elles figurent sur
 * les contrats et les factures. L'ancien écran gardait un formulaire de
 * douane sur le téléphone, que rien ne relisait.
 */
export function ProfileInfoScreen() {
  const { theme } = useTheme();
  const nav = useNavigation();
  const { user, refresh } = useSession();
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [billingAddress, setBillingAddress] = useState(user?.billingAddress ?? '');
  const [isPro, setIsPro] = useState(user?.accountType === 'PROFESSIONAL');
  const [companyName, setCompanyName] = useState(user?.companyName ?? '');
  const [companySiret, setCompanySiret] = useState(user?.companySiret ?? '');
  const [companyVatId, setCompanyVatId] = useState(user?.companyVatId ?? '');
  const [companyAddress, setCompanyAddress] = useState(user?.companyAddress ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isClient = user?.role === 'CLIENT';

  // Toujours repartir du profil serveur à jour : enregistrer un formulaire
  // pré-rempli avec des valeurs périmées effacerait la société.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    refresh().finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName ?? '');
    setLastName(user.lastName ?? '');
    setPhone(user.phone ?? '');
    setBillingAddress(user.billingAddress ?? '');
    setIsPro(user.accountType === 'PROFESSIONAL');
    setCompanyName(user.companyName ?? '');
    setCompanySiret(user.companySiret ?? '');
    setCompanyVatId(user.companyVatId ?? '');
    setCompanyAddress(user.companyAddress ?? '');
  }, [user]);

  const save = async () => {
    setError(null);
    if (!firstName.trim() || !lastName.trim()) return setError('Prénom et nom sont obligatoires.');
    if (isPro && (!companyName.trim() || !companySiret.trim())) {
      return setError('Compte professionnel : raison sociale et SIRET obligatoires.');
    }
    setSaving(true);
    try {
      await updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        billingAddress: billingAddress.trim(),
        ...(isClient
          ? {
              accountType: isPro ? 'PROFESSIONAL' : 'INDIVIDUAL',
              companyName: isPro ? companyName.trim() : '',
              companySiret: isPro ? companySiret.trim() : '',
              companyVatId: isPro ? companyVatId.trim() : '',
              companyAddress: isPro ? companyAddress.trim() : '',
            }
          : {}),
      });
      await refresh();
      notify('Informations enregistrées', 'Elles figureront sur tes prochains documents.');
      nav.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppBar title="Mes informations" subtitle="Reprises sur tes contrats et factures" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 14 }}>
          <Surface padded style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Field containerStyle={{ flex: 1 }} label="Prénom" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
              <Field containerStyle={{ flex: 1 }} label="Nom" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
            </View>
            <Field label="Téléphone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+33 6 12 34 56 78" />
            <Field label="E-mail" value={user?.email ?? ''} editable={false} hint="L'adresse de connexion ne se modifie pas ici." />
            <Field
              label="Adresse de facturation"
              value={billingAddress}
              onChangeText={setBillingAddress}
              placeholder="Numéro, rue, code postal, ville"
              multiline
            />
          </Surface>

          {isClient ? (
            <Surface padded style={{ gap: 10 }}>
              <Text style={{ fontSize: 11, color: theme.muted, letterSpacing: 1, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }}>
                Type de compte
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[{ v: false, l: 'Particulier' }, { v: true, l: 'Professionnel' }].map((o) => (
                  <Pressable
                    key={o.l}
                    onPress={() => setIsPro(o.v)}
                    style={{
                      flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: RADII.md, borderWidth: 1.5,
                      borderColor: isPro === o.v ? theme.navy : theme.line,
                      backgroundColor: isPro === o.v ? theme.bgSoft : theme.surface,
                    }}
                  >
                    <Text style={{ fontSize: 13.5, color: theme.ink, fontFamily: TYPO.weights.semibold }}>{o.l}</Text>
                  </Pressable>
                ))}
              </View>
              {isPro ? (
                <>
                  <Field label="Raison sociale" value={companyName} onChangeText={setCompanyName} placeholder="Garage Martin SARL" />
                  <Field label="SIRET" value={companySiret} onChangeText={setCompanySiret} keyboardType="number-pad" placeholder="14 chiffres" />
                  <Field label="N° de TVA intracommunautaire (facultatif)" value={companyVatId} onChangeText={setCompanyVatId} autoCapitalize="characters" placeholder="FR12345678901" />
                  <Field label="Adresse du siège (si différente)" value={companyAddress} onChangeText={setCompanyAddress} multiline />
                </>
              ) : null}
            </Surface>
          ) : null}

          {error ? <Text style={{ fontSize: 13, color: theme.bad, fontFamily: TYPO.weights.medium }}>{error}</Text> : null}
          <Button kind="primary" size="lg" fullWidth loading={saving} disabled={!ready} onPress={save}>
            Enregistrer
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
