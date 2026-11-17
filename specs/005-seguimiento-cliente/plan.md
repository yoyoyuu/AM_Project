# Plan 005 — Seguimiento de Comisiones del Cliente

**Estado:** Borrador · **Versión:** 0.1 · **Fecha:** 2026-11-17
**Derivado de:** `005-spec.md`
**Constitución:** v1.1

> Este documento describe **cómo** se implementa la spec 005. Toda decisión técnica se deriva de los RF y RNF de la spec.

---

## 1. Visión general del flujo técnico

```
Cliente (React Native / Expo)
  │
  ├─ [Tab] Mis Comisiones  ──  MyCommissionsScreen
  │     ├─ Sección "En curso"    (status = EN_PROGRESO)
  │     ├─ Sección "Pendientes"  (status = PENDIENTE)
  │     └─ Sección "Finalizadas" (status IN COMPLETADA, RECHAZADA, CANCELADA)
  │           └─ Toca una tarjeta
  │
  └─ [Screen] CommissionTrackingDetailScreen
        ├─ Encabezado de estado + badge
        ├─ Stepper (SKETCH → LINEART → FINAL)  [solo si EN_PROGRESO o COMPLETADA]
        ├─ Bloque de rechazo + motivo            [solo si RECHAZADA]
        ├─ Datos del servicio contratado
        ├─ Datos del artista
        ├─ Detalles del encargo enviado
        └─ Galería de referencias (URL firmadas, 1 h)

Backend (Supabase)
  └─ SELECT commissions (READ ONLY)
       ├─ RLS: auth.uid() = client_id
       ├─ JOIN services, profiles (artista), commission_references
       └─ Sin ningún UPDATE / INSERT desde este módulo
```

---

## 2. Revisión del esquema de base de datos

### 2.1 Tablas utilizadas (sin modificaciones)

La Spec 005 es **exclusivamente de lectura**. No se crean tablas nuevas ni se alteran las existentes. Se utilizan tal como quedaron tras la migración 004:

| Tabla | Uso en esta spec |
|---|---|
| `public.commissions` | Fuente principal: estado, etapa, motivo de rechazo, fechas |
| `public.services` | JOIN para título, `base_price`, `estimated_days` |
| `public.profiles` | JOIN para `handle` y `display_name` del artista (`artist_id`) |
| `public.commission_references` | JOIN para rutas de almacenamiento de imágenes |

### 2.2 Índices recomendados

Los índices existentes tras la migración 004 cubren las necesidades del artista (filtro por `artist_id`). Se agregan dos índices para optimizar las consultas del cliente:

```sql
-- supabase/migrations/005_client_tracking_indexes.sql

-- Índice 1: búsqueda de todas las comisiones de un cliente, ordenadas por updated_at
-- Cubre la query principal de MyCommissionsScreen
CREATE INDEX IF NOT EXISTS idx_commissions_client_updated
  ON public.commissions (client_id, updated_at DESC);

-- Índice 2: búsqueda de comisiones de un cliente filtradas por status
-- Cubre la agrupación por secciones (En curso / Pendientes / Finalizadas)
CREATE INDEX IF NOT EXISTS idx_commissions_client_status
  ON public.commissions (client_id, status);
```

> **Nota:** el índice `idx_commissions_updated_at` creado en la migración 004 es un índice global sobre `updated_at`. Los nuevos índices compuestos con `client_id` como prefijo son más eficientes para las consultas filtradas por cliente, que son el 100 % de las consultas de este módulo.

### 2.3 Validación de políticas RLS de lectura para `client_id`

La política `SELECT` sobre `commissions` fue creada en la migración 003. Se verifica que cubra correctamente el acceso del cliente:

```sql
-- Política de SELECT existente (migración 003) — verificar que incluya client_id:
-- CREATE POLICY "commissions_select_parties"
--   ON public.commissions FOR SELECT
--   TO authenticated
--   USING (auth.uid() = client_id OR auth.uid() = artist_id);
--
-- Esta política ya permite al cliente leer sus propias comisiones.
-- No se requiere una política adicional para esta spec.
```

**Pruebas RLS para cliente (nuevas):**

```sql
-- supabase/tests/005_rls_client_test.sql

-- Prueba 1: cliente puede leer sus propias comisiones
SET LOCAL request.jwt.claims = '{"sub":"client-uuid-1","role":"authenticated"}';
SELECT id, status FROM public.commissions WHERE client_id = 'client-uuid-1';
-- Esperado: filas donde client_id = 'client-uuid-1'

-- Prueba 2: cliente NO puede leer comisiones de otro cliente
SET LOCAL request.jwt.claims = '{"sub":"client-uuid-2","role":"authenticated"}';
SELECT id FROM public.commissions WHERE client_id = 'client-uuid-1';
-- Esperado: 0 filas

-- Prueba 3: cliente NO puede actualizar su propia comisión
SET LOCAL request.jwt.claims = '{"sub":"client-uuid-1","role":"authenticated"}';
UPDATE public.commissions
  SET status = 'COMPLETADA'
  WHERE client_id = 'client-uuid-1';
-- Esperado: 0 filas actualizadas (RLS solo permite UPDATE al artist_id)

-- Prueba 4: tercero autenticado no ve ninguna comisión ajena
SET LOCAL request.jwt.claims = '{"sub":"stranger-uuid","role":"authenticated"}';
SELECT id FROM public.commissions
  WHERE client_id = 'client-uuid-1' OR artist_id = 'artist-uuid-1';
-- Esperado: 0 filas

-- Prueba 5: cliente puede leer comisiones rechazadas (incluyendo rejection_reason)
SET LOCAL request.jwt.claims = '{"sub":"client-uuid-1","role":"authenticated"}';
SELECT id, status, rejection_reason
  FROM public.commissions
  WHERE client_id = 'client-uuid-1' AND status = 'RECHAZADA';
-- Esperado: fila con rejection_reason (puede ser nulo o texto)

-- Prueba 6: cliente puede leer JOIN con services y profiles
SET LOCAL request.jwt.claims = '{"sub":"client-uuid-1","role":"authenticated"}';
SELECT c.id, s.title, p.handle
  FROM public.commissions c
  JOIN public.services s ON s.id = c.service_id
  JOIN public.profiles p ON p.id = c.artist_id
  WHERE c.client_id = 'client-uuid-1';
-- Esperado: filas propias del cliente con datos del servicio y del artista
```

---

## 3. Contratos TypeScript

### 3.1 Tipos de dominio reutilizados

Los tipos `CommissionStatus`, `CreativeStage` y `CREATIVE_STAGE_ORDER` definidos en `src/features/gestion/types.ts` (Spec 004) **no se duplican**. Se importan directamente desde ese módulo.

```typescript
// src/features/seguimiento/types.ts

// Re-exportar tipos compartidos desde el módulo de gestión (sin duplicar)
export type { CommissionStatus, CreativeStage } from '@/features/gestion/types';
export { CREATIVE_STAGE_ORDER } from '@/features/gestion/types';

// Vista enriquecida para el seguimiento del cliente (JOIN con service, artist profile y references)
export interface ClientCommissionSummary {
  id: string;
  status: import('@/features/gestion/types').CommissionStatus;
  current_stage: import('@/features/gestion/types').CreativeStage | null;
  rejection_reason: string | null;
  service_title: string;
  artist_handle: string;
  artist_display_name: string | null;
  updated_at: string;
  created_at: string;
}

export interface ClientCommissionDetail extends ClientCommissionSummary {
  // Datos del servicio
  service_base_price: number;
  service_estimated_days: number;
  // Datos del encargo
  description: string;
  intended_use: 'personal' | 'comercial';
  pose: string | null;
  key_elements: string | null;
  additional_notes: string | null;
  // Referencias
  references: CommissionReferenceView[];
}

export interface CommissionReferenceView {
  id: string;
  storage_path: string;
  signed_url: string | null; // generada en cliente, expira en 1 h
}

// Grupos de la pantalla principal
export interface CommissionGroups {
  active: ClientCommissionSummary[];    // EN_PROGRESO
  pending: ClientCommissionSummary[];   // PENDIENTE
  finished: ClientCommissionSummary[];  // COMPLETADA | RECHAZADA | CANCELADA
}
```

### 3.2 Mapeadores de presentación

```typescript
// src/features/seguimiento/presenters.ts

import type { CommissionStatus, CreativeStage } from './types';
import { CREATIVE_STAGE_ORDER } from './types';

// ─── Badges de estado ────────────────────────────────────────────────────────

export interface StatusBadgeConfig {
  label: string;
  colorKey: 'info' | 'warning' | 'success' | 'error' | 'neutral';
}

const STATUS_BADGE_MAP: Record<CommissionStatus, StatusBadgeConfig> = {
  PENDIENTE:   { label: 'Pendiente',  colorKey: 'warning' },
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

  if (diffMinutes < 1)   return 'justo ahora';
  if (diffMinutes < 60)  return `hace ${diffMinutes} min`;
  if (diffHours < 24)    return `hace ${diffHours} h`;
  if (diffDays === 1)    return 'ayer';
  if (diffDays < 7)      return `hace ${diffDays} días`;

  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

// ─── Agrupación de comisiones ────────────────────────────────────────────────

import type { ClientCommissionSummary, CommissionGroups } from './types';

export function groupCommissions(commissions: ClientCommissionSummary[]): CommissionGroups {
  const active:  ClientCommissionSummary[] = [];
  const pending: ClientCommissionSummary[] = [];
  const finished: ClientCommissionSummary[] = [];

  for (const c of commissions) {
    if (c.status === 'EN_PROGRESO') active.push(c);
    else if (c.status === 'PENDIENTE') pending.push(c);
    else finished.push(c);
  }

  // Ordenar cada grupo de más reciente a más antiguo (updated_at ya viene ordenado de Supabase,
  // pero se reordena aquí para garantizar el invariante en tests unitarios)
  const byUpdated = (a: ClientCommissionSummary, b: ClientCommissionSummary) =>
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();

  return {
    active:  active.sort(byUpdated),
    pending: pending.sort(byUpdated),
    finished: finished.sort(byUpdated),
  };
}
```

### 3.3 Hooks con TanStack Query

```typescript
// src/features/seguimiento/hooks/useMyCommissions.ts

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ClientCommissionSummary } from '../types';

/** Query key factory para las comisiones del cliente */
export const myCommissionsQueryKey = (clientId: string) =>
  ['commissions', 'client', clientId, 'list'] as const;

export function useMyCommissions(clientId: string) {
  return useQuery({
    queryKey: myCommissionsQueryKey(clientId),
    queryFn: async (): Promise<ClientCommissionSummary[]> => {
      const { data, error } = await supabase
        .from('commissions')
        .select(`
          id,
          status,
          current_stage,
          rejection_reason,
          updated_at,
          created_at,
          service:services!service_id (title),
          artist:profiles!artist_id (handle, display_name)
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Mapear la respuesta al tipo plano ClientCommissionSummary
      return (data ?? []).map((row: any) => ({
        id: row.id,
        status: row.status,
        current_stage: row.current_stage,
        rejection_reason: row.rejection_reason,
        updated_at: row.updated_at,
        created_at: row.created_at,
        service_title: row.service?.title ?? '',
        artist_handle: row.artist?.handle ?? '',
        artist_display_name: row.artist?.display_name ?? null,
      }));
    },
    staleTime: 1000 * 30, // 30 s — balance entre frescura y cuota de Supabase
    // refetchOnWindowFocus: true  (valor por defecto de TanStack Query, cubre RF-05-C)
  });
}
```

```typescript
// src/features/seguimiento/hooks/useCommissionTrackingDetail.ts

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ClientCommissionDetail, CommissionReferenceView } from '../types';

export const commissionTrackingDetailQueryKey = (commissionId: string) =>
  ['commissions', 'client', 'detail', commissionId] as const;

export function useCommissionTrackingDetail(commissionId: string) {
  return useQuery({
    queryKey: commissionTrackingDetailQueryKey(commissionId),
    queryFn: async (): Promise<ClientCommissionDetail> => {
      const { data, error } = await supabase
        .from('commissions')
        .select(`
          id,
          status,
          current_stage,
          rejection_reason,
          description,
          intended_use,
          pose,
          key_elements,
          additional_notes,
          updated_at,
          created_at,
          service:services!service_id (title, base_price, estimated_days),
          artist:profiles!artist_id (handle, display_name),
          references:commission_references (id, storage_path)
        `)
        .eq('id', commissionId)
        .single();

      if (error) throw error;

      // Generar URLs firmadas para las referencias (expiración 1 h)
      const refsWithUrls: CommissionReferenceView[] = await Promise.all(
        ((data as any).references ?? []).map(async (ref: { id: string; storage_path: string }) => {
          const { data: signed } = await supabase.storage
            .from('commission-references')
            .createSignedUrl(ref.storage_path, 3600);
          return { id: ref.id, storage_path: ref.storage_path, signed_url: signed?.signedUrl ?? null };
        }),
      );

      const row = data as any;
      return {
        id: row.id,
        status: row.status,
        current_stage: row.current_stage,
        rejection_reason: row.rejection_reason,
        updated_at: row.updated_at,
        created_at: row.created_at,
        service_title: row.service?.title ?? '',
        service_base_price: row.service?.base_price ?? 0,
        service_estimated_days: row.service?.estimated_days ?? 0,
        artist_handle: row.artist?.handle ?? '',
        artist_display_name: row.artist?.display_name ?? null,
        description: row.description,
        intended_use: row.intended_use,
        pose: row.pose,
        key_elements: row.key_elements,
        additional_notes: row.additional_notes,
        references: refsWithUrls,
      };
    },
    staleTime: 1000 * 30,
  });
}
```

**Estrategia de invalidación:** este módulo es de **solo lectura**. No ejecuta mutaciones, por lo que no invalida queries activamente. La frescura de los datos se mantiene por:
1. `refetchOnWindowFocus: true` (defecto de TanStack Query) — se revalida al volver a la pantalla (RF-05-C).
2. `staleTime: 30 s` — tras 30 segundos, la siguiente visita a la pantalla provoca un re-fetch en segundo plano.
3. Pull-to-refresh — llama explícitamente a `refetch()` del hook de lista (RF-05-C).

---

## 4. Estructura de pantallas en Expo Router

```
src/app/
└── (tabs)/
    └── commissions/
        ├── index.tsx                    # Tab "Mis Comisiones" → MyCommissionsScreen
        └── [commissionId].tsx           # Detalle de seguimiento → CommissionTrackingDetailScreen

src/features/seguimiento/
├── screens/
│   ├── MyCommissionsScreen.tsx          # RF-05-A: lista agrupada por estado
│   └── CommissionTrackingDetailScreen.tsx # RF-05-B: detalle + stepper + bloque de rechazo
├── components/
│   ├── CommissionCard.tsx               # Tarjeta de resumen en la lista
│   ├── CommissionStatusBadge.tsx        # Chip de estado (reutilizable con gestion/)
│   ├── CommissionsGroupSection.tsx      # Sección (encabezado + lista de tarjetas)
│   ├── CommissionsEmptyState.tsx        # Estado vacío con CTA "Explorar artistas"
│   ├── CreativeStepper.tsx              # Indicador visual de etapas (3 pasos)
│   ├── RejectionBlock.tsx               # Bloque de rechazo con motivo
│   ├── CommissionDetailSkeleton.tsx     # Skeleton de carga para el detalle
│   └── CommissionListSkeleton.tsx       # Skeleton de carga para la lista
├── hooks/
│   ├── useMyCommissions.ts              # Query: lista de comisiones del cliente
│   └── useCommissionTrackingDetail.ts   # Query: detalle con referencias firmadas
├── presenters.ts                        # Mapeadores: badges, stepper, fechas, agrupación
└── types.ts                             # Tipos: ClientCommissionSummary, Detail, etc.

supabase/
├── migrations/
│   └── 005_client_tracking_indexes.sql  # Índices compuestos (client_id, updated_at / status)
└── tests/
    └── 005_rls_client_test.sql          # Pruebas de acceso del cliente
```

---

## 5. Notas de rendimiento y cuota gratuita

| Recurso | Consideración |
|---|---|
| Consulta de lista | Un `SELECT` con dos JOINs (services, profiles) + filtro por `client_id` vía RLS. El índice `idx_commissions_client_updated` cubre el 100 % de este acceso. |
| Consulta de detalle | Un `SELECT` con tres JOINs (services, profiles, commission_references) + `.single()`. Acceso puntual por `id`; el índice PK lo resuelve en O(1). |
| URLs firmadas | Generadas al abrir el detalle. Expiración de 1 h. No se cachean en disco para evitar leaks de contenido tras cerrar sesión. |
| `staleTime` de 30 s | El cliente no necesita datos en tiempo real. 30 s de cache reduce peticiones a Supabase en un 90 % en uso típico (el artista actualiza etapas con minutos de diferencia, no segundos). |
| Pull-to-refresh | Controlado por el usuario; no hay polling automático. |
| Skeletons | Se muestran mientras `isLoading = true`. Evitan parpadeos de contenido vacío y mejoran la percepción de velocidad. |

---

## 6. Decisiones técnicas

| ID | Tema | Decisión |
|---|---|---|
| DT-5.1 | Reutilización de tipos de Spec 004 | `CommissionStatus`, `CreativeStage` y `CREATIVE_STAGE_ORDER` se importan desde `src/features/gestion/types.ts`. No se duplican. Facilita la consistencia y reduce la superficie de bugs. |
| DT-5.2 | Mapeadores en `presenters.ts` | Toda la lógica de presentación (colores, etiquetas, stepper, fechas relativas, agrupación) se centraliza en funciones puras y testeables, desacopladas de los componentes UI. |
| DT-5.3 | Sin mutaciones desde este módulo | El módulo no ejecuta ningún UPDATE. Las queries son de solo lectura. No se necesita `useMutation` ni invalidación activa. |
| DT-5.4 | Índices compuestos `(client_id, updated_at)` y `(client_id, status)` | La query principal filtra por `client_id` (RLS implícito) y ordena por `updated_at`. Un índice compuesto es más eficiente que dos índices simples para este patrón. |
| DT-5.5 | `CommissionStatusBadge` como componente compartido | El badge de estado se usa tanto en este módulo (seguimiento del cliente) como en el módulo de gestión del artista (Spec 004). Se ubica en `src/features/seguimiento/components/` pero puede moverse a `src/components/shared/` si más módulos lo requieren. |
| DT-5.6 | Rutas en `(tabs)/commissions/` | La pantalla de lista es una pestaña principal del cliente. La ruta de detalle `[commissionId]` es una pantalla anidada que usa el parámetro `commissionId` como clave para el hook de detalle. |