import React, { useState } from 'react';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { CommissionDetailScreen } from './src/screens/CommissionDetailScreen';
import { Commission } from './src/types';

export default function App() {
  const [selectedCommission, setSelectedCommission] = useState<Commission | null>(null);

  return selectedCommission ? (
    <CommissionDetailScreen
      commission={selectedCommission}
      onBack={() => setSelectedCommission(null)}
    />
  ) : (
    <DashboardScreen onSelectCommission={(item) => setSelectedCommission(item)} />
  );
}