import React from 'react';
import { Text as RNText, TextProps, TextStyle, StyleSheet } from 'react-native';
import { colors, typography } from '../../theme';

type Variant = 'titleXL' | 'title' | 'subtitle' | 'body' | 'label' | 'caption';
type Tone = 'default' | 'secondary' | 'muted' | 'neutral' | 'primary' | 'danger' | 'success' | 'inverse';

export interface AppTextProps extends TextProps {
  variant?: Variant;
  tone?: Tone;
  style?: TextStyle | TextStyle[];
}

const toneColors: Record<Tone, string> = {
  default: colors.text,
  secondary: colors.textSecondary,
  muted: colors.textMuted,
  neutral: colors.neutralText,
  primary: colors.primaryStrong,
  danger: colors.danger,
  success: colors.successStrong,
  inverse: '#FFFFFF',
};

export function Text({ variant = 'body', tone = 'default', style, ...rest }: AppTextProps) {
  const base = typography[variant];
  return (
    <RNText
      {...rest}
      style={StyleSheet.flatten([{ color: toneColors[tone], ...base }, style as any])}
    />
  );
}

export default Text;
