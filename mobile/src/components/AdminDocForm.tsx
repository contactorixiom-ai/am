// Formulaire de génération de documents de l'espace admin (Roger).
// Rend dynamiquement les champs décrits par un AdminDocType : texte, nombre,
// multiligne, booléen (Oui/Non), sélection (chips) et tableau (lignes
// répétables, ex. une ligne par marchandise dangereuse). Les champs "half"
// sont groupés deux par ligne pour rester dense — Roger veut aller vite.
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  AdminDocType,
  AdminFieldSpec,
  AdminTableRow,
  AdminValues,
  ISSUER_HELP,
  ISSUER_LABEL,
  isBlankRow,
  parseTableRows,
  serializeTableRows,
} from '../utils/adminDocs';
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
    const isHalf = f.half && f.type !== 'multiline' && f.type !== 'select' && f.type !== 'table';
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
      if (f.type === 'table') {
        const msg = tableError(f, parseTableRows(values[f.key]));
        if (msg) nextErrors[f.key] = msg;
        return;
      }
      if (!f.required) return;
      const v = values[f.key];
      if (typeof v !== 'string' || v.trim() === '') {
        nextErrors[f.key] = 'Champ requis';
      }
    });
    Object.entries(docType.validate?.(values) ?? {}).forEach(([k, msg]) => {
      if (msg && !nextErrors[k]) nextErrors[k] = msg;
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSubmit(values);
  };

  // Lignes d'un tableau : au moins une si requis, colonnes requises remplies.
  function tableError(f: AdminFieldSpec, rows: AdminTableRow[]): string {
    const filled = rows.filter((r) => !isBlankRow(r));
    if (f.required && filled.length === 0) return `Ajoute au moins une ligne (${(f.itemLabel ?? 'ligne').toLowerCase()}).`;
    const missing: string[] = [];
    filled.forEach((r, i) => {
      (f.columns ?? []).forEach((c) => {
        if (c.required && !(r[c.key] ?? '').trim()) missing.push(`${f.itemLabel ?? 'Ligne'} ${i + 1} : ${c.label}`);
      });
    });
    return missing.length ? `À compléter — ${missing.slice(0, 3).join(' · ')}${missing.length > 3 ? '…' : ''}` : '';
  }

  const setRows = (key: string, rows: AdminTableRow[]) => set(key, serializeTableRows(rows));

  // Qui délivre l'original : la première chose à savoir avant de remplir.
  const issuerTone =
    docType.issuer === 'axis'
      ? { bg: theme.good + '18', border: theme.good + '55', fg: theme.good }
      : { bg: theme.warn + '16', border: theme.warn + '50', fg: theme.warn };

  return (
    <View style={{ gap: 12 }}>
      <View
        style={{
          backgroundColor: issuerTone.bg,
          borderColor: issuerTone.border,
          borderWidth: 1,
          borderRadius: RADII.md,
          padding: 11,
          gap: 3,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <Icons.shield size={14} color={issuerTone.fg} stroke={1.9} />
          <Text style={{ fontSize: 12.5, color: issuerTone.fg, fontFamily: TYPO.weights.bold }}>
            {ISSUER_LABEL[docType.issuer]}
          </Text>
        </View>
        <Text style={{ fontSize: 11.5, color: theme.inkSoft, fontFamily: TYPO.weights.medium, lineHeight: 16 }}>
          {docType.issuerNote ?? ISSUER_HELP[docType.issuer]}
        </Text>
      </View>

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

  function renderTable(f: AdminFieldSpec) {
    const stored = parseTableRows(values[f.key]);
    const blank = (): AdminTableRow => Object.fromEntries((f.columns ?? []).map((c) => [c.key, '']));
    const rows = stored.length ? stored : [blank()];
    const canAdd = !f.maxRows || rows.length < f.maxRows;
    const cellRows = buildRows(f.columns ?? []);
    const update = (i: number, key: string, v: string) => {
      const next = rows.map((r, k) => (k === i ? { ...r, [key]: v } : r));
      setRows(f.key, next);
    };
    return (
      <View style={{ gap: 8 }}>
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
        {rows.map((row, i) => (
          <View
            key={i}
            style={{
              borderWidth: 1,
              borderColor: theme.line,
              borderRadius: RADII.md,
              backgroundColor: theme.surface,
              padding: 10,
              gap: 10,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 13, color: theme.ink, fontFamily: TYPO.weights.bold }}>
                {f.itemLabel ?? 'Ligne'} {i + 1}
              </Text>
              {rows.length > 1 ? (
                <Pressable
                  onPress={() => setRows(f.key, rows.filter((_, k) => k !== i))}
                  hitSlop={8}
                  accessibilityLabel={`Retirer ${(f.itemLabel ?? 'ligne').toLowerCase()} ${i + 1}`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 6 }}
                >
                  <Icons.x size={13} color={theme.bad} stroke={2} />
                  <Text style={{ fontSize: 12, color: theme.bad, fontFamily: TYPO.weights.semibold }}>Retirer</Text>
                </Pressable>
              ) : null}
            </View>
            {cellRows.map((cr) => (
              <View key={cr.map((c) => c.key).join('+')} style={{ flexDirection: 'row', gap: 10 }}>
                {cr.map((c) => (
                  <View key={c.key} style={{ flex: 1, minWidth: 0 }}>
                    {c.type === 'select'
                      ? renderChips(c.label, c.options ?? [], row[c.key] ?? '', (v) => update(i, c.key, v))
                      : (
                        <Field
                          label={c.label}
                          value={row[c.key] ?? ''}
                          onChangeText={(t) => update(i, c.key, t)}
                          placeholder={c.placeholder}
                          hint={c.hint}
                          autoCapitalize="none"
                        />
                      )}
                  </View>
                ))}
              </View>
            ))}
          </View>
        ))}
        {canAdd ? (
          <Pressable
            onPress={() => setRows(f.key, [...rows, blank()])}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: 11,
              borderRadius: RADII.md,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: theme.line,
            }}
          >
            <Icons.plus size={15} color={theme.ink} stroke={2} />
            <Text style={{ fontSize: 13, color: theme.ink, fontFamily: TYPO.weights.semibold }}>
              {f.addLabel ?? 'Ajouter une ligne'}
            </Text>
          </Pressable>
        ) : null}
        {errors[f.key] ? (
          <Text style={{ color: theme.bad, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm }}>
            {errors[f.key]}
          </Text>
        ) : f.hint ? (
          <Text style={{ color: theme.muted, fontFamily: TYPO.weights.regular, fontSize: TYPO.sizes.bodySm }}>
            {f.hint}
          </Text>
        ) : null}
      </View>
    );
  }

  function renderChips(label: string, options: string[], current: string, onPick: (v: string) => void, error?: string) {
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
          {label}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {options.map((opt) => {
            const active = current === opt;
            return (
              <Pressable
                key={opt}
                onPress={() => onPick(opt)}
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
        {error ? (
          <Text style={{ color: theme.bad, fontFamily: TYPO.weights.medium, fontSize: TYPO.sizes.bodySm }}>
            {error}
          </Text>
        ) : null}
      </View>
    );
  }

  function renderField(f: AdminFieldSpec) {
    const type = f.type ?? 'text';

    if (type === 'table') return renderTable(f);

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
      return renderChips(f.label, f.options ?? [], current, (v) => set(f.key, v), errors[f.key] || undefined);
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
