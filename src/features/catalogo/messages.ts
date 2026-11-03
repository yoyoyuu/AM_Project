/** Mensajes literales definidos en spec.md §4. */
export const MESSAGES = {
  requiredFields: 'Completa todos los campos obligatorios',
  titleLen: 'El título debe tener entre 3 y 80 caracteres',
  pricePositive: 'El precio debe ser un número entero mayor que cero',
  deliveryRange: 'El tiempo de entrega debe ser entre 1 y 365 días',
  descriptionLen: 'La descripción no puede superar los 1 000 caracteres',
  limitReached:
    'Alcanzaste el límite de 20 servicios. Elimina uno antes de crear otro',
  activeCommissions:
    'No puedes eliminar este servicio porque tiene comisiones activas',
  tosMin: 'Los términos de servicio deben tener al menos 10 caracteres',
  tosMax: 'Los términos de servicio no pueden superar los 5 000 caracteres',
  tosLen: 'Los términos de servicio deben tener al menos 10 caracteres',
  handleNotFound: 'No se encontró ningún artista con ese identificador',
  catalogEmpty: 'Este artista aún no tiene servicios disponibles',
  noTos: 'Este artista aún no ha publicado sus términos de servicio',
  noConnection: 'No se pudo conectar, reintente más tarde',
  notAnArtist: 'No se pudo completar la acción, inténtalo de nuevo',
  generic: 'No se pudo completar la acción, inténtalo de nuevo',
} as const;
