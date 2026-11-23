import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export function useIsOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOnline(state.isConnected !== false && state.isInternetReachable !== false);
    });
    NetInfo.fetch().then((state) => {
      setOnline(state.isConnected !== false && state.isInternetReachable !== false);
    });
    return unsubscribe;
  }, []);

  return online;
}
