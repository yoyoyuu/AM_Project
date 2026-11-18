import {
  getStatusBadge,
  buildStepperConfig,
  formatRelativeDate,
  groupCommissions,
} from '../presenters';
import type { ClientCommissionSummary } from '../types';

// ─── getStatusBadge ───────────────────────────────────────────────────────────

describe('getStatusBadge', () => {
  it('returns correct label and colorKey for PENDIENTE', () => {
    expect(getStatusBadge('PENDIENTE')).toEqual({ label: 'Pendiente', colorKey: 'warning' });
  });

  it('returns correct label and colorKey for EN_PROGRESO', () => {
    expect(getStatusBadge('EN_PROGRESO')).toEqual({ label: 'En progreso', colorKey: 'info' });
  });

  it('returns correct label and colorKey for COMPLETADA', () => {
    expect(getStatusBadge('COMPLETADA')).toEqual({ label: 'Completada', colorKey: 'success' });
  });

  it('returns correct label and colorKey for RECHAZADA', () => {
    expect(getStatusBadge('RECHAZADA')).toEqual({ label: 'Rechazada', colorKey: 'error' });
  });

  it('returns correct label and colorKey for CANCELADA', () => {
    expect(getStatusBadge('CANCELADA')).toEqual({ label: 'Cancelada', colorKey: 'neutral' });
  });

  it('returns correct label and colorKey for EN_REVISION', () => {
    expect(getStatusBadge('EN_REVISION')).toEqual({ label: 'En revisión', colorKey: 'warning' });
  });
});

// ─── buildStepperConfig ───────────────────────────────────────────────────────

describe('buildStepperConfig — EN_PROGRESO', () => {
  it('SKETCH: first step active, rest pending', () => {
    const steps = buildStepperConfig('EN_PROGRESO', 'SKETCH');
    expect(steps[0].state).toBe('active');
    expect(steps[1].state).toBe('pending');
    expect(steps[2].state).toBe('pending');
  });

  it('LINEART: first step completed, second active, third pending', () => {
    const steps = buildStepperConfig('EN_PROGRESO', 'LINEART');
    expect(steps[0].state).toBe('completed');
    expect(steps[1].state).toBe('active');
    expect(steps[2].state).toBe('pending');
  });

  it('FINAL: first two completed, last active', () => {
    const steps = buildStepperConfig('EN_PROGRESO', 'FINAL');
    expect(steps[0].state).toBe('completed');
    expect(steps[1].state).toBe('completed');
    expect(steps[2].state).toBe('active');
  });

  it('null stage: all pending', () => {
    const steps = buildStepperConfig('EN_PROGRESO', null);
    expect(steps.every((s) => s.state === 'pending')).toBe(true);
  });
});

describe('buildStepperConfig — COMPLETADA', () => {
  it('all three steps are completed regardless of current_stage', () => {
    const steps = buildStepperConfig('COMPLETADA', null);
    expect(steps.every((s) => s.state === 'completed')).toBe(true);
  });
});

describe('buildStepperConfig — inactive statuses', () => {
  it('PENDIENTE: all steps pending', () => {
    const steps = buildStepperConfig('PENDIENTE', null);
    expect(steps.every((s) => s.state === 'pending')).toBe(true);
  });

  it('RECHAZADA: all steps pending', () => {
    const steps = buildStepperConfig('RECHAZADA', null);
    expect(steps.every((s) => s.state === 'pending')).toBe(true);
  });

  it('CANCELADA: all steps pending', () => {
    const steps = buildStepperConfig('CANCELADA', null);
    expect(steps.every((s) => s.state === 'pending')).toBe(true);
  });
});

describe('buildStepperConfig — labels', () => {
  it('step codes and labels match spec order', () => {
    const steps = buildStepperConfig('PENDIENTE', null);
    expect(steps[0].code).toBe('SKETCH');
    expect(steps[0].label).toBe('Boceto');
    expect(steps[1].code).toBe('LINEART');
    expect(steps[1].label).toBe('Delineado');
    expect(steps[2].code).toBe('FINAL');
    expect(steps[2].label).toBe('Color / Acabado final');
  });
});

// ─── formatRelativeDate ───────────────────────────────────────────────────────

describe('formatRelativeDate', () => {
  const NOW = new Date('2026-11-17T12:00:00.000Z');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns "justo ahora" for < 1 minute ago', () => {
    const date = new Date(NOW.getTime() - 30_000).toISOString();
    expect(formatRelativeDate(date)).toBe('justo ahora');
  });

  it('returns "hace X min" for < 1 hour ago', () => {
    const date = new Date(NOW.getTime() - 20 * 60_000).toISOString();
    expect(formatRelativeDate(date)).toBe('hace 20 min');
  });

  it('returns "hace X h" for < 24 hours ago', () => {
    const date = new Date(NOW.getTime() - 3 * 60 * 60_000).toISOString();
    expect(formatRelativeDate(date)).toBe('hace 3 h');
  });

  it('returns "ayer" for exactly 1 day ago', () => {
    const date = new Date(NOW.getTime() - 25 * 60 * 60_000).toISOString();
    expect(formatRelativeDate(date)).toBe('ayer');
  });

  it('returns "hace X días" for 2–6 days ago', () => {
    const date = new Date(NOW.getTime() - 3 * 24 * 60 * 60_000).toISOString();
    expect(formatRelativeDate(date)).toBe('hace 3 días');
  });

  it('returns formatted date for > 7 days ago', () => {
    const date = new Date(NOW.getTime() - 10 * 24 * 60 * 60_000).toISOString();
    const result = formatRelativeDate(date);
    // Should be a formatted date string, not a relative phrase
    expect(result).not.toMatch(/^hace/);
    expect(result).not.toBe('ayer');
    expect(result).not.toBe('justo ahora');
  });
});

// ─── groupCommissions ─────────────────────────────────────────────────────────

function makeCommission(
  overrides: Partial<ClientCommissionSummary> & { id: string; status: ClientCommissionSummary['status']; updated_at: string },
): ClientCommissionSummary {
  return {
    current_stage: null,
    rejection_reason: null,
    service_title: 'Servicio test',
    artist_handle: '@artista',
    artist_display_name: null,
    created_at: overrides.updated_at,
    ...overrides,
  };
}

describe('groupCommissions — empty', () => {
  it('returns three empty arrays for an empty input', () => {
    const result = groupCommissions([]);
    expect(result.active).toHaveLength(0);
    expect(result.pending).toHaveLength(0);
    expect(result.finished).toHaveLength(0);
  });
});

describe('groupCommissions — only active', () => {
  it('places EN_PROGRESO commissions in active', () => {
    const c = makeCommission({ id: '1', status: 'EN_PROGRESO', updated_at: '2026-11-17T10:00:00Z' });
    const result = groupCommissions([c]);
    expect(result.active).toHaveLength(1);
    expect(result.pending).toHaveLength(0);
    expect(result.finished).toHaveLength(0);
  });
});

describe('groupCommissions — mixed statuses', () => {
  it('separates EN_PROGRESO, PENDIENTE, COMPLETADA, RECHAZADA, CANCELADA correctly', () => {
    const commissions = [
      makeCommission({ id: '1', status: 'EN_PROGRESO', updated_at: '2026-11-17T10:00:00Z' }),
      makeCommission({ id: '2', status: 'PENDIENTE',   updated_at: '2026-11-16T10:00:00Z' }),
      makeCommission({ id: '3', status: 'COMPLETADA',  updated_at: '2026-11-15T10:00:00Z' }),
      makeCommission({ id: '4', status: 'RECHAZADA',   updated_at: '2026-11-14T10:00:00Z' }),
      makeCommission({ id: '5', status: 'CANCELADA',   updated_at: '2026-11-13T10:00:00Z' }),
    ];
    const result = groupCommissions(commissions);
    expect(result.active).toHaveLength(1);
    expect(result.pending).toHaveLength(1);
    expect(result.finished).toHaveLength(3);
  });

  it('sorts each group by updated_at descending', () => {
    const commissions = [
      makeCommission({ id: 'old', status: 'PENDIENTE', updated_at: '2026-11-10T00:00:00Z' }),
      makeCommission({ id: 'new', status: 'PENDIENTE', updated_at: '2026-11-17T00:00:00Z' }),
    ];
    const result = groupCommissions(commissions);
    expect(result.pending[0].id).toBe('new');
    expect(result.pending[1].id).toBe('old');
  });
});
