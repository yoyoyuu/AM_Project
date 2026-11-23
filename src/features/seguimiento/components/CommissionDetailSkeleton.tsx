import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors } from '../../../theme';

function SkeletonBox({ style }: { style?: object }) {
  const [opacity] = useState(() => new Animated.Value(0.3));

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return <Animated.View style={[{ opacity }, style]} />;
}

function Block({ children }: { children: React.ReactNode }) {
  return <View style={styles.block}>{children}</View>;
}

export function CommissionDetailSkeleton() {
  return (
    <View style={styles.container}>
      {/* Encabezado de estado */}
      <Block>
        <SkeletonBox style={styles.badge} />
        <SkeletonBox style={[styles.line, styles.titleLine]} />
      </Block>

      {/* Stepper */}
      <Block>
        <View style={styles.stepperRow}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.stepCell}>
              <SkeletonBox style={styles.stepIcon} />
              {i < 2 && <SkeletonBox style={styles.connector} />}
            </View>
          ))}
        </View>
        <View style={styles.stepperRow}>
          {[0, 1, 2].map((i) => (
            <SkeletonBox key={i} style={styles.stepLabel} />
          ))}
        </View>
      </Block>

      {/* Datos del servicio */}
      <Block>
        <SkeletonBox style={[styles.line, styles.shortLine]} />
        <SkeletonBox style={[styles.line, styles.mediumLine]} />
        <SkeletonBox style={[styles.line, styles.shortLine]} />
      </Block>

      {/* Datos del encargo */}
      <Block>
        <SkeletonBox style={[styles.line, styles.shortLine]} />
        <SkeletonBox style={[styles.line, styles.fullLine]} />
        <SkeletonBox style={[styles.line, styles.fullLine]} />
        <SkeletonBox style={[styles.line, styles.mediumLine]} />
      </Block>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.border,
    borderRadius: 999,
    height: 24,
    marginBottom: 12,
    width: 90,
  },
  block: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  connector: {
    backgroundColor: colors.border,
    flex: 1,
    height: 2,
    marginHorizontal: 4,
    marginTop: 15,
  },
  container: {
    padding: 16,
  },
  fullLine: {
    width: '100%',
  },
  line: {
    backgroundColor: colors.border,
    borderRadius: 4,
    height: 14,
    marginVertical: 4,
  },
  mediumLine: {
    width: '60%',
  },
  shortLine: {
    width: '40%',
  },
  stepCell: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  stepIcon: {
    backgroundColor: colors.border,
    borderRadius: 16,
    height: 32,
    width: 32,
  },
  stepLabel: {
    backgroundColor: colors.border,
    borderRadius: 4,
    flex: 1,
    height: 10,
    marginHorizontal: 4,
    marginTop: 6,
  },
  stepperRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  titleLine: {
    width: '70%',
  },
});
