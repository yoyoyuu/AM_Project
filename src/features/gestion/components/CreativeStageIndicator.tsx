import { StyleSheet, Text, View } from 'react-native';

import { getStageName } from '../stateMachine';
import { CREATIVE_STAGE_ORDER } from '../types';
import type { CreativeStage } from '../types';

interface Props {
  currentStage: CreativeStage | null;
}

export function CreativeStageIndicator({ currentStage }: Props) {
  const activeIndex =
    currentStage === null
      ? CREATIVE_STAGE_ORDER.length // null = completada → todos marcados
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
              <Text style={[styles.dotLabel, (isCompleted || isActive) && styles.dotLabelActive]}>
                {index + 1}
              </Text>
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
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 0,
  },
  stepWrapper: {
    alignItems: 'center',
    flex: 1,
    position: 'relative',
  },
  dot: {
    alignItems: 'center',
    backgroundColor: '#E5E7EB',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  dotActive: {
    backgroundColor: '#3B82F6',
  },
  dotCompleted: {
    backgroundColor: '#10B981',
  },
  dotLabel: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '700',
  },
  dotLabelActive: {
    color: '#FFFFFF',
  },
  stepName: {
    color: '#6B7280',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  stepNameActive: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  stepNameCompleted: {
    color: '#059669',
  },
  connector: {
    backgroundColor: '#E5E7EB',
    height: 2,
    position: 'absolute',
    right: -1,
    top: 15,
    width: '50%',
  },
  connectorCompleted: {
    backgroundColor: '#10B981',
  },
});
