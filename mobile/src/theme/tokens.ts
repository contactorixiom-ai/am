// Portage des tokens design depuis /design/tokens.jsx vers React Native.
// Garde EXACTEMENT les mêmes valeurs hex.

export const AXIS_LIGHT = {
  name: 'light' as const,
  bg:        '#F5F1E8',
  bgSoft:    '#EDE7D6',
  surface:   '#FFFFFF',
  surface2:  '#FAF7EE',
  ink:       '#0B1A2F',
  inkSoft:   '#324358',
  muted:     '#6E7891',
  faint:     '#9CA3B3',
  line:      '#E4DCC6',
  lineSoft:  '#EEE6D0',
  navy:      '#0B2545',
  navyDeep:  '#06182E',
  gold:      '#C9A55C',
  goldHi:    '#F2D789',
  goldDeep:  '#8E6A22',
  good:      '#1F8A5B',
  warn:      '#B7791F',
  bad:       '#B23A48',
  select:    '#0B2545',
  selectInk: '#F5F1E8',
};

export const AXIS_DARK = {
  name: 'dark' as const,
  bg:        '#06182E',
  bgSoft:    '#0A2241',
  surface:   '#0F2B4D',
  surface2:  '#13345C',
  ink:       '#F1ECDC',
  inkSoft:   '#C7CFDE',
  muted:     '#9CA3B3',
  faint:     '#6E7891',
  line:      '#1B3D67',
  lineSoft:  '#163358',
  navy:      '#0B2545',
  navyDeep:  '#06182E',
  gold:      '#D4B262',
  goldHi:    '#F2D789',
  goldDeep:  '#8E6A22',
  good:      '#34D399',
  warn:      '#F59E0B',
  bad:       '#F87171',
  select:    '#D4B262',
  selectInk: '#06182E',
};

// Le type relâche `name` en string union pour accepter light ET dark.
export type AxisTheme = Omit<typeof AXIS_LIGHT, 'name'> & { name: 'light' | 'dark' };

export const RADII = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  xxl: 16,
  pill: 999,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const TYPO = {
  fontFamily: 'Manrope_400Regular',
  weights: {
    regular: 'Manrope_400Regular',
    medium:  'Manrope_500Medium',
    semibold:'Manrope_600SemiBold',
    bold:    'Manrope_700Bold',
  },
  sizes: {
    displayHero: 46,
    displayM:    28,
    displayS:    22,
    title:      15,
    body:       14,
    bodySm:     13,
    label:      11,
    caption:    10.5,
  },
} as const;

export const SHADOWS = {
  card: {
    shadowColor: '#0B2545',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 3,
  },
  large: {
    shadowColor: '#0B2545',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 28,
    elevation: 6,
  },
};

// Safe-area du design d'origine (iOS 26)
export const SAFE_AREA_TOP = 62;
export const SAFE_AREA_BOTTOM = 28;
