import { useLocalSearchParams } from 'expo-router';

import { CommissionTrackingDetailScreen } from '../../../features/seguimiento/screens/CommissionTrackingDetailScreen';

export default function CommissionDetailRoute() {
  const { commissionId } = useLocalSearchParams<{ commissionId: string }>();
  return <CommissionTrackingDetailScreen commissionId={commissionId} />;
}
