// Formulaire de génération de documents de l'espace admin (Roger).
// Rend dynamiquement les champs décrits par un AdminDocType : texte, nombre,
// multiligne, booléen (Oui/Non) et sélection (chips). Les champs "half" sont
// groupés deux par ligne pour rester dense — Roger veut aller vite.
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AdminDocType, AdminFieldSpec, AdminValues } from '../utils/adminDocs';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';
import { Button } from './Button';
import { Field } from './Field';
import { Icons } from './Icons';

interface Props {
  docType: AdminDocType;
  /** Valeurs initiales (défauts + éventuel pré-remplissage depuis un envoi). */
  initialValues: AdminValues;
  /** Appelé au clic sur « Générer le PDF » avec les valeurs saisies. */
  onSubmit: (values: AdminValues) => void;
  submitting?: boolean;
}

// Ligne de rendu : soit un champ pleine largeur, soit deux champs demi-largeur.
type Row = AdminFieldSpec[];

function buildRows(fields: AdminFieldSpec[]): Row[] {
  const rows: Row[] = [];
  let pending: AdminFieldSpec | null = null;
  fields.forEach((f) => {
    const isHalf = f.half && f.type !== 'multiline' && f.type !== 'select';
    if (isHalf) {
      if (pending) {
        rows.push([pending, f]);
        pending = null;
      } else {
        pending = f;
      }
    } else {
      if (pending) {
        rows.push([pending]);
        pending = null;
      }
      rows.push([f]);
    }
  });
  if (pending) rows.push([pending]);
  return rows;
}

export function AdminDocForm({ docType, initialValues, onSubmit, submitting }: Props) {
  const { theme } = useTheme();
  const [values, setValues] = useState<AdminValues>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Nouveau type ou nouveau pré-remplissage → on repart des valeurs fournies.
  useEffect(() => {
    setValues(initialValues);
    setErrors({});
  }, [docType.id, initialValues]);

  const rows = useMemo(() => buildRows(docType.fields), [docType]);

  const set = (key: string, v: string | boolean) => {
    setValues((prev) => ({ ...prev, [key]: v }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const submit = () => {
    const nextErrors: Record<string, string> = {};
    docType.fields.forEach((f) => {
      if (!f.required) return;
      const v = values[f.key];
      if (typeof v !== 'string' || v.trim() === '') {
        nextErrors[f.key] = 'Champ requis';
      }
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSubmit(values);
  };

  return (
    <View style={{ gap: 12 }}>
      {rows.map((row) => (
        <View key={row.map((f) => f.key).join('+')} style={{ flexDirection: 'row', gap: 10 }}>
          {row.map((f) => (
            <View key={f.key} style={{ flex: 1, minWidth: 0 }}>
              {renderField(f)}
            </View>
          ))}
        </View>
      ))}

      <Button
        kind="gold"
        size="lg"
        fullWidth
        loading={submitting}
        onPress={submit}
        leftIcon={<Icons.doc size={18} color={theme.navy} stroke={1.8} />}
        style={{ marginTop: 4 }}
      >
        Générer le PDF
      </Button>
    </View>
  );

  function renderField(f: AdminFieldSpec) {
    const type = f.type ?? 'text';

    if (type === 'boolean') {
      const on = values[f.key] === true;
      return (
        <View style={{ gap: 6 }}>
          <Text
            style={{
              color: theme.muted,
              fontFamily: TYPO.weights.semibold,
              fontSize: TYPO.sizes.label,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            {f.label}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[{ v: true, label: 'Oui' }, { v: false, label: 'Non' }].map((opt) => {
              const active = on === opt.v;
              return (
                <Pressable
                  key={opt.label}
                  onPress={() => set(f.key, opt.v)}
                  style={{
                    flex: 1,
                    paddingVertical: 11,
                    borderRadius: RADII.md,
                    borderWidth: 1,
                    alignItems: 'center',
                    borderColor: active ? theme.select : theme.line,
                    backgroundColor: active ? theme.select : theme.surface2,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      color: active ? theme.selectInk : theme.ink,
                      fontFamily: TYPO.weights.semibold,
                    }}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    }

    if (type === 'select') {
      const current = typeof values[f.key] === 'string' ? (values[f.key] as string) : '';
      return (
        <View style={{ gap: 6 }}>
          <Text
            style={{
              color: theme.muted,
              fontFamily: TYPO.weights.semibold,
              fontSize: TYPO.sizes.label,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            {f.label}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(f.options ?? []).map((opt) => {
              const active = current === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() => set(f.key, opt)}
                  style={{
                    paddingVertical: 7,
                    paddingHorizontal: 12,
                    borderRadius: RADII.pill,
                    borderWidth: 1,
                    borderColor: active ? theme.select : theme.line,
                    backgroundColor: active ? theme.select : theme.surface,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12.5,
                      color: active ? theme.selectInk : theme.ink,
                      fontFamily: TYPO.weights.medium,
                    }}
                  >
                    {opt}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    }

    const strValue = typeof values[f.key] === 'string' ? (values[f.key] as string) : '';
    return (
      <Field
        label={f.label}
        value={strValue}
        onChangeText={(t) => set(f.key, t)}
        placeholder={f.placeholder}
        hint={f.hint}
        error={errors[f.key] || undefined}
        keyboardType={type === 'number' ? 'decimal-pad' : 'default'}
        multiline={type === 'multiline'}
        numberOfLines={type === 'multiline' ? 4 : 1}
        autoCapitalize={f.key.toLowerCase().includes('email') ? 'none' : 'sentences'}
      />
    );
  }
}
