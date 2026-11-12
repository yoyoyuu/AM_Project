import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useArtistPublicProfile } from '../../../../features/catalogo/queries';
import { CommissionRequestScreen } from '../../../../features/solicitud/screens/CommissionRequestScreen';
import { useProfile } from '../../../../features/auth/useProfile';

function ErrorState({ message }: { message: string }) {
  return (
    <View style={styles.centered}>
      <Text accessibilityRole="alert" style={styles.errorText}>
        {message}
      </Text>
    </View>
  );
}

export default function CommissionRequestRoute() {
  const { serviceId, handle, artistId } = useLocalSearchParams<{
    serviceId: string;
    handle: string;
    artistId: string;
  }>();

  const profileQuery = useArtistPublicProfile(handle ?? '');
  const { profile: myProfile } = useProfile();

  if (profileQuery.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#6C5CE7" />
      </View>
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <ErrorState message="Este servicio no está disponible en este momento" />
    );
  }

  const artistProfile = profileQuery.data;

  // Guard: client cannot commission themselves
  if (myProfile?.handle && myProfile.handle === artistProfile.handle) {
    return (
      <ErrorState message="No puedes enviarte una solicitud a ti mismo" />
    );
  }

  // Find the service in the artist's active services list
  const service = artistProfile.services.find((s) => s.id === serviceId);

  // Service not found in active list → paused or removed
  if (!service) {
    return (
      <ErrorState message="Este servicio no está disponible en este momento" />
    );
  }

  return (
    <CommissionRequestScreen
      artistId={artistId ?? ''}
      artistHandle={handle ?? ''}
      service={service}
      tosText={artistProfile.tos}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 16,
    textAlign: 'center',
  },
});
