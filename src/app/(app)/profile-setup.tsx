import { zodResolver } from '@hookform/resolvers/zod';
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
import { z } from 'zod';

import { useProfile } from '../../features/auth/useProfile';
import { messages } from '../../features/auth/messages';
import { displayNameSchema } from '../../features/auth/schemas';

const profileSetupSchema = z.object({
  displayName: displayNameSchema,
});

type ProfileSetupInput = z.infer<typeof profileSetupSchema>;

export default function ProfileSetupScreen() {
  const { profile, updateProfile } = useProfile();
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileSetupInput>({
    defaultValues: {
      displayName: profile?.display_name ?? '',
    },
    resolver: zodResolver(profileSetupSchema),
  });

  const onSubmit = async ({ displayName }: ProfileSetupInput) => {
    setSubmissionError(null);

    try {
      await updateProfile({ displayName });
      router.replace('/');
    } catch (error) {
      setSubmissionError(
        error instanceof Error ? error.message : messages.invalidField,
      );
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.container}>
        <Text style={styles.brand}>Koma</Text>
        <Text style={styles.title}>Completa tu perfil</Text>
        <Text style={styles.subtitle}>
          Define el nombre que verán otros usuarios.
        </Text>

        <Text style={styles.label}>Nombre visible</Text>
        <Controller
          control={control}
          name="displayName"
          render={({ field: { onBlur, onChange, value } }) => (
            <TextInput
              autoCapitalize="words"
              autoComplete="name"
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="Tu nombre"
              style={[styles.input, errors.displayName && styles.inputError]}
              textContentType="name"
              value={value}
            />
          )}
        />
        {errors.displayName && (
          <Text style={styles.error}>
            {errors.displayName.message ?? messages.invalidDisplayName}
          </Text>
        )}
        {submissionError && (
          <Text accessibilityRole="alert" style={styles.error}>
            {submissionError}
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
            <Text style={styles.buttonText}>Guardar nombre</Text>
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
  error: {
    color: '#B91C1C',
    fontSize: 14,
    marginTop: 6,
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
