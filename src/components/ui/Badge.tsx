import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radii, spacing, typography } from '../../theme';
import { Text } from './Text';

type Tone = 'success' | 'primary' | 'neutral';

export interface BadgeProps {
  tone?: Tone;
  label: string;
  icon?: string;
  style?: ViewStyle;
}

const toneStyles: Record<Tone, { bg: string; fg: string; defaultIcon: string }> = {
  success: { bg: colors.successSoft, fg: colors.successStrong, defaultIcon: '✓' },
  primary: { bg: colors.primarySoft, fg: colors.primaryStrong, defaultIcon: '!' },
  neutral: { bg: colors.neutralSoft, fg: colors.neutralText, defaultIcon: '•' },
};

export function Badge({ tone = 'neutral', label, icon, style }: BadgeProps) {
  const t = toneStyles[tone];
  return (
    <View style={[styles.container, { backgroundColor: t.bg }, style]}>
      <Text style={{ color: t.fg, ...typography.label, marginRight: 4 }}>{icon ?? t.defaultIcon}</Text>
      <Text style={{ color: t.fg, ...typography.label }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.badge,
  },
});

export default Badge;
