// Remise à zéro avant le lancement (administrateur, onglet Équipe).
//
// Efface toute l'activité de test : convoyages, colis, devis, paiements,
// factures, documents, états des lieux, messages, notifications. Les comptes
// inscrits sont conservés. Utilisable une seule fois, en tapant « EFFACER ».
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { getResetPreview, ResetPreview, runReset } from '../api/dataReset';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';
import { confirmAction, notify } from '../utils/notify';
import { Button } from './Button';
import { Field } from './Field';
import { Surface } from './Surface';

export function ResetPanel({ onDone }: { onDone?: () => void }) {
  const { theme } = useTheme();
  const [preview, setPreview] = useState<ResetPreview | null>(null);
  const [typed, setTyped] = useState('');
  const [running, setRunning] = useState(false);

  useEffect(() => {
    getResetPreview().then(setPreview).catch(() => setPreview(null));
  }, []);

  if (!preview) return null;

  if (preview.doneAt) {
    return (
      <Surface padded style={{ gap: 4 }}>
        <Text style={{ fontSize: 14, color: theme.ink, fontFamily: TYPO.weights.bold }}>Remise à zéro faite</Text>
        <Text style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium, lineHeight: 18 }}>
          {`L'activité de test a été effacée le ${new Date(preview.doneAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}. Tout ce qui apparaît depuis est réel.`}
        </Text>
      </Surface>
    );
  }

  const items = [
    [preview.missions, 'convoyage'],
    [preview.parcels, 'colis / envoi'],
    [preview.quotes, 'devis'],
    [preview.payments, 'paiement'],
    [preview.documents, 'document'],
    [preview.inspections, 'état des lieux'],
    [preview.conversations, 'conversation'],
    [preview.adminDocuments, 'document officiel'],
    [preview.vehicles, 'véhicule'],
  ] as const;
  const summary = items.filter(([n]) => n > 0).map(([n, label]) => `${n} ${label}${n > 1 && !label.endsWith('s') ? 's' : ''}`).join(', ');
  const ready = typed.trim().toUpperCase() === 'EFFACER';

  const run = () => {
    confirmAction(
      'Tout effacer ?',
      'Toute l\'activité de test est supprimée définitivement. Les comptes inscrits sont conservés. Cette action ne peut pas être annulée.',
      async () => {
        setRunning(true);
        try {
          const res = await runReset(typed);
          setPreview({ ...res, doneAt: res.doneAt ?? new Date().toISOString() });
          setTyped('');
          notify('Remise à zéro faite', 'L\'application est vierge et prête pour le lancement.');
          onDone?.();
        } catch (e) {
          notify('Remise à zéro impossible', e instanceof Error ? e.message : 'Réessaie dans un instant.');
        } finally {
          setRunning(false);
        }
      },
      'Tout effacer',
    );
  };

  return (
    <Surface padded style={{ gap: 10, borderWidth: 1, borderColor: theme.bad + '55' }}>
      <Text style={{ fontSize: 15, color: theme.bad, fontFamily: TYPO.weights.bold }}>Remise à zéro avant le lancement</Text>
      <Text style={{ fontSize: 12.5, color: theme.inkSoft, fontFamily: TYPO.weights.medium, lineHeight: 18 }}>
        Efface toutes les opérations de test : convoyages, colis, devis, paiements, factures, documents, états des lieux, messages et
        notifications. La numérotation des factures et des documents repart à 1. Les comptes inscrits (clients, convoyeurs, équipe)
        sont conservés. Utilisable une seule fois.
      </Text>
      <Text style={{ fontSize: 12.5, color: theme.ink, fontFamily: TYPO.weights.semibold }}>
        {summary ? `À effacer : ${summary}.` : 'Aucune activité à effacer.'}
      </Text>
      <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium, lineHeight: 16 }}>
        Les paiements de test restent visibles dans ton tableau de bord Stripe (mode test) : ils ne sont pas affectés.
      </Text>
      <Field label="Tape EFFACER pour confirmer" value={typed} onChangeText={setTyped} autoCapitalize="characters" autoCorrect={false} />
      <Button kind="danger" size="md" fullWidth disabled={!ready || running} loading={running} onPress={run}>
        Tout effacer
      </Button>
    </Surface>
  );
}
