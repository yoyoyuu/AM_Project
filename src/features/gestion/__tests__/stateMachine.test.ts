import { applyTransition, getStageName } from '../stateMachine';

describe('applyTransition — ACCEPT', () => {
  it('transitions PENDIENTE to EN_PROGRESO with stage SKETCH', () => {
    const result = applyTransition('PENDIENTE', null, 'ACCEPT');
    expect(result).toEqual({ newStatus: 'EN_PROGRESO', newStage: 'SKETCH' });
  });

  it('throws when accepting a non-PENDIENTE commission', () => {
    expect(() => applyTransition('EN_PROGRESO', 'SKETCH', 'ACCEPT')).toThrow(
      'Esta comisión ya no puede ser aceptada',
    );
    expect(() => applyTransition('RECHAZADA', null, 'ACCEPT')).toThrow(
      'Esta comisión ya no puede ser aceptada',
    );
    expect(() => applyTransition('COMPLETADA', null, 'ACCEPT')).toThrow(
      'Esta comisión ya no puede ser aceptada',
    );
  });
});

describe('applyTransition — REJECT', () => {
  it('transitions PENDIENTE to RECHAZADA with no stage', () => {
    const result = applyTransition('PENDIENTE', null, 'REJECT');
    expect(result).toEqual({ newStatus: 'RECHAZADA', newStage: null });
  });

  it('throws when rejecting a non-PENDIENTE commission', () => {
    expect(() => applyTransition('EN_PROGRESO', 'SKETCH', 'REJECT')).toThrow(
      'Esta comisión ya no puede ser rechazada',
    );
  });
});

describe('applyTransition — ADVANCE_STAGE', () => {
  it('advances SKETCH to LINEART', () => {
    const result = applyTransition('EN_PROGRESO', 'SKETCH', 'ADVANCE_STAGE');
    expect(result).toEqual({ newStatus: 'EN_PROGRESO', newStage: 'LINEART' });
  });

  it('advances LINEART to FINAL', () => {
    const result = applyTransition('EN_PROGRESO', 'LINEART', 'ADVANCE_STAGE');
    expect(result).toEqual({ newStatus: 'EN_PROGRESO', newStage: 'FINAL' });
  });

  it('completing FINAL transitions to COMPLETADA with no stage', () => {
    const result = applyTransition('EN_PROGRESO', 'FINAL', 'ADVANCE_STAGE');
    expect(result).toEqual({ newStatus: 'COMPLETADA', newStage: null });
  });

  it('throws when advancing stage on a non-EN_PROGRESO commission', () => {
    expect(() => applyTransition('PENDIENTE', null, 'ADVANCE_STAGE')).toThrow(
      'Esta comisión ya no está en progreso',
    );
    expect(() => applyTransition('COMPLETADA', null, 'ADVANCE_STAGE')).toThrow(
      'Esta comisión ya no está en progreso',
    );
    expect(() => applyTransition('RECHAZADA', null, 'ADVANCE_STAGE')).toThrow(
      'Esta comisión ya no está en progreso',
    );
  });

  it('throws when stage is null while status is EN_PROGRESO (skip attempt)', () => {
    expect(() => applyTransition('EN_PROGRESO', null, 'ADVANCE_STAGE')).toThrow(
      'Debes completar la etapa actual antes de avanzar',
    );
  });
});

describe('getStageName', () => {
  it('returns "Boceto" for SKETCH', () => {
    expect(getStageName('SKETCH')).toBe('Boceto');
  });

  it('returns "Delineado" for LINEART', () => {
    expect(getStageName('LINEART')).toBe('Delineado');
  });

  it('returns "Color / Acabado final" for FINAL', () => {
    expect(getStageName('FINAL')).toBe('Color / Acabado final');
  });
});
