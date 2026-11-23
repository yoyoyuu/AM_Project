import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { NOTIFICATION_MESSAGES as M } from '../messages';
import { getPushPermissionState, type PushPermissionState } from '../permission';
import { syncPushRegistration } from '../pushToken';
import { NotificationPermissionPrompt } from './NotificationPermissionPrompt';
import { colors } from '../../../theme';

interface Props {
  showToast?: (message: string) => void;
}

export function NotificationSettingsRow({ showToast }: Props) {
  const [state, setState] = useState<PushPermissionState | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const previousState = useRef<PushPermissionState | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let mounted = true;
    void getPushPermissionState().then(async (next) => {
      if (!mounted) return;
      if (previousState.current !== 'granted' && next === 'granted') {
        await syncPushRegistration().catch(() => undefined);
      }
      if (!mounted) return;
      previousState.current = next;
      setState(next);
    });
    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active') setRefreshTick((n) => n + 1);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, [refreshTick]);

  const valueLabel = state === 'granted' ? M.settingsOn : M.settingsOff;

  return (
    <View style={styles.row}>
      <View style={styles.header}>
        <Text style={styles.label}>{M.settingsLabel}</Text>
        <Text style={styles.value}>{valueLabel}</Text>
      </View>

      {state === 'askable' && (
        <Pressable
          style={styles.actionButton}
          onPress={() => setPromptOpen(true)}
          accessibilityRole="button"
        >
          <Text style={styles.actionLabel}>{M.settingsEnable}</Text>
        </Pressable>
      )}

      {state === 'blocked' && (
        <>
          <Text style={styles.helpText}>{M.settingsBlocked}</Text>
          <Pressable
            style={styles.actionButton}
            onPress={() => {
              void Linking.openSettings();
            }}
            accessibilityRole="button"
          >
            <Text style={styles.actionLabel}>{M.openSettings}</Text>
          </Pressable>
        </>
      )}

      {promptOpen && (
        <NotificationPermissionPrompt
          showToast={showToast ?? (() => undefined)}
          forceVisible
          onClose={() => {
            setPromptOpen(false);
            setRefreshTick((n) => n + 1);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: 8,
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  actionLabel: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  helpText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  row: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingVertical: 12,
  },
  value: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});
