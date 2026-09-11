import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { AppBar } from '../components/AppBar';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Icons } from '../components/Icons';
import { SectionHead } from '../components/SectionHead';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { notify } from '../utils/notify';
import { useTheme } from '../theme/ThemeProvider';
import { SPACING, TYPO } from '../theme/tokens';

// Clé de persistance partagée avec DocumentsScreen (qui lit ces infos pour
// pré-remplir les documents générés).
export const SHIPMENT_INFO_KEY = 'axis.shipmentInfo.v1';

// Forme persistée — sous-ensemble de ShipmentInput, saisi par l'utilisateur.
export interface ShipmentInfoForm {
  senderName: string;
  senderAddress: string;
  senderVat: string;
  recipientName: string;
  recipientAddress: string;
  recipientCountry: string;
  goodsDesignation: string;
  hsCode: string;
  declaredValue: string;
  currency: string;
  incoterm: string;
  weightKg: string;
  dimensions: string;
  packageCount: string;
  vehicleBrandModel: string;
  vehiclePlate: string;
}

const EMPTY: ShipmentInfoForm = {
  senderName: '', senderAddress: '', senderVat: '',
  recipientName: '', recipientAddress: '', recipientCountry: '',
  goodsDesignation: '', hsCode: '', declaredValue: '', currency: 'EUR', incoterm: '',
  weightKg: '', dimensions: '', packageCount: '',
  vehicleBrandModel: '', vehiclePlate: '',
};

export function ShipmentInfoScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [form, setForm] = useState<ShipmentInfoForm>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SHIPMENT_INFO_KEY)
      .then((raw) => { if (raw) { try { setForm({ ...EMPTY, ...JSON.parse(raw) }); } catch { /* ignore */ } } })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const set = (k: keyof ShipmentInfoForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    try {
      await AsyncStorage.setItem(SHIPMENT_INFO_KEY, JSON.stringify(form));
    } catch { /* navigation privée : on continue quand même */ }
    notify('Infos enregistrées', 'Tes documents seront générés avec ces informations.');
    nav.goBack();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppBar title="Infos de l'envoi" subtitle="Saisies une fois, réutilisées sur tous les documents" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 14 }} keyboardShouldPersistTaps="handled">

          <Surface padded style={{ padding: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <Icons.bolt size={18} color={theme.gold} stroke={1.8} />
            <Text style={{ flex: 1, fontSize: 12.5, color: theme.inkSoft, fontFamily: TYPO.weights.medium, lineHeight: 17 }}>
              Remplis ces informations une seule fois. Elles serviront à générer automatiquement la facture commerciale, la liste de colisage, la déclaration d'export et tous les autres documents.
            </Text>
          </Surface>

          <Surface padded style={{ padding: 16, gap: 12 }}>
            <SectionHead title="Expéditeur" />
            <Field label="Nom / société" value={form.senderName} onChangeText={set('senderName')} placeholder="Axis Import SAS" autoCapitalize="words" />
            <Field label="Adresse" value={form.senderAddress} onChangeText={set('senderAddress')} placeholder="14 rue de la Logistique, 75015 Paris" />
            <Field label="N° TVA / identifiant fiscal" value={form.senderVat} onChangeText={set('senderVat')} placeholder="FR42 925487312" autoCapitalize="characters" />
          </Surface>

          <Surface padded style={{ padding: 16, gap: 12 }}>
            <SectionHead title="Destinataire" />
            <Field label="Nom / société" value={form.recipientName} onChangeText={set('recipientName')} placeholder="Prénom Nom" autoCapitalize="words" />
            <Field label="Adresse de livraison" value={form.recipientAddress} onChangeText={set('recipientAddress')} placeholder="Quartier, ville" multiline numberOfLines={2} />
            <Field label="Pays de destination" value={form.recipientCountry} onChangeText={set('recipientCountry')} placeholder="Sénégal" autoCapitalize="words" hint="Détermine la réglementation douanière appliquée" />
          </Surface>

          <Surface padded style={{ padding: 16, gap: 12 }}>
            <SectionHead title="Marchandise" />
            <Field label="Désignation" value={form.goodsDesignation} onChangeText={set('goodsDesignation')} placeholder="Pièces détachées, matériel…" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Field containerStyle={{ flex: 1 }} label="Code SH (douane)" value={form.hsCode} onChangeText={set('hsCode')} placeholder="8708.99" keyboardType="numbers-and-punctuation" hint="Nomenclature douanière" />
              <Field containerStyle={{ flex: 1 }} label="N° de colis" value={form.packageCount} onChangeText={set('packageCount')} placeholder="4" keyboardType="number-pad" />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Field containerStyle={{ flex: 1.4 }} label="Valeur déclarée" value={form.declaredValue} onChangeText={set('declaredValue')} placeholder="3800" keyboardType="numeric" hint="Base des droits de douane" />
              <Field containerStyle={{ flex: 1 }} label="Devise" value={form.currency} onChangeText={set('currency')} placeholder="EUR" autoCapitalize="characters" />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Field containerStyle={{ flex: 1 }} label="Poids brut (kg)" value={form.weightKg} onChangeText={set('weightKg')} placeholder="513" keyboardType="numeric" />
              <Field containerStyle={{ flex: 1.2 }} label="Dimensions L×l×H" value={form.dimensions} onChangeText={set('dimensions')} placeholder="120×80×100 cm" />
            </View>
            <Field label="Incoterm (optionnel)" value={form.incoterm} onChangeText={set('incoterm')} placeholder="FOB Le Havre / CIF Dakar" autoCapitalize="characters" />
          </Surface>

          <Surface padded style={{ padding: 16, gap: 12 }}>
            <SectionHead title="Véhicule (si convoyage)" />
            <Field label="Marque & modèle" value={form.vehicleBrandModel} onChangeText={set('vehicleBrandModel')} placeholder="BMW Série 3 320d" />
            <Field label="Immatriculation" value={form.vehiclePlate} onChangeText={set('vehiclePlate')} placeholder="AB-123-CD" autoCapitalize="characters" />
          </Surface>

          <Button kind="gold" size="lg" fullWidth onPress={save} rightIcon={<Icons.check size={18} color={theme.navy} stroke={2.4} />} disabled={!loaded}>
            Enregistrer les informations
          </Button>
          <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium, textAlign: 'center' }}>
            Tu pourras les modifier à tout moment. Aucune donnée n'est partagée sans ton accord.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Convertit le formulaire persisté en Partial<ShipmentInput> pour dossierAuto.
export function shipmentInfoToInput(form: ShipmentInfoForm) {
  const value = parseFloat(form.declaredValue.replace(',', '.'));
  const weight = parseFloat(form.weightKg.replace(',', '.'));
  const pkg = parseInt(form.packageCount, 10);
  return {
    originCountry: 'France (UE)',
    declaredValue: Number.isFinite(value) ? value : undefined,
    currency: form.currency || undefined,
    incoterm: form.incoterm || undefined,
    sender: (form.senderName || form.senderAddress || form.senderVat)
      ? { name: form.senderName || undefined, address: form.senderAddress || undefined, vat: form.senderVat || undefined }
      : undefined,
    recipient: (form.recipientName || form.recipientAddress || form.recipientCountry)
      ? { name: form.recipientName || undefined, address: form.recipientAddress || undefined, country: form.recipientCountry || undefined }
      : undefined,
    goods: form.goodsDesignation
      ? [{ designation: form.goodsDesignation, hsCode: form.hsCode || undefined }]
      : undefined,
    weightKg: Number.isFinite(weight) ? weight : undefined,
    dimensions: form.dimensions || undefined,
    packageCount: Number.isFinite(pkg) ? pkg : undefined,
    vehicleBrandModel: form.vehicleBrandModel || undefined,
    vehiclePlate: form.vehiclePlate || undefined,
  };
}
