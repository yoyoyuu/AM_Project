/**
 * Tests de lógica para CommissionStatusBadge.
 * El preset jest-expo/node no monta React Native, por lo que se valida
 * la capa de datos (presenter) que el componente consume, en lugar del render.
 * Los colores y etiquetas visuales están cubiertos en presenters.test.ts.
 */
import { getStatusBadge } from '../presenters';
import type { CommissionStatus } from '../types';

const ALL_STATUSES: CommissionStatus[] = [
  'PENDIENTE',
  'EN_PROGRESO',
  'COMPLETADA',
  'RECHAZADA',
  'CANCELADA',
  'EN_REVISION',
];

const VALID_COLOR_KEYS = ['info', 'warning', 'success', 'error', 'neutral'];

describe('CommissionStatusBadge — datos del presenter', () => {
  it.each(ALL_STATUSES)('status %s tiene label no vacío', (status) => {
    const { label } = getStatusBadge(status);
    expect(label).toBeTruthy();
  });

  it.each(ALL_STATUSES)('status %s tiene colorKey válido para COLOR_MAP', (status) => {
    const { colorKey } = getStatusBadge(status);
    expect(VALID_COLOR_KEYS).toContain(colorKey);
  });

  it('cubre los 6 estados definidos en CommissionStatus', () => {
    expect(ALL_STATUSES).toHaveLength(6);
    ALL_STATUSES.forEach((status) => {
      expect(() => getStatusBadge(status)).not.toThrow();
    });
  });
});
