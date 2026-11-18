import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

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

function SkeletonCard() {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <SkeletonBox style={styles.titleLine} />
        <SkeletonBox style={styles.badge} />
      </View>
      <SkeletonBox style={styles.subtitleLine} />
      <SkeletonBox style={styles.dateLine} />
    </View>
  );
}

export function CommissionListSkeleton() {
  return (
    <View>
      <SkeletonBox style={styles.sectionHeader} />
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    height: 22,
    width: 72,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 16,
  },
  dateLine: {
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    height: 10,
    marginTop: 8,
    width: 80,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionHeader: {
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    height: 12,
    marginBottom: 8,
    marginHorizontal: 16,
    width: 100,
  },
  subtitleLine: {
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    height: 12,
    marginTop: 8,
    width: 120,
  },
  titleLine: {
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    flex: 1,
    height: 16,
    marginRight: 8,
  },
});
