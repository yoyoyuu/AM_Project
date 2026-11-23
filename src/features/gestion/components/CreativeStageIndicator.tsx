import { StyleSheet, Text, View } from 'react-native';

import { getStageName } from '../stateMachine';
import { CREATIVE_STAGE_ORDER } from '../types';
import type { CreativeStage } from '../types';
import { colors } from '../../../theme';

interface Props {
  currentStage: CreativeStage | null;
}

export function CreativeStageIndicator({ currentStage }: Props) {
  const activeIndex =
    currentStage === null
      ? CREATIVE_STAGE_ORDER.length
      : CREATIVE_STAGE_ORDER.indexOf(currentStage);

  return (
    <View style={styles.row}>
      {CREATIVE_STAGE_ORDER.map((stage, index) => {
        const isCompleted = index < activeIndex;
        const isActive = index === activeIndex;

        return (
          <View key={stage} style={styles.stepWrapper}>
            <View
              style={[
                styles.dot,
                isCompleted && styles.dotCompleted,
                isActive && styles.dotActive,
              ]}
            >
              {isCompleted ? (
                <Text style={styles.dotLabelActive}>✓</Text>
              ) : (
                <Text style={[styles.dotLabel, isActive && styles.dotLabelActive]}>
                  {index + 1}
                </Text>
              )}
            </View>
            <Text
              style={[
                styles.stepName,
                isActive && styles.stepNameActive,
                isCompleted && styles.stepNameCompleted,
              ]}
              numberOfLines={2}
            >
              {getStageName(stage)}
            </Text>
            {index < CREATIVE_STAGE_ORDER.length - 1 && (
              <View style={[styles.connector, isCompleted && styles.connectorCompleted]} />
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'flex-start', flexDirection: 'row' },
  stepWrapper: { alignItems: 'center', flex: 1, position: 'relative' },
  dot: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderWidth: 2,
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  dotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dotCompleted: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  dotLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  dotLabelActive: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '700',
  },
  stepName: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  stepNameActive: {
    color: colors.primaryStrong,
    fontWeight: '700',
  },
  stepNameCompleted: {
    color: colors.successStrong,
  },
  connector: {
    backgroundColor: colors.borderStrong,
    height: 2,
    position: 'absolute',
    right: -1,
    top: 15,
    width: '50%',
  },
  connectorCompleted: {
    backgroundColor: colors.success,
  },
});
