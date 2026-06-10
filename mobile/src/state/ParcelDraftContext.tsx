import React, { createContext, useContext, useState } from 'react';
import { PickupMode } from '../api/quotes';

export interface ParcelDraftState {
  // Adresses et logistique
  pickupMode?: PickupMode;
  relayPointId?: string;
  relayPointLabel?: string;
  pickupAddress?: string;
  pickupAt?: string;
  // Pour passer le devis courant aux étapes suivantes
  quoteId?: string;
}

interface ParcelDraftContextValue {
  draft: ParcelDraftState;
  set: (updates: Partial<ParcelDraftState>) => void;
  reset: () => void;
}

const ParcelDraftContext = createContext<ParcelDraftContextValue | null>(null);

export function ParcelDraftProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<ParcelDraftState>({});
  return (
    <ParcelDraftContext.Provider
      value={{
        draft,
        set: (updates) => setDraft((prev) => ({ ...prev, ...updates })),
        reset: () => setDraft({}),
      }}
    >
      {children}
    </ParcelDraftContext.Provider>
  );
}

export function useParcelDraft(): ParcelDraftContextValue {
  const ctx = useContext(ParcelDraftContext);
  if (!ctx) throw new Error('useParcelDraft must be used within <ParcelDraftProvider>');
  return ctx;
}
