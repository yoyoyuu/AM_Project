import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'Koma',
  slug: config.slug ?? 'koma',
  android: {
    ...config.android,
    // EAS Build: variable de entorno de tipo archivo (GOOGLE_SERVICES_JSON).
    // Local: archivo ignorado por git en la raíz del proyecto.
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
  },
});
