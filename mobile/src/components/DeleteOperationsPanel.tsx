// Suppression d'opérations de test (administrateur, onglet Équipe).
//
// Utilisable à tout moment, contrairement à la remise à zéro d'avant
// lancement : Roger coche les opérations de test, et seules celles-là
// disparaissent, avec leur suivi, leurs états des lieux, messages, paiements
// et documents. Tout le reste de l'activité est intact.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { deleteOperations, listResetOperations, ResetOperation } from '../api/dataReset';
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

/** Nombre d'opérations affichées avant « Afficher plus ». */
const PAGE = 20;

export function DeleteOperationsPanel({ onDone }: { onDone?: () => void }) {
  const { theme } = useTheme();
  const [ops, setOps] = useState<ResetOperation[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [typed, setTyped] = useState('');
  const [running, setRunning] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [lastDeleted, setLastDeleted] = useState<string[]>([]);

  const load = useCallback(() => {
    setFailed(false);
    listResetOperations()
      // Les plus récentes d'abord : ce sont en général les essais du jour.
      .then((list) => setOps([...list].reverse()))
      .catch(() => { setOps([]); setFailed(true); });
  }, []);
  useEffect(load, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!ops) return [];
    if (!q) return ops;
    return ops.filter((o) =>
      [o.reference, o.clientName, o.clientEmail, o.route, o.detail, o.driverName].some((v) => v.toLowerCase().includes(q)),
    );
  }, [ops, query]);

  const chosen = (ops ?? []).filter((o) => selected.has(o.id));
  const invoiced = chosen.filter((o) => o.paymentStatus === 'PAID' && o.invoiceNumber);
  const ready = typed.trim().toUpperCase() === 'EFFACER' && chosen.length > 0;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exportChosen = () => {
    const headers = ['Date', 'Type', 'Référence', 'Statut', 'Trajet', 'Client', 'E-mail client', 'Téléphone client',
      'Véhicule / contenu', 'Destinataire', 'Convoyeur', 'Prix (EUR)', 'Règlement', 'Réglé (EUR)', 'N° de facture'];
    const rows = chosen.map((o) => [
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
    ]);
    const ok = downloadCsv(`operations-axis-supprimees-${new Date().toISOString().slice(0, 10)}`, headers, rows);
    notify(ok ? 'Données téléchargées' : 'Export indisponible',
      ok ? `${chosen.length} opération(s) exportée(s) avant suppression.` : 'L\'export CSV est disponible sur la version web / bureau.');
  };

  const execute = async () => {
    setRunning(true);
    setFailure(null);
    try {
      const res = await deleteOperations(typed, chosen);
      setLastDeleted(res.deleted);
      setSelected(new Set());
      setTyped('');
      load();
      onDone?.();
    } catch (e) {
      setFailure(e instanceof Error && e.message ? e.message : 'Le serveur n\'a pas répondu. Vérifie la connexion et réessaie.');
    } finally {
      setRunning(false);
    }
  };

  const run = () => {
    confirmAction(
      `Supprimer ${chosen.length} opération${chosen.length > 1 ? 's' : ''} ?`,
      `${chosen.map((o) => o.reference).join(', ')} : suppression définitive, avec leur suivi, états des lieux, messages, paiements et documents. Le reste de l'activité et les comptes ne sont pas touchés.`
        + (invoiced.length ? ` Attention : ${invoiced.length} facture(s) émise(s) disparaîtront (${invoiced.map((o) => o.invoiceNumber).join(', ')}).` : ''),
      () => { void execute(); },
      'Supprimer',
    );
  };

  return (
    <Surface padded style={{ gap: 12, borderWidth: 1, borderColor: theme.bad + '55' }}>
      <Text style={{ fontSize: 15, color: theme.bad, fontFamily: TYPO.weights.bold }}>Supprimer des opérations de test</Text>
      <Text style={{ fontSize: 12.5, color: theme.inkSoft, fontFamily: TYPO.weights.medium, lineHeight: 18 }}>
        Coche les opérations d'essai : seules celles-là sont supprimées, avec tout ce qui leur est rattaché. Le reste de l'activité,
        les comptes inscrits et les documents officiels ne sont pas touchés. Disponible à tout moment.
      </Text>

      {lastDeleted.length ? (
        <View style={{ padding: 12, borderRadius: 10, backgroundColor: theme.good + '15', borderWidth: 1, borderColor: theme.good + '40' }}>
          <Text style={{ fontSize: 12.5, color: theme.good, fontFamily: TYPO.weights.semibold }}>
            {`✓ Supprimé : ${lastDeleted.join(', ')}`}
          </Text>
        </View>
      ) : null}

      {ops === null ? <ActivityIndicator color={theme.link} /> : null}
      {failed ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: theme.bad, fontFamily: TYPO.weights.semibold, fontSize: 13 }}>Liste indisponible pour le moment.</Text>
          <Button kind="outline" size="sm" onPress={load} style={{ alignSelf: 'flex-start' }}>Réessayer</Button>
        </View>
      ) : null}

      {ops && !failed ? (
        ops.length === 0 ? (
          <Text style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>Aucune opération enregistrée.</Text>
        ) : (
          <>
            <Field
              label="Rechercher"
              value={query}
              onChangeText={(v) => { setQuery(v); setShown(PAGE); }}
              placeholder="Référence, client, ville…"
              autoCorrect={false}
            />
            <View style={{ gap: 6 }}>
              {filtered.slice(0, shown).map((o) => {
                const on = selected.has(o.id);
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
                      borderColor: on ? theme.bad : theme.line,
                      backgroundColor: on ? theme.bad + '12' : theme.surface,
                    }}
                  >
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        marginTop: 1,
                        borderWidth: 1.5,
                        borderColor: on ? theme.bad : theme.faint,
                        backgroundColor: on ? theme.bad : 'transparent',
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
              {filtered.length === 0 ? (
                <Text style={{ fontSize: 12.5, color: theme.muted, fontFamily: TYPO.weights.medium }}>Aucune opération ne correspond.</Text>
              ) : null}
              {filtered.length > shown ? (
                <Button kind="ghost" size="sm" onPress={() => setShown((n) => n + PAGE)}>
                  {`Afficher plus (${filtered.length - shown} de plus)`}
                </Button>
              ) : null}
            </View>
          </>
        )
      ) : null}

      {chosen.length ? (
        <>
          <Text style={{ fontSize: 12.5, color: theme.ink, fontFamily: TYPO.weights.semibold }}>
            {`${chosen.length} opération(s) à supprimer : ${chosen.map((o) => o.reference).join(', ')}.`}
          </Text>
          {invoiced.length ? (
            <View style={{ padding: 12, borderRadius: 10, backgroundColor: theme.warn + '18', borderWidth: 1, borderColor: theme.warn + '55' }}>
              <Text style={{ fontSize: 12, color: theme.ink, fontFamily: TYPO.weights.semibold, lineHeight: 17 }}>
                {`${invoiced.length} opération(s) ont une facture émise (${invoiced.map((o) => o.invoiceNumber).join(', ')}). Si c'était un vrai paiement, ne supprime pas : fais plutôt un avoir. Pour un essai, la facture disparaît et son numéro n'est jamais réutilisé.`}
              </Text>
            </View>
          ) : null}
          <Button kind="outline" size="md" fullWidth onPress={exportChosen}>
            Télécharger la sélection avant suppression (CSV)
          </Button>
          <Field label="Tape EFFACER pour confirmer" value={typed} onChangeText={setTyped} autoCapitalize="characters" autoCorrect={false} />
          {failure ? (
            <View style={{ padding: 12, borderRadius: 10, backgroundColor: theme.bad + '15', borderWidth: 1, borderColor: theme.bad + '40' }}>
              <Text style={{ fontSize: 12.5, color: theme.bad, fontFamily: TYPO.weights.semibold }}>{`Rien n'a été supprimé : ${failure}`}</Text>
            </View>
          ) : null}
          <Button kind="danger" size="md" fullWidth disabled={!ready || running} loading={running} onPress={run}>
            {`Supprimer ${chosen.length} opération${chosen.length > 1 ? 's' : ''}`}
          </Button>
        </>
      ) : null}
    </Surface>
  );
}
