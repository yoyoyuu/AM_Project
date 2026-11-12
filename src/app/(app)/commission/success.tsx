import { useLocalSearchParams } from 'expo-router';

import { CommissionSuccessScreen } from '../../../features/solicitud/screens/CommissionSuccessScreen';

export default function CommissionSuccessRoute() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  return <CommissionSuccessScreen artistHandle={handle ?? ''} />;
}
