import { Checkbox } from 'expo-checkbox';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface Props {
  tosText: string | null;
  onAcceptChange: (accepted: boolean) => void;
}

export function TosAcceptanceBlock({ tosText, onAcceptChange }: Props) {
  const [accepted, setAccepted] = useState(false);

  if (tosText === null) return null;

  const handleChange = (value: boolean) => {
    setAccepted(value);
    onAcceptChange(value);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Términos de servicio del artista</Text>

      <ScrollView
        style={styles.tosScroll}
        nestedScrollEnabled
      >
        <Text style={styles.tosText}>{tosText}</Text>
      </ScrollView>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: accepted }}
        onPress={() => handleChange(!accepted)}
        style={styles.checkRow}
      >
        <Checkbox
          color={accepted ? '#6C5CE7' : undefined}
          onValueChange={handleChange}
          value={accepted}
        />
        <Text style={styles.checkLabel}>
          He leído y acepto los términos de servicio
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  label: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '600',
  },
  tosScroll: {
    backgroundColor: '#F9FAFB',
    borderColor: '#D1D5DB',
    borderRadius: 10,
    borderWidth: 1,
    maxHeight: 160,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tosText: {
    color: '#374151',
    fontSize: 14,
    lineHeight: 20,
  },
  checkRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  checkLabel: {
    color: '#374151',
    flex: 1,
    fontSize: 15,
  },
});
