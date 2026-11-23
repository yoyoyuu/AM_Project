import { StyleSheet, Text, View } from 'react-native';

import type { StepConfig, StepState } from '../presenters';
import { colors } from '../../../theme';

interface Props {
  steps: StepConfig[];
}

const STEP_COLORS: Record<StepState, { bg: string; border: string; text: string }> = {
  completed: { bg: colors.success, border: colors.success, text: colors.surface },
  active: { bg: colors.primary, border: colors.primary, text: colors.surface },
  pending: { bg: colors.surface, border: colors.borderStrong, text: colors.textMuted },
};

function StepIcon({ state, index }: { state: StepState; index: number }) {
  const c = STEP_COLORS[state];
  return (
    <View
      style={[styles.icon, { backgroundColor: c.bg, borderColor: c.border }]}
      accessibilityLabel={
        state === 'completed' ? 'Completado' : state === 'active' ? 'En curso' : 'Pendiente'
      }
    >
      {state === 'completed' ? (
        <Text style={[styles.iconText, { color: c.text }]}>✓</Text>
      ) : (
        <Text style={[styles.iconText, { color: c.text }]}>{index + 1}</Text>
      )}
    </View>
  );
}

function Connector({ completed }: { completed: boolean }) {
  return (
    <View
      style={[
        styles.connector,
        { backgroundColor: completed ? colors.success : colors.borderStrong },
      ]}
    />
  );
}

export function CreativeStepper({ steps }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.iconRow}>
        {steps.map((step, i) => (
          <View key={step.code} style={styles.iconCell}>
            <StepIcon state={step.state} index={i} />
            {i < steps.length - 1 && <Connector completed={step.state === 'completed'} />}
          </View>
        ))}
      </View>

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
  container: { paddingVertical: 8 },
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
  iconRow: { flexDirection: 'row', paddingHorizontal: 16 },
  iconText: { fontSize: 13, fontWeight: '700' },
  label: {
    color: colors.text,
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  labelActive: { color: colors.primaryStrong },
  labelPending: { color: colors.textMuted, fontWeight: '400' },
  labelRow: { flexDirection: 'row', marginTop: 6, paddingHorizontal: 8 },
});
