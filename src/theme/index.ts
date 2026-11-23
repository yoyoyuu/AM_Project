export const colors = {
  primary: '#E87A90',
  primaryStrong: '#B84F67',
  primarySoft: '#FFF0F3',
  danger: '#A84450',
  success: '#6C9E7E',
  successStrong: '#47745A',
  successSoft: '#E8F5ED',
  text: '#2C3E50',
  textSecondary: '#58697A',
  textMuted: '#82909C',
  neutralText: '#52647F',
  neutralSoft: '#E8EBF0',
  border: '#E3E7E9',
  borderStrong: '#C3CCD1',
  disabledBg: '#E6E6E6',
  background: '#F6F8F7',
  surface: '#FFFFFF',
  surfaceMuted: '#FAFAFA',
  surfaceSunken: '#F4F6F5',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  screen: 20,
} as const;

export const radii = {
  badge: 8,
  control: 12,
  card: 12,
  modal: 20,
} as const;

export const shadows = {
  soft: {
    shadowColor: '#2C3E50',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
} as const;

export const typography = {
  titleXL: { fontSize: 24, lineHeight: 32, fontWeight: '600' as const },
  title: { fontSize: 20, lineHeight: 28, fontWeight: '600' as const },
  subtitle: { fontSize: 16, lineHeight: 22, fontWeight: '600' as const },
  body: { fontSize: 15, lineHeight: 24, fontWeight: '400' as const },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' as const },
} as const;

export const theme = { colors, spacing, radii, shadows, typography };
export type Theme = typeof theme;
export default theme;
