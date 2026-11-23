import { useEffect, useState } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { catalogoErrors } from '../../../features/catalogo/errors';
import { useTosForm } from '../../../features/catalogo/hooks/useTosForm';
import {
  useMyTos,
  useUpsertTos,
} from '../../../features/catalogo/queries';
import type { TosFormValues } from '../../../features/catalogo/schemas';
import { colors } from '../../../theme';

export default function TosScreen() {
  const tosQuery = useMyTos();
  const upsertTos = useUpsertTos();
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useTosForm();
  const content = useWatch({ control, name: 'content' }) ?? '';

  useEffect(() => {
    if (tosQuery.data !== undefined) {
      reset({ content: tosQuery.data?.content ?? '' });
    }
  }, [reset, tosQuery.data]);

  const onSubmit = async ({ content: nextContent }: TosFormValues) => {
    setSubmissionError(null);
    setSavedMessage(null);

    try {
      await upsertTos.mutateAsync(nextContent);
      setSavedMessage('Términos de servicio guardados');
    } catch (error) {
      setSubmissionError(catalogoErrors.handle(error));
    }
  };

  if (tosQuery.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (tosQuery.isError) {
    return (
      <View style={styles.centered}>
        <Text accessibilityRole="alert" style={styles.error}>
          {catalogoErrors.handle(tosQuery.error)}
        </Text>
      </View>
    );
  }

  const isSaving = isSubmitting || upsertTos.isPending;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.container}>
        <Text style={styles.brand}>Koma</Text>
        <Text style={styles.title}>Mis términos de servicio</Text>
        <Text style={styles.subtitle}>
          Escribe las condiciones que tus clientes deben conocer antes de
          solicitar una comisión.
        </Text>

        <Controller
          control={control}
          name="content"
          render={({ field: { onBlur, onChange, value } }) => (
            <TextInput
              multiline
              maxLength={5000}
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="Escribe aquí tus términos de servicio"
              style={[styles.input, errors.content && styles.inputError]}
              textAlignVertical="top"
              value={value}
            />
          )}
        />
        <Text
          style={[
            styles.counter,
            content.length === 5000 && styles.counterLimit,
          ]}
        >
          {content.length} / 5000
        </Text>
        {errors.content && (
          <Text style={styles.error}>{errors.content.message}</Text>
        )}

        {submissionError && (
          <Text accessibilityRole="alert" style={styles.error}>
            {submissionError}
          </Text>
        )}
        {savedMessage && (
          <Text accessibilityRole="status" style={styles.success}>
            {savedMessage}
          </Text>
        )}

        <Pressable
          accessibilityRole="button"
          disabled={isSaving}
          onPress={() => void handleSubmit(onSubmit)()}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            isSaving && styles.buttonDisabled,
          ]}
        >
          {isSaving ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.buttonText}>Guardar términos</Text>
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
    padding: 24,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  brand: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 20,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 23,
    marginBottom: 20,
    marginTop: 8,
  },
  input: {
    borderColor: colors.borderStrong,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 260,
    padding: 14,
  },
  inputError: {
    borderColor: colors.danger,
  },
  counter: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 6,
    textAlign: 'right',
  },
  counterLimit: {
    color: colors.danger,
    fontWeight: '600',
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
    textAlign: 'center',
  },
  success: {
    color: colors.successStrong,
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    justifyContent: 'center',
    marginTop: 28,
    minHeight: 52,
    paddingHorizontal: 16,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    backgroundColor: colors.textMuted,
  },
  buttonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '700',
  },
});
