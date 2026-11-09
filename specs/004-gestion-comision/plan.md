# Plan 004 — Gestión de comisión
 
**Estado:** Borrador · **Versión:** 0.1 · **Fecha:** 2026-11-08
**Derivado de:** `004-spec.md`
**Constitución:** v1.1
 
> Este documento describe **cómo** se implementa la spec 004. Toda decisión técnica se deriva de los RF y RNF de la spec.
 
---
 
## 1. Visión general del flujo técnico
 
```
Artista (React Native / Expo)
  │
  ├─ [Tab] Panel de Gestión
  │     └─ Lista de comisiones PENDIENTE (RF-07-A)
  │           └─ Toca una solicitud
  │
  ├─ [Screen] CommissionDetailScreen (RF-07-B)
  │     ├─ Resumen del servicio (precio base, tiempo estimado)
  │     ├─ Datos de la solicitud (descripción, uso previsto, campos opcionales)
  │     ├─ Galería de referencias (URL firmadas, 1 h de expiración)
  │     ├─ Botón "Aceptar comisión" → RF-07-C
  │     └─ Botón "Rechazar comisión" → RF-07-D
  │
  ├─ [Screen] CommissionWorkScreen (RF-07-E)
  │     ├─ Estado: EN_PROGRESO
  │     ├─ Etapa actual: SKETCH | LINEART | FINAL
  │     ├─ Indicador de progreso (3 pasos)
  │     └─ Botón "Completar etapa" → avanza la máquina de estados
  │
  └─ [Screen] CommissionCompletedScreen
        └─ Estado: COMPLETADA (terminal)
 
Backend (Supabase)
  ├─ UPDATE commissions SET status, current_stage, rejection_reason, updated_at
  ├─ RLS: solo el artist_id coincidente puede ejecutar UPDATE
  └─ [Futuro - spec 008] Trigger / Edge Function para push al cliente
```
 
---
 
## 2. Esquema de base de datos
 
### 2.1 Tipos ENUM de Postgres
 
```sql
-- Tipo de estado de la comisión (todos los estados del ciclo de vida)
CREATE TYPE public.commission_status AS ENUM (
  'PENDIENTE',
  'EN_PROGRESO',
  'RECHAZADA',
  'COMPLETADA',
  'CANCELADA',
  'EN_REVISION'
);
 
-- Tipo de etapa creativa (secuencia estandarizada)
CREATE TYPE public.creative_stage AS ENUM (
  'SKETCH',
  'LINEART',
  'FINAL'
);
```
 
> **Nota:** los ENUMs se crean en la migración 004. La migración 003 usó un `CHECK` de texto para `status`; la migración 004 convierte esa columna al tipo ENUM. Usar ENUM en Postgres garantiza validación a nivel de motor sin posibilidad de insertar valores no declarados.
 
### 2.2 Migración de la tabla `commissions`
 
La tabla `commissions` fue creada en la migración 003 con `status text NOT NULL`. Esta migración:
1. Convierte `status` al tipo ENUM `commission_status`.
2. Agrega las columnas `current_stage`, `rejection_reason` y `updated_at`.
3. Agrega un trigger para actualizar `updated_at` automáticamente.
```sql
-- supabase/migrations/004_commission_management.sql
 
-- 1. Crear los tipos ENUM
CREATE TYPE public.commission_status AS ENUM (
  'PENDIENTE',
  'EN_PROGRESO',
  'RECHAZADA',
  'COMPLETADA',
  'CANCELADA',
  'EN_REVISION'
);
 
CREATE TYPE public.creative_stage AS ENUM (
  'SKETCH',
  'LINEART',
  'FINAL'
);
 
-- 2. Convertir la columna status de text a ENUM
ALTER TABLE public.commissions
  ALTER COLUMN status DROP DEFAULT;
 
ALTER TABLE public.commissions
  ALTER COLUMN status TYPE public.commission_status
  USING status::public.commission_status;
 
ALTER TABLE public.commissions
  ALTER COLUMN status SET DEFAULT 'PENDIENTE';
 
-- Eliminar el CHECK de texto que ya no aplica (reemplazado por el ENUM)
ALTER TABLE public.commissions
  DROP CONSTRAINT IF EXISTS commissions_status_check;
 
-- 3. Agregar columnas de gestión
ALTER TABLE public.commissions
  ADD COLUMN current_stage     public.creative_stage  NULL,
  ADD COLUMN rejection_reason  text                   NULL
    CONSTRAINT rejection_reason_length CHECK (char_length(rejection_reason) <= 500),
  ADD COLUMN updated_at        timestamptz            NOT NULL DEFAULT now();
 
-- 4. Índice en updated_at para ordenar eficientemente
CREATE INDEX idx_commissions_updated_at ON public.commissions (updated_at DESC);
 
-- 5. Trigger para updated_at automático
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
 
CREATE TRIGGER commissions_set_updated_at
  BEFORE UPDATE ON public.commissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```
 
### 2.3 Estado resultante de la tabla `commissions`
 
```sql
-- Vista completa de la tabla tras las migraciones 003 y 004
CREATE TABLE public.commissions (
  id               uuid                     PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        uuid                     NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  artist_id        uuid                     NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  service_id       uuid                     NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  status           public.commission_status NOT NULL DEFAULT 'PENDIENTE',
  current_stage    public.creative_stage    NULL,         -- NULL cuando no está EN_PROGRESO
  rejection_reason text                     NULL
    CONSTRAINT rejection_reason_length CHECK (char_length(rejection_reason) <= 500),
  description      text                     NOT NULL CHECK (char_length(description) BETWEEN 20 AND 2000),
  pose             text                     CHECK (char_length(pose) <= 500),
  key_elements     text                     CHECK (char_length(key_elements) <= 500),
  intended_use     text                     NOT NULL CHECK (intended_use IN ('personal','comercial')),
  additional_notes text                     CHECK (char_length(additional_notes) <= 500),
  terms_accepted_at timestamptz             NULL,
  created_at       timestamptz              NOT NULL DEFAULT now(),
  updated_at       timestamptz              NOT NULL DEFAULT now(),
  CONSTRAINT client_ne_artist CHECK (client_id <> artist_id)
);
```
 
### 2.4 Restricciones de transición de estado (nivel aplicación)
 
Las transiciones se validan en el cliente (TypeScript) y se refuerzan en las políticas RLS. No se implementa una función de base de datos para validar la máquina de estados en el MVP (simplicidad, Principio 11); la validación doble cliente + RLS es suficiente.
 
| Acción | Condición requerida (`status` actual) | `status` resultante | `current_stage` resultante |
|---|---|---|---|
| Aceptar | `PENDIENTE` | `EN_PROGRESO` | `SKETCH` |
| Rechazar | `PENDIENTE` | `RECHAZADA` | `NULL` |
| Avanzar de SKETCH | `EN_PROGRESO`, `current_stage = SKETCH` | `EN_PROGRESO` | `LINEART` |
| Avanzar de LINEART | `EN_PROGRESO`, `current_stage = LINEART` | `EN_PROGRESO` | `FINAL` |
| Completar FINAL | `EN_PROGRESO`, `current_stage = FINAL` | `COMPLETADA` | `NULL` |
 
---
 
## 3. Políticas RLS
 
RLS ya está habilitado en `commissions` (migración 003). Esta migración refina las políticas existentes.
 
```sql
-- Eliminar la política de UPDATE genérica de la migración 003
DROP POLICY IF EXISTS "commissions_update_artist" ON public.commissions;
 
-- Política de UPDATE refinada: solo el artista propietario puede actualizar
-- Solo los campos de gestión son modificables por el artista
-- (el cliente nunca ejecuta UPDATE en esta spec ni en la spec 003)
CREATE POLICY "commissions_update_artist_only"
  ON public.commissions FOR UPDATE
  TO authenticated
  USING  (auth.uid() = artist_id)
  WITH CHECK (
    auth.uid() = artist_id
    -- Garantizar que artist_id y client_id no cambian en un UPDATE
    AND artist_id = artist_id
    AND client_id = client_id
  );
 
-- La política SELECT de la migración 003 ya permite al artista leer sus comisiones.
-- No se requieren políticas adicionales de SELECT.
 
-- Resumen de políticas activas tras esta migración:
-- INSERT: solo el cliente puede crear (política de migración 003, sin cambios)
-- SELECT: cliente o artista de la comisión (política de migración 003, sin cambios)
-- UPDATE: solo el artista propietario (reemplazada en esta migración)
-- DELETE: denegado (sin política, RLS deniega por defecto)
```
 
### 3.1 Pruebas RLS para las nuevas políticas
 
```sql
-- supabase/tests/004_rls_test.sql
 
-- Prueba 1: artista puede leer sus propias comisiones pendientes
SET LOCAL request.jwt.claims = '{"sub":"artist-uuid-1","role":"authenticated"}';
SELECT * FROM public.commissions WHERE artist_id = 'artist-uuid-1' AND status = 'PENDIENTE';
-- Esperado: filas propias del artista
 
-- Prueba 2: artista NO puede leer comisiones de otro artista
SET LOCAL request.jwt.claims = '{"sub":"artist-uuid-2","role":"authenticated"}';
SELECT * FROM public.commissions WHERE artist_id = 'artist-uuid-1';
-- Esperado: 0 filas
 
-- Prueba 3: artista puede actualizar status de su comisión (aceptar)
SET LOCAL request.jwt.claims = '{"sub":"artist-uuid-1","role":"authenticated"}';
UPDATE public.commissions
  SET status = 'EN_PROGRESO', current_stage = 'SKETCH'
  WHERE id = 'commission-uuid-1' AND artist_id = 'artist-uuid-1';
-- Esperado: 1 fila actualizada
 
-- Prueba 4: artista NO puede actualizar comisión ajena
SET LOCAL request.jwt.claims = '{"sub":"artist-uuid-2","role":"authenticated"}';
UPDATE public.commissions
  SET status = 'EN_PROGRESO'
  WHERE id = 'commission-uuid-1';
-- Esperado: 0 filas actualizadas (RLS filtra)
 
-- Prueba 5: cliente NO puede actualizar el status de la comisión
SET LOCAL request.jwt.claims = '{"sub":"client-uuid-1","role":"authenticated"}';
UPDATE public.commissions
  SET status = 'COMPLETADA'
  WHERE id = 'commission-uuid-1';
-- Esperado: 0 filas actualizadas (RLS filtra, el cliente no cumple USING)
 
-- Prueba 6: tercero NO puede actualizar ninguna comisión
SET LOCAL request.jwt.claims = '{"sub":"stranger-uuid","role":"authenticated"}';
UPDATE public.commissions
  SET status = 'RECHAZADA'
  WHERE id = 'commission-uuid-1';
-- Esperado: 0 filas actualizadas
 
-- Prueba 7: rechazo con motivo válido
SET LOCAL request.jwt.claims = '{"sub":"artist-uuid-1","role":"authenticated"}';
UPDATE public.commissions
  SET status = 'RECHAZADA', rejection_reason = 'No tengo capacidad esta semana'
  WHERE id = 'commission-uuid-2' AND artist_id = 'artist-uuid-1' AND status = 'PENDIENTE';
-- Esperado: 1 fila actualizada
 
-- Prueba 8: rejection_reason supera 500 caracteres (CHECK constraint)
SET LOCAL request.jwt.claims = '{"sub":"artist-uuid-1","role":"authenticated"}';
UPDATE public.commissions
  SET rejection_reason = repeat('x', 501)
  WHERE id = 'commission-uuid-2';
-- Esperado: error de CHECK constraint
```
 
---
 
## 4. Contratos TypeScript
 
### 4.1 Tipos de dominio extendidos
 
```typescript
// src/features/gestion/types.ts
 
export type CommissionStatus =
  | 'PENDIENTE'
  | 'EN_PROGRESO'
  | 'RECHAZADA'
  | 'COMPLETADA'
  | 'CANCELADA'
  | 'EN_REVISION';
 
export type CreativeStage = 'SKETCH' | 'LINEART' | 'FINAL';
 
// Orden canónico de las etapas para validar transiciones
export const CREATIVE_STAGE_ORDER: CreativeStage[] = ['SKETCH', 'LINEART', 'FINAL'];
 
export interface Commission {
  id: string;
  client_id: string;
  artist_id: string;
  service_id: string;
  status: CommissionStatus;
  current_stage: CreativeStage | null;
  rejection_reason: string | null;
  description: string;
  pose: string | null;
  key_elements: string | null;
  intended_use: 'personal' | 'comercial';
  additional_notes: string | null;
  terms_accepted_at: string | null;
  created_at: string;
  updated_at: string;
}
 
// Vista enriquecida para el panel del artista (JOIN con service y profile del cliente)
export interface CommissionWithDetails extends Commission {
  service: {
    title: string;
    base_price: number;
    estimated_days: number;
  };
  client_profile: {
    handle: string;
    display_name: string | null;
  };
  references: CommissionReference[];
}
 
export interface CommissionReference {
  id: string;
  commission_id: string;
  storage_path: string;
  file_size: number;
  signed_url: string | null; // generada en el cliente, expira en 1 h
}
```
 
### 4.2 Máquina de estados estricta
 
```typescript
// src/features/gestion/stateMachine.ts
 
import type { CommissionStatus, CreativeStage } from './types';
import { CREATIVE_STAGE_ORDER } from './types';
 
export type CommissionAction =
  | 'ACCEPT'
  | 'REJECT'
  | 'ADVANCE_STAGE';
 
export interface TransitionResult {
  newStatus: CommissionStatus;
  newStage: CreativeStage | null;
}
 
/**
 * Calcula el resultado de una transición.
 * Lanza un error si la transición no es válida.
 * Esta función es pura (sin efectos secundarios) y testeable de forma aislada.
 */
export function applyTransition(
  currentStatus: CommissionStatus,
  currentStage: CreativeStage | null,
  action: CommissionAction,
): TransitionResult {
  switch (action) {
    case 'ACCEPT': {
      if (currentStatus !== 'PENDIENTE') {
        throw new Error('Esta comisión ya no puede ser aceptada');
      }
      return { newStatus: 'EN_PROGRESO', newStage: 'SKETCH' };
    }
 
    case 'REJECT': {
      if (currentStatus !== 'PENDIENTE') {
        throw new Error('Esta comisión ya no puede ser rechazada');
      }
      return { newStatus: 'RECHAZADA', newStage: null };
    }
 
    case 'ADVANCE_STAGE': {
      if (currentStatus !== 'EN_PROGRESO') {
        throw new Error('Esta comisión ya no está en progreso');
      }
      if (currentStage === null) {
        throw new Error('Debes completar la etapa actual antes de avanzar');
      }
 
      const currentIndex = CREATIVE_STAGE_ORDER.indexOf(currentStage);
      const isLastStage = currentIndex === CREATIVE_STAGE_ORDER.length - 1;
 
      if (isLastStage) {
        return { newStatus: 'COMPLETADA', newStage: null };
      }
 
      const nextStage = CREATIVE_STAGE_ORDER[currentIndex + 1];
      return { newStatus: 'EN_PROGRESO', newStage: nextStage };
    }
 
    default: {
      const _exhaustive: never = action;
      throw new Error(`Acción desconocida: ${_exhaustive}`);
    }
  }
}
 
/**
 * Devuelve el nombre visible de la etapa para los mensajes de UI.
 */
export function getStageName(stage: CreativeStage): string {
  const names: Record<CreativeStage, string> = {
    SKETCH: 'Boceto',
    LINEART: 'Delineado',
    FINAL: 'Color / Acabado final',
  };
  return names[stage];
}
```
 
### 4.3 Esquemas Zod
 
```typescript
// src/features/gestion/schemas.ts
import { z } from 'zod';
 
// Formulario de rechazo (el motivo es opcional)
export const rejectCommissionSchema = z.object({
  rejection_reason: z
    .string()
    .max(500, 'El motivo no puede superar los 500 caracteres')
    .optional()
    .or(z.literal('')),
});
 
export type RejectCommissionFormValues = z.infer<typeof rejectCommissionSchema>;
```
 
### 4.4 Hooks con TanStack Query
 
```typescript
// src/features/gestion/hooks/usePendingCommissions.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { CommissionWithDetails } from '../types';
 
export const pendingCommissionsQueryKey = (artistId: string) =>
  ['commissions', 'pending', artistId] as const;
 
export function usePendingCommissions(artistId: string) {
  return useQuery({
    queryKey: pendingCommissionsQueryKey(artistId),
    queryFn: async (): Promise<CommissionWithDetails[]> => {
      const { data, error } = await supabase
        .from('commissions')
        .select(`
          *,
          service:services (title, base_price, estimated_days),
          client_profile:profiles!client_id (handle, display_name),
          references:commission_references (*)
        `)
        .eq('status', 'PENDIENTE')
        .order('created_at', { ascending: false });
 
      if (error) throw error;
      return data as CommissionWithDetails[];
    },
    staleTime: 1000 * 30, // 30 segundos antes de considerar stale
  });
}
```
 
```typescript
// src/features/gestion/hooks/useCommissionDetail.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { CommissionWithDetails } from '../types';
 
export const commissionDetailQueryKey = (commissionId: string) =>
  ['commissions', 'detail', commissionId] as const;
 
export function useCommissionDetail(commissionId: string) {
  return useQuery({
    queryKey: commissionDetailQueryKey(commissionId),
    queryFn: async (): Promise<CommissionWithDetails> => {
      const { data, error } = await supabase
        .from('commissions')
        .select(`
          *,
          service:services (title, base_price, estimated_days),
          client_profile:profiles!client_id (handle, display_name),
          references:commission_references (*)
        `)
        .eq('id', commissionId)
        .single();
 
      if (error) throw error;
 
      // Generar URLs firmadas para las referencias (expiración 1 h)
      const refsWithUrls = await Promise.all(
        (data.references ?? []).map(async (ref: { storage_path: string; [key: string]: unknown }) => {
          const { data: signed } = await supabase.storage
            .from('commission-references')
            .createSignedUrl(ref.storage_path, 3600);
          return { ...ref, signed_url: signed?.signedUrl ?? null };
        }),
      );
 
      return { ...data, references: refsWithUrls } as CommissionWithDetails;
    },
  });
}
```
 
```typescript
// src/features/gestion/hooks/useCommissionAction.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { applyTransition } from '../stateMachine';
import { pendingCommissionsQueryKey, commissionDetailQueryKey } from './usePendingCommissions';
import type { CommissionAction, CommissionStatus, CreativeStage } from '../types';
 
interface ActionPayload {
  commissionId: string;
  artistId: string;
  currentStatus: CommissionStatus;
  currentStage: CreativeStage | null;
  action: CommissionAction;
  rejectionReason?: string;
}
 
export function useCommissionAction() {
  const queryClient = useQueryClient();
 
  return useMutation({
    mutationFn: async (payload: ActionPayload) => {
      const { commissionId, artistId, currentStatus, currentStage, action, rejectionReason } =
        payload;
 
      // 1. Validar la transición en el cliente antes de llamar a Supabase
      const { newStatus, newStage } = applyTransition(currentStatus, currentStage, action);
 
      // 2. Preparar el payload de actualización
      const updatePayload: Record<string, unknown> = {
        status: newStatus,
        current_stage: newStage,
      };
 
      if (action === 'REJECT') {
        updatePayload.rejection_reason = rejectionReason?.trim() || null;
      }
 
      // 3. Ejecutar el UPDATE (RLS garantiza que solo el artista propietario puede ejecutarlo)
      const { error } = await supabase
        .from('commissions')
        .update(updatePayload)
        .eq('id', commissionId)
        .eq('artist_id', artistId) // defensa en profundidad: coincide con la política RLS
        .eq('status', currentStatus); // optimistic concurrency: solo actualiza si el estado no cambió
 
      if (error) {
        throw new Error(
          'No se pudo completar la acción, comprueba tu conexión e inténtalo de nuevo',
        );
      }
 
      return { newStatus, newStage };
    },
 
    onSuccess: (_data, variables) => {
      // Invalidar queries afectadas para forzar re-fetch
      queryClient.invalidateQueries({
        queryKey: pendingCommissionsQueryKey(variables.artistId),
      });
      queryClient.invalidateQueries({
        queryKey: commissionDetailQueryKey(variables.commissionId),
      });
    },
  });
}
```
 
---
 
## 5. Estructura de archivos
 
```
src/features/gestion/
├── screens/
│   ├── ArtistCommissionsScreen.tsx   # Lista de pendientes (RF-07-A)
│   ├── CommissionDetailScreen.tsx    # Detalle + botones aceptar/rechazar (RF-07-B, C, D)
│   ├── CommissionWorkScreen.tsx      # Panel de etapas creativas (RF-07-E)
│   └── CommissionCompletedScreen.tsx # Estado terminal COMPLETADA
├── components/
│   ├── PendingCommissionCard.tsx     # Tarjeta en la lista de pendientes
│   ├── CommissionStatusBadge.tsx     # Chip de estado con color
│   ├── CreativeStageIndicator.tsx    # Indicador de progreso (3 pasos)
│   ├── ReferenceGallery.tsx          # Grid de miniaturas de referencia
│   ├── RejectCommissionSheet.tsx     # Bottom sheet de rechazo con campo de motivo
│   └── ConfirmActionDialog.tsx       # Diálogo de confirmación reutilizable
├── hooks/
│   ├── usePendingCommissions.ts      # Query: lista de pendientes (sección 4.4)
│   ├── useCommissionDetail.ts        # Query: detalle + URLs firmadas (sección 4.4)
│   └── useCommissionAction.ts        # Mutation: aceptar / rechazar / avanzar (sección 4.4)
├── stateMachine.ts                   # Lógica pura de transiciones (sección 4.2)
├── schemas.ts                        # Zod: rechazo (sección 4.3)
└── types.ts                          # Tipos de dominio extendidos (sección 4.1)
 
src/app/
└── artist/
    ├── commissions/
    │   └── index.tsx                 # Ruta: lista de pendientes
    └── commissions/
        ├── [commissionId]/
        │   └── index.tsx             # Ruta: detalle de comisión
        └── [commissionId]/
            └── work.tsx              # Ruta: panel de trabajo
 
supabase/
├── migrations/
│   └── 004_commission_management.sql # ENUMs + ALTER TABLE + trigger + RLS (sección 2 y 3)
└── tests/
    └── 004_rls_test.sql              # Pruebas de acceso (sección 3.1)
```
 
---
 
## 6. Consideraciones de rendimiento y cuota gratuita
 
| Recurso | Consideración |
|---|---|
| Consultas Supabase | La query de detalle usa un `SELECT` con JOINs implícitos (FK). Postgres resuelve eficientemente con los índices de `artist_id` y `status` existentes. |
| URLs firmadas de Storage | Se generan al abrir el detalle, con expiración de 1 hora. No se cachean más allá de la vida del componente para evitar URLs expiradas. |
| TanStack Query `staleTime` | 30 segundos para la lista de pendientes. El artista no necesita datos en tiempo real absoluto; la invalidación tras mutación garantiza consistencia. |
| Revalidación en foco | TanStack Query revalida al volver a la pantalla (`refetchOnWindowFocus: true` por defecto), suficiente para detectar nuevas solicitudes sin polling explícito. |
 
---
 
## 7. Decisiones técnicas
 
| ID | Tema | Decisión |
|---|---|---|
| DT-4.1 | Validación de transición | En el cliente (TypeScript puro, testeable) **y** reforzada por RLS en Postgres. No se implementa una función PL/pgSQL para la máquina de estados en el MVP (Principio 11). |
| DT-4.2 | Concurrencia optimista | El UPDATE incluye `.eq('status', currentStatus)` para evitar sobreescritura si el estado cambió entre la carga del detalle y la acción del artista. |
| DT-4.3 | ENUMs vs CHECK de texto | Se migra a ENUM para garantizar validación a nivel de motor, habilitar autocompletado en el ORM generado y reducir errores de tipeo. |
| DT-4.4 | Trigger `updated_at` | Función PL/pgSQL reutilizable (`set_updated_at`) para mantener la columna sincronizada sin depender del cliente. |
| DT-4.5 | URLs firmadas | Se generan en el cliente (Supabase JS SDK) al abrir el detalle. Expiración de 1 hora es suficiente para la sesión de revisión del artista. |
| DT-4.6 | Invalidación de caché | `useCommissionAction` invalida ambas queries (`pending` y `detail`) en `onSuccess`, garantizando que la UI se actualiza sin recargar la app. |
 