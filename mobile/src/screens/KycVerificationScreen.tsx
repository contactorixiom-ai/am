import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { AppBar } from '../components/AppBar';
import { Button } from '../components/Button';
import { Icons } from '../components/Icons';
import { Pill, PillTone } from '../components/Pill';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { notify } from '../utils/notify';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';

type DocStatus = 'pending' | 'uploaded' | 'verified' | 'rejected';

interface RequiredDoc {
  key: string;
  title: string;
  hint: string;
  required: boolean;
}

const REQUIRED_DOCS: RequiredDoc[] = [
  { key: 'license_front', title: 'Permis de conduire — recto', hint: 'Photo nette, sans reflet', required: true },
  { key: 'license_back',  title: 'Permis de conduire — verso', hint: 'Toutes les catégories visibles', required: true },
  { key: 'id_front',      title: 'Pièce d\'identité — recto', hint: 'CNI ou passeport', required: true },
  { key: 'id_back',       title: 'Pièce d\'identité — verso', hint: 'Sauf si passeport', required: false },
  { key: 'address',       title: 'Justificatif de domicile', hint: 'Moins de 3 mois (facture, quittance)', required: true },
  { key: 'selfie',        title: 'Selfie de contrôle', hint: 'Pour vérification anti-fraude', required: true },
];

type State = Record<string, { status: DocStatus; uri?: string; uploadedAt?: string }>;

const STORAGE_KEY = 'axis.kyc.v1';

export function KycVerificationScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [state, setState] = useState<State>({});

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) try { setState(JSON.parse(raw)); } catch { /* ignore */ }
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state]);

  const totalRequired = REQUIRED_DOCS.filter((d) => d.required).length;
  const uploadedRequired = REQUIRED_DOCS.filter((d) => d.required && (state[d.key]?.status === 'uploaded' || state[d.key]?.status === 'verified')).length;
  const progress = Math.round((uploadedRequired / totalRequired) * 100);

  const allVerified = REQUIRED_DOCS.every((d) => !d.required || state[d.key]?.status === 'verified');
  const allUploaded = uploadedRequired === totalRequired;

  const pickFile = (key: string) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      // Native fallback — on n'a pas configuré expo-image-picker dans cette
      // version, donc on simule pour la démo.
      simulateUpload(key);
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setState((prev) => ({
          ...prev,
          [key]: {
            status: 'uploaded',
            uri: dataUrl,
            uploadedAt: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
          },
        }));
        notify('Document envoyé', 'Notre équipe vérifie ton document sous 24h.');
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const simulateUpload = (key: string) => {
    setState((prev) => ({
      ...prev,
      [key]: {
        status: 'uploaded',
        uploadedAt: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
      },
    }));
    notify('Document envoyé', 'Notre équipe vérifie ton document sous 24h.');
  };

  // Bouton démo : valider tout d'un coup (pour la présentation client)
  const simulateAdminApproval = () => {
    setState((prev) => {
      const next: State = { ...prev };
      REQUIRED_DOCS.forEach((d) => {
        if (next[d.key]?.status === 'uploaded') {
          next[d.key] = { ...next[d.key], status: 'verified' };
        }
      });
      return next;
    });
    notify('Profil vérifié', 'Tes documents ont été validés par notre équipe conformité.');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppBar title="Vérification d'identité" subtitle="KYC chauffeur · conforme RGPD" />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 16 }}>
        {/* Hero statut global */}
        <Surface padded flat style={{ padding: 16, backgroundColor: allVerified ? '#0F4D2C' : theme.navy, borderColor: allVerified ? '#0F4D2C' : theme.navy }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(245,241,232,0.12)', alignItems: 'center', justifyContent: 'center' }}>
              {allVerified
                ? <Icons.check size={22} color={theme.goldHi} stroke={2.4} />
                : <Icons.shield size={22} color={theme.goldHi} stroke={1.8} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: theme.goldHi, letterSpacing: 1, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }}>
                {allVerified ? 'Profil vérifié' : allUploaded ? 'Vérification en cours' : 'À compléter'}
              </Text>
              <Text style={{ fontSize: 18, color: '#F5F1E8', fontFamily: TYPO.weights.bold, marginTop: 2, letterSpacing: -0.2 }}>
                {allVerified ? 'Tu es habilité à conduire' : `${uploadedRequired}/${totalRequired} documents fournis`}
              </Text>
            </View>
          </View>

          {/* Progression */}
          <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(245,241,232,0.15)', marginTop: 14 }}>
            <View style={{ width: `${progress}%`, height: '100%', backgroundColor: theme.gold, borderRadius: 2 }} />
          </View>
          <Text style={{ fontSize: 11.5, color: 'rgba(245,241,232,0.62)', marginTop: 8, fontFamily: TYPO.weights.medium }}>
            {allVerified
              ? 'Validation conformité réalisée par notre équipe. Tes documents sont chiffrés AES-256.'
              : 'Tes documents sont chiffrés en transit (TLS 1.3) et au repos (AES-256). Conservés 7 ans (obligation légale convoyage).'}
          </Text>
        </Surface>

        {/* Liste des documents */}
        <View style={{ gap: 10 }}>
          {REQUIRED_DOCS.map((doc) => {
            const s = state[doc.key]?.status ?? 'pending';
            return (
              <DocCard
                key={doc.key}
                title={doc.title}
                hint={doc.hint}
                required={doc.required}
                status={s}
                uri={state[doc.key]?.uri}
                uploadedAt={state[doc.key]?.uploadedAt}
                onPick={() => pickFile(doc.key)}
              />
            );
          })}
        </View>

        {/* Garanties sécurité */}
        <Surface padded style={{ padding: 14 }}>
          <Text style={{ fontSize: 11, color: theme.muted, letterSpacing: 1, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }}>
            Sécurité de tes données
          </Text>
          {[
            { Ic: Icons.shield, t: 'Chiffrement AES-256 au repos, TLS 1.3 en transit' },
            { Ic: Icons.check,  t: 'Conforme RGPD · serveurs en France (Hébergeur agréé HDS)' },
            { Ic: Icons.doc,    t: 'Conservation 7 ans (obligation légale convoyage)' },
            { Ic: Icons.x,      t: 'Aucun partage tiers · droit de suppression sur demande' },
          ].map((r) => (
            <View key={r.t} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
              <r.Ic size={16} color={theme.gold} stroke={1.8} />
              <Text style={{ flex: 1, fontSize: 12.5, color: theme.inkSoft, fontFamily: TYPO.weights.medium }}>{r.t}</Text>
            </View>
          ))}
        </Surface>

        {/* Bouton démo */}
        {allUploaded && !allVerified ? (
          <Button kind="outline" size="lg" fullWidth onPress={simulateAdminApproval}>
            [Démo] Simuler la validation conformité
          </Button>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function DocCard({
  title, hint, required, status, uri, uploadedAt, onPick,
}: {
  title: string;
  hint: string;
  required: boolean;
  status: DocStatus;
  uri?: string;
  uploadedAt?: string;
  onPick: () => void;
}) {
  const { theme } = useTheme();
  const tone: PillTone =
    status === 'verified' ? 'good' :
    status === 'uploaded' ? 'navy' :
    status === 'rejected' ? 'bad' : 'ghost';
  const label =
    status === 'verified' ? 'Vérifié' :
    status === 'uploaded' ? 'En vérification' :
    status === 'rejected' ? 'Refusé' : (required ? 'Requis' : 'Optionnel');

  return (
    <Pressable onPress={onPick}>
      <Surface padded style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 56, height: 44, borderRadius: 8, backgroundColor: theme.bgSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {uri ? (
              <Image source={{ uri }} style={{ width: 56, height: 44 }} resizeMode="cover" />
            ) : (
              <Icons.camera size={18} color={theme.muted} stroke={1.6} />
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 14, color: theme.ink, fontFamily: TYPO.weights.semibold }} numberOfLines={1}>{title}</Text>
            <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 2 }} numberOfLines={1}>
              {uploadedAt ? `Reçu le ${uploadedAt}` : hint}
            </Text>
          </View>
          <Pill tone={tone}>{label}</Pill>
        </View>
      </Surface>
    </Pressable>
  );
}
