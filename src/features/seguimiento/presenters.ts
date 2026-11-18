import { CREATIVE_STAGE_ORDER } from './types';
import type { CommissionStatus, CreativeStage, ClientCommissionSummary, CommissionGroups } from './types';

// ─── Badges de estado ────────────────────────────────────────────────────────

export interface StatusBadgeConfig {
  label: string;
  colorKey: 'info' | 'warning' | 'success' | 'error' | 'neutral';
}

const STATUS_BADGE_MAP: Record<CommissionStatus, StatusBadgeConfig> = {
  PENDIENTE:   { label: 'Pendiente',   colorKey: 'warning' },
  EN_PROGRESO: { label: 'En progreso', colorKey: 'info'    },
  COMPLETADA:  { label: 'Completada',  colorKey: 'success' },
  RECHAZADA:   { label: 'Rechazada',   colorKey: 'error'   },
  CANCELADA:   { label: 'Cancelada',   colorKey: 'neutral' },
  EN_REVISION: { label: 'En revisión', colorKey: 'warning' },
};

export function getStatusBadge(status: CommissionStatus): StatusBadgeConfig {
  return STATUS_BADGE_MAP[status];
}

// ─── Etapas creativas ────────────────────────────────────────────────────────

export type StepState = 'completed' | 'active' | 'pending';

export interface StepConfig {
  code: CreativeStage;
  label: string;
  description: string;
  state: StepState;
}

const STAGE_META: Record<CreativeStage, { label: string; description: string }> = {
  SKETCH:  { label: 'Boceto',                description: 'El artista está trabajando en el boceto inicial.' },
  LINEART: { label: 'Delineado',             description: 'El artista está refinando los trazos y el delineado.' },
  FINAL:   { label: 'Color / Acabado final', description: 'El artista está aplicando color y los acabados finales.' },
};

/**
 * Genera la configuración visual de los 3 pasos del stepper.
 * - status = EN_PROGRESO: estado real según current_stage
 * - status = COMPLETADA:  las tres etapas se muestran como completadas
 * - cualquier otro:       todas las etapas en 'pending' (stepper inactivo)
 */
export function buildStepperConfig(
  status: CommissionStatus,
  currentStage: CreativeStage | null,
): StepConfig[] {
  return CREATIVE_STAGE_ORDER.map((code, index) => {
    const meta = STAGE_META[code];
    let state: StepState = 'pending';

    if (status === 'COMPLETADA') {
      state = 'completed';
    } else if (status === 'EN_PROGRESO' && currentStage !== null) {
      const currentIndex = CREATIVE_STAGE_ORDER.indexOf(currentStage);
      if (index < currentIndex) state = 'completed';
      else if (index === currentIndex) state = 'active';
      else state = 'pending';
    }

    return { code, label: meta.label, description: meta.description, state };
  });
}

// ─── Fechas relativas ────────────────────────────────────────────────────────

/**
 * Formatea una fecha ISO como texto relativo legible en español.
 * Ej: "hace 2 horas", "ayer", "15 nov"
 */
export function formatRelativeDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1)  return 'justo ahora';
  if (diffMinutes < 60) return `hace ${diffMinutes} min`;
  if (diffHours < 24)   return `hace ${diffHours} h`;
  if (diffDays === 1)   return 'ayer';
  if (diffDays < 7)     return `hace ${diffDays} días`;

  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

// ─── Agrupación de comisiones ────────────────────────────────────────────────

export function groupCommissions(commissions: ClientCommissionSummary[]): CommissionGroups {
  const active:   ClientCommissionSummary[] = [];
  const pending:  ClientCommissionSummary[] = [];
  const finished: ClientCommissionSummary[] = [];

  for (const c of commissions) {
    if (c.status === 'EN_PROGRESO') active.push(c);
    else if (c.status === 'PENDIENTE') pending.push(c);
    else finished.push(c);
  }

  const byUpdated = (a: ClientCommissionSummary, b: ClientCommissionSummary) =>
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();

  return {
    active:  active.sort(byUpdated),
    pending: pending.sort(byUpdated),
    finished: finished.sort(byUpdated),
  };
}
