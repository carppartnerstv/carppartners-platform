import { Platform } from 'react-native';

// Font family names after loading via expo-font
export const fonts = {
  sora: {
    regular: 'Sora_400Regular',
    medium: 'Sora_500Medium',
    semiBold: 'Sora_600SemiBold',
    bold: 'Sora_700Bold',
    extraBold: 'Sora_800ExtraBold',
  },
  inter: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semiBold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
  // System fallbacks until custom fonts load
  system: Platform.select({ ios: 'System', android: 'Roboto', default: 'sans-serif' }),
} as const;

export const textStyles = {
  // Headings — Sora
  heroTitle: { fontFamily: fonts.sora.extraBold, fontSize: 32, lineHeight: 38, letterSpacing: -0.5 },
  detailTitle: { fontFamily: fonts.sora.bold, fontSize: 26, lineHeight: 32, letterSpacing: -0.3 },
  pageTitle: { fontFamily: fonts.sora.bold, fontSize: 22, lineHeight: 28 },
  sectionTitle: { fontFamily: fonts.sora.semiBold, fontSize: 17, lineHeight: 22 },
  cardTitle: { fontFamily: fonts.sora.semiBold, fontSize: 14, lineHeight: 19 },

  // Body — Inter
  bodyLg: { fontFamily: fonts.inter.regular, fontSize: 16, lineHeight: 24 },
  body: { fontFamily: fonts.inter.regular, fontSize: 14, lineHeight: 21 },
  bodySm: { fontFamily: fonts.inter.regular, fontSize: 13, lineHeight: 19 },
  bodyXs: { fontFamily: fonts.inter.regular, fontSize: 12, lineHeight: 17 },

  // Labels
  labelLg: { fontFamily: fonts.inter.semiBold, fontSize: 15, lineHeight: 20 },
  label: { fontFamily: fonts.inter.semiBold, fontSize: 13, lineHeight: 18 },
  labelSm: { fontFamily: fonts.inter.medium, fontSize: 12, lineHeight: 16 },
  kicker: { fontFamily: fonts.inter.semiBold, fontSize: 11, lineHeight: 14, letterSpacing: 0.8 },

  // Navigation
  tabLabel: { fontFamily: fonts.inter.medium, fontSize: 11, lineHeight: 14 },
  navItem: { fontFamily: fonts.inter.medium, fontSize: 13, lineHeight: 18 },

  // Buttons
  buttonLg: { fontFamily: fonts.inter.semiBold, fontSize: 16, lineHeight: 20, letterSpacing: 0.1 },
  button: { fontFamily: fonts.inter.semiBold, fontSize: 14, lineHeight: 18, letterSpacing: 0.1 },
  buttonSm: { fontFamily: fonts.inter.semiBold, fontSize: 13, lineHeight: 17 },
} as const;

export type TextStyle = keyof typeof textStyles;
