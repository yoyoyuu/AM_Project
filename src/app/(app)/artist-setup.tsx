import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
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

import { getAuthErrorMessage } from '../../features/auth/errors';
import { messages } from '../../features/auth/messages';
import { handleSchema } from '../../features/auth/schemas';
import { useProfile } from '../../features/auth/useProfile';
import { supabase } from '../../lib/supabase';

const artistSetupSchema = z.object({
  handle: handleSchema,
});

type ArtistSetupInput = z.infer<typeof artistSetupSchema>;
type Availability = 'idle' | 'checking' | 'available' | 'unavailable' | 'error';

export default function ArtistSetupScreen() {
  const { activateArtist, isUpdating, profile } = useProfile();
  const [availability, setAvailability] = useState<Availability>('idle');
  const [checkedHandle, setCheckedHandle] = useState<string | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(
    null,
  );
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [confirmChange, setConfirmChange] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ArtistSetupInput>({
    defaultValues: {
      handle: profile?.handle ?? '',
    },
    resolver: zodResolver(artistSetupSchema),
  });
  const handle = useWatch({ control, name: 'handle' });
  const currentHandle = profile?.handle;
  const isChangingHandle =
    currentHandle !== null &&
    currentHandle !== undefined &&
    handle !== currentHandle;
  const canSubmit =
    availability === 'available' && checkedHandle === handle;

  useEffect(() => {
    let active = true;

    const timeout = setTimeout(() => {
      const parsedHandle = handleSchema.safeParse(handle);
      if (!parsedHandle.success) {
        setAvailability('idle');
        setCheckedHandle(null);
        setAvailabilityError(null);
        setConfirmChange(false);
        return;
      }

      if (handle === currentHandle) {
        setAvailability('available');
        setCheckedHandle(handle);
        setAvailabilityError(null);
        setConfirmChange(false);
        return;
      }

      setAvailability('checking');
      setCheckedHandle(null);
      setAvailabilityError(null);
      setConfirmChange(false);
      void supabase
        .rpc('is_handle_available', { p_handle: parsedHandle.data })
        .then(({ data, error }) => {
          if (!active) {
            return;
          }

          if (error) {
            setAvailability('error');
            setCheckedHandle(handle);
            setAvailabilityError(getAuthErrorMessage(error));
            return;
          }

          setCheckedHandle(handle);
          setAvailability(data ? 'available' : 'unavailable');
        });
    }, 350);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [currentHandle, handle]);

  const onSubmit = async ({ handle: nextHandle }: ArtistSetupInput) => {
    setSubmissionError(null);

    try {
      await activateArtist(nextHandle);
      router.replace('/');
    } catch (error) {
      setSubmissionError(
        error instanceof Error
          ? error.message
          : messages.invalidHandle,
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
        <Text style={styles.title}>Ofrece tus comisiones</Text>
        <Text style={styles.subtitle}>
          Elige el identificador público con el que tus clientes te
          encontrarán.
        </Text>

        <Text style={styles.label}>Handle</Text>
        <Controller
          control={control}
          name="handle"
          render={({ field: { onBlur, onChange, value } }) => (
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="tu-handle"
              style={[styles.input, errors.handle && styles.inputError]}
              value={value}
            />
          )}
        />
        {errors.handle && (
          <Text style={styles.error}>
            {errors.handle.message ?? messages.invalidHandle}
          </Text>
        )}
        {!errors.handle && availability === 'checking' && (
          <Text style={styles.hint}>Comprobando disponibilidad...</Text>
        )}
        {!errors.handle && availability === 'available' && (
          <Text style={styles.success}>Este handle está disponible.</Text>
        )}
        {!errors.handle && availability === 'unavailable' && (
          <Text style={styles.error}>{messages.duplicateHandle}</Text>
        )}
        {availabilityError && (
          <Text accessibilityRole="alert" style={styles.error}>
            {availabilityError}
          </Text>
        )}
        {isChangingHandle && (
          <Text style={styles.warning}>
            Al cambiar tu handle, el anterior dejará de funcionar.
          </Text>
        )}
        {confirmChange && (
          <View style={styles.confirmation}>
            <Text style={styles.warning}>
              Confirma el cambio para continuar.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setConfirmChange(false)}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelText}>Conservar el handle anterior</Text>
            </Pressable>
          </View>
        )}
        {submissionError && (
          <Text accessibilityRole="alert" style={styles.error}>
            {submissionError}
          </Text>
        )}

        <Pressable
          accessibilityRole="button"
          disabled={!canSubmit || isUpdating}
          onPress={() => {
            if (isChangingHandle) {
              setConfirmChange(true);
              return;
            }
            void handleSubmit(onSubmit)();
          }}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            (!canSubmit || isUpdating) && styles.buttonDisabled,
          ]}
        >
          {isUpdating ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>
              {isChangingHandle ? 'Revisar cambio' : 'Activar perfil de artista'}
            </Text>
          )}
        </Pressable>

        {confirmChange && (
          <Pressable
            accessibilityRole="button"
            disabled={isUpdating}
            onPress={() => void handleSubmit(onSubmit)()}
            style={styles.confirmButton}
          >
            <Text style={styles.confirmText}>Confirmar cambio</Text>
          </Pressable>
        )}
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
  hint: {
    color: '#6B7280',
    fontSize: 14,
    marginTop: 6,
  },
  success: {
    color: '#166534',
    fontSize: 14,
    marginTop: 6,
  },
  error: {
    color: '#B91C1C',
    fontSize: 14,
    marginTop: 6,
  },
  warning: {
    color: '#92400E',
    fontSize: 14,
    marginTop: 12,
  },
  confirmation: {
    borderColor: '#F59E0B',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },
  cancelButton: {
    marginTop: 8,
  },
  cancelText: {
    color: '#92400E',
    fontSize: 14,
    fontWeight: '600',
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
    opacity: 0.5,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  confirmButton: {
    alignItems: 'center',
    borderColor: '#6C5CE7',
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 48,
  },
  confirmText: {
    color: '#5B4BC4',
    fontSize: 15,
    fontWeight: '700',
  },
});
