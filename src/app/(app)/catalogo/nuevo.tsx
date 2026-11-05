import { router } from 'expo-router';
import { Controller } from 'react-hook-form';
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
import { useCreateService } from '../../../features/catalogo/queries';
import { useServiceForm } from '../../../features/catalogo/hooks/useServiceForm';
import type { ServiceFormValues } from '../../../features/catalogo/schemas';

export default function NewServiceScreen() {
  const createService = useCreateService();
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useServiceForm();

  const onSubmit = async (values: ServiceFormValues) => {
    try {
      await createService.mutateAsync({
        title: values.title,
        description: values.description ?? null,
        price_mxn: values.price_mxn,
        delivery_days: values.delivery_days,
        status: 'active',
      });
      router.navigate('/catalogo');
    } catch (error) {
      return catalogoErrors.handle(error);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.container}>
        <Text style={styles.brand}>Koma</Text>
        <Text style={styles.title}>Nuevo servicio</Text>
        <Text style={styles.subtitle}>
          Describe el servicio que quieres ofrecer.
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
              placeholder="Ej. Ilustración busto"
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
              placeholder="Qué incluye este servicio"
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
              placeholder="Ej. 500"
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
              placeholder="Ej. 7"
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

        {createService.isError && (
          <Text accessibilityRole="alert" style={styles.error}>
            {catalogoErrors.handle(createService.error)}
          </Text>
        )}

        <Pressable
          accessibilityRole="button"
          disabled={isSubmitting || createService.isPending}
          onPress={() => void handleSubmit(onSubmit)()}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            (isSubmitting || createService.isPending) &&
              styles.buttonDisabled,
          ]}
        >
          {isSubmitting || createService.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Guardar servicio</Text>
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
    marginTop: 6,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#6C5CE7',
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
    backgroundColor: '#9CA3AF',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
