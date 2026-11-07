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
import { askPhotoOrFile, notify } from '../utils/notify';
import { extOfMime, mimeOfDataUrl, uriToDataUrl } from '../utils/imageData';
import { PickedFile, pickFile as chooseFile } from '../utils/pickFile';
import { capturePhoto } from '../utils/pickImage';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';
import { ApiError } from '../api/client';
import { fetchMe, upsertLicence } from '../api/auth';
import { Field } from '../components/Field';
import { Chips } from '../components/StaffWidgets';
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
  /** Document souvent reçu en PDF : on ouvre le choix de fichier (PDF ou photo). */
  file?: boolean;
  /** Section « Si tu es hébergé » : obligatoire seulement en cas d'hébergement. */
  hosting?: boolean;
}

// Les 8 pièces demandées par Axis Import, dans l'ordre du dossier. Le serveur
// applique la même règle pour accepter une mission (identité et permis
// validés, le reste envoyé).
const REQUIRED_DOCS: RequiredDoc[] = [
  { key: 'id_front',      title: '1. Pièce d\'identité — recto', hint: 'Carte d\'identité, titre de séjour ou passeport (page photo)', required: true, apiType: 'IDENTITY_CARD' },
  { key: 'id_back',       title: '1. Pièce d\'identité — verso', hint: 'Pour un passeport, photographie la page de signature', required: true, apiType: 'IDENTITY_CARD' },
  { key: 'address',       title: '2. Justificatif de domicile', hint: 'Moins de 3 mois : facture, quittance, avis d\'imposition', required: true, apiType: 'PROOF_OF_ADDRESS', file: true },
  { key: 'license_front', title: '3. Permis de conduire — recto', hint: 'Photo nette, sans reflet', required: true, apiType: 'DRIVER_LICENSE' },
  { key: 'license_back',  title: '3. Permis de conduire — verso', hint: 'Toutes les catégories (A, B, C, D) visibles', required: true, apiType: 'DRIVER_LICENSE' },
  { key: 'rib',           title: '4. RIB', hint: 'Relevé d\'identité bancaire à ton nom (PDF ou photo)', required: true, apiType: 'BANK_DETAILS', file: true },
  { key: 'hosting',       title: '5. Attestation d\'hébergement', hint: 'Signée par la personne qui t\'héberge (PDF ou photo)', required: false, apiType: 'HOSTING_CERTIFICATE', file: true, hosting: true },
  { key: 'host_id_front', title: '5. Pièce d\'identité de l\'hébergeant — recto', hint: 'Annexe obligatoire de l\'attestation d\'hébergement', required: false, apiType: 'HOST_IDENTITY', hosting: true },
  { key: 'host_id_back',  title: '5. Pièce d\'identité de l\'hébergeant — verso', hint: 'Annexe obligatoire de l\'attestation d\'hébergement', required: false, apiType: 'HOST_IDENTITY', hosting: true },
  { key: 'vitale',        title: '6. Carte Vitale', hint: 'Photo nette du recto, numéro lisible', required: true, apiType: 'VITALE_CARD' },
  { key: 'health_rights', title: '7. Attestation de droits — assurance maladie', hint: 'À télécharger sur ameli.fr (Mon compte › Mes attestations)', required: true, apiType: 'HEALTH_INSURANCE_RIGHTS', file: true },
  { key: 'selfie',        title: '8. Photo faciale', hint: 'De face, visage dégagé, sans lunettes de soleil', required: true, apiType: 'SELFIE' },
];

const LICENSE_CATEGORIES = ['A', 'B', 'BE', 'C', 'CE', 'D', 'DE'];

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
  // Même règle que le serveur pour accepter une mission : une pièce
  // d'identité et un permis approuvés par Axis.
  const [habilitated, setHabilitated] = useState(false);
  // Convoyeur hébergé chez un tiers : attestation + pièce de l'hébergeant.
  const [hosted, setHosted] = useState(false);
  const [licence, setLicence] = useState<{ loaded: boolean; number: string; expires: string; categories: string[] }>({ loaded: false, number: '', expires: '', categories: [] });
  const [savingLicence, setSavingLicence] = useState(false);
  const isRequired = (d: RequiredDoc) => d.required || (hosted && !!d.hosting);
  const shownDocs = REQUIRED_DOCS.filter((d) => !d.hosting || hosted);

  // Statut réel, tel que le serveur le connaît. Plus de « mode démo » local :
  // l'écran affichait « envoyé » pour des documents restés sur le téléphone.
  const load = useCallback(async () => {
    try {
      const overview = await fetchKycOverview();
      const approvedTypes = new Set(overview.documents.filter((d) => d.status === 'APPROVED').map((d) => d.type));
      const sentTypes = new Set(overview.documents.filter((d) => d.status !== 'REJECTED').map((d) => d.type));
      // Même règle que le serveur : identité et permis validés, les autres
      // pièces envoyées (et la pièce de l'hébergeant si hébergé).
      const isHosted = sentTypes.has('HOSTING_CERTIFICATE') || sentTypes.has('HOST_IDENTITY');
      if (isHosted) setHosted(true);
      const sentOthers: KycDocumentType[] = ['PROOF_OF_ADDRESS', 'BANK_DETAILS', 'VITALE_CARD', 'HEALTH_INSURANCE_RIGHTS', 'SELFIE'];
      setHabilitated(
        approvedTypes.has('DRIVER_LICENSE') && (approvedTypes.has('IDENTITY_CARD') || approvedTypes.has('PASSPORT'))
          && sentOthers.every((t) => sentTypes.has(t))
          && (!isHosted || (sentTypes.has('HOSTING_CERTIFICATE') && sentTypes.has('HOST_IDENTITY'))),
      );
      const lp = await fetchMe().then((u) => u.driverProfile).catch(() => null);
      if (lp) {
        setLicence((cur) => cur.loaded ? cur : {
          loaded: true,
          number: lp.licenseNumber ?? '',
          expires: lp.licenseExpiresAt ? new Date(lp.licenseExpiresAt).toLocaleDateString('fr-FR') : '',
          categories: lp.licenseCategories ?? [],
        });
      }
      // Documents triés du plus récent au plus ancien : le premier trouvé
      // pour un emplacement est celui qui compte. L'emplacement (recto,
      // verso…) est retrouvé grâce au nom de fichier ; à défaut, par type.
      const next: State = {};
      // Un document dont le nom ne dit pas l'emplacement (déposé ailleurs que
      // depuis cet écran) occupe le premier emplacement libre de son type :
      // sinon un permis validé par Axis s'affichait « 0/3 fournis ».
      const used = new Set<string>();
      const placed = (d: { id: string }) => used.has(d.id);
      for (const doc of REQUIRED_DOCS) {
        const byName = overview.documents.find((d) => !placed(d) && d.fileName?.startsWith(`${doc.key}.`));
        if (byName) used.add(byName.id);
      }
      for (const doc of REQUIRED_DOCS) {
        const match =
          overview.documents.find((d) => d.fileName?.startsWith(`${doc.key}.`)) ??
          overview.documents.find(
            (d) => !placed(d) && d.type === doc.apiType && !REQUIRED_DOCS.some((x) => d.fileName?.startsWith(`${x.key}.`)),
          );
        if (match) used.add(match.id);
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

  const totalRequired = REQUIRED_DOCS.filter(isRequired).length;
  const uploadedRequired = REQUIRED_DOCS.filter((d) => isRequired(d) && (state[d.key]?.status === 'uploaded' || state[d.key]?.status === 'verified')).length;
  const progress = Math.round((uploadedRequired / totalRequired) * 100);

  const allVerified = habilitated || REQUIRED_DOCS.every((d) => !isRequired(d) || state[d.key]?.status === 'verified');
  const allUploaded = uploadedRequired === totalRequired;

  const todayLabel = () =>
    new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

  const pickFile = async (key: string) => {
    const doc = REQUIRED_DOCS.find((d) => d.key === key);
    if (!doc || busyKey) return;
    // Appareil photo sur téléphone (galerie si refusé), sélecteur sur le web.
    // Auparavant, l'application installée simulait l'envoi : aucun
    // convoyeur inscrit depuis un téléphone ne pouvait être vérifié.
    // L'attestation de droits se télécharge en PDF sur ameli.fr : on ouvre
    // le choix de fichier (PDF ou photo) plutôt que l'appareil photo.
    // Justificatif de domicile, RIB, attestations : souvent en PDF. On
    // propose alors photo ou fichier.
    let picked: PickedFile | null = null;
    if (doc.file) {
      const source = await askPhotoOrFile(doc.title.replace(/^\d+\.\s*/, ''), 'Prends une photo du document, ou choisis un fichier (PDF ou image) sur ton téléphone ou ton ordinateur.');
      if (!source) return;
      if (source === 'document') {
        try {
          picked = await chooseFile('document');
        } catch (e) {
          notify('Fichier non retenu', e instanceof Error ? e.message : 'Réessaie.');
          return;
        }
        if (!picked) return;
      }
    }
    const uri = picked ? null : await capturePhoto();
    if (!picked && !uri) return;
    setBusyKey(doc.key);
    try {
      const dataUrl = picked ? picked.dataUrl : await uriToDataUrl(uri!);
      if (!dataUrl) throw new Error('Photo illisible. Réessaie.');
      const mimeType = picked ? picked.mimeType : mimeOfDataUrl(dataUrl);
      await uploadAndSubmitKyc({
        type: doc.apiType,
        fileName: `${doc.key}.${mimeType.includes('pdf') ? 'pdf' : extOfMime(mimeType)}`,
        mimeType,
        data: dataUrl,
      });
      setState((prev) => ({ ...prev, [key]: { status: 'uploaded', uri: mimeType.startsWith('image/') ? dataUrl : undefined, uploadedAt: todayLabel() } }));
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

  const saveLicence = async () => {
    const m = licence.expires.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (!licence.categories.length) return notify('Catégories', 'Coche au moins une catégorie de permis.');
    if (licence.number.trim().length < 4) return notify('Numéro du permis', 'Indique le numéro inscrit sur ton permis (case 5).');
    if (!m) return notify('Date de validité', 'Écris la date au format JJ/MM/AAAA (case 4b du permis).');
    const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    if (Number.isNaN(new Date(iso).getTime())) return notify('Date de validité', 'Cette date n\'existe pas.');
    setSavingLicence(true);
    try {
      await upsertLicence({ licenseNumber: licence.number.trim().toUpperCase(), licenseExpiresAt: iso, licenseCategories: licence.categories });
      notify('Permis enregistré', `Catégories : ${licence.categories.join(', ')}.`);
    } catch (e) {
      notify('Enregistrement impossible', e instanceof Error ? e.message : 'Réessaie.');
    } finally {
      setSavingLicence(false);
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
          {shownDocs.map((doc) => {
            const s = state[doc.key]?.status ?? 'pending';
            return (
              <React.Fragment key={doc.key}>
              <DocCard
                key={doc.key}
                title={doc.title}
                hint={doc.hint}
                required={isRequired(doc)}
                status={s}
                uri={state[doc.key]?.uri}
                uploadedAt={state[doc.key]?.uploadedAt}
                note={state[doc.key]?.note}
                busy={busyKey === doc.key}
                onPick={() => void pickFile(doc.key)}
              />
              {doc.key === 'rib' ? (
                <Surface padded style={{ padding: 14, gap: 8 }}>
                  <Text style={{ fontSize: 14, color: theme.ink, fontFamily: TYPO.weights.semibold }}>5. Es-tu hébergé(e) chez quelqu'un ?</Text>
                  <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium, lineHeight: 17 }}>
                    Si oui, ajoute l'attestation d'hébergement et, en annexe, la pièce d'identité de la personne qui t'héberge.
                  </Text>
                  <Chips<'no' | 'yes'>
                    options={[{ key: 'no', label: 'Non, je suis chez moi' }, { key: 'yes', label: 'Oui, je suis hébergé(e)' }]}
                    value={hosted ? 'yes' : 'no'}
                    onChange={(v) => setHosted(v === 'yes')}
                  />
                </Surface>
              ) : null}
              {doc.key === 'license_back' ? (
                <Surface padded style={{ padding: 14, gap: 10 }}>
                  <Text style={{ fontSize: 14, color: theme.ink, fontFamily: TYPO.weights.semibold }}>Ton permis</Text>
                  <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium, lineHeight: 17 }}>
                    Coche les catégories inscrites sur ton permis : Axis ne te confie que les véhicules que tu as le droit de conduire (bus et autocars : permis D).
                  </Text>
                  <Chips<string>
                    multi
                    options={LICENSE_CATEGORIES.map((c) => ({ key: c, label: c }))}
                    values={licence.categories}
                    onToggle={(c) => setLicence((l) => ({ ...l, categories: l.categories.includes(c) ? l.categories.filter((x) => x !== c) : [...l.categories, c] }))}
                  />
                  <Field label="Numéro du permis" value={licence.number} onChangeText={(v) => setLicence((l) => ({ ...l, number: v }))} autoCapitalize="characters" />
                  <Field label="Valable jusqu'au (JJ/MM/AAAA)" value={licence.expires} onChangeText={(v) => setLicence((l) => ({ ...l, expires: v }))} placeholder="Ex. 14/03/2034" keyboardType="numbers-and-punctuation" />
                  <Button kind="outline" size="sm" loading={savingLicence} style={{ alignSelf: 'flex-start' }} onPress={() => void saveLicence()}>
                    Enregistrer mon permis
                  </Button>
                </Surface>
              ) : null}
              </React.Fragment>
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
            <Text style={{ fontSize: 14, color: theme.ink, fontFamily: TYPO.weights.semibold }} numberOfLines={2}>{title}</Text>
            <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 2 }} numberOfLines={2}>
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
