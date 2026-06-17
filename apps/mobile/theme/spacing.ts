export const spacing = {
  '0': 0,
  px: 1,
  '0.5': 2,
  '1': 4,
  '1.5': 6,
  '2': 8,
  '2.5': 10,
  '3': 12,
  '4': 16,
  '5': 20,
  '6': 24,
  '7': 28,
  '8': 32,
  '10': 40,
  '12': 48,
  '14': 56,
  '16': 64,

  // Semantic aliases
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 48,

  // Layout
  pagePaddingH: 16,   // horizontal page margin
  pagePaddingV: 20,   // vertical page margin
  rowGap: 8,          // gap between VideoCards in a row
  sectionGap: 28,     // gap between rows/sections
  tabBarHeight: 56,   // bottom tab bar height
} as const;

export const radii = {
  none: 0,
  sm: 5,
  md: 9,     // buttons
  lg: 11,    // cards
  xl: 14,
  '2xl': 18,
  full: 9999,

  // Semantic
  button: 9,
  card: 11,
  chip: 7,
  badge: 5,
  menu: 12,
  avatar: 9999,
  modal: 16,
} as const;

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
} as const;
