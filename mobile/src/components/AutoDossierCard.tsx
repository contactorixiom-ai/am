import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from './Button';
import { Icons } from './Icons';
import { Pill } from './Pill';
import { Surface } from './Surface';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';
import {
  DossierPlan,
  GenerateAllResult,
  generateAllAuto,
  joinLabels,
  planCounts,
} from '../utils/dossierAuto';

interface Props {
  /** Plan du dossier (croisement envoi × réglementation pays). */
  plan: DossierPlan;
  /** Données de démonstration (API indisponible). */
  demo?: boolean;
  /**
   * Notifie le parent qu'un document `auto` vient d'être généré, pour qu'il
   * mette à jour le statut affiché dans la liste détaillée (clé du document).
   */
  onGenerated?: (docKeys: string[]) => void;
}

// ════════════════════════════════════════════════════════════════════════
//  CARTE « DOSSIER AUTOMATIQUE »
//  Mise en avant en haut du centre de conformité. Un seul geste : « Générer
//  tout le dossier » produit d'un coup tous les PDF générables, puis affiche
//  un récap clair de ce qu'il reste à fournir / signer.
// ════════════════════════════════════════════════════════════════════════
export function AutoDossierCard({ plan, demo, onGenerated }: Props) {
  const { theme } = useTheme();
  const counts = useMemo(() => planCounts(plan), [plan]);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null);
  const [result, setResult] = useState<GenerateAllResult | null>(null);

  const nothingToGenerate = counts.auto === 0;

  const handleGenerateAll = async () => {
    if (busy || nothingToGenerate) return;
    setBusy(true);
    setResult(null);
    setProgress({ done: 0, total: counts.auto, label: '' });
    try {
      const res = await generateAllAuto(plan, {
        onProgress: (done, total, current) =>
          setProgress({ done, total, label: current.doc.label }),
      });
      setResult(res);
      if (res.generated.length > 0) {
        const keys = plan.auto
          .filter((i) => res.generated.includes(i.doc.label))
          .map((i) => i.doc.key);
        onGenerated?.(keys);
      }
    } catch {
      // Repli gracieux : on n'efface pas l'écran, on signale l'échec via le récap.
      setResult({
        generated: [],
        failed: plan.auto.map((i) => i.doc.label),
        remaining: {
          toUpload: plan.toUpload.map((i) => i.doc.label),
          toSign: plan.toSign.map((i) => i.doc.label),
        },
      });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  // Carte navy mise en avant (cohérente avec ComplianceChecklist).
  const onNavy = '#F5F1E8';
  const onNavyMuted = 'rgba(245,241,232,0.62)';

  return (
    <Surface padded flat style={{ padding: 16, backgroundColor: theme.navy, borderColor: theme.navy, gap: 14 }}>
      {/* En-tête */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 44, height: 44, borderRadius: 12,
            backgroundColor: 'rgba(245,241,232,0.12)',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icons.bolt size={22} color={theme.goldHi} stroke={1.9} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 11, color: theme.goldHi, letterSpacing: 1, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }}>
            Dossier automatique
          </Text>
          <Text style={{ fontSize: 18, color: onNavy, fontFamily: TYPO.weights.bold, marginTop: 2, letterSpacing: -0.2 }}>
            Saisis une fois, on génère tout
          </Text>
        </View>
      </View>

      {/* Résumé chiffré */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Pill tone="gold">{`${counts.auto} ${counts.auto > 1 ? 'générés' : 'généré'} auto.`}</Pill>
        <Pill tone="ghost" style={{ borderColor: 'rgba(245,241,232,0.28)' }}>
          {`${counts.toUpload} à fournir`}
        </Pill>
        {counts.toSign > 0 ? (
          <Pill tone="ghost" style={{ borderColor: 'rgba(245,241,232,0.28)' }}>
            {`${counts.toSign} à signer`}
          </Pill>
        ) : null}
        {demo ? (
          <Pill tone="ghost" style={{ borderColor: 'rgba(245,241,232,0.28)' }}>Démo</Pill>
        ) : null}
      </View>

      <Text style={{ fontSize: 12.5, color: onNavyMuted, lineHeight: 17, fontFamily: TYPO.weights.medium }}>
        {nothingToGenerate
          ? "Aucun document n'est générable automatiquement pour cet envoi. Les pièces requises sont à fournir ou à signer ci-dessous."
          : `Axis remplit et produit ${counts.auto} document${counts.auto > 1 ? 's' : ''} d'un coup à partir des infos de l'envoi. Il ne vous reste que le strict minimum.`}
      </Text>

      {/* Progression pendant la génération */}
      {busy && progress ? (
        <View style={{ gap: 6 }}>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(245,241,232,0.15)' }}>
            <View
              style={{
                width: `${progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0}%`,
                height: '100%', backgroundColor: theme.gold, borderRadius: 2,
              }}
            />
          </View>
          <Text style={{ fontSize: 11.5, color: onNavyMuted, fontFamily: TYPO.weights.medium }} numberOfLines={1}>
            {`Génération ${progress.done}/${progress.total}${progress.label ? ` · ${progress.label}` : ''}…`}
          </Text>
        </View>
      ) : null}

      {/* Récap après génération */}
      {result && !busy ? (
        <View
          style={{
            backgroundColor: 'rgba(245,241,232,0.08)',
            borderRadius: 12, padding: 12, gap: 6,
          }}
        >
          {result.generated.length > 0 ? (
            <Text style={{ fontSize: 13, color: onNavy, fontFamily: TYPO.weights.semibold, lineHeight: 18 }}>
              {`✓ ${result.generated.length} document${result.generated.length > 1 ? 's' : ''} généré${result.generated.length > 1 ? 's' : ''}.`}
            </Text>
          ) : (
            <Text style={{ fontSize: 13, color: theme.goldHi, fontFamily: TYPO.weights.semibold, lineHeight: 18 }}>
              Aucun document n'a pu être généré. Réessaie.
            </Text>
          )}

          {result.remaining.toUpload.length > 0 ? (
            <Text style={{ fontSize: 12, color: onNavyMuted, fontFamily: TYPO.weights.medium, lineHeight: 17 }}>
              {`Il ne vous reste qu'à fournir : ${joinLabels(result.remaining.toUpload)}.`}
            </Text>
          ) : null}
          {result.remaining.toSign.length > 0 ? (
            <Text style={{ fontSize: 12, color: onNavyMuted, fontFamily: TYPO.weights.medium, lineHeight: 17 }}>
              {`À signer : ${joinLabels(result.remaining.toSign)}.`}
            </Text>
          ) : null}
          {result.failed.length > 0 ? (
            <Text style={{ fontSize: 12, color: theme.goldHi, fontFamily: TYPO.weights.medium, lineHeight: 17 }}>
              {`À régénérer : ${joinLabels(result.failed)}.`}
            </Text>
          ) : null}
          {result.remaining.toUpload.length === 0 && result.remaining.toSign.length === 0 && result.failed.length === 0 ? (
            <Text style={{ fontSize: 12, color: onNavyMuted, fontFamily: TYPO.weights.medium, lineHeight: 17 }}>
              Dossier complet — rien d'autre à fournir.
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Bouton principal */}
      <Button
        kind="gold"
        size="lg"
        fullWidth
        loading={busy}
        disabled={nothingToGenerate}
        onPress={handleGenerateAll}
        rightIcon={busy ? undefined : <Icons.bolt size={18} color={theme.navy} stroke={2.2} />}
      >
        {busy
          ? 'Génération en cours…'
          : result && result.generated.length > 0
            ? 'Régénérer tout le dossier'
            : 'Générer tout le dossier'}
      </Button>
    </Surface>
  );
}
