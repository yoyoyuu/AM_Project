import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Controller } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { catalogoErrors } from '../../../features/catalogo/errors';
import {
  useDeleteService,
  useMyServices,
  useUpdateService,
} from '../../../features/catalogo/queries';
import { useServiceForm } from '../../../features/catalogo/hooks/useServiceForm';
import type { ServiceFormValues } from '../../../features/catalogo/schemas';
import type { ServiceStatus } from '../../../features/catalogo/types';

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const serviceId = Array.isArray(id) ? id[0] : id;
  const servicesQuery = useMyServices();
  const updateService = useUpdateService();
  const deleteService = useDeleteService();
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const service = useMemo(
    () => servicesQuery.data?.find((item) => item.id === serviceId) ?? null,
    [serviceId, servicesQuery.data],
  );
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useServiceForm();

  useEffect(() => {
    if (service !== null) {
      reset({
        title: service.title,
        description: service.description,
        price_mxn: service.price_mxn,
        delivery_days: service.delivery_days,
      });
    }
  }, [reset, service]);

  if (servicesQuery.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#6C5CE7" />
      </View>
    );
  }

  if (servicesQuery.isError) {
    return (
      <View style={styles.centered}>
        <Text accessibilityRole="alert" style={styles.error}>
          {catalogoErrors.handle(servicesQuery.error)}
        </Text>
      </View>
    );
  }

  if (service === null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>No se encontró el servicio.</Text>
        <Pressable onPress={() => router.back()} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Volver al catálogo</Text>
        </Pressable>
      </View>
    );
  }

  const onSubmit = async (values: ServiceFormValues) => {
    setSubmissionError(null);
    try {
      await updateService.mutateAsync({
        id: service.id,
        payload: {
          title: values.title,
          description: values.description ?? null,
          price_mxn: values.price_mxn,
          delivery_days: values.delivery_days,
        },
      });
      router.back();
    } catch (error) {
      setSubmissionError(catalogoErrors.handle(error));
    }
  };

  const changeStatus = async (status: ServiceStatus) => {
    setSubmissionError(null);
    try {
      await updateService.mutateAsync({
        id: service.id,
        payload: { status },
      });
    } catch (error) {
      setSubmissionError(catalogoErrors.handle(error));
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Eliminar servicio',
      'Esta acción es permanente. ¿Quieres continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setSubmissionError(null);
              try {
                await deleteService.mutateAsync(service.id);
                router.back();
              } catch (error) {
                setSubmissionError(catalogoErrors.handle(error));
              }
            })();
          },
        },
      ],
      { cancelable: true },
    );
  };

  const isMutating =
    isSubmitting || updateService.isPending || deleteService.isPending;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.container}>
        <Text style={styles.brand}>Koma</Text>
        <Text style={styles.title}>Editar servicio</Text>
        <Text style={styles.subtitle}>
          Actualiza la información o cambia su disponibilidad.
        </Text>

        <Text style={styles.label}>Título</Text>
        <Controller
          control={control}
          name="title"
          render={({ field: { onBlur, onChange, value } }) => (
            <TextInput
              autoCapitalize="sentences"
              onBlur={onBlur}
              onChangeText={onChange}
              style={[styles.input, errors.title && styles.inputError]}
              value={value}
            />
          )}
        />
        {errors.title && (
          <Text style={styles.error}>{errors.title.message}</Text>
        )}

        <Text style={styles.label}>Descripción (opcional)</Text>
        <Controller
          control={control}
          name="description"
          render={({ field: { onBlur, onChange, value } }) => (
            <TextInput
              multiline
              onBlur={onBlur}
              onChangeText={onChange}
              style={[
                styles.input,
                styles.descriptionInput,
                errors.description && styles.inputError,
              ]}
              textAlignVertical="top"
              value={value ?? ''}
            />
          )}
        />
        {errors.description && (
          <Text style={styles.error}>{errors.description.message}</Text>
        )}

        <Text style={styles.label}>Precio base (MXN)</Text>
        <Controller
          control={control}
          name="price_mxn"
          render={({ field: { onBlur, onChange, value } }) => (
            <TextInput
              keyboardType="numeric"
              onBlur={onBlur}
              onChangeText={(text) => onChange(text ? Number(text) : NaN)}
              style={[styles.input, errors.price_mxn && styles.inputError]}
              value={value === undefined ? '' : String(value)}
            />
          )}
        />
        {errors.price_mxn && (
          <Text style={styles.error}>{errors.price_mxn.message}</Text>
        )}

        <Text style={styles.label}>Tiempo de entrega (días)</Text>
        <Controller
          control={control}
          name="delivery_days"
          render={({ field: { onBlur, onChange, value } }) => (
            <TextInput
              keyboardType="numeric"
              onBlur={onBlur}
              onChangeText={(text) => onChange(text ? Number(text) : NaN)}
              style={[
                styles.input,
                errors.delivery_days && styles.inputError,
              ]}
              value={value === undefined ? '' : String(value)}
            />
          )}
        />
        {errors.delivery_days && (
          <Text style={styles.error}>{errors.delivery_days.message}</Text>
        )}

        {submissionError && (
          <Text accessibilityRole="alert" style={styles.error}>
            {submissionError}
          </Text>
        )}

        <Pressable
          accessibilityRole="button"
          disabled={isMutating}
          onPress={() => void handleSubmit(onSubmit)()}
          style={[styles.primaryButton, isMutating && styles.disabledButton]}
        >
          {isMutating ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>Guardar cambios</Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={isMutating}
          onPress={() =>
            void changeStatus(service.status === 'active' ? 'paused' : 'active')
          }
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>
            {service.status === 'active' ? 'Pausar servicio' : 'Activar servicio'}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={isMutating}
          onPress={confirmDelete}
          style={styles.deleteButton}
        >
          <Text style={styles.deleteButtonText}>Eliminar servicio</Text>
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
    color: '#6C5CE7',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 20,
  },
  title: {
    color: '#1F2937',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: '#6B7280',
    fontSize: 16,
    marginBottom: 20,
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
  descriptionInput: {
    minHeight: 110,
    paddingTop: 14,
  },
  inputError: {
    borderColor: '#B91C1C',
  },
  error: {
    color: '#B91C1C',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
    textAlign: 'center',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#6C5CE7',
    borderRadius: 10,
    justifyContent: 'center',
    marginTop: 28,
    minHeight: 52,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#6C5CE7',
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 50,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: '#6C5CE7',
    fontSize: 16,
    fontWeight: '700',
  },
  deleteButton: {
    alignItems: 'center',
    marginTop: 18,
    minHeight: 48,
    paddingVertical: 8,
  },
  deleteButtonText: {
    color: '#B91C1C',
    fontSize: 15,
    fontWeight: '600',
  },
});
