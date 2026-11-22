import type { Href } from 'expo-router';

export type PushTarget = 'artist_request' | 'artist_work' | 'client_tracking';

export interface PushData {
  commission_id: string;
  target: PushTarget;
  recipient_id: string;
}

const TARGETS: readonly PushTarget[] = ['artist_request', 'artist_work', 'client_tracking'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parsePushData(raw: unknown): PushData | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { commission_id, target, recipient_id } = raw as Record<string, unknown>;
  if (typeof commission_id !== 'string' || !UUID_RE.test(commission_id)) return null;
  if (typeof recipient_id !== 'string' || !UUID_RE.test(recipient_id)) return null;
  if (typeof target !== 'string' || !(TARGETS as readonly string[]).includes(target)) return null;
  return { commission_id, target: target as PushTarget, recipient_id };
}

/**
 * RF-28-A. Devuelve null si el aviso no es de la sesión actual (Escenario 8.26).
 * Rutas de las specs 004 (src/app/artist/commissions/[commissionId]/{index,work}.tsx)
 * y 005 (src/app/(tabs)/commissions/[commissionId].tsx).
 */
export function resolveNotificationRoute(data: PushData, currentUserId: string | null): Href | null {
  if (!currentUserId || data.recipient_id !== currentUserId) return null;
  const params = { commissionId: data.commission_id };
  switch (data.target) {
    case 'artist_request':
      return { pathname: '/artist/commissions/[commissionId]', params };
    case 'artist_work':
      return { pathname: '/artist/commissions/[commissionId]/work', params };
    case 'client_tracking':
      return { pathname: '/commissions/[commissionId]', params };
  }
}
