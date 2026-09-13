import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { PickupMode } from '../api/quotes';

// ───────────────────────── Catégories & types ─────────────────────────
// On garde l'enum côté UI cohérent avec `ParcelCategory` côté API.
export type ParcelKind = 'DOCUMENTS' | 'SMALL' | 'STANDARD' | 'BULKY' | 'PALLET';
export type CustomsCategory =
  | 'PERSONAL_EFFECTS'
  | 'COMMERCIAL_GOODS'
  | 'SAMPLES'
  | 'GIFT';

export interface ParcelDimensions {
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
}

// Petite "ville" minimaliste pour le brouillon (sérialisable)
export interface DraftCity {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  region: 'EU' | 'AFRICA';
}

export interface ParcelDraftState {
  // ─── Étape 1 — Depuis / Vers ────────────────────────────────
  from?: DraftCity;
  to?: DraftCity;
  transportMode?: 'AIR' | 'SEA';

  // ─── Étape 2 — Quel colis ───────────────────────────────────
  kind?: ParcelKind;
  weightKg?: number;
  dimensions?: ParcelDimensions;
  /** URI ou data-URL d'une photo optionnelle. */
  photoUri?: string;

  // ─── Étape 3 — Contenu ──────────────────────────────────────
  description?: string;
  customsCategory?: CustomsCategory;
  declaredValueEur?: number;
  fragile?: boolean;

  // ─── Étape 4 — Récupération ────────────────────────────────
  pickupMode?: PickupMode;
  relayPointId?: string;
  relayPointLabel?: string;
  pickupAddress?: string;
  pickupAt?: string;
  pickupNotes?: string;

  // ─── Étape 5 — Destinataire ─────────────────────────────────
  recipientFirstName?: string;
  recipientLastName?: string;
  recipientPhone?: string;
  recipientEmail?: string;
  destinationAddress?: string;
  deliverToAxisRelay?: boolean;

  // ─── Bookkeeping ────────────────────────────────────────────
  /** Pour passer le devis courant aux étapes suivantes. */
  quoteId?: string;
  /** Dernière étape atteinte par l'utilisateur (0..5). */
  step?: number;
  /** ISO date — pour savoir si un brouillon est "vieux". */
  savedAt?: string;
}

interface ParcelDraftContextValue {
  draft: ParcelDraftState;
  set: (updates: Partial<ParcelDraftState>) => void;
  /** Reset le draft. Snapshot conservé pour la confirmation/suivi. */
  reset: () => void;
  /** Persiste le brouillon courant en AsyncStorage (« Reprendre plus tard »). */
  saveForLater: () => Promise<void>;
  /** Indique si un brouillon a été restauré depuis le storage. */
  restored: boolean;
  /** Dernier draft "validé" (snapshot pris au moment du reset). */
  lastBooking: ParcelDraftState | null;
}

const ParcelDraftContext = createContext<ParcelDraftContextValue | null>(null);

const STORAGE_KEY = 'axis.parcelDraft.v2';

export function ParcelDraftProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<ParcelDraftState>({});
  const [lastBooking, setLastBooking] = useState<ParcelDraftState | null>(null);
  const [restored, setRestored] = useState(false);
  // Hydratation au démarrage : récupère un brouillon "Reprendre plus tard".
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw) as ParcelDraftState;
          // Ne restaure que si la date est < 7 jours
          if (parsed.savedAt) {
            const ageMs = Date.now() - new Date(parsed.savedAt).getTime();
            if (ageMs < 7 * 24 * 3600 * 1000) {
              setDraft(parsed);
              setRestored(true);
            }
          }
        } catch {
          /* corruption → on ignore */
        }
      })
      .catch(() => {});
  }, []);

  const set = useCallback((updates: Partial<ParcelDraftState>) => {
    setDraft((prev) => ({ ...prev, ...updates }));
  }, []);

  const reset = useCallback(() => {
    setDraft((prev) => {
      // On garde un snapshot pour l'écran de confirmation/suivi.
      setLastBooking(prev);
      return {};
    });
    setRestored(false);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  const saveForLater = useCallback(async () => {
    const payload: ParcelDraftState = { ...draft, savedAt: new Date().toISOString() };
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* offline → silencieux */
    }
  }, [draft]);

  return (
    <ParcelDraftContext.Provider value={{ draft, set, reset, saveForLater, restored, lastBooking }}>
      {children}
    </ParcelDraftContext.Provider>
  );
}

export function useParcelDraft(): ParcelDraftContextValue {
  const ctx = useContext(ParcelDraftContext);
  if (!ctx) throw new Error('useParcelDraft must be used within <ParcelDraftProvider>');
  return ctx;
}

// ─── Métadonnées UI partagées ──────────────────────────────────────────
export const PARCEL_KINDS: { value: ParcelKind; emoji: string; label: string; hint: string; maxKg?: number }[] = [
  { value: 'DOCUMENTS', emoji: '📄', label: 'Documents',     hint: 'Lettres, contrats — < 2 kg' },
  { value: 'SMALL',     emoji: '📦', label: 'Petit colis',   hint: 'Carton S — jusqu\'à 5 kg', maxKg: 5 },
  { value: 'STANDARD',  emoji: '📦', label: 'Standard',      hint: 'Carton M ou L — jusqu\'à 30 kg', maxKg: 30 },
  { value: 'BULKY',     emoji: '🧳', label: 'Volumineux',    hint: 'Valise, gros colis — > 30 kg' },
  { value: 'PALLET',    emoji: '🚛', label: 'Marchandise',   hint: 'Palette / fret — sur devis' },
];

export const PARCEL_PRESETS: { id: string; label: string; lengthCm: number; widthCm: number; heightCm: number; weightHint: string }[] = [
  { id: 'S', label: 'Carton S 30×20×15',  lengthCm: 30, widthCm: 20, heightCm: 15, weightHint: '~ 2 kg' },
  { id: 'M', label: 'Carton M 40×30×25',  lengthCm: 40, widthCm: 30, heightCm: 25, weightHint: '~ 5 kg' },
  { id: 'L', label: 'Carton L 60×40×40',  lengthCm: 60, widthCm: 40, heightCm: 40, weightHint: '~ 15 kg' },
];

export const CUSTOMS_CATEGORIES: { value: CustomsCategory; emoji: string; label: string; hint: string }[] = [
  { value: 'PERSONAL_EFFECTS', emoji: '🎁', label: 'Effets personnels', hint: 'Affaires non commerciales' },
  { value: 'COMMERCIAL_GOODS', emoji: '🏷️', label: 'Marchandise',       hint: 'Vente / revente' },
  { value: 'SAMPLES',          emoji: '🔬', label: 'Échantillons',      hint: 'Sans valeur commerciale' },
  { value: 'GIFT',             emoji: '🎀', label: 'Cadeau',            hint: 'Pour un proche' },
];

/** Convertit une `ParcelKind` UI vers la catégorie API (`ParcelCategory`). */
export function mapKindToApiCategory(
  kind: ParcelKind | undefined,
  customs: CustomsCategory | undefined,
): 'PERSONAL_EFFECTS' | 'COMMERCIAL_GOODS' | 'DOCUMENTS' | 'OTHER' {
  if (kind === 'DOCUMENTS') return 'DOCUMENTS';
  if (customs === 'COMMERCIAL_GOODS') return 'COMMERCIAL_GOODS';
  if (customs === 'PERSONAL_EFFECTS' || customs === 'GIFT' || customs === 'SAMPLES') return 'PERSONAL_EFFECTS';
  return 'OTHER';
}
