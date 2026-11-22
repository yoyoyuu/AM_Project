import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PROMPT_DISMISSED_STORAGE_KEY } from '../constants';
import { NOTIFICATION_MESSAGES as M } from '../messages';
import { getPushPermissionState, requestPushPermission } from '../permission';
import { syncPushRegistration } from '../pushToken';

interface Props {
  showToast: (message: string) => void;
  /** Perfil (Escenario 8.5): mostrar aunque se haya elegido «Ahora no» antes. */
  forceVisible?: boolean;
  onClose?: (granted: boolean) => void;
}

export function NotificationPermissionPrompt({ showToast, forceVisible = false, onClose }: Props) {
  const [autoVisible, setAutoVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const visible = forceVisible || autoVisible;

  useEffect(() => {
    if (forceVisible) return;
    let mounted = true;
    void Promise.all([
      getPushPermissionState(),
      AsyncStorage.getItem(PROMPT_DISMISSED_STORAGE_KEY),
    ]).then(([state, dismissed]) => {
      if (!mounted) return;
      setAutoVisible(state === 'askable' && dismissed === null);
    });
    return () => {
      mounted = false;
    };
  }, [forceVisible]);

  const finish = async (granted: boolean) => {
    await AsyncStorage.setItem(PROMPT_DISMISSED_STORAGE_KEY, '1');
    setAutoVisible(false);
    setBusy(false);
    onClose?.(granted);
  };

  const onDecline = async () => {
    showToast(M.disabled);
    await finish(false);
  };

  const onAccept = async () => {
    setBusy(true);
    const granted = await requestPushPermission();
    if (!granted) {
      showToast(M.disabled);
      await finish(false);
      return;
    }
    try {
      await syncPushRegistration();
      showToast(M.enabled);
    } catch {
      showToast(M.registerFailed);
    }
    await finish(true);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDecline}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <Text style={styles.title} accessibilityRole="header">{M.promptTitle}</Text>
          <Text style={styles.message}>{M.promptBody}</Text>
          <View style={styles.actions}>
            <Pressable
              style={styles.cancelButton}
              onPress={onDecline}
              disabled={busy}
              accessibilityRole="button"
            >
              <Text style={styles.cancelLabel}>{M.promptDecline}</Text>
            </Pressable>
            <Pressable
              style={styles.confirmButton}
              onPress={onAccept}
              disabled={busy}
              accessibilityRole="button"
            >
              <Text style={styles.confirmLabel}>{M.promptAccept}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  cancelButton: {
    borderColor: '#D1D5DB',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cancelLabel: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  confirmLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  dialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginHorizontal: 24,
    padding: 20,
    width: '100%',
  },
  message: {
    color: '#6B7280',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
});
