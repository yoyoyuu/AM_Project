import { setNotificationHandler } from 'expo-notifications';
import { supabase } from '../../lib/supabase';
import { parsePushData } from './routing';

/**
 * Se ejecuta al importar el módulo (una vez, en src/app/_layout.tsx).
 * Solo muestra el banner si el aviso es de la sesión actual (RNF-NOT-8.2).
 * SDK 53+: shouldShowBanner / shouldShowList reemplazan a shouldShowAlert.
 */
setNotificationHandler({
  handleNotification: async (notification) => {
    const data = parsePushData(notification.request.content.data);
    const { data: auth } = await supabase.auth.getSession();
    const mine = data !== null && auth.session?.user.id === data.recipient_id;
    return {
      shouldShowBanner: mine,
      shouldShowList: mine,
      shouldPlaySound: mine,
      shouldSetBadge: false,
    };
  },
});
