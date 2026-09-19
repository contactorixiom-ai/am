import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CountryRequirements, getDemoRequirements, getRequirements } from '../api/customs';
import { Field } from '../components/Field';
import { Icons } from '../components/Icons';
import { Pill } from '../components/Pill';
import { Surface } from '../components/Surface';
import {
  CUSTOMS_CATEGORIES,
  CustomsCategory,
  ParcelDraftState,
} from '../state/ParcelDraftContext';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, SPACING, TYPO } from '../theme/tokens';

interface Props {
  draft: ParcelDraftState;
  onChange: (updates: Partial<ParcelDraftState>) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// ParcelContentScreen — Étape 3 du wizard
// Description, catégorie douanière, valeur déclarée, fragile.
// Récupère dynamiquement la fiche réglementaire du pays de destination via
// l'API `customs` (avec fallback démo si offline).
// ─────────────────────────────────────────────────────────────────────────────
export function ParcelContentScreen({ draft, onChange }: Props) {
  const { theme } = useTheme();
  const [requirements, setRequirements] = useState<CountryRequirements | null>(null);
  const [loadingReqs, setLoadingReqs] = useState(false);
  const [valueText, setValueText] = useState(
    draft.declaredValueEur ? String(draft.declaredValueEur) : '',
  );

  const country = draft.to?.country;

  useEffect(() => {
    if (!country) return;
    setLoadingReqs(true);
    let cancelled = false;
    getRequirements(country)
      .then((r) => {
        if (!cancelled) setRequirements(r);
      })
      .catch(() => {
        // Repli démo
        const r = getDemoRequirements(country);
        if (!cancelled) setRequirements(r);
      })
      .finally(() => {
        if (!cancelled) setLoadingReqs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [country]);

  const setCustoms = (cat: CustomsCategory) => onChange({ customsCategory: cat });

  const highValue = (draft.declaredValueEur ?? 0) >= 1000;

  return (
    <View style={{ gap: SPACING.lg }}>
      <View>
        <Text style={{ color: theme.ink, fontFamily: TYPO.weights.bold, fontSize: TYPO.sizes.displayS, letterSpacing: -0.3 }}>
          Que contient ton colis ?
        </Text>
        <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, marginTop: 6 }}>
          Ces informations servent à la déclaration douanière et à l'assurance.
        </Text>
      </View>

      {/* Description */}
      <Surface>
        <Field
          label="Description courte"
          value={draft.description ?? ''}
          onChangeText={(t) => onChange({ description: t })}
          placeholder="ex : 3 robes en tissu, 1 paire de chaussures"
          multiline
          numberOfLines={3}
          hint="Liste sommaire — pas besoin de tout détailler"
        />
      </Surface>

      {/* Catégorie douanière */}
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
          Catégorie douanière
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {CUSTOMS_CATEGORIES.map((c) => {
            const active = draft.customsCategory === c.value;
            return (
              <Pressable
                key={c.value}
                onPress={() => setCustoms(c.value)}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: RADII.md,
                  borderWidth: 1,
                  borderColor: active ? theme.navy : theme.line,
                  backgroundColor: active ? theme.bgSoft : 'transparent',
                  flexGrow: 1,
                  flexBasis: '46%',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 16 }}>{c.emoji}</Text>
                  <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.bodySm }}>
                    {c.label}
                  </Text>
                </View>
                <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: 11.5, marginTop: 2 }}>
                  {c.hint}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Surface>

      {/* Valeur déclarée */}
      <Surface>
        <Field
          label="Valeur déclarée (€)"
          value={valueText}
          onChangeText={(t) => {
            setValueText(t);
            const num = parseFloat(t.replace(',', '.'));
            onChange({ declaredValueEur: Number.isFinite(num) && num > 0 ? num : undefined });
          }}
          keyboardType="numeric"
          placeholder="ex : 350"
          hint={highValue
            ? '⚠️ Au-dessus de 1 000 € : facture commerciale obligatoire pour la douane'
            : 'Sert à la déclaration douanière et au remboursement en cas de perte'}
        />
      </Surface>

      {/* Fragile */}
      <Surface>
        <Pressable
          onPress={() => onChange({ fragile: !draft.fragile })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
        >
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              borderWidth: 2,
              borderColor: draft.fragile ? theme.navy : theme.line,
              backgroundColor: draft.fragile ? theme.navy : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {draft.fragile ? <Icons.check size={14} color={theme.surface} stroke={2.4} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.body }}>
              Contient des objets fragiles
            </Text>
            <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm, marginTop: 2 }}>
              Manutention renforcée + sticker rouge
            </Text>
          </View>
        </Pressable>
      </Surface>

      {/* Mention douane dynamique selon le pays */}
      {country ? (
        <Surface flat style={{ backgroundColor: theme.bgSoft, borderColor: theme.line }}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <Icons.shield size={18} color={theme.gold} stroke={1.8} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.ink, fontFamily: TYPO.weights.semibold, fontSize: TYPO.sizes.bodySm }}>
                Réglementation {requirements?.countryName ?? country}
              </Text>
              {loadingReqs ? (
                <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: 12, marginTop: 6 }}>
                  Chargement de la fiche pays…
                </Text>
              ) : requirements ? (
                <>
                  <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: 12, marginTop: 6, lineHeight: 17 }}>
                    Documents à fournir : {requirements.checklist
                      .filter((d) => d.mandatory)
                      .map((d) => d.label)
                      .slice(0, 4)
                      .join(' · ')}
                  </Text>
                  {requirements.cargoMandatory && requirements.cargoTrackingType ? (
                    <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      <Pill tone="warn">
                        {requirements.cargoTrackingType} obligatoire
                      </Pill>
                      {requirements.authority ? (
                        <Pill tone="ghost">Émis par {requirements.authority}</Pill>
                      ) : null}
                    </View>
                  ) : null}
                </>
              ) : (
                <Text style={{ color: theme.muted, fontFamily: TYPO.weights.medium, fontSize: 12, marginTop: 6 }}>
                  Fiche réglementaire indisponible. Tu seras guidé après réservation.
                </Text>
              )}
            </View>
          </View>
        </Surface>
      ) : null}
    </View>
  );
}
