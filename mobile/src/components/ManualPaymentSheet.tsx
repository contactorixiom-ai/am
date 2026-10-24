import React, { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { ManualMethod, recordManualPayment } from '../api/payments';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';
import { Button } from './Button';
import { Field } from './Field';

const METHODS: { v: ManualMethod; l: string }[] = [
  { v: 'TRANSFER', l: 'Virement' },
  { v: 'CASH', l: 'Espèces' },
  { v: 'CHECK', l: 'Chèque' },
  { v: 'CARD_TERMINAL', l: 'Carte (TPE)' },
  { v: 'MOBILE_MONEY', l: 'Mobile money' },
];

export interface EncashTarget {
  kind: 'mission' | 'parcel';
  id: string;
  reference: string;
  amountCents?: number | null;
}

/**
 * Règlement reçu hors de l'application : l'envoi passe « payé », le client
 * est prévenu et la facture reçoit son numéro légal.
 */
export function ManualPaymentSheet({ target, onClose, onDone }: { target: EncashTarget | null; onClose: () => void; onDone: (invoiceNumber?: string | null) => void }) {
  const { theme } = useTheme();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<ManualMethod>('TRANSFER');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAmount(target?.amountCents ? (target.amountCents / 100).toFixed(2).replace('.', ',') : '');
    setMethod('TRANSFER');
    setNote('');
    setError(null);
  }, [target]);

  const save = async () => {
    if (!target) return;
    const cents = Math.round(Number(amount.replace(/\s/g, '').replace(',', '.')) * 100);
    if (!Number.isFinite(cents) || cents < 100) return setError('Montant invalide.');
    setSaving(true);
    setError(null);
    try {
      const p = await recordManualPayment({
        ...(target.kind === 'mission' ? { missionId: target.id } : { parcelId: target.id }),
        amountCents: cents,
        method,
        note: note.trim() || undefined,
      });
      onDone(p.invoiceNumber);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={!!target} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(11,37,69,0.55)', justifyContent: 'flex-end' }}>
        <Pressable onPress={(e) => e.stopPropagation?.()} style={{ backgroundColor: theme.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 28, gap: 12 }}>
          <Text style={{ fontSize: 17, color: theme.ink, fontFamily: TYPO.weights.bold }}>Encaisser — {target?.reference}</Text>
          <Text style={{ fontSize: 12.5, color: theme.inkSoft, fontFamily: TYPO.weights.medium, lineHeight: 18 }}>
            Règlement reçu hors de l'application. L'envoi passe « payé », le client est prévenu et sa facture reçoit son numéro.
          </Text>
          <Field label="Montant TTC (€)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {METHODS.map((m) => (
              <Pressable
                key={m.v}
                onPress={() => setMethod(m.v)}
                style={{
                  paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADII.pill, borderWidth: 1.5,
                  borderColor: method === m.v ? theme.navy : theme.line,
                  backgroundColor: method === m.v ? theme.navy : theme.surface,
                }}
              >
                <Text style={{ fontSize: 13, color: method === m.v ? theme.bg : theme.ink, fontFamily: TYPO.weights.semibold }}>{m.l}</Text>
              </Pressable>
            ))}
          </View>
          <Field label="Référence (facultatif)" value={note} onChangeText={setNote} placeholder="N° de virement, de chèque…" />
          {error ? <Text style={{ fontSize: 13, color: theme.bad, fontFamily: TYPO.weights.medium }}>{error}</Text> : null}
          <Button kind="primary" fullWidth loading={saving} onPress={save}>Enregistrer le règlement</Button>
          <Button kind="ghost" fullWidth onPress={onClose}>Annuler</Button>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
