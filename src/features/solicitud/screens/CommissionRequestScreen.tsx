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

import type { PublicServiceItem } from '../../catalogo/types';
import { ServiceSummaryCard } from '../components/ServiceSummaryCard';
import { TosAcceptanceBlock } from '../components/TosAcceptanceBlock';
import { ReferenceImagePicker } from '../components/ReferenceImagePicker';
import { useSubmitCommission } from '../hooks/useSubmitCommission';
import { commissionRequestSchema, type CommissionRequestFormValues } from '../schemas';
import type { LocalImageAsset } from '../types';

export interface CommissionRequestScreenProps {
  artistId: string;
  artistHandle: string;
  service: PublicServiceItem;
  tosText: string | null;
}

export function CommissionRequestScreen({
  artistId,
  artistHandle,
  service,
  tosText,
}: CommissionRequestScreenProps) {
  const [images, setImages] = useState<LocalImageAsset[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const hasArtistTos = tosText !== null;

  const submitCommission = useSubmitCommission();

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CommissionRequestFormValues>({
    resolver: zodResolver(commissionRequestSchema),
    defaultValues: {
      description: '',
      pose: '',
      key_elements: '',
      additional_notes: '',
      terms_accepted: false,
    },
  });

  const onSubmit = async (values: CommissionRequestFormValues) => {
    setSubmitError(null);

    if (hasArtistTos && !values.terms_accepted) {
      setError('terms_accepted', {
        message: 'Debes aceptar los términos de servicio del artista para continuar',
      });
      return;
    }

    try {
      await submitCommission.mutateAsync({
        artistId,
        serviceId: service.id,
        form: values,
        images,
        hasArtistTos,
      });
      router.replace(`/commission/success?handle=${encodeURIComponent(artistHandle)}`);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'No se pudo enviar la solicitud, comprueba tu conexión e inténtalo de nuevo',
      );
    }
  };

  const isPending = isSubmitting || submitCommission.isPending;
  const tosAccepted = !hasArtistTos; // si no hay TOS, el botón no depende de ella

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.container}>
        <Text style={styles.title}>Solicitar comisión</Text>

        <View style={styles.section}>
          <ServiceSummaryCard
            title={service.title}
            base_price={service.price_mxn}
            estimated_days={service.delivery_days}
          />
        </View>

        {hasArtistTos && (
          <View style={styles.section}>
            <TosAcceptanceBlock
              tosText={tosText}
              onAcceptChange={(accepted) => {
                if (accepted) setError('terms_accepted', {});
              }}
            />
            {errors.terms_accepted?.message ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {errors.terms_accepted.message}
              </Text>
            ) : null}
          </View>
        )}

        <Text style={styles.sectionTitle}>Detalles del encargo</Text>

        <Text style={styles.label}>
          Descripción del personaje o concepto{' '}
          <Text style={styles.required}>*</Text>
        </Text>
        <Controller
          control={control}
          name="description"
          render={({ field: { onBlur, onChange, value } }) => (
            <TextInput
              multiline
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="Describe el personaje, escena o concepto con el mayor detalle posible (mín. 20 caracteres)"
              style={[styles.input, styles.multilineInput, errors.description && styles.inputError]}
              textAlignVertical="top"
              value={value}
            />
          )}
        />
        {errors.description?.message ? (
          <Text style={styles.error}>{errors.description.message}</Text>
        ) : null}

        <Text style={styles.label}>Pose o composición</Text>
        <Controller
          control={control}
          name="pose"
          render={({ field: { onBlur, onChange, value } }) => (
            <TextInput
              multiline
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="Ej. de pie, de frente, fondo blanco… (opcional)"
              style={[styles.input, styles.multilineInput, errors.pose && styles.inputError]}
              textAlignVertical="top"
              value={value ?? ''}
            />
          )}
        />
        {errors.pose?.message ? (
          <Text style={styles.error}>{errors.pose.message}</Text>
        ) : null}

        <Text style={styles.label}>Elementos clave</Text>
        <Controller
          control={control}
          name="key_elements"
          render={({ field: { onBlur, onChange, value } }) => (
            <TextInput
              multiline
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="Objetos, colores, detalles importantes… (opcional)"
              style={[styles.input, styles.multilineInput, errors.key_elements && styles.inputError]}
              textAlignVertical="top"
              value={value ?? ''}
            />
          )}
        />
        {errors.key_elements?.message ? (
          <Text style={styles.error}>{errors.key_elements.message}</Text>
        ) : null}

        <Text style={styles.label}>
          Uso previsto <Text style={styles.required}>*</Text>
        </Text>
        <Controller
          control={control}
          name="intended_use"
          render={({ field: { onChange, value } }) => (
            <View style={styles.radioRow}>
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: value === 'personal' }}
                onPress={() => onChange('personal')}
                style={[styles.radioOption, value === 'personal' && styles.radioSelected]}
              >
                <Text style={[styles.radioText, value === 'personal' && styles.radioTextSelected]}>
                  Personal
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: value === 'comercial' }}
                onPress={() => onChange('comercial')}
                style={[styles.radioOption, value === 'comercial' && styles.radioSelected]}
              >
                <Text style={[styles.radioText, value === 'comercial' && styles.radioTextSelected]}>
                  Comercial
                </Text>
              </Pressable>
            </View>
          )}
        />
        {errors.intended_use?.message ? (
          <Text style={styles.error}>{errors.intended_use.message}</Text>
        ) : null}

        <Text style={styles.label}>Notas adicionales</Text>
        <Controller
          control={control}
          name="additional_notes"
          render={({ field: { onBlur, onChange, value } }) => (
            <TextInput
              multiline
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="Cualquier otra indicación para el artista (opcional)"
              style={[styles.input, styles.multilineInput, errors.additional_notes && styles.inputError]}
              textAlignVertical="top"
              value={value ?? ''}
            />
          )}
        />
        {errors.additional_notes?.message ? (
          <Text style={styles.error}>{errors.additional_notes.message}</Text>
        ) : null}

        <View style={styles.section}>
          <ReferenceImagePicker onImagesChange={setImages} />
        </View>

        {submitError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {submitError}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={isPending || (hasArtistTos && !tosAccepted)}
          onPress={() => void handleSubmit(onSubmit)()}
          style={({ pressed }) => [
            styles.submitButton,
            pressed && styles.submitButtonPressed,
            isPending && styles.submitButtonDisabled,
          ]}
        >
          {isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Enviar solicitud</Text>
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
  title: {
    color: '#1F2937',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#1F2937',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
    marginTop: 8,
  },
  section: {
    marginBottom: 8,
    marginTop: 16,
  },
  label: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  required: {
    color: '#B91C1C',
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
  multilineInput: {
    minHeight: 90,
    paddingTop: 12,
  },
  inputError: {
    borderColor: '#B91C1C',
  },
  radioRow: {
    flexDirection: 'row',
    gap: 12,
  },
  radioOption: {
    alignItems: 'center',
    borderColor: '#D1D5DB',
    borderRadius: 10,
    borderWidth: 1.5,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  radioSelected: {
    backgroundColor: '#F3F0FF',
    borderColor: '#6C5CE7',
  },
  radioText: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '600',
  },
  radioTextSelected: {
    color: '#6C5CE7',
  },
  error: {
    color: '#B91C1C',
    fontSize: 14,
    marginTop: 6,
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: '#6C5CE7',
    borderRadius: 10,
    justifyContent: 'center',
    marginTop: 28,
    minHeight: 52,
  },
  submitButtonPressed: {
    opacity: 0.85,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
