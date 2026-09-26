import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ParcelDimensions } from '../components/ParcelDimensions';
import { Field } from '../components/Field';
import { Pill } from '../components/Pill';
import { Surface } from '../components/Surface';
import { Icons } from '../components/Icons';
import {
  ParcelDraftState,
  ParcelKind,
  PARCEL_KINDS,
} from '../state/ParcelDraftContext';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, SPACING, TYPO } from '../theme/tokens';

interface Props {
  draft: ParcelDraftState;
  onChange: (updates: Partial<ParcelDraftState>) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// ParcelSizeScreen
// Étape 2 du wizard — type + dimensions + poids + photo optionnelle.
// Exporté comme composant pour pouvoir être réutilisé soit en route Stack
// dédiée (cf. report orchestrateur) soit en sous-vue de ParcelRequestScreen.
// ─────────────────────────────────────────────────────────────────────────────
export function ParcelSizeScreen({ draft, onChange }: Props) {
  const { theme } = useTheme();
  const [photoLocal, setPhotoLocal] = useState<string | undefined>(draft.photoUri);
  const [weightText, setWeightText] = useState(draft.weightKg ? String(draft.weightKg) : '');

  const setKind = (kind: ParcelKind) => {
    onChange({ kind });
  };

  const handlePickPreset = (preset: { weightHint: string }) => {
    // Si l'utilisateur n'a rien saisi, suggère un poids depuis le hint ("~ 5 kg")
    if (weightText) return;
    const m = preset.weightHint.match(/(\d+(?:[.,]\d+)?)/);
    if (m) {
      const val = parseFloat(m[1].replace(',', '.'));
      setWeightText(String(val));
      onChange({ weightKg: val });
    }
  };

  // Mock d'ajout de photo (le module camera n'est pas encore branché)
  const handleAddPhoto = () => {
    if (typeof window !== 'undefined' && (window as any).document) {
      const input = (window as any).document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const uri = String(reader.result ?? '');
          setPhotoLocal(uri);
          onChange({ photoUri: uri });
        };
        reader.readAsDataURL(file);
      };
      input.click();
    } else {
      // Sur natif : on simulera ; à brancher avec expo-image-picker plus tard.
      const uri = `mock://photo/${Date.now()}`;
      setPhotoLocal(uri);
      onChange({ photoUri: uri });
    }
  };

  return (
    <View style={{ gap: SPACING.lg }}>
      <View>
        <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.displayS, letterSpacing: -0.3 }}>
          Décris ton colis
        </Text>
        <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, marginTop: 6 }}>
          Une photo et des dimensions précises = un prix fiable, pas de surprise au dépôt.
        </Text>
      </View>

      {/* Type de colis */}
      <Surface>
        <Text
          style={{
            color: theme.muted,
            fontFamily: TYPO.weights.semibold,
            fontSize: TYPO.sizes.label,
            letterSpacing: 1,
            textTransform: 'uppercase',
            marginBottom: SPACING.md,
          }}
        >
          Type de colis
        </Text>
        <View style={{ gap: 8 }}>
          {PARCEL_KINDS.map((k) => {
            const active = draft.kind === k.value;
            return (
              <Pressable
                key={k.value}
                onPress={() => setKind(k.value)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: SPACING.md,
                  borderRadius: RADII.md,
                  borderWidth: 1,
                  borderColor: active ? theme.navy : theme.line,
                  backgroundColor: active ? theme.bgSoft : pressed ? theme.bgSoft : theme.surface,
                })}
              >
                <Text style={{ fontSize: 24 }}>{k.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.body }}>
                    {k.label}
                  </Text>
                  <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, marginTop: 2 }}>
                    {k.hint}
                  </Text>
                </View>
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    borderWidth: 2,
                    borderColor: active ? theme.navy : theme.line,
                    backgroundColor: active ? theme.navy : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {active ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.surface }} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </Surface>

      {/* Dimensions */}
      <Surface>
        <ParcelDimensions
          value={draft.dimensions}
          onChange={(d) => onChange({ dimensions: d })}
          onPickPreset={handlePickPreset}
        />
      </Surface>

      {/* Poids */}
      <Surface>
        <Field
          label="Poids estimé (kg)"
          value={weightText}
          onChangeText={(t) => {
            setWeightText(t);
            const num = parseFloat(t.replace(',', '.'));
            onChange({ weightKg: Number.isFinite(num) && num > 0 ? num : undefined });
          }}
          keyboardType="numeric"
          placeholder="ex : 5"
          hint="Pèse-le avec un pèse-personne en te tenant dessus, puis sans. La différence = ton colis."
        />
        {/* Suggestions rapides */}
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: SPACING.md }}>
          {[1, 2, 5, 10, 20, 30].map((kg) => {
            const active = draft.weightKg === kg;
            return (
              <Pressable
                key={kg}
                onPress={() => {
                  setWeightText(String(kg));
                  onChange({ weightKg: kg });
                }}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: RADII.pill,
                  borderWidth: 1,
                  borderColor: active ? theme.navy : theme.line,
                  backgroundColor: active ? theme.navy : 'transparent',
                }}
              >
                <Text
                  style={{
                    color: active ? theme.surface : theme.ink,
                    fontFamily: TYPO.weights.semibold,
                    fontSize: 12.5,
                  }}
                >
                  {kg} kg
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Surface>

      {/* Photo optionnelle */}
      <Surface>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: RADII.md,
              borderWidth: 1,
              borderColor: theme.line,
              backgroundColor: theme.bgSoft,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {photoLocal && photoLocal.startsWith('data:') ? (
              // Sur web on rend l'image directement via une balise <img> en HTML
              // via la balise <Image> de RN.
              <PhotoPreview uri={photoLocal} />
            ) : (
              <Icons.camera size={24} color={theme.muted} stroke={1.8} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.body }}>
              Photo du colis (optionnel)
            </Text>
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, marginTop: 2 }}>
              {photoLocal ? 'Photo ajoutée — appuie pour changer' : 'Aide nos transporteurs à reconnaître ton colis'}
            </Text>
          </View>
          <Pressable
            onPress={handleAddPhoto}
            style={({ pressed }) => ({
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: theme.line,
              backgroundColor: pressed ? theme.bgSoft : 'transparent',
            })}
          >
            <Text style={{ color: theme.navy, fontFamily: TYPO.weights.semibold, fontSize: 12.5 }}>
              {photoLocal ? 'Changer' : 'Ajouter'}
            </Text>
          </Pressable>
        </View>
        {draft.kind ? (
          <View style={{ marginTop: SPACING.md, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Pill tone="ghost">Choix : {PARCEL_KINDS.find((k) => k.value === draft.kind)?.label}</Pill>
          </View>
        ) : null}
      </Surface>
    </View>
  );
}

// Petit wrapper pour afficher la photo sans avoir à importer `Image` partout.
function PhotoPreview({ uri }: { uri: string }) {
  // Sur web on insère un <img>, sur natif on déléguerait à RN Image.
  if (typeof document !== 'undefined') {
    // Création d'un élément image via le DOM web pour éviter d'importer
    // explicitement react-native-web ici.
    return React.createElement('img', {
      src: uri,
      style: { width: '100%', height: '100%', objectFit: 'cover' },
    });
  }
  // Fallback (natif) : on n'affiche rien — ce code n'est appelé que côté web.
  return null;
}
