import React, { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radii, typography } from '../../theme';
import { Text } from './Text';

export interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  containerStyle?: ViewStyle;
}

export function TextField({
  label,
  error,
  helperText,
  containerStyle,
  onFocus,
  onBlur,
  style,
  ...rest
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const borderColor = error
    ? colors.primaryStrong
    : focused
      ? colors.primary
      : colors.border;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text variant="label" tone="secondary" style={styles.label}>
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          { borderColor, color: colors.text },
          style,
        ]}
      />
      {error ? (
        <Text variant="caption" tone="danger" style={styles.message}>
          {error}
        </Text>
      ) : helperText ? (
        <Text variant="caption" tone="muted" style={styles.message}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  label: { marginBottom: 4 },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: radii.control,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    ...typography.body,
  },
  message: { marginTop: 4 },
});

export default TextField;
