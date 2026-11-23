import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radii, typography } from '../../theme';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  title: string;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}

export function Button({
  title,
  variant = 'primary',
  loading = false,
  disabled = false,
  fullWidth,
  leftIcon,
  rightIcon,
  style,
  onPressIn,
  onPressOut,
  ...rest
}: ButtonProps) {
  const [pressed, setPressed] = useState(false);
  const isDisabled = disabled || loading;

  const containerStyle = getContainerStyle(variant, isDisabled, pressed);
  const labelColor = getLabelColor(variant, isDisabled);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      android_ripple={
        isDisabled
          ? undefined
          : { color: variant === 'primary' ? colors.primaryStrong : colors.primarySoft }
      }
      disabled={isDisabled}
      onPressIn={(e) => {
        setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        onPressOut?.(e);
      }}
      style={StyleSheet.flatten([styles.base, fullWidth && styles.fullWidth, containerStyle, style as any])}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={labelColor} />
      ) : (
        <View style={styles.content}>
          {leftIcon ? <View style={styles.iconLeft}>{leftIcon}</View> : null}
          <Text style={{ color: labelColor, ...typography.subtitle }}>{title}</Text>
          {rightIcon ? <View style={styles.iconRight}>{rightIcon}</View> : null}
        </View>
      )}
    </Pressable>
  );
}

function getContainerStyle(variant: Variant, disabled: boolean, pressed: boolean): ViewStyle {
  if (disabled) {
    return { backgroundColor: colors.disabledBg, borderWidth: 0 };
  }
  switch (variant) {
    case 'primary':
      return { backgroundColor: pressed ? colors.primaryStrong : colors.primary, borderWidth: 0 };
    case 'secondary':
      return {
        backgroundColor: pressed ? colors.primarySoft : colors.surface,
        borderWidth: 1,
        borderColor: colors.primary,
      };
    case 'ghost':
      return {
        backgroundColor: pressed ? colors.primarySoft : 'transparent',
        borderWidth: 0,
      };
  }
}

function getLabelColor(variant: Variant, disabled: boolean): string {
  if (disabled) return colors.textMuted;
  if (variant === 'primary') return '#FFFFFF';
  return colors.primaryStrong;
}

const styles = StyleSheet.create({
  base: {
    height: 48,
    borderRadius: radii.control,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  iconLeft: { marginRight: 8 },
  iconRight: { marginLeft: 8 },
});

export default Button;
