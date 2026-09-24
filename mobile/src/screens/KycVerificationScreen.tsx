import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { AppBar } from '../components/AppBar';
import { Button } from '../components/Button';
import { Icons } from '../components/Icons';
import { Pill, PillTone } from '../components/Pill';
import { Surface } from '../components/Surface';
import { RootStackParamList } from '../navigation/types';
import { notify } from '../utils/notify';
import { extOfMime, mimeOfDataUrl, uriToDataUrl } from '../utils/imageData';
import { capturePhoto } from '../utils/pickImage';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';
import { ApiError } from '../api/client';
import {
  fetchKycOverview,
  uploadAndSubmitKyc,
  type KycDocumentType,
  type KycStatus as ApiKycStatus,
} from '../api/kyc';

type DocStatus = 'pending' | 'uploaded' | 'verified' | 'rejected';

interface RequiredDoc {
  key: string;
  title: string;
  hint: string;
  required: boolean;
  /** Type KYC backend associé (sert au mapping API ↔ écran). */
  apiType: KycDocumentType;
}

const REQUIRED_DOCS: RequiredDoc[] = [
  { key: 'license_front', title: 'Permis de conduire — recto', hint: 'Photo nette, sans reflet', required: true, apiType: 'DRIVER_LICENSE' },
  { key: 'license_back',  title: 'Permis de conduire — verso', hint: 'Toutes les catégories visibles', required: true, apiType: 'DRIVER_LICENSE' },
  { key: 'id_front',      title: 'Pièce d\'identité — recto', hint: 'CNI ou passeport', required: true, apiType: 'IDENTITY_CARD' },
  { key: 'id_back',       title: 'Pièce d\'identité — verso', hint: 'Sauf si passeport', required: false, apiType: 'IDENTITY_CARD' },
  { key: 'address',       title: 'Justificatif de domicile', hint: 'Moins de 3 mois (facture, quittance)', required: true, apiType: 'PROOF_OF_ADDRESS' },
  { key: 'selfie',        title: 'Selfie de contrôle', hint: 'Pour vérification anti-fraude', required: true, apiType: 'OTHER' },
];

function apiStatusToDocStatus(status: ApiKycStatus): DocStatus {
  if (status === 'APPROVED') return 'verified';
  if (status === 'REJECTED') return 'rejected';
  return 'uploaded';
}

type State = Record<string, { status: DocStatus; uri?: string; uploadedAt?: string; note?: string }>;

export function KycVerificationScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [state, setState] = useState<State>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Statut réel, tel que le serveur le connaît. Plus de « mode démo » local :
  // l'écran affichait « envoyé » pour des documents restés sur le téléphone.
  const load = useCallback(async () => {
    try {
      const overview = await fetchKycOverview();
      // Documents triés du plus récent au plus ancien : le premier trouvé
      // pour un emplacement est celui qui compte. L'emplacement (recto,
      // verso…) est retrouvé grâce au nom de fichier ; à défaut, par type.
      const next: State = {};
      for (const doc of REQUIRED_DOCS) {
        const match =
          overview.documents.find((d) => d.fileName?.startsWith(`${doc.key}.`)) ??
          (REQUIRED_DOCS.filter((x) => x.apiType === doc.apiType).length === 1
            ? overview.documents.find((d) => d.type === doc.apiType)
            : undefined);
        if (match) {
          next[doc.key] = {
            status: apiStatusToDocStatus(match.status),
            uploadedAt: new Date(match.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
            note: match.status === 'REJECTED' ? match.notes ?? undefined : undefined,
          };
        }
      }
      setState((prev) => {
        // On garde l'aperçu local des photos qu'on vient d'envoyer.
        const merged: State = {};
        for (const [k, v] of Object.entries(next)) merged[k] = { ...v, uri: prev[k]?.uri };
        return merged;
      });
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Statut indisponible.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totalRequired = REQUIRED_DOCS.filter((d) => d.required).length;
  const uploadedRequired = REQUIRED_DOCS.filter((d) => d.required && (state[d.key]?.status === 'uploaded' || state[d.key]?.status === 'verified')).length;
  const progress = Math.round((uploadedRequired / totalRequired) * 100);

  const allVerified = REQUIRED_DOCS.every((d) => !d.required || state[d.key]?.status === 'verified');
  const allUploaded = uploadedRequired === totalRequired;

  const todayLabel = () =>
    new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

  const pickFile = async (key: string) => {
    const doc = REQUIRED_DOCS.find((d) => d.key === key);
    if (!doc || busyKey) return;
    // Appareil photo sur téléphone (galerie si refusé), sélecteur sur le web.
    // Auparavant, l'application installée simulait l'envoi : aucun
    // convoyeur inscrit depuis un téléphone ne pouvait être vérifié.
    const uri = await capturePhoto();
    if (!uri) return;
    setBusyKey(doc.key);
    try {
      const dataUrl = await uriToDataUrl(uri);
      if (!dataUrl) throw new Error('Photo illisible. Réessaie.');
      const mimeType = mimeOfDataUrl(dataUrl);
      await uploadAndSubmitKyc({
        type: doc.apiType,
        fileName: `${doc.key}.${extOfMime(mimeType)}`,
        mimeType,
        data: dataUrl,
      });
      setState((prev) => ({ ...prev, [key]: { status: 'uploaded', uri: dataUrl, uploadedAt: todayLabel() } }));
      notify('Document envoyé', 'Axis Import le vérifie et te prévient dès que c\'est fait.');
      void load();
    } catch (e) {
      const msg =
        e instanceof ApiError && e.isNetworkError
          ? 'Pas de connexion. Le document n\'a pas été envoyé : réessaie quand tu as du réseau.'
          : e instanceof Error
            ? e.message
            : 'Envoi impossible. Réessaie.';
      notify('Document non envoyé', msg);
    } finally {
      setBusyKey(null);
    }
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
                {allVerified ? 'Tu es habilité à conduire' : `${uploadedRequired}/${totalRequired} documents obligatoires fournis`}
              </Text>
            </View>
          </View>

          {/* Progression */}
          <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(245,241,232,0.15)', marginTop: 14 }}>
            <View style={{ width: `${progress}%`, height: '100%', backgroundColor: theme.gold, borderRadius: 2 }} />
          </View>
          <Text style={{ fontSize: 11.5, color: 'rgba(245,241,232,0.62)', marginTop: 8, fontFamily: TYPO.weights.medium }}>
            {allVerified
              ? 'Documents vérifiés par l\'équipe Axis Import.'
              : 'Tes documents sont transmis de façon chiffrée (HTTPS) et vérifiés par l\'équipe Axis Import.'}
          </Text>
        </Surface>

        {loadError ? (
          <Text style={{ fontSize: 12.5, color: theme.bad, fontFamily: TYPO.weights.medium }}>
            Statut de tes documents indisponible ({loadError}). Tu peux quand même envoyer un document.
          </Text>
        ) : null}

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
                note={state[doc.key]?.note}
                busy={busyKey === doc.key}
                onPick={() => void pickFile(doc.key)}
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
            // Chaque ligne doit rester vraie et conforme à la politique de
            // confidentialité : l'écran promettait un hébergement « en France,
            // agréé HDS » et une conservation de 7 ans, faux tous les deux.
            { Ic: Icons.shield, t: 'Transmission chiffrée (HTTPS), fichiers accessibles sur connexion uniquement' },
            { Ic: Icons.check,  t: 'Visibles seulement par toi et l\'équipe Axis Import' },
            { Ic: Icons.doc,    t: 'Supprimés avec ton compte (Profil → Supprimer mon compte)' },
            { Ic: Icons.x,      t: 'Jamais vendus ni partagés à des fins commerciales' },
          ].map((r) => (
            <View key={r.t} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
              <r.Ic size={16} color={theme.gold} stroke={1.8} />
              <Text style={{ flex: 1, fontSize: 12.5, color: theme.inkSoft, fontFamily: TYPO.weights.medium }}>{r.t}</Text>
            </View>
          ))}
        </Surface>
      </ScrollView>
    </SafeAreaView>
  );
}

function DocCard({
  title, hint, required, status, uri, uploadedAt, note, busy, onPick,
}: {
  note?: string;
  title: string;
  hint: string;
  required: boolean;
  status: DocStatus;
  uri?: string;
  uploadedAt?: string;
  busy?: boolean;
  onPick: () => void;
}) {
  const { theme } = useTheme();
  const tone: PillTone =
    busy ? 'navy' :
    status === 'verified' ? 'good' :
    status === 'uploaded' ? 'navy' :
    status === 'rejected' ? 'bad' : 'ghost';
  const label =
    busy ? 'Envoi…' :
    status === 'verified' ? 'Vérifié' :
    status === 'uploaded' ? 'En vérification' :
    status === 'rejected' ? 'Refusé' : (required ? 'Requis' : 'Optionnel');

  return (
    <Pressable onPress={onPick} disabled={busy}>
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
            {status === 'rejected' ? (
              <Text style={{ fontSize: 12, color: theme.bad, fontFamily: TYPO.weights.semibold, marginTop: 3 }}>
                {note ? `Motif : ${note}. ` : ''}Touche pour envoyer une nouvelle photo.
              </Text>
            ) : null}
          </View>
          <Pill tone={tone}>{label}</Pill>
        </View>
      </Surface>
    </Pressable>
  );
}
