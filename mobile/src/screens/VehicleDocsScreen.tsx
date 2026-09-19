import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { AppBar } from '../components/AppBar';
import { Icons } from '../components/Icons';
import { Pill, PillTone } from '../components/Pill';
import { Surface } from '../components/Surface';
import { notify } from '../utils/notify';
import { useTheme } from '../theme/ThemeProvider';
import { RADII, TYPO } from '../theme/tokens';

interface DocItem {
  key: string;
  title: string;
  hint: string;
  expiry?: string; // YYYY-MM-DD
  uri?: string;
  uploadedAt?: string;
  ocr?: Record<string, string>; // champs extraits "OCR"
}

const DEFAULTS: DocItem[] = [
  { key: 'cg',  title: 'Carte grise', hint: 'Certificat d\'immatriculation' },
  { key: 'ct',  title: 'Contrôle technique', hint: 'Moins de 2 ans (4 ans véhicule neuf)' },
  { key: 'ass', title: 'Assurance véhicule', hint: 'Attestation en cours de validité' },
  { key: 'kbis',title: 'Kbis / Justificatif pro', hint: 'Pour les pros · moins de 3 mois' },
];

const STORAGE_KEY = 'axis.vehicleDocs.v1';

export function VehicleDocsScreen() {
  const { theme } = useTheme();
  const [docs, setDocs] = useState<DocItem[]>(DEFAULTS);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) try { setDocs(JSON.parse(raw)); } catch { /* ignore */ }
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(docs)).catch(() => {});
  }, [docs]);

  const pickFile = (key: string) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      simulateUpload(key);
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        applyUpload(key, dataUrl);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const simulateUpload = (key: string) => applyUpload(key);

  const applyUpload = (key: string, uri?: string) => {
    // OCR fictif : on remplit des champs selon la nature du doc.
    const mockOcr = mockOcrFor(key);
    const expiry = mockExpiryFor(key);
    setDocs((prev) => prev.map((d) => d.key === key
      ? { ...d, uri, uploadedAt: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }), ocr: mockOcr, expiry }
      : d));
    notify('Document analysé', `OCR effectué. ${mockOcr ? Object.keys(mockOcr).length : 0} champs extraits automatiquement.`);
  };

  const remove = (key: string) => {
    setDocs((prev) => prev.map((d) => d.key === key ? { key: d.key, title: d.title, hint: d.hint } : d));
  };

  const summary = useMemo(() => {
    const required = docs.filter((d) => d.key !== 'kbis');
    const uploaded = required.filter((d) => !!d.uri || !!d.uploadedAt).length;
    return { uploaded, total: required.length };
  }, [docs]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppBar title="Documents véhicule" subtitle="Carte grise, CT, assurance" />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 14 }}>
        {/* Hero */}
        <Surface padded flat style={{ padding: 16, backgroundColor: theme.navy, borderColor: theme.navy }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(245,241,232,0.12)', alignItems: 'center', justifyContent: 'center' }}>
              <Icons.doc size={22} color={theme.goldHi} stroke={1.8} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: theme.goldHi, letterSpacing: 1, textTransform: 'uppercase', fontFamily: TYPO.weights.semibold }}>
                Pièces du véhicule
              </Text>
              <Text style={{ fontSize: 18, color: '#F5F1E8', fontFamily: TYPO.weights.bold, marginTop: 2 }}>
                {summary.uploaded}/{summary.total} pièces fournies
              </Text>
            </View>
          </View>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(245,241,232,0.15)', marginTop: 14 }}>
            <View style={{ width: `${(summary.uploaded / summary.total) * 100}%`, height: '100%', backgroundColor: theme.gold, borderRadius: 2 }} />
          </View>
          <Text style={{ fontSize: 11.5, color: 'rgba(245,241,232,0.62)', marginTop: 8, fontFamily: TYPO.weights.medium }}>
            OCR automatique : on extrait les infos (n° immatriculation, date d'expiration) pour t'éviter de tout retaper.
          </Text>
        </Surface>

        {docs.map((d) => (
          <DocCard key={d.key} doc={d} onPick={() => pickFile(d.key)} onRemove={() => remove(d.key)} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function DocCard({ doc, onPick, onRemove }: { doc: DocItem; onPick: () => void; onRemove: () => void }) {
  const { theme } = useTheme();
  const status = computeStatus(doc);
  const hasFile = !!doc.uri || !!doc.uploadedAt;

  return (
    <Surface padded style={{ padding: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable onPress={onPick} style={{ width: 60, height: 76, borderRadius: 10, backgroundColor: theme.bgSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {doc.uri ? (
            <Image source={{ uri: doc.uri }} style={{ width: 60, height: 76 }} resizeMode="cover" />
          ) : (
            <Icons.camera size={20} color={theme.muted} stroke={1.6} />
          )}
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 14, color: theme.ink, fontFamily: TYPO.weights.semibold }}>{doc.title}</Text>
            <Pill tone={status.tone}>{status.label}</Pill>
          </View>
          <Text style={{ fontSize: 11.5, color: theme.muted, fontFamily: TYPO.weights.medium, marginTop: 2 }}>
            {doc.uploadedAt ? `Reçu le ${doc.uploadedAt}` : doc.hint}
          </Text>
          {doc.ocr ? (
            <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.lineSoft, gap: 3 }}>
              {Object.entries(doc.ocr).slice(0, 3).map(([k, v]) => (
                <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 11, color: theme.muted, fontFamily: TYPO.weights.medium }}>{k}</Text>
                  <Text style={{ fontSize: 11, color: theme.ink, fontFamily: TYPO.weights.semibold, fontVariant: ['tabular-nums'] }}>{v}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
        {hasFile ? (
          <Pressable onPress={onRemove} style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: theme.line, backgroundColor: pressed ? theme.bgSoft : theme.surface, alignItems: 'center', justifyContent: 'center' })}>
            <Icons.x size={14} color={theme.muted} stroke={2} />
          </Pressable>
        ) : null}
      </View>
    </Surface>
  );
}

function computeStatus(d: DocItem): { tone: PillTone; label: string } {
  if (!d.uri && !d.uploadedAt) return { tone: 'ghost', label: d.key === 'kbis' ? 'Optionnel' : 'Requis' };
  if (!d.expiry) return { tone: 'navy', label: 'Fourni' };
  const days = daysUntil(d.expiry);
  if (days < 0) return { tone: 'bad', label: 'Expiré' };
  if (days < 60) return { tone: 'warn', label: `Expire dans ${days} j` };
  return { tone: 'good', label: 'Valide' };
}

function daysUntil(yyyymmdd: string): number {
  const t = new Date(yyyymmdd).getTime();
  const now = new Date().getTime();
  return Math.floor((t - now) / (1000 * 60 * 60 * 24));
}

function mockOcrFor(key: string): Record<string, string> | undefined {
  switch (key) {
    case 'cg': return {
      'N° immatriculation': 'AX-2847-AI',
      'Marque · Modèle': 'BMW · Série 3 320d',
      'Date 1re mise en circulation': '12/03/2022',
      'Titulaire': 'Léa Martin',
    };
    case 'ct': return {
      'Centre': 'Auto Sécurité Paris 15',
      'Date du contrôle': '02/04/2025',
      'Prochain contrôle': '02/04/2027',
      'Résultat': 'Favorable',
    };
    case 'ass': return {
      'Assureur': 'AXA Assurances',
      'N° contrat': 'AX-PRO-2026-4189',
      'Couverture': 'Tous risques',
      'Valide jusqu\'au': '31/12/2026',
    };
    default: return undefined;
  }
}

function mockExpiryFor(key: string): string | undefined {
  const now = new Date();
  switch (key) {
    case 'ct': {
      // expire dans 45 jours → carte "Expire dans 45 j" warn
      const d = new Date(now.getTime() + 45 * 86400000);
      return d.toISOString().slice(0, 10);
    }
    case 'ass': {
      // expire dans 250 jours → valide
      const d = new Date(now.getTime() + 250 * 86400000);
      return d.toISOString().slice(0, 10);
    }
    default: return undefined;
  }
}
