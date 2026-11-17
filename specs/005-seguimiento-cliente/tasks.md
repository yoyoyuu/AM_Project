# Tasks 005 — Seguimiento de Comisiones del Cliente

**Estado:** Borrador · **Versión:** 0.1 · **Fecha:** 2026-11-17
**Derivado de:** `005-spec.md` y `005-plan.md`

> Las tareas están ordenadas por dependencia lógica. Cada tarea debe completarse y pasar `expo lint` + `tsc` antes de iniciar la siguiente.

---

## Bloque 1 — Base de datos

### T001 — Migración: índices de acceso del cliente ✅
**Traza:** RNF-01 (tiempo de carga ≤ 2 s), RF-05-A (consulta de lista)
**Archivos creados:**
- `supabase/migrations/007_client_tracking_indexes.sql` (renombrado a 007 para evitar conflicto de orden con 005_commission_management.sql)

**Contenido:** crear los dos índices compuestos definidos en `plan.md` sección 2.2:
```sql
CREATE INDEX IF NOT EXISTS idx_commissions_client_updated
  ON public.commissions (client_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_commissions_client_status
  ON public.commissions (client_id, status);
```
Verificar que la migración aplica sin errores en entorno local con `supabase db push`.

---

### T002 — Pruebas RLS: acceso de lectura del cliente ✅
**Traza:** RNF-04 (acceso solo a comisiones propias), Principio 6 (sin tokens anónimos), RF-05-A, RF-05-B
**Archivos creados:**
- `supabase/tests/005_rls_client_test.sql`

**Contenido:** las 6 pruebas definidas en `plan.md` sección 2.3, que verifican:
1. Cliente lee sus propias comisiones.
2. Cliente NO lee comisiones de otro cliente.
3. Cliente NO puede ejecutar UPDATE sobre `status`.
4. Tercero autenticado no ve ninguna comisión ajena.
5. Cliente lee `rejection_reason` en comisiones rechazadas.
6. Cliente lee JOIN con `services` y `profiles`.

Ejecutar con `supabase test db` y confirmar que todos los asserts pasan.

---

## Bloque 2 — Tipos y lógica de presentación

### T003 — Tipos TypeScript del módulo de seguimiento
**Traza:** RF-05-A, RF-05-B (contratos de datos)
**Archivos a crear:**
- `src/features/seguimiento/types.ts`

**Contenido:** definir `ClientCommissionSummary`, `ClientCommissionDetail`, `CommissionReferenceView` y `CommissionGroups` según `plan.md` sección 3.1. Re-exportar `CommissionStatus`, `CreativeStage` y `CREATIVE_STAGE_ORDER` desde `@/features/gestion/types`.

Verificar con `tsc --noEmit` que no hay errores de tipos.

---

### T004 — Mapeadores de presentación (badges, stepper, fechas, agrupación)
**Traza:** RF-05-A (badges, agrupación, fechas), RF-05-B (stepper), spec sección 5
**Archivos a crear:**
- `src/features/seguimiento/presenters.ts`

**Contenido:**
- `getStatusBadge(status): StatusBadgeConfig` — etiqueta y colorKey por cada `CommissionStatus`.
- `buildStepperConfig(status, currentStage): StepConfig[]` — 3 pasos con estado `completed | active | pending` según la lógica de `plan.md` sección 3.2.
- `formatRelativeDate(isoDate): string` — fecha relativa en español.
- `groupCommissions(commissions): CommissionGroups` — separa en `active`, `pending`, `finished`.

**Tests unitarios a crear:**
- `src/features/seguimiento/__tests__/presenters.test.ts`
  - Casos para `buildStepperConfig`: EN_PROGRESO en cada etapa, COMPLETADA, PENDIENTE, RECHAZADA.
  - Casos para `groupCommissions`: vacío, solo activas, mezcla de estados.
  - Casos para `formatRelativeDate`: < 1 min, < 1 h, < 24 h, ayer, > 7 días.
  - Casos para `getStatusBadge`: todos los estados.

Verificar cobertura ≥ 60 % en este archivo. Ejecutar `expo lint` sin errores.

---

## Bloque 3 — Hooks de datos

### T005 — Hook `useMyCommissions`
**Traza:** RF-05-A (lista de comisiones), RF-05-C (revalidación por foco y pull-to-refresh)
**Archivos a crear:**
- `src/features/seguimiento/hooks/useMyCommissions.ts`

**Contenido:** implementar el hook según `plan.md` sección 3.3:
- Query key: `['commissions', 'client', clientId, 'list']`.
- SELECT con JOIN a `services` y `profiles` (artista), ordenado por `updated_at DESC`.
- Mapeo de la respuesta al tipo `ClientCommissionSummary[]`.
- `staleTime: 30_000`.
- `refetchOnWindowFocus: true` (valor por defecto; documentar con comentario).

Verificar con `tsc --noEmit`.

---

### T006 — Hook `useCommissionTrackingDetail`
**Traza:** RF-05-B (vista de detalle, galería de referencias, datos del encargo)
**Archivos a crear:**
- `src/features/seguimiento/hooks/useCommissionTrackingDetail.ts`

**Contenido:** implementar el hook según `plan.md` sección 3.3:
- Query key: `['commissions', 'client', 'detail', commissionId]`.
- SELECT con JOIN a `services`, `profiles` (artista) y `commission_references`.
- Generación de URLs firmadas (expiración 3600 s) con `supabase.storage.createSignedUrl`.
- Mapeo al tipo `ClientCommissionDetail`.
- `staleTime: 30_000`.

Verificar con `tsc --noEmit`.

---

## Bloque 4 — Componentes UI

### T007 — Componente `CommissionStatusBadge`
**Traza:** RF-05-A (badge en tarjeta), RF-05-B (badge en encabezado de detalle), spec sección 5.1
**Archivos a crear:**
- `src/features/seguimiento/components/CommissionStatusBadge.tsx`

**Props:** `status: CommissionStatus`.
Usa `getStatusBadge(status)` del presentador para obtener `label` y `colorKey`.
Renderiza un chip/badge con el texto y el color correspondiente.

Cubrir con snapshot test o test de accesibilidad básica.

---

### T008 — Componente `CommissionCard`
**Traza:** RF-05-A (tarjeta de resumen en la lista), spec sección 3
**Archivos a crear:**
- `src/features/seguimiento/components/CommissionCard.tsx`

**Props:** `commission: ClientCommissionSummary`, `onPress: () => void`.
Debe mostrar: título del servicio, handle del artista, `CommissionStatusBadge`, etapa en curso (solo si `EN_PROGRESO`), fecha relativa (`formatRelativeDate(updated_at)`).

---

### T009 — Componente `CommissionsGroupSection`
**Traza:** RF-05-A (agrupación por estado)
**Archivos a crear:**
- `src/features/seguimiento/components/CommissionsGroupSection.tsx`

**Props:** `title: string`, `commissions: ClientCommissionSummary[]`, `onPressItem: (id: string) => void`.
Si `commissions.length === 0` el componente no renderiza nada (ni el encabezado).
Renderiza el título del grupo y la lista de `CommissionCard`.

---

### T010 — Componente `CommissionsEmptyState`
**Traza:** RF-05-A (estado vacío), spec sección 6
**Archivos a crear:**
- `src/features/seguimiento/components/CommissionsEmptyState.tsx`

**Props:** `onExploreArtists: () => void`.
Muestra el mensaje literal: `"Aún no has solicitado ninguna comisión"` y el botón `"Explorar artistas"` que invoca `onExploreArtists`.

---

### T011 — Componente `CommissionListSkeleton`
**Traza:** RF-05-C (indicadores de carga)
**Archivos a crear:**
- `src/features/seguimiento/components/CommissionListSkeleton.tsx`

Renderiza 3 tarjetas skeleton animadas (placeholder de carga). Se muestra mientras `isLoading = true` en `useMyCommissions`.

---

### T012 — Componente `CreativeStepper`
**Traza:** RF-05-B (indicador visual de etapas), spec sección 5.2 y 5.3
**Archivos a crear:**
- `src/features/seguimiento/components/CreativeStepper.tsx`

**Props:** `steps: StepConfig[]` (resultado de `buildStepperConfig`).
Renderiza los 3 pasos en horizontal o vertical. Cada paso muestra: ícono de estado (`completed` = ✓, `active` = círculo destacado, `pending` = círculo vacío), `label` y línea conectora entre pasos.

---

### T013 — Componente `RejectionBlock`
**Traza:** RF-05-B (bloque de rechazo), spec sección 6
**Archivos a crear:**
- `src/features/seguimiento/components/RejectionBlock.tsx`

**Props:** `rejectionReason: string | null`.
Si `rejectionReason` es no nulo, muestra: `"Motivo indicado por el artista:"` + el texto del motivo.
Si `rejectionReason` es nulo, muestra: `"El artista no indicó un motivo específico."`.
Incluye el encabezado `"Solicitud rechazada"` siempre.

---

### T014 — Componente `CommissionDetailSkeleton`
**Traza:** RF-05-C (indicadores de carga en el detalle)
**Archivos a crear:**
- `src/features/seguimiento/components/CommissionDetailSkeleton.tsx`

Renderiza placeholders animados para el encabezado de estado, el stepper, los bloques de datos del servicio y los datos del encargo. Se muestra mientras `isLoading = true` en `useCommissionTrackingDetail`.

---

## Bloque 5 — Pantallas

### T015 — Pantalla `MyCommissionsScreen`
**Traza:** RF-05-A (tablero principal), RF-05-C (pull-to-refresh, revalidación)
**Archivos a crear:**
- `src/features/seguimiento/screens/MyCommissionsScreen.tsx`

**Lógica:**
1. Obtener `clientId` desde la sesión autenticada (`useSession()` o similar de Spec 001).
2. Invocar `useMyCommissions(clientId)`.
3. Si `isLoading`: mostrar `CommissionListSkeleton`.
4. Si `isError`: mostrar mensaje `"No se pudo cargar tus comisiones. Comprueba tu conexión e intenta de nuevo"` con botón "Reintentar" que llama a `refetch()`.
5. Si datos cargados:
   - Aplicar `groupCommissions(data)` para obtener `{ active, pending, finished }`.
   - Si los tres grupos están vacíos: mostrar `CommissionsEmptyState`.
   - Si hay datos: renderizar `CommissionsGroupSection` para cada grupo no vacío ("En curso", "Pendientes", "Finalizadas").
6. Implementar `pull-to-refresh` con `RefreshControl` que llame a `refetch()`.
7. Al tocar una `CommissionCard`: navegar a `/(tabs)/commissions/[commissionId]`.

---

### T016 — Pantalla `CommissionTrackingDetailScreen`
**Traza:** RF-05-B (vista detallada, stepper, bloque de rechazo, galería)
**Archivos a crear:**
- `src/features/seguimiento/screens/CommissionTrackingDetailScreen.tsx`

**Lógica:**
1. Obtener `commissionId` desde los parámetros de la ruta (Expo Router `useLocalSearchParams`).
2. Invocar `useCommissionTrackingDetail(commissionId)`.
3. Si `isLoading`: mostrar `CommissionDetailSkeleton`.
4. Si `isError`: mostrar mensaje `"No se pudo cargar el detalle. Comprueba tu conexión e intenta de nuevo"` con botón "Reintentar".
5. Si datos cargados, renderizar en scroll vertical:
   - **Encabezado:** `CommissionStatusBadge` con el estado actual.
   - **Stepper** (solo si `status = EN_PROGRESO` o `COMPLETADA`): `CreativeStepper` con `buildStepperConfig(status, current_stage)`.
   - **Bloque de rechazo** (solo si `status = RECHAZADA`): `RejectionBlock` con `rejection_reason`.
   - **Datos del servicio:** título, precio base (`$`), tiempo estimado.
   - **Datos del artista:** handle y nombre (si existe).
   - **Detalles del encargo:** descripción, uso previsto, pose (si existe), elementos clave (si existen), notas adicionales (si existen).
   - **Galería de referencias:** miniaturas de `references` (si existen); al tocar, ampliar en modal.
   - **Fechas:** "Solicitada el [fecha]" y "Última actualización: [fecha relativa]".
6. No renderizar ningún botón de acción que modifique la comisión.

---

## Bloque 6 — Rutas Expo Router

### T017 — Ruta tab: lista de comisiones del cliente
**Traza:** RF-05-A (acceso desde la navegación principal)
**Archivos a crear:**
- `src/app/(tabs)/commissions/index.tsx`

**Contenido:** wrapper mínimo que renderiza `<MyCommissionsScreen />`. Configurar el título de la tab como "Mis Comisiones".

---

### T018 — Ruta anidada: detalle de seguimiento
**Traza:** RF-05-B (acceso al detalle desde la lista)
**Archivos a crear:**
- `src/app/(tabs)/commissions/[commissionId].tsx`

**Contenido:** wrapper que extrae el parámetro `commissionId` y renderiza `<CommissionTrackingDetailScreen commissionId={commissionId} />`. Configurar el título de la pantalla como "Detalle del encargo".

---

## Bloque 7 — Verificación final

### T019 — Verificación de lint, tipos y cobertura
**Traza:** RNF-08 (cobertura ≥ 60 %), todos los RF
**Archivos a modificar / verificar:**
- Todos los archivos creados en T003–T018.

**Pasos:**
1. `expo lint` → 0 errores y 0 warnings relevantes.
2. `tsc --noEmit` → 0 errores de tipos.
3. Ejecutar suite de tests: `jest src/features/seguimiento/` → cobertura ≥ 60 % en `presenters.ts` y en los hooks.
4. Ejecutar pruebas RLS: `supabase test db` → los 6 asserts de `005_rls_client_test.sql` pasan.
5. Verificar manualmente en simulador:
   - Estado vacío visible cuando no hay comisiones.
   - Agrupación correcta por estado.
   - Stepper refleja etapas correctamente para cada estado.
   - Bloque de rechazo muestra motivo o mensaje neutro según corresponda.
   - Pull-to-refresh funciona sin errores.
   - No existe ningún botón de acción en la vista de detalle.
   - Todos los mensajes de error coinciden con los literales de la spec sección 6.

---

## Resumen de archivos a crear

| Tarea | Archivos |
|---|---|
| T001 | `supabase/migrations/005_client_tracking_indexes.sql` |
| T002 | `supabase/tests/005_rls_client_test.sql` |
| T003 | `src/features/seguimiento/types.ts` |
| T004 | `src/features/seguimiento/presenters.ts`, `src/features/seguimiento/__tests__/presenters.test.ts` |
| T005 | `src/features/seguimiento/hooks/useMyCommissions.ts` |
| T006 | `src/features/seguimiento/hooks/useCommissionTrackingDetail.ts` |
| T007 | `src/features/seguimiento/components/CommissionStatusBadge.tsx` |
| T008 | `src/features/seguimiento/components/CommissionCard.tsx` |
| T009 | `src/features/seguimiento/components/CommissionsGroupSection.tsx` |
| T010 | `src/features/seguimiento/components/CommissionsEmptyState.tsx` |
| T011 | `src/features/seguimiento/components/CommissionListSkeleton.tsx` |
| T012 | `src/features/seguimiento/components/CreativeStepper.tsx` |
| T013 | `src/features/seguimiento/components/RejectionBlock.tsx` |
| T014 | `src/features/seguimiento/components/CommissionDetailSkeleton.tsx` |
| T015 | `src/features/seguimiento/screens/MyCommissionsScreen.tsx` |
| T016 | `src/features/seguimiento/screens/CommissionTrackingDetailScreen.tsx` |
| T017 | `src/app/(tabs)/commissions/index.tsx` |
| T018 | `src/app/(tabs)/commissions/[commissionId].tsx` |
| T019 | Verificación (sin archivos nuevos) |