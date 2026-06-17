export const colors = {
  // Backgrounds
  bg: '#06090c',
  surface: '#0e151a',
  surface2: 'rgba(255,255,255,0.05)',
  surfaceHover: 'rgba(255,255,255,0.08)',

  // Brand
  brand: '#68140b',
  brandBright: '#cf4a35',
  brandDim: 'rgba(207,74,53,0.15)',

  // Accent
  gold: '#e3bd72',
  goldFill: 'rgba(216,166,74,0.95)',

  // Text
  textPrimary: '#eef3f0',
  textSecondary: '#cdd6d2',
  textMuted: '#85958e',
  textFaint: '#7d8d86',
  textInverse: '#06090c',

  // Borders
  border: 'rgba(255,255,255,0.07)',
  borderMedium: 'rgba(255,255,255,0.15)',
  borderStrong: 'rgba(255,255,255,0.25)',

  // Semantic
  error: '#E53E3E',
  errorDim: 'rgba(229,62,62,0.15)',
  success: '#38A169',
  successDim: 'rgba(56,161,105,0.15)',
  warning: '#D69E2E',
  info: '#3182CE',

  // Pure
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',

  // Scrim overlays (for gradients)
  scrimFull: 'rgba(6,9,12,1)',
  scrimHalf: 'rgba(6,9,12,0.5)',
  scrimNone: 'rgba(6,9,12,0)',
} as const;

export type Color = keyof typeof colors;
