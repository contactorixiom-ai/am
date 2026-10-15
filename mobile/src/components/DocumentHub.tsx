import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Button } from './Button';
import { Icons } from './Icons';
import { Pill, PillTone } from './Pill';
import { Surface } from './Surface';
import { useTheme } from '../theme/ThemeProvider';
import { TYPO } from '../theme/tokens';
import {
  CatalogDoc,
  DocCategory,
  DocSource,
  SOURCE_LABEL,
  groupByCategory,
} from '../utils/documentCatalog';

// État local d'un document, persisté par (countryCode + kind + docKey).
export type DocState = 'pending' | 'ready';

export interface DocStatusEntry {
  state: DocState;
  /** Aperçu (signature ou fichier téléversé). */
  uri?: string;
  /** Date d'action formatée FR. */
  at?: string;
}

interface Props {
  docs: CatalogDoc[];
  status: Record<string, DocStatusEntry>;
  /** Clé de statut pour un doc (countryCode:kind:docKey géré par le parent). */
  statusKey: (doc: CatalogDoc) => string;
  onGenerate: (doc: CatalogDoc) => void;
  onUpload: (doc: CatalogDoc) => void;
  onSign: (doc: CatalogDoc) => void;
  busyKey?: string | null;
}

// Catégorie → icône du design system.
const CAT_ICON: Record<DocCategory, keyof typeof Icons> = {
  commercial: 'euro',
  transport: 'truck',
  origin: 'flag',
  customs: 'globe',
  tracking: 'box',
  insurance: 'shield',
  compliance: 'check',
  vehicle: 'car',
  contract: 'sig',
};

// Action contextuelle par source.
const SOURCE_ACTION: Record<DocSource, { label: string; icon: keyof typeof Icons }> = {
  generated: { label: 'Générer', icon: 'doc' },
  uploaded: { label: 'Téléverser', icon: 'plus' },
  signed: { label: 'Signer', icon: 'sig' },
};

// Centre documentaire : liste des documents requis groupés par catégorie,
// avec filtres en chips et action contextuelle par document.
export function DocumentHub({
  docs, status, statusKey, onGenerate, onUpload, onSign, busyKey,
}: Props) {
  const { theme } = useTheme();
  const [filter, setFilter] = useState<DocCategory | 'all'>('all');

  const groups = useMemo(() => groupByCategory(docs), [docs]);

  // Chips de filtre : « Tous » + catégories présentes (avec compteur).
  const chips = useMemo(
    () => [
      { id: 'all' as const, label: 'Tous', count: docs.length },
      ...groups.map((g) => ({ id: g.category, label: shortLabel(g.category), count: g.docs.length })),
    ],
    [groups, docs.length],
  );

  const visibleGroups = filter === 'all' ? groups : groups.filter((g) => g.category === filter);

  return (
    <View style={{ gap: 14 }}>
      {/* Filtres par catégorie */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
      >
        {chips.map((c) => {
          const on = filter === c.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => setFilter(c.id)}
              style={{
                flexShrink: 0, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999,
                borderWidth: 1, borderColor: on ? theme.select : theme.line,
                backgroundColor: on ? theme.select : theme.surface,
                flexDirection: 'row', alignItems: 'center', gap: 6,
              }}
            >
              <Text style={{ fontSize: 13, color: on ? theme.selectInk : theme.ink, fontFamily: TYPO.weights.medium }}>{c.label}</Text>
              <Text style={{ fontSize: 11, color: on ? theme.selectInk : theme.muted, opacity: 0.8, fontFamily: TYPO.weights.semibold }}>{c.count}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Groupes */}
      {visibleGroups.map((group) => (
        <View key={group.category} style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <Icons.chev size={14} color={theme.muted} stroke={2.4} />
            <Text style={{ fontSize: 11.5, color: theme.muted, letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }}>
              {group.label}
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: theme.line }} />
          </View>

          {group.docs.map((doc) => (
            <DocRow
              key={doc.key}
              doc={doc}
              entry={status[statusKey(doc)]}
              busy={busyKey === statusKey(doc)}
              onGenerate={() => onGenerate(doc)}
              onUpload={() => onUpload(doc)}
              onSign={() => onSign(doc)}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function DocRow({
  doc, entry, busy, onGenerate, onUpload, onSign,
}: {
  doc: CatalogDoc;
  entry?: DocStatusEntry;
  busy?: boolean;
  onGenerate: () => void;
  onUpload: () => void;
  onSign: () => void;
}) {
  const { theme } = useTheme();
  const ready = entry?.state === 'ready';
  const CatIcon = Icons[CAT_ICON[doc.category]];
  const action = SOURCE_ACTION[doc.source];
  const ActionIcon = Icons[action.icon];

  // Badge de statut.
  const tone: PillTone = ready ? 'good' : doc.source === 'generated' ? 'navy' : doc.source === 'signed' ? 'warn' : 'ghost';
  const badge = ready
    ? doc.source === 'signed' ? 'Signé' : doc.source === 'uploaded' ? 'Fourni' : 'Généré'
    : SOURCE_LABEL[doc.source];

  // Action selon la source (régénérer / re-signer / remplacer si déjà prêt).
  const onAction = busy
    ? () => {}
    : doc.source === 'generated'
      ? onGenerate
      : doc.source === 'signed'
        ? onSign
        : onUpload;

  const actionLabel = busy
    ? '…'
    : ready
      ? doc.source === 'uploaded' ? 'Remplacer' : 'Revoir'
      : action.label;

  return (
    <Surface padded style={{ padding: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: theme.bgSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {entry?.uri ? (
            <Image source={{ uri: entry.uri }} style={{ width: 44, height: 44 }} resizeMode="cover" />
          ) : (
            <CatIcon size={20} color={theme.navy} stroke={1.6} />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Pill tone={tone}>{badge}</Pill>
            {doc.mandatory ? null : <Pill tone="ghost">Optionnel</Pill>}
          </View>
          <Text style={{ fontSize: 14, color: theme.ink, marginTop: 6, fontFamily: TYPO.weights.semibold }}>{doc.label}</Text>
          {doc.issuer ? (
            <Text style={{ fontSize: 11.5, color: theme.muted, marginTop: 2, fontFamily: TYPO.weights.medium }} numberOfLines={1}>
              {doc.issuer}
            </Text>
          ) : null}
          <Text style={{ fontSize: 11.5, color: theme.inkSoft, marginTop: 4, lineHeight: 16, fontFamily: TYPO.weights.regular }}>
            {doc.description}
          </Text>
          {entry?.at ? (
            <Text style={{ fontSize: 11, color: theme.good, marginTop: 6, fontFamily: TYPO.weights.semibold }}>
              {ready ? `✓ ${doc.source === 'signed' ? 'Signé' : doc.source === 'uploaded' ? 'Reçu' : 'Généré'} le ${entry.at}` : ''}
            </Text>
          ) : null}

          <View style={{ marginTop: 10, flexDirection: 'row' }}>
            <Button
              kind={ready ? 'outline' : doc.source === 'generated' ? 'primary' : 'gold'}
              size="sm"
              loading={busy}
              onPress={onAction}
              rightIcon={busy ? undefined : <ActionIcon size={15} color={ready ? theme.ink : doc.source === 'generated' ? '#FFFFFF' : theme.navy} stroke={1.8} />}
            >
              {actionLabel}
            </Button>
          </View>
        </View>
      </View>
    </Surface>
  );
}

// Libellés courts pour les chips (les libellés longs sont dans CATEGORY_LABEL).
function shortLabel(cat: DocCategory): string {
  switch (cat) {
    case 'commercial': return 'Commercial';
    case 'transport': return 'Transport';
    case 'origin': return 'Origine';
    case 'customs': return 'Douane';
    case 'tracking': return 'Bordereau';
    case 'insurance': return 'Assurance';
    case 'compliance': return 'Conformité';
    case 'vehicle': return 'Véhicule';
    case 'contract': return 'Contrat';
  }
}
