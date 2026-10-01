import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Modal, Pressable, Text, View } from 'react-native';
import { listPendingKyc, PendingKycDocument, reviewKycDocument } from '../api/kyc';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';
import { AuthImage } from './AuthImage';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { Field } from './Field';
import { Skeleton } from './Skeleton';
import { Surface } from './Surface';

// Emplacement indiqué par le nom du fichier (voir KycVerificationScreen).
const SLOT_LABELS: Record<string, string> = {
  license_front: 'Permis — recto',
  license_back: 'Permis — verso',
  id_front: 'Pièce d\'identité — recto',
  id_back: 'Pièce d\'identité — verso',
  address: 'Justificatif de domicile',
  selfie: 'Photo de contrôle (selfie)',
};
const TYPE_LABELS: Record<string, string> = {
  DRIVER_LICENSE: 'Permis de conduire',
  IDENTITY_CARD: 'Pièce d\'identité',
  PASSPORT: 'Passeport',
  PROOF_OF_ADDRESS: 'Justificatif de domicile',
  OTHER: 'Autre document',
};

function labelOf(d: PendingKycDocument): string {
  const slot = d.fileName?.split('.')[0];
  return (slot && SLOT_LABELS[slot]) || TYPE_LABELS[d.type] || d.type;
}

/**
 * Vérification des pièces des convoyeurs. Sans cet écran, Roger n'avait
 * aucun moyen de valider un convoyeur, et un convoyeur non validé ne peut
 * pas accepter de mission.
 */
export function KycReviewPanel({ onCountChange }: { onCountChange?: (n: number) => void }) {
  const { theme } = useTheme();
  const [docs, setDocs] = useState<PendingKycDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [zoom, setZoom] = useState<PendingKycDocument | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await listPendingKyc();
      setDocs(list);
      onCountChange?.(list.length);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible.');
      setDocs((d) => d ?? []);
    }
  }, [onCountChange]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (doc: PendingKycDocument, status: 'APPROVED' | 'REJECTED') => {
    if (status === 'REJECTED' && !reason.trim()) {
      setError('Indique le motif du refus : il est envoyé au convoyeur.');
      return;
    }
    setBusy(doc.id);
    setError(null);
    try {
      await reviewKycDocument(doc.id, status, status === 'REJECTED' ? reason.trim() : undefined);
      setRejecting(null);
      setReason('');
      setDocs((prev) => {
        const next = (prev ?? []).filter((d) => d.id !== doc.id);
        onCountChange?.(next.length);
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible.');
    } finally {
      setBusy(null);
    }
  };

  if (docs === null) return <Skeleton variant="card" count={2} />;

  // Regroupement par personne : on valide un convoyeur pièce par pièce, mais
  // on compare la photo de contrôle à la pièce d'identité côte à côte.
  const byUser = new Map<string, PendingKycDocument[]>();
  for (const d of docs) byUser.set(d.user.id, [...(byUser.get(d.user.id) ?? []), d]);

  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontSize: 12.5, color: theme.inkSoft, fontFamily: TYPO.weights.medium, lineHeight: 18 }}>
        Un convoyeur peut accepter des missions dès que sa pièce d'identité (ou son passeport) et son permis sont validés.
        Compare la photo de contrôle à la pièce d'identité. Touche une photo pour l'agrandir.
      </Text>
      {error ? <Text style={{ fontSize: 13, color: theme.bad, fontFamily: TYPO.weights.medium }}>{error}</Text> : null}

      {docs.length === 0 ? (
        <Surface padded style={{ padding: 4 }}>
          <EmptyState iconKey="check" title="Rien à vérifier" subtitle="Les documents envoyés par les convoyeurs apparaîtront ici." />
        </Surface>
      ) : (
        [...byUser.values()].map((list) => {
          const u = list[0].user;
          return (
            <Surface key={u.id} padded style={{ padding: 12, gap: 10 }}>
              <View>
                <Text style={{ fontSize: 15, color: theme.ink, fontFamily: TYPO.weights.bold }}>
                  {u.firstName} {u.lastName}
                  <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium }}>
                    {u.role === 'DRIVER' ? '  · convoyeur' : '  · client'}
                  </Text>
                </Text>
                <Text style={{ fontSize: 12.5, color: theme.inkSoft, fontFamily: TYPO.weights.medium, marginTop: 2 }}>
                  {u.email}
                  {u.phone ? '  ·  ' : ''}
                  {u.phone ? (
                    <Text style={{ color: theme.navy, textDecorationLine: 'underline' }} onPress={() => Linking.openURL(`tel:${u.phone!.replace(/\s/g, '')}`)}>
                      {u.phone}
                    </Text>
                  ) : null}
                </Text>
              </View>
              {list.map((d) => (
                <View key={d.id} style={{ gap: 8, borderTopWidth: 1, borderTopColor: theme.line, paddingTop: 10 }}>
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    <Pressable onPress={() => setZoom(d)}>
                      <AuthImage url={d.fileUrl} style={{ width: 96, height: 68, borderRadius: 8 }} label={labelOf(d)} />
                    </Pressable>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13.5, color: theme.ink, fontFamily: TYPO.weights.semibold }}>{labelOf(d)}</Text>
                      <Text style={{ fontSize: 12, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 2 }}>
                        Reçu le {new Date(d.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                      </Text>
                    </View>
                  </View>
                  {rejecting === d.id ? (
                    <View style={{ gap: 8 }}>
                      <Field label="Motif du refus" value={reason} onChangeText={setReason} placeholder="Photo floue, document expiré…" />
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Button kind="ghost" size="sm" style={{ flex: 1 }} onPress={() => { setRejecting(null); setReason(''); }}>
                          Annuler
                        </Button>
                        <Button kind="danger" size="sm" style={{ flex: 1 }} loading={busy === d.id} onPress={() => decide(d, 'REJECTED')}>
                          Refuser
                        </Button>
                      </View>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Button kind="outline" size="sm" style={{ flex: 1 }} onPress={() => { setRejecting(d.id); setReason(''); }}>
                        Refuser…
                      </Button>
                      <Button kind="primary" size="sm" style={{ flex: 1 }} loading={busy === d.id} onPress={() => decide(d, 'APPROVED')}>
                        Valider
                      </Button>
                    </View>
                  )}
                </View>
              ))}
            </Surface>
          );
        })
      )}

      <Modal visible={!!zoom} transparent animationType="fade" onRequestClose={() => setZoom(null)}>
        <Pressable onPress={() => setZoom(null)} style={{ flex: 1, backgroundColor: 'rgba(6,24,46,0.92)', justifyContent: 'center', padding: 12 }}>
          {zoom ? (
            <>
              <AuthImage url={zoom.fileUrl} style={{ width: '100%', height: '80%' }} label={labelOf(zoom)} contain />
              <Text style={{ color: '#F5F1E8', textAlign: 'center', marginTop: 12, fontFamily: TYPO.weights.semibold }}>
                {labelOf(zoom)} · touche pour fermer
              </Text>
            </>
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}
