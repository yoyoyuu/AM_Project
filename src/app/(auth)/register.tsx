import { zodResolver } from '@hookform/resolvers/zod';
import { Checkbox } from 'expo-checkbox';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { signUp } from '../../features/auth/api';
import { messages } from '../../features/auth/messages';
import {
  registrationSchema,
  type RegistrationInput,
} from '../../features/auth/schemas';

export default function RegisterScreen() {
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegistrationInput>({
    defaultValues: {
      email: '',
      password: '',
      privacyAccepted: false,
    },
    resolver: zodResolver(registrationSchema),
  });

  const onSubmit = async (input: RegistrationInput) => {
    setSubmissionError(null);
    setSubmitted(false);

    const result = await signUp(input);
    if (result.error !== null) {
      setSubmissionError(result.error);
      return;
    }

    if (result.data?.session !== null && result.data?.session !== undefined) {
      router.replace('/');
      return;
    }

    setSubmitted(true);
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.container}>
        <Text style={styles.brand}>Koma</Text>
        <Text style={styles.title}>Crea tu cuenta</Text>
        <Text style={styles.subtitle}>
          Regístrate para gestionar tus comisiones de arte.
        </Text>

        <Text style={styles.label}>Correo electrónico</Text>
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="tu-correo@ejemplo.com"
              style={[styles.input, errors.email && styles.inputError]}
              textContentType="emailAddress"
              value={value}
            />
          )}
        />
        {errors.email && (
          <Text style={styles.error}>{errors.email.message}</Text>
        )}

        <Text style={styles.label}>Contraseña</Text>
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              autoCapitalize="none"
              autoComplete="new-password"
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="Mínimo 8 caracteres"
              secureTextEntry
              style={[styles.input, errors.password && styles.inputError]}
              textContentType="newPassword"
              value={value}
            />
          )}
        />
        {errors.password && (
          <Text style={styles.error}>{errors.password.message}</Text>
        )}

        <Controller
          control={control}
          name="privacyAccepted"
          render={({ field: { onChange, value } }) => (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: value }}
              onPress={() => onChange(!value)}
              style={styles.privacyRow}
            >
              <Checkbox
                color={value ? '#6C5CE7' : undefined}
                onValueChange={onChange}
                value={value}
              />
              <Text style={styles.privacyText}>
                Acepto el aviso de privacidad de Koma.
              </Text>
            </Pressable>
          )}
        />
        {errors.privacyAccepted && (
          <Text style={styles.error}>
            {errors.privacyAccepted.message ?? messages.privacyNotAccepted}
          </Text>
        )}

        {submissionError && (
          <Text accessibilityRole="alert" style={styles.error}>
            {submissionError}
          </Text>
        )}
        {submitted && (
          <Text accessibilityRole="status" style={styles.success}>
            Te enviamos un código a tu correo.
          </Text>
        )}

        <Pressable
          accessibilityRole="button"
          disabled={isSubmitting}
          onPress={() => void handleSubmit(onSubmit)()}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            isSubmitting && styles.buttonDisabled,
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Crear cuenta</Text>
          )}
        </Pressable>

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  brand: {
    color: '#6C5CE7',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 24,
  },
  title: {
    color: '#1F2937',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: '#6B7280',
    fontSize: 16,
    marginBottom: 28,
    marginTop: 8,
  },
  label: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderColor: '#D1D5DB',
    borderRadius: 10,
    borderWidth: 1,
    color: '#111827',
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  inputError: {
    borderColor: '#B91C1C',
  },
  privacyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 22,
  },
  privacyText: {
    color: '#374151',
    flex: 1,
    fontSize: 15,
    marginLeft: 10,
  },
  error: {
    color: '#B91C1C',
    fontSize: 14,
    marginTop: 6,
  },
  success: {
    color: '#166534',
    fontSize: 14,
    marginTop: 12,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#6C5CE7',
    borderRadius: 10,
    justifyContent: 'center',
    marginTop: 28,
    minHeight: 52,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
