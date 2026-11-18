import { StyleSheet, Text, View } from 'react-native';

import type { StepConfig, StepState } from '../presenters';

interface Props {
  steps: StepConfig[];
}

const STEP_COLORS: Record<StepState, { bg: string; border: string; text: string }> = {
  completed: { bg: '#059669', border: '#059669', text: '#FFFFFF' },
  active:    { bg: '#3B82F6', border: '#3B82F6', text: '#FFFFFF' },
  pending:   { bg: '#FFFFFF', border: '#D1D5DB', text: '#9CA3AF' },
};

function StepIcon({ state, index }: { state: StepState; index: number }) {
  const colors = STEP_COLORS[state];
  return (
    <View
      style={[
        styles.icon,
        { backgroundColor: colors.bg, borderColor: colors.border },
      ]}
      accessibilityLabel={
        state === 'completed' ? 'Completado' : state === 'active' ? 'En curso' : 'Pendiente'
      }
    >
      {state === 'completed' ? (
        <Text style={[styles.iconText, { color: colors.text }]}>✓</Text>
      ) : (
        <Text style={[styles.iconText, { color: colors.text }]}>{index + 1}</Text>
      )}
    </View>
  );
}

function Connector({ completed }: { completed: boolean }) {
  return (
    <View
      style={[styles.connector, { backgroundColor: completed ? '#059669' : '#D1D5DB' }]}
    />
  );
}

export function CreativeStepper({ steps }: Props) {
  return (
    <View style={styles.container}>
      {/* Iconos y conectores */}
      <View style={styles.iconRow}>
        {steps.map((step, i) => (
          <View key={step.code} style={styles.iconCell}>
            <StepIcon state={step.state} index={i} />
            {i < steps.length - 1 && (
              <Connector completed={step.state === 'completed'} />
            )}
          </View>
        ))}
      </View>

      {/* Etiquetas debajo */}
      <View style={styles.labelRow}>
        {steps.map((step) => (
          <Text
            key={step.code}
            style={[
              styles.label,
              step.state === 'active' && styles.labelActive,
              step.state === 'pending' && styles.labelPending,
            ]}
            numberOfLines={2}
          >
            {step.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  connector: {
    flex: 1,
    height: 2,
    marginHorizontal: 4,
    marginTop: 15,
  },
  container: {
    paddingVertical: 8,
  },
  icon: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 2,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  iconCell: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'center',
  },
  iconRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  iconText: {
    fontSize: 13,
    fontWeight: '700',
  },
  label: {
    color: '#374151',
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  labelActive: {
    color: '#3B82F6',
  },
  labelPending: {
    color: '#9CA3AF',
    fontWeight: '400',
  },
  labelRow: {
    flexDirection: 'row',
    marginTop: 6,
    paddingHorizontal: 8,
  },
});
