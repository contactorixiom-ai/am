// Mise en page selon la taille de l'écran. Téléphone : inchangé. Tablette et
// ordinateur : contenu centré, grilles à plusieurs colonnes, fenêtres de
// dialogue au centre plutôt que feuilles pleine largeur.
import { Platform, useWindowDimensions } from 'react-native';

/** Largeur du contenu sur ordinateur. */
export const APP_MAX_WIDTH = 1280;
/** Largeur des fenêtres (paiement, affectation, fiches…) sur ordinateur. */
export const SHEET_MAX_WIDTH = 600;
/** Au-delà : mise en page « large ». */
export const WIDE_BREAKPOINT = 760;

export function useLayout() {
  const { width } = useWindowDimensions();
  const wide = Platform.OS === 'web' && width >= WIDE_BREAKPOINT;
  return {
    width,
    wide,
    /** Marge latérale des écrans. */
    gutter: wide ? 32 : 16,
  };
}

/**
 * À ajouter au voile des fenêtres qui montent du bas : sur ordinateur, la
 * fenêtre est centrée et garde une largeur raisonnable.
 */
export const SHEET_GUTTER: Record<string, unknown> =
  typeof document !== 'undefined'
    ? { paddingHorizontal: `max(0px, calc((100% - ${SHEET_MAX_WIDTH}px) / 2))` }
    : {};
