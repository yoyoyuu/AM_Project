// Spec 008 — Literales de UI, categoría y toasts (spec §8.1 / §8.2)
export const NOTIFICATION_MESSAGES = {
  promptTitle: 'Activa las notificaciones',
  promptBody:
    'Koma te avisará cuando haya novedades en tus comisiones: nuevas solicitudes, avances, cambios de etapa y pagos. Los avisos nunca muestran montos, descripciones ni notas privadas.',
  promptAccept: 'Activar',
  promptDecline: 'Ahora no',
  enabled: 'Notificaciones activadas',
  disabled: 'Notificaciones desactivadas. Puedes activarlas cuando quieras desde tu perfil.',
  registerFailed: 'No se pudieron activar las notificaciones en este dispositivo. Inténtalo más tarde.',
  settingsLabel: 'Notificaciones',
  settingsOn: 'Activadas',
  settingsOff: 'Desactivadas',
  settingsEnable: 'Activar notificaciones',
  settingsBlocked: 'Las notificaciones están desactivadas en los ajustes de Android.',
  openSettings: 'Abrir ajustes',
  channelName: 'Actividad de comisiones',
  channelDescription: 'Avisos sobre solicitudes, avances, pagos y entregas de tus comisiones.',
} as const;
