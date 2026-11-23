import * as MediaLibrary from 'expo-media-library';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  openAppSettings,
  SAVE_MESSAGES,
  useSaveDeliverable,
} from '../hooks/useSaveDeliverable';
import { colors } from '../../../theme';

interface Props {
  commissionId: string;
  deliverablePath: string;
}

export function SaveToGalleryButton({ commissionId, deliverablePath }: Props) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const { mutateAsync: save, isPending } = useSaveDeliverable();

  const handlePress = async () => {
    setErrorMessage(null);
    setShowSettings(false);

    const { granted } = await MediaLibrary.getPermissionsAsync(true);
    if (!granted) {
      await new Promise<void>((resolve) => {
        Alert.alert(
          'Acceso a la galería',
          'Koma necesita permiso para guardar la ilustración final en la galería de tu dispositivo.',
          [{ text: 'Continuar', onPress: () => resolve() }],
        );
      });
    }

    const outcome = await save({ commissionId, deliverablePath });
    if (outcome.ok) {
      Alert.alert(SAVE_MESSAGES.success);
    } else {
      setErrorMessage(outcome.message);
      setShowSettings(outcome.showOpenSettings);
    }
  };

  return (
    <View>
      <Pressable
        style={[styles.button, isPending && styles.buttonDisabled]}
        onPress={() => { void handlePress(); }}
        disabled={isPending}
      >
        {isPending ? (
          <>
            <ActivityIndicator size="small" color={colors.surface} />
            <Text style={styles.label}>Guardando…</Text>
          </>
        ) : (
          <Text style={styles.label}>Guardar en galería</Text>
        )}
      </Pressable>

      {errorMessage && (
        <View style={styles.errorBox}>
          <Text style={styles.errorTxt}>{errorMessage}</Text>
          {showSettings && (
            <Pressable onPress={openAppSettings}>
              <Text style={styles.settingsLink}>Abrir ajustes</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  errorBox: {
    marginTop: 8,
  },
  errorTxt: {
    color: colors.danger,
    fontSize: 13,
  },
  label: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '600',
  },
  settingsLink: {
    color: colors.primary,
    fontSize: 13,
    marginTop: 4,
    textDecorationLine: 'underline',
  },
});
