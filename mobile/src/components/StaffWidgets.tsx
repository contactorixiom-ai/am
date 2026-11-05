// Briques communes à « Mon espace » (convoyeurs, salariés) et aux espaces de
// l'équipe (RH, secrétariat, comptabilité) : ligne de fichier, choix de
// catégorie, formulaire d'envoi d'une pièce.
import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { ApiError } from '../api/client';
import { CATEGORIES, categoryLabel, euros, MissionLite, STATUS_LABEL, StaffFile, StaffFileKind } from '../api/staffSpace';
import { useTheme } from '../theme/ThemeProvider';
import { SHEET_GUTTER } from '../theme/layout';
import { RADII, TYPO } from '../theme/tokens';
import { notify } from '../utils/notify';
import { openProtectedFile } from '../utils/openFile';
import { PickedFile, pickFile } from '../utils/pickFile';
import { Button } from './Button';
import { Field } from './Field';
import { Icons } from './Icons';
import { Pill, PillTone } from './Pill';
import { Surface } from './Surface';

export const fmtDay = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

/** « 15/10/2026 » ou « 2026-10-15 » → ISO, null si illisible ou vide. */
export function parseDay(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  const fr = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (fr) {
    const d = new Date(Number(fr[3]), Number(fr[2]) - 1, Number(fr[1]), 12, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const iso = new Date(v);
  return Number.isNaN(iso.getTime()) ? null : iso.toISOString();
}

export function statusTone(status: StaffFile['status']): PillTone {
  if (status === 'APPROVED') return 'good';
  if (status === 'REIMBURSED') return 'navy';
  if (status === 'REJECTED') return 'bad';
  return 'warn';
}

export async function openStaffFile(f: { fileUrl: string; fileName: string }) {
  try {
    const ok = await openProtectedFile(f.fileUrl, f.fileName);
    if (!ok) notify('Fichier indisponible', 'Le fichier n\'a pas pu être téléchargé. Réessaie dans un instant.');
  } catch {
    notify('Fichier indisponible', 'Le fichier n\'a pas pu être ouvert.');
  }
}

/** Une pièce : titre, détails, statut et bouton pour l'ouvrir. */
export function FileRow({
  file,
  showStatus = true,
  showAmount = false,
  showOwner = false,
  onOpen,
  actions,
}: {
  file: StaffFile;
  showStatus?: boolean;
  showAmount?: boolean;
  showOwner?: boolean;
  onOpen?: () => void;
  actions?: React.ReactNode;
}) {
  const { theme } = useTheme();
  const isPdf = file.mimeType.includes('pdf');
  const details = [
    showOwner && file.user ? `${file.user.firstName} ${file.user.lastName}`.trim() : '',
    categoryLabel(file.kind, file.category),
    file.spentAt ? fmtDay(file.spentAt) : '',
    file.missionRef ?? '',
  ].filter(Boolean).join(' · ');
  return (
    <View style={{ gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.lineSoft }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: theme.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
          {isPdf ? <Icons.doc size={18} color={theme.link} stroke={1.8} /> : <Icons.camera size={18} color={theme.link} stroke={1.8} />}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 13.5, color: theme.ink, fontFamily: TYPO.weights.semibold }} numberOfLines={2}>{file.title}</Text>
          <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium }} numberOfLines={2}>
            {details || fmtDay(file.createdAt)}
          </Text>
        </View>
        {showAmount && file.amountCents ? (
          <Text style={{ fontSize: 13.5, color: theme.ink, fontFamily: TYPO.weights.bold, fontVariant: ['tabular-nums'] }}>{euros(file.amountCents)}</Text>
        ) : null}
        {showStatus ? <Pill tone={statusTone(file.status)}>{STATUS_LABEL[file.status]}</Pill> : null}
      </View>
      {file.note ? <Text style={{ fontSize: 12, color: theme.inkSoft, fontFamily: TYPO.weights.medium }}>{file.note}</Text> : null}
      {file.reviewNote ? (
        <Text style={{ fontSize: 12, color: file.status === 'REJECTED' ? theme.bad : theme.muted, fontFamily: TYPO.weights.semibold }}>
          Axis : {file.reviewNote}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button
          kind="outline"
          size="sm"
          leftIcon={<Icons.arrow size={14} color={theme.ink} stroke={1.9} />}
          onPress={() => { onOpen?.(); void openStaffFile(file); }}
        >
          {isPdf ? 'Télécharger' : 'Ouvrir'}
        </Button>
        {actions}
      </View>
    </View>
  );
}

export function Chips<T extends string>({ options, value, onChange }: { options: { key: T; label: string }[]; value: T | null; onChange: (v: T) => void }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {options.map((o) => {
        const on = value === o.key;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={{
              paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADII.pill, borderWidth: 1,
              borderColor: on ? theme.select : theme.line, backgroundColor: on ? theme.select : theme.surface,
            }}
          >
            <Text style={{ fontSize: 12.5, color: on ? theme.selectInk : theme.ink, fontFamily: TYPO.weights.semibold }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SectionTitle({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, color: theme.muted, letterSpacing: 1, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }}>{title}</Text>
        {sub ? <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 2 }}>{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/** Choix du fichier : photo prise sur le moment ou fichier existant. */
export function FilePicker({ file, onChange }: { file: PickedFile | null; onChange: (f: PickedFile | null) => void }) {
  const { theme } = useTheme();
  const [busy, setBusy] = useState(false);
  const choose = async (source: 'camera' | 'document') => {
    setBusy(true);
    try {
      const f = await pickFile(source);
      if (f) onChange(f);
    } catch (e) {
      notify('Fichier non retenu', e instanceof Error ? e.message : 'Réessaie.');
    } finally {
      setBusy(false);
    }
  };
  if (file) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.bgSoft }}>
        <Icons.check size={16} color={theme.good} stroke={2.2} />
        <Text style={{ flex: 1, fontSize: 12.5, color: theme.ink, fontFamily: TYPO.weights.semibold }} numberOfLines={1}>
          {file.name} · {Math.max(1, Math.round(file.size / 1024))} Ko
        </Text>
        <Pressable onPress={() => onChange(null)} accessibilityLabel="Retirer le fichier">
          <Icons.x size={16} color={theme.muted} stroke={2} />
        </Pressable>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Button kind="outline" size="md" style={{ flex: 1 }} disabled={busy} leftIcon={<Icons.camera size={16} color={theme.ink} stroke={1.8} />} onPress={() => void choose('camera')}>
        Photo
      </Button>
      <Button kind="outline" size="md" style={{ flex: 1 }} disabled={busy} leftIcon={<Icons.doc size={16} color={theme.ink} stroke={1.8} />} onPress={() => void choose('document')}>
        Fichier / PDF
      </Button>
      {busy ? <ActivityIndicator color={theme.link} /> : null}
    </View>
  );
}

export interface UploadValues {
  category: string;
  file: PickedFile;
  title?: string;
  note?: string;
  amountCents?: number;
  spentAt?: string;
  missionId?: string;
}

/**
 * Fenêtre d'envoi d'une pièce : catégorie, fichier, et selon le cas montant,
 * date, mission concernée et note.
 */
export function UploadSheet({
  visible,
  kind,
  heading,
  intro,
  missions = [],
  withAmount = false,
  fixedTitle,
  submitLabel = 'Envoyer',
  onClose,
  onSubmit,
}: {
  visible: boolean;
  kind: StaffFileKind;
  heading: string;
  intro?: string;
  missions?: MissionLite[];
  withAmount?: boolean;
  /** Titre imposé (réponse à une demande de la RH). */
  fixedTitle?: string;
  submitLabel?: string;
  onClose: () => void;
  onSubmit: (v: UploadValues) => Promise<void>;
}) {
  const { theme } = useTheme();
  const [category, setCategory] = useState<string | null>(null);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState('');
  const [missionId, setMissionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setCategory(null); setFile(null); setTitle(''); setNote(''); setAmount(''); setDay(''); setMissionId(null); setError(null);
  };
  const close = () => { reset(); onClose(); };

  const submit = async () => {
    setError(null);
    const cat = category ?? (fixedTitle ? 'OTHER' : null);
    if (!cat) return setError('Choisis le type de pièce.');
    if (!file) return setError('Ajoute la photo ou le fichier.');
    let amountCents: number | undefined;
    if (withAmount) {
      const v = Number(amount.replace(/\s/g, '').replace(',', '.'));
      if (!Number.isFinite(v) || v <= 0) return setError('Indique le montant TTC figurant sur le justificatif.');
      amountCents = Math.round(v * 100);
    }
    const spentAt = day.trim() ? parseDay(day) : null;
    if (day.trim() && !spentAt) return setError('Date illisible : écris-la au format JJ/MM/AAAA.');
    setSaving(true);
    try {
      await onSubmit({
        category: cat,
        file,
        title: fixedTitle ?? (title.trim() || undefined),
        note: note.trim() || undefined,
        amountCents,
        spentAt: spentAt ?? undefined,
        missionId: missionId ?? undefined,
      });
      close();
    } catch (e) {
      setError(
        e instanceof ApiError && e.isNetworkError
          ? 'Pas de connexion : rien n\'a été envoyé. Réessaie quand tu as du réseau.'
          : e instanceof Error ? e.message : 'Envoi impossible. Réessaie.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: 'rgba(11,37,69,0.55)', justifyContent: 'flex-end', ...SHEET_GUTTER }}>
        <View style={{ maxHeight: '92%', backgroundColor: theme.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 12 }}>
            <Text style={{ flex: 1, fontSize: 17, color: theme.ink, fontFamily: TYPO.weights.bold }}>{heading}</Text>
            <Pressable onPress={close} accessibilityLabel="Fermer" style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: theme.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icons.x size={16} color={theme.ink} stroke={2} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 14 }} keyboardShouldPersistTaps="handled">
            {intro ? <Text style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium, lineHeight: 18 }}>{intro}</Text> : null}
            {fixedTitle ? (
              <Surface padded flat><Text style={{ fontSize: 13.5, color: theme.ink, fontFamily: TYPO.weights.semibold }}>{fixedTitle}</Text></Surface>
            ) : (
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.semibold }}>Type de pièce</Text>
                <Chips options={CATEGORIES[kind]} value={category} onChange={setCategory} />
              </View>
            )}
            <FilePicker file={file} onChange={setFile} />
            {withAmount ? (
              <Field label="Montant TTC (€)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Ex. 42,50" />
            ) : null}
            {!fixedTitle ? (
              <Field label="Intitulé (facultatif)" value={title} onChangeText={setTitle} placeholder={category ? categoryLabel(kind, category) : 'Ex. Paris → Lyon, 14 h 12'} />
            ) : null}
            <Field
              label={kind === 'TRAVEL' ? 'Date du voyage / du séjour (facultatif)' : 'Date de la dépense (facultatif)'}
              value={day}
              onChangeText={setDay}
              placeholder="JJ/MM/AAAA"
            />
            {missions.length ? (
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.semibold }}>Mission concernée (facultatif)</Text>
                <Chips
                  options={missions.slice(0, 12).map((m) => ({ key: m.id, label: `${m.reference} · ${m.pickupCity} → ${m.deliveryCity}` }))}
                  value={missionId}
                  onChange={(v) => setMissionId((cur) => (cur === v ? null : v))}
                />
              </View>
            ) : null}
            <Field label="Note (facultatif)" value={note} onChangeText={setNote} multiline placeholder="Précision utile pour Axis" />
            {error ? <Text style={{ color: theme.bad, fontFamily: TYPO.weights.semibold, fontSize: 13 }}>{error}</Text> : null}
            <Button kind="gold" size="lg" fullWidth loading={saving} onPress={() => void submit()}>{submitLabel}</Button>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
