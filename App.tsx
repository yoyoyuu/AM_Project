import React, { useState } from 'react';
import { router } from 'expo-router';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { CommissionDetailScreen } from './src/screens/CommissionDetailScreen';
import { signOut } from './src/features/auth/api';
import { Commission } from './src/types';

export default function App() {
  const [selectedCommission, setSelectedCommission] = useState<Commission | null>(null);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const handleSignOut = async () => {
    setLogoutError(null);
    const result = await signOut();

    if (result.error !== null) {
      setLogoutError(result.error);
      return;
    }

    router.replace('/login');
  };

  return selectedCommission ? (
    <CommissionDetailScreen
      commission={selectedCommission}
      onBack={() => setSelectedCommission(null)}
    />
  ) : (
    <DashboardScreen
      onLogout={handleSignOut}
      logoutError={logoutError}
      onSelectCommission={(item) => setSelectedCommission(item)}
    />
  );
}