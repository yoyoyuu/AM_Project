import { Image } from 'expo-image';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { usePaymentProofUrl } from '../hooks/usePaymentProofUrl';
import { colors } from '../../../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  path: string | null;
  reference: string | null;
  note: string | null;
  uploadedAt: string | null;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PaymentProofViewer({ visible, onClose, path, reference, note, uploadedAt }: Props) {
  const { data: url, isLoading, isError, refetch } = usePaymentProofUrl(path);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <Pressable style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeTxt}>✕</Text>
        </Pressable>

        <ScrollView
          contentContainerStyle={styles.imageContainer}
          maximumZoomScale={4}
          minimumZoomScale={1}
          centerContent
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        >
          {isLoading && <ActivityIndicator size="large" color={colors.textSecondary} />}
          {isError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorTxt}>
                No se pudo cargar el comprobante. Inténtalo de nuevo
              </Text>
              <Pressable style={styles.retryBtn} onPress={() => refetch()}>
                <Text style={styles.retryTxt}>Reintentar</Text>
              </Pressable>
            </View>
          )}
          {url && (
            <Image
              source={{ uri: url }}
              style={styles.image}
              contentFit="contain"
              transition={150}
            />
          )}
        </ScrollView>

        {(reference || note || uploadedAt) && (
          <View style={styles.meta}>
            {uploadedAt ? (
              <Text style={styles.metaItem}>Enviado el {formatDate(uploadedAt)}</Text>
            ) : null}
            {reference ? (
              <Text style={styles.metaItem}>Referencia: {reference}</Text>
            ) : null}
            {note ? <Text style={styles.metaItem}>Nota: {note}</Text> : null}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.text,
  },
  closeBtn: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  closeTxt: {
    color: colors.surface,
    fontSize: 20,
    fontWeight: '600',
  },
  imageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: SCREEN_H * 0.7,
    minWidth: SCREEN_W,
  },
  image: {
    width: SCREEN_W,
    height: SCREEN_H * 0.75,
  },
  errorBox: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  errorTxt: {
    color: colors.borderStrong,
    fontSize: 14,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: colors.text,
    borderRadius: 8,
  },
  retryTxt: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '600',
  },
  meta: {
    backgroundColor: colors.text,
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 4,
  },
  metaItem: {
    color: colors.borderStrong,
    fontSize: 13,
  },
});
