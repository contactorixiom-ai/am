// Remise à zéro avant le lancement (administrateur, onglet Équipe).
//
// Efface l'activité de test : convoyages, colis, devis, paiements, factures,
// documents, états des lieux, messages, notifications. Roger coche les
// opérations réelles à garder, et peut télécharger toutes les données avant.
// Les comptes inscrits sont conservés. Une seule fois, en tapant « EFFACER ».
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { getResetPreview, listResetOperations, ResetOperation, ResetPreview, runReset } from '../api/dataReset';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';
import { downloadCsv } from '../utils/csv';
import { confirmAction, notify } from '../utils/notify';
import { Button } from './Button';
import { Field } from './Field';
import { Icons } from './Icons';
import { StatusBadge, statusLabel } from './StatusBadge';
import { Surface } from './Surface';

const fmtEur = (cents: number | null) =>
  cents == null ? '' : (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

export function ResetPanel({ onDone }: { onDone?: () => void }) {
  const { theme } = useTheme();
  const [preview, setPreview] = useState<ResetPreview | null>(null);
  const [ops, setOps] = useState<ResetOperation[]>([]);
  const [keep, setKeep] = useState<Set<string>>(new Set());
  const [typed, setTyped] = useState('');
  const [running, setRunning] = useState(false);
  const [kept, setKept] = useState<string[]>([]);

  useEffect(() => {
    getResetPreview()
      .then((p) => {
        setPreview(p);
        if (!p.doneAt) listResetOperations().then(setOps).catch(() => setOps([]));
      })
      .catch(() => setPreview(null));
  }, []);

  if (!preview) return null;

  if (preview.doneAt) {
    return (
      <Surface padded style={{ gap: 4 }}>
        <Text style={{ fontSize: 14, color: theme.ink, fontFamily: TYPO.weights.bold }}>Remise à zéro faite</Text>
        <Text style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium, lineHeight: 18 }}>
          {`L'activité de test a été effacée le ${new Date(preview.doneAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}${
            kept.length ? `, en gardant ${kept.join(', ')}` : ''
          }. Tout ce qui apparaît depuis est réel.`}
        </Text>
      </Surface>
    );
  }

  const toggle = (id: string) =>
    setKeep((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const keptOps = ops.filter((o) => keep.has(o.id));
  const erased = ops.length - keptOps.length;
  const ready = typed.trim().toUpperCase() === 'EFFACER';

  const exportAll = () => {
    const headers = ['Date', 'Type', 'Référence', 'Statut', 'Trajet', 'Client', 'E-mail client', 'Téléphone client',
      'Véhicule / contenu', 'Destinataire', 'Convoyeur', 'Prix (EUR)', 'Règlement', 'Réglé (EUR)', 'N° de facture', 'Gardée'];
    const rows = ops.map((o) => [
      new Date(o.createdAt).toLocaleDateString('fr-FR'),
      o.kind === 'mission' ? 'Convoyage' : 'Colis / envoi',
      o.reference,
      statusLabel(o.status),
      o.route,
      o.clientName,
      o.clientEmail,
      o.clientPhone,
      o.detail,
      o.recipient,
      o.driverName,
      o.priceCents == null ? '' : (o.priceCents / 100).toFixed(2).replace('.', ','),
      o.paymentStatus === 'PAID' ? 'Payé' : o.paymentStatus ? 'Non payé' : '',
      o.paidCents == null ? '' : (o.paidCents / 100).toFixed(2).replace('.', ','),
      o.invoiceNumber ?? '',
      keep.has(o.id) ? 'Oui' : 'Non',
    ]);
    const ok = downloadCsv(`operations-axis-avant-remise-a-zero-${new Date().toISOString().slice(0, 10)}`, headers, rows);
    notify(ok ? 'Données téléchargées' : 'Export indisponible',
      ok ? `${ops.length} opération(s) exportée(s). Garde ce fichier : il ne pourra plus être produit après l'effacement.`
         : 'L\'export CSV est disponible sur la version web / bureau.');
  };

  const run = () => {
    confirmAction(
      'Tout effacer ?',
      keptOps.length
        ? `${erased} opération(s) de test effacée(s) définitivement. Gardée(s) intacte(s) : ${keptOps.map((o) => o.reference).join(', ')}. Les comptes inscrits sont conservés.`
        : 'Toute l\'activité est supprimée définitivement, sans rien garder. Les comptes inscrits sont conservés.',
      async () => {
        setRunning(true);
        try {
          const res = await runReset(typed, keptOps);
          setKept(res.kept ?? []);
          setPreview({ ...res, doneAt: res.doneAt ?? new Date().toISOString() });
          setTyped('');
          notify('Remise à zéro faite', res.kept?.length ? `Gardé : ${res.kept.join(', ')}.` : 'L\'application est vierge.');
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
    <Surface padded style={{ gap: 12, borderWidth: 1, borderColor: theme.bad + '55' }}>
      <Text style={{ fontSize: 15, color: theme.bad, fontFamily: TYPO.weights.bold }}>Remise à zéro avant le lancement</Text>
      <Text style={{ fontSize: 12.5, color: theme.inkSoft, fontFamily: TYPO.weights.medium, lineHeight: 18 }}>
        Efface les opérations de test : convoyages, colis, devis, paiements, factures, documents, états des lieux, messages et
        notifications. Les comptes inscrits (clients, convoyeurs, équipe) sont conservés. Utilisable une seule fois.
      </Text>

      <Text style={{ fontSize: 13, color: theme.ink, fontFamily: TYPO.weights.bold }}>1 · Télécharger les données de test</Text>
      <Button kind="outline" size="md" fullWidth onPress={exportAll} disabled={!ops.length}>
        {`Télécharger les ${ops.length} opération(s) (CSV)`}
      </Button>

      <Text style={{ fontSize: 13, color: theme.ink, fontFamily: TYPO.weights.bold }}>2 · Cocher les opérations réelles à garder</Text>
      <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium, lineHeight: 17 }}>
        Une opération gardée reste intacte : client, contenu, suivi, règlement, facture, documents et messages. La numérotation des
        factures reprend après la dernière facture gardée.
      </Text>
      {ops.length === 0 ? (
        <Text style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>Aucune opération enregistrée.</Text>
      ) : (
        <View style={{ gap: 6 }}>
          {ops.map((o) => {
            const on = keep.has(o.id);
            return (
              <Pressable
                key={o.id}
                onPress={() => toggle(o.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                style={{
                  flexDirection: 'row',
                  gap: 10,
                  padding: 10,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: on ? theme.good : theme.line,
                  backgroundColor: on ? theme.good + '14' : theme.surface,
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    marginTop: 1,
                    borderWidth: 1.5,
                    borderColor: on ? theme.good : theme.faint,
                    backgroundColor: on ? theme.good : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {on ? <Icons.check size={14} color="#fff" stroke={2.4} /> : null}
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={{ fontSize: 13, color: theme.ink, fontFamily: TYPO.weights.bold }}>{o.reference}</Text>
                    <StatusBadge status={o.status} />
                  </View>
                  <Text style={{ fontSize: 12, color: theme.inkSoft, fontFamily: TYPO.weights.semibold }} numberOfLines={1}>
                    {`${fmtDay(o.createdAt)} · ${o.route}`}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium }} numberOfLines={2}>
                    {[o.clientName, o.detail, o.recipient ? `pour ${o.recipient}` : ''].filter(Boolean).join(' · ')}
                  </Text>
                  {o.priceCents != null ? (
                    <Text style={{ fontSize: 11.5, color: o.paymentStatus === 'PAID' ? theme.good : theme.muted, fontFamily: TYPO.weights.semibold }}>
                      {o.paymentStatus === 'PAID' ? `Payé ${fmtEur(o.paidCents)}${o.invoiceNumber ? ` · ${o.invoiceNumber}` : ''}` : `${fmtEur(o.priceCents)} · non payé`}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      <Text style={{ fontSize: 13, color: theme.ink, fontFamily: TYPO.weights.bold }}>3 · Confirmer</Text>
      <Text style={{ fontSize: 12.5, color: theme.ink, fontFamily: TYPO.weights.semibold }}>
        {keptOps.length
          ? `${erased} opération(s) effacée(s), ${keptOps.length} gardée(s) : ${keptOps.map((o) => o.reference).join(', ')}.`
          : `${ops.length} opération(s) effacée(s), aucune gardée.`}
      </Text>
      <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium, lineHeight: 16 }}>
        Les paiements de test restent visibles dans ton tableau de bord Stripe (mode test) : ils ne sont pas affectés.
      </Text>
      <Field label="Tape EFFACER pour confirmer" value={typed} onChangeText={setTyped} autoCapitalize="characters" autoCorrect={false} />
      <Button kind="danger" size="md" fullWidth disabled={!ready || running} loading={running} onPress={run}>
        {keptOps.length ? `Tout effacer sauf ${keptOps.length} opération${keptOps.length > 1 ? 's' : ''}` : 'Tout effacer'}
      </Button>
    </Surface>
  );
}
