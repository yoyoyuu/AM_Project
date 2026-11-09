# Tasks 004 — Gestión de comisión
 
**Estado:** Borrador · **Versión:** 0.1 · **Fecha:** 2026-11-08
**Derivado de:** `004-spec.md` y `004-plan.md`
**Constitución:** v1.1
 
> Las tareas están ordenadas por dependencias. Cada tarea es atómica: se puede implementar, revisar y cerrar de forma independiente. El commit usa el ID de tarea como prefijo (`feat: T040 ...`).
 
---
 
## Fase 1 — Base de datos y contratos
 
### T041 — Crear tipos ENUM en Postgres ✅
 
**RF/RNF:** RF-07-C, RF-07-D, RF-07-E · Plan §2.1
**Archivos a crear/modificar:**
- `supabase/migrations/004_commission_management.sql` (crear)
**Descripción:**
Crear los tipos `commission_status` y `creative_stage` como ENUMs de Postgres dentro de la migración 004. Incluir todos los valores declarados en la spec aunque no todos se activen en esta spec (`CANCELADA`, `EN_REVISION`).
 
**Criterio de hecho:** `supabase db diff` no muestra diferencias; los tipos aparecen en `pg_type` al consultarlos.
 
---
 
### T042 — Migrar columna `status` a ENUM y agregar columnas de gestión ✅
 
**RF/RNF:** RF-07-C, RF-07-D, RF-07-E · Plan §2.2
**Depende de:** T041
**Archivos a crear/modificar:**
- `supabase/migrations/004_commission_management.sql` (continuar)
**Descripción:**
En la misma migración 004:
1. Convertir `commissions.status` de `text` a `commission_status` ENUM con `USING status::commission_status`.
2. Eliminar el `CHECK` de texto de la migración 003.
3. Agregar columnas: `current_stage creative_stage NULL`, `rejection_reason text NULL CHECK (char_length(rejection_reason) <= 500)`, `updated_at timestamptz NOT NULL DEFAULT now()`.
4. Crear índice en `updated_at DESC`.
5. Crear función `set_updated_at()` y trigger `commissions_set_updated_at`.
**Criterio de hecho:** `supabase db push` sin errores; `\d commissions` muestra los tipos correctos; insertar un valor inválido en `status` produce error de ENUM.
 
---
 
### T043 — Actualizar políticas RLS para gestión del artista ✅
 
**RF/RNF:** RNF-04, Principio 5, Principio 6 · Plan §3
**Depende de:** T042
**Archivos a crear/modificar:**
- `supabase/migrations/004_commission_management.sql` (continuar)
**Descripción:**
En la misma migración 004:
1. Eliminar la política `commissions_update_artist` creada en la migración 003.
2. Crear la política `commissions_update_artist_only` que permite UPDATE solo cuando `auth.uid() = artist_id`.
3. Verificar que las políticas INSERT y SELECT de la migración 003 no requieren cambios.
**Criterio de hecho:** las pruebas T044 pasan; un usuario distinto al `artist_id` no puede ejecutar UPDATE en ninguna comisión.
 
---
 
### T044 — Escribir pruebas de RLS para spec 004 ✅
 
**RF/RNF:** RNF-04, Principio 5 · Plan §3.1
**Depende de:** T043
**Archivos a crear/modificar:**
- `supabase/tests/004_rls_test.sql` (crear)
**Descripción:**
Implementar las 8 pruebas definidas en el plan §3.1:
- Artista lee sus propias comisiones pendientes (Escenario 4.3 negativo).
- Artista no lee comisiones ajenas.
- Artista puede actualizar `status` de su comisión.
- Artista no puede actualizar comisión ajena.
- Cliente no puede actualizar `status`.
- Tercero no puede actualizar ninguna comisión.
- Rechazo con motivo válido.
- `rejection_reason` > 500 caracteres falla por CHECK constraint.
**Criterio de hecho:** `supabase db test` (o ejecución manual) reporta todas las pruebas como esperadas.
 
---
 
### T045 — Definir tipos TypeScript de dominio extendidos
 
**RF/RNF:** Principio 3 (TypeScript estricto) · Plan §4.1
**Depende de:** T042
**Archivos a crear/modificar:**
- `src/features/gestion/types.ts` (crear)
**Descripción:**
Crear el archivo con los tipos: `CommissionStatus`, `CreativeStage`, `CREATIVE_STAGE_ORDER`, `Commission`, `CommissionWithDetails`, `CommissionReference`. Verificar que `CommissionStatus` del plan 003 (`src/features/solicitud/types.ts`) sea compatible o exportar desde `gestion/types.ts` y re-exportar en `solicitud/types.ts`.
 
**Criterio de hecho:** `tsc --noEmit` da 0 errores; `prohibido any` cumplido.
 
---
 
### T046 — Implementar máquina de estados TypeScript
 
**RF/RNF:** RF-07-C, RF-07-D, RF-07-E · Plan §4.2
**Depende de:** T045
**Archivos a crear/modificar:**
- `src/features/gestion/stateMachine.ts` (crear)
**Descripción:**
Implementar `applyTransition(currentStatus, currentStage, action): TransitionResult` y `getStageName(stage): string` exactamente como se define en el plan §4.2. La función debe lanzar errores con los mensajes literales de la spec §6.
 
**Criterio de hecho:** tests unitarios (T047) cubren todos los caminos felices y todos los errores; `tsc` sin errores.
 
---
 
### T047 — Tests unitarios de la máquina de estados
 
**RF/RNF:** RNF-08 (cobertura ≥ 60 %) · Plan §4.2
**Depende de:** T046
**Archivos a crear/modificar:**
- `src/features/gestion/__tests__/stateMachine.test.ts` (crear)
**Descripción:**
Escribir tests con Jest que cubran:
- Aceptar comisión `PENDIENTE` → `EN_PROGRESO` / `SKETCH`.
- Rechazar comisión `PENDIENTE` → `RECHAZADA` / `null`.
- Avanzar `SKETCH` → `LINEART`.
- Avanzar `LINEART` → `FINAL`.
- Avanzar `FINAL` → `COMPLETADA` / `null`.
- Error al aceptar comisión no `PENDIENTE`.
- Error al avanzar etapa en comisión no `EN_PROGRESO`.
- Error al intentar saltar etapa (validado lógicamente en el cliente).
- `getStageName` devuelve el nombre correcto para cada etapa.
**Criterio de hecho:** `jest --coverage` ≥ 60 % en `stateMachine.ts`; 0 fallos.
 
---
 
### T048 — Definir esquema Zod y tipos de formulario de rechazo
 
**RF/RNF:** RF-07-D · Plan §4.3
**Depende de:** T045
**Archivos a crear/modificar:**
- `src/features/gestion/schemas.ts` (crear)
**Descripción:**
Implementar `rejectCommissionSchema` y exportar `RejectCommissionFormValues`. El campo `rejection_reason` debe ser opcional y aceptar cadena vacía como equivalente a nulo.
 
**Criterio de hecho:** `tsc` sin errores; test unitario verifica que cadena de 501 caracteres falla con el mensaje literal "El motivo no puede superar los 500 caracteres".
 
---
 
## Fase 2 — Hooks de datos
 
### T049 — Hook `usePendingCommissions`
 
**RF/RNF:** RF-07-A · Plan §4.4
**Depende de:** T045
**Archivos a crear/modificar:**
- `src/features/gestion/hooks/usePendingCommissions.ts` (crear)
**Descripción:**
Implementar el hook usando TanStack Query con la query key `['commissions', 'pending', artistId]`, `staleTime` de 30 segundos y el SELECT con JOINs definido en el plan §4.4. El hook filtra por `status = 'PENDIENTE'` y ordena por `created_at DESC`.
 
**Criterio de hecho:** en un emulador/dispositivo, la lista de pendientes se muestra correctamente y no incluye comisiones de otros artistas.
 
---
 
### T050 — Hook `useCommissionDetail`
 
**RF/RNF:** RF-07-B · Plan §4.4
**Depende de:** T045
**Archivos a crear/modificar:**
- `src/features/gestion/hooks/useCommissionDetail.ts` (crear)
**Descripción:**
Implementar el hook con query key `['commissions', 'detail', commissionId]`. Incluir la generación de URLs firmadas para las referencias con expiración de 1 hora usando `supabase.storage.from('commission-references').createSignedUrl`.
 
**Criterio de hecho:** el detalle muestra todos los campos de la spec; las imágenes de referencia cargan correctamente desde las URLs firmadas.
 
---
 
### T051 — Hook `useCommissionAction`
 
**RF/RNF:** RF-07-C, RF-07-D, RF-07-E · Plan §4.4
**Depende de:** T046, T049, T050
**Archivos a crear/modificar:**
- `src/features/gestion/hooks/useCommissionAction.ts` (crear)
**Descripción:**
Implementar la mutación que:
1. Llama a `applyTransition` para validar antes de enviar.
2. Ejecuta `UPDATE` con `.eq('status', currentStatus)` para concurrencia optimista.
3. Incluye `.eq('artist_id', artistId)` como defensa en profundidad.
4. En `onSuccess`, invalida las queries `pending` y `detail`.
5. Maneja el error de red con el mensaje literal de la spec §6.
**Criterio de hecho:** la acción actualiza el estado en Supabase y la UI se actualiza sin recargar la app; un artista ajeno obtiene 0 filas actualizadas.
 
---
 
## Fase 3 — Componentes reutilizables
 
### T052 — Componente `CommissionStatusBadge`
 
**RF/RNF:** RF-07-A, RF-07-B · Plan §5
**Depende de:** T045
**Archivos a crear/modificar:**
- `src/features/gestion/components/CommissionStatusBadge.tsx` (crear)
**Descripción:**
Chip de texto con color de fondo semántico por estado:
- `PENDIENTE`: amarillo/naranja.
- `EN_PROGRESO`: azul.
- `RECHAZADA`: rojo.
- `COMPLETADA`: verde.
Acepta `status: CommissionStatus` como prop.
**Criterio de hecho:** se renderiza correctamente en la lista y en el detalle; `tsc` sin errores.
 
---
 
### T053 — Componente `CreativeStageIndicator`
 
**RF/RNF:** RF-07-E · Plan §5
**Depende de:** T045
**Archivos a crear/modificar:**
- `src/features/gestion/components/CreativeStageIndicator.tsx` (crear)
**Descripción:**
Indicador de progreso de 3 pasos horizontales (Boceto → Delineado → Color / Acabado final). La etapa activa se resalta visualmente. Acepta `currentStage: CreativeStage | null` como prop.
 
**Criterio de hecho:** los 3 pasos se renderizan; la etapa activa tiene el estilo correcto; cuando `currentStage` es `null` (comisión completada), el indicador muestra todos completados.
 
---
 
### T054 — Componente `ReferenceGallery`
 
**RF/RNF:** RF-07-B · Plan §5
**Depende de:** T050
**Archivos a crear/modificar:**
- `src/features/gestion/components/ReferenceGallery.tsx` (crear)
**Descripción:**
Grid de miniaturas de imágenes de referencia usando `Image` de React Native. Cada miniatura es presionable para abrir la imagen a pantalla completa (modal o navegación). Acepta `references: CommissionReference[]` como prop. Si no hay referencias, muestra el texto "Sin imágenes de referencia".
 
**Criterio de hecho:** las miniaturas se muestran usando las URLs firmadas; tocar una miniatura la amplía.
 
---
 
### T055 — Componente `ConfirmActionDialog`
 
**RF/RNF:** RF-07-C, RF-07-D, RF-07-E (confirmaciones) · Plan §5
**Depende de:** (ninguna)
**Archivos a crear/modificar:**
- `src/features/gestion/components/ConfirmActionDialog.tsx` (crear)
**Descripción:**
Diálogo modal reutilizable con título, mensaje, botón de confirmación y botón de cancelación. Acepta props: `visible`, `title`, `message`, `confirmLabel`, `onConfirm`, `onCancel`, `destructive` (para el botón rojo en rechazo).
 
**Criterio de hecho:** el diálogo se muestra y se oculta correctamente; los botones llaman a las callbacks correspondientes.
 
---
 
### T056 — Componente `RejectCommissionSheet`
 
**RF/RNF:** RF-07-D · Plan §5
**Depende de:** T048, T055
**Archivos a crear/modificar:**
- `src/features/gestion/components/RejectCommissionSheet.tsx` (crear)
**Descripción:**
Bottom sheet (o modal) que contiene:
- Campo de texto opcional "Motivo de rechazo" (React Hook Form + `rejectCommissionSchema`).
- Contador de caracteres (X / 500).
- Botón "Confirmar rechazo" (destructivo) que valida el formulario con Zod antes de llamar `onConfirm(rejectionReason)`.
- Botón "Cancelar".
**Criterio de hecho:** un motivo de 501 caracteres no puede enviarse; el formulario vacío se envía con `rejection_reason = null`.
 
---
 
### T057 — Componente `PendingCommissionCard`
 
**RF/RNF:** RF-07-A · Plan §5
**Depende de:** T052
**Archivos a crear/modificar:**
- `src/features/gestion/components/PendingCommissionCard.tsx` (crear)
**Descripción:**
Tarjeta presionable que muestra: nombre del servicio, handle del cliente, fecha formateada de la solicitud y el `CommissionStatusBadge`. Al presionar, navega a la pantalla de detalle.
 
**Criterio de hecho:** la tarjeta renderiza todos los campos; la navegación lleva al detalle correcto.
 
---
 
## Fase 4 — Pantallas
 
### T058 — Pantalla `ArtistCommissionsScreen` (lista de pendientes)
 
**RF/RNF:** RF-07-A, Escenarios 4.1, 4.2, 4.3 · Plan §5
**Depende de:** T049, T057
**Archivos a crear/modificar:**
- `src/features/gestion/screens/ArtistCommissionsScreen.tsx` (crear)
- `src/app/artist/commissions/index.tsx` (crear)
**Descripción:**
Pantalla principal del panel del artista con:
- `FlatList` de `PendingCommissionCard` usando datos de `usePendingCommissions`.
- Estado de carga (skeleton o spinner).
- Estado vacío: mensaje "No tienes solicitudes pendientes".
- Estado de error: mensaje "No se pudo completar la acción, comprueba tu conexión e inténtalo de nuevo".
- Pull-to-refresh para forzar re-fetch.
**Criterio de hecho:** Escenarios 4.1 y 4.2 pasan manualmente; la lista no muestra comisiones de otros artistas.
 
---
 
### T059 — Pantalla `CommissionDetailScreen`
 
**RF/RNF:** RF-07-B, RF-07-C, RF-07-D, Escenarios 4.4–4.12 · Plan §5
**Depende de:** T050, T051, T053, T054, T055, T056
**Archivos a crear/modificar:**
- `src/features/gestion/screens/CommissionDetailScreen.tsx` (crear)
- `src/app/artist/commissions/[commissionId]/index.tsx` (crear)
**Descripción:**
Pantalla de detalle de la comisión con:
- Resumen del servicio (nombre, precio base, tiempo estimado).
- Todos los campos de la solicitud (descripción, uso previsto, campos opcionales).
- `ReferenceGallery` para las imágenes de referencia.
- Botones "Aceptar comisión" y "Rechazar comisión" (solo visibles si `status === 'PENDIENTE'`).
- Al aceptar: muestra `ConfirmActionDialog` con el mensaje literal de la spec; al confirmar llama `useCommissionAction` con `action: 'ACCEPT'`.
- Al rechazar: muestra `RejectCommissionSheet`; al confirmar llama `useCommissionAction` con `action: 'REJECT'` y el motivo.
- Si `status !== 'PENDIENTE'`, los botones no se muestran.
- Redirige a `CommissionWorkScreen` tras aceptación exitosa.
**Criterio de hecho:** Escenarios 4.4–4.12 pasan manualmente; los mensajes de confirmación y error son exactamente los definidos en spec §6.
 
---
 
### T060 — Pantalla `CommissionWorkScreen` (gestión de etapas)
 
**RF/RNF:** RF-07-E, Escenarios 4.13–4.17 · Plan §5
**Depende de:** T051, T053, T055
**Archivos a crear/modificar:**
- `src/features/gestion/screens/CommissionWorkScreen.tsx` (crear)
- `src/app/artist/commissions/[commissionId]/work.tsx` (crear)
**Descripción:**
Pantalla de trabajo activo con:
- `CommissionStatusBadge` mostrando `EN_PROGRESO`.
- `CreativeStageIndicator` con la etapa actual resaltada.
- Nombre visible de la etapa actual (usando `getStageName`).
- Botón "Completar etapa" que muestra el `ConfirmActionDialog` correcto según si es la última etapa o no.
- Al confirmar llama `useCommissionAction` con `action: 'ADVANCE_STAGE'`.
- Si `status === 'COMPLETADA'`, redirige a `CommissionCompletedScreen`.
**Criterio de hecho:** Escenarios 4.13–4.17 pasan manualmente; la secuencia SKETCH → LINEART → FINAL → COMPLETADA funciona sin saltos; los mensajes de confirmación son exactamente los de spec §6.
 
---
 
### T061 — Pantalla `CommissionCompletedScreen`
 
**RF/RNF:** RF-07-E (Escenario 4.14) · Plan §5
**Depende de:** T052
**Archivos a crear/modificar:**
- `src/features/gestion/screens/CommissionCompletedScreen.tsx` (crear)
**Descripción:**
Pantalla de estado terminal que muestra:
- Icono de comisión completada.
- Mensaje "¡Comisión completada! El cliente será notificado".
- `CommissionStatusBadge` con `COMPLETADA`.
- Botón "Volver al panel" que navega a `ArtistCommissionsScreen`.
**Criterio de hecho:** se muestra tras completar la última etapa; el botón navega correctamente.
 
---
 
## Fase 5 — Integración y calidad
 
### T062 — Integrar ruta en la navegación del artista (Expo Router)
 
**RF/RNF:** Principio 3 (Expo Router) · Plan §5
**Depende de:** T058, T059, T060, T061
**Archivos a crear/modificar:**
- `src/app/artist/commissions/index.tsx` (verificar ruta)
- `src/app/artist/commissions/[commissionId]/index.tsx` (verificar ruta)
- `src/app/artist/commissions/[commissionId]/work.tsx` (verificar ruta)
**Descripción:**
Verificar que las rutas de Expo Router están correctamente anidadas bajo el layout del artista (que ya existe desde spec 001/002). Asegurarse de que la ruta del panel de comisiones es accesible solo cuando el usuario tiene perfil de artista activo (guard de spec 001).
 
**Criterio de hecho:** navegar a `/artist/commissions` muestra la lista; navegar a `/artist/commissions/{id}` muestra el detalle; navegar a `/artist/commissions/{id}/work` muestra el panel de trabajo.
 
---
 
### T063 — Validación de lint y tipos
 
**RF/RNF:** Principio 3 (TypeScript estricto), RNF-08 · Constitución §6
**Depende de:** T058, T059, T060, T061, T062
**Archivos a crear/modificar:**
- ninguno (solo ejecución de herramientas)
**Descripción:**
Ejecutar `expo lint` y `tsc --noEmit` sobre toda la base de código. Corregir todos los errores encontrados en los archivos de esta spec. Verificar que `prohibido any` no fue violado.
 
**Criterio de hecho:** `expo lint` y `tsc --noEmit` dan exactamente 0 errores y 0 advertencias relevantes.
 
---
 
### T064 — Verificar cobertura de pruebas ≥ 60 %
 
**RF/RNF:** RNF-08 · Constitución §6
**Depende de:** T047, T048
**Archivos a crear/modificar:**
- `src/features/gestion/__tests__/schemas.test.ts` (crear si es necesario para alcanzar cobertura)
**Descripción:**
Ejecutar `jest --coverage --collectCoverageFrom='src/features/gestion/**/*.ts'`. Verificar que la cobertura de líneas en `stateMachine.ts` y `schemas.ts` es ≥ 60 %. Agregar tests si fuera necesario.
 
**Criterio de hecho:** reporte de cobertura de Jest muestra ≥ 60 % en la lógica de la feature `gestion`.
 
---
 
### T065 — Validar criterios de aceptación de la spec de forma manual
 
**RF/RNF:** Todos los RF-07 · Constitución §6 (definición de hecho)
**Depende de:** T058, T059, T060, T061, T062, T063, T064
**Archivos a crear/modificar:**
- ninguno
**Descripción:**
Recorrer el checklist completo de la spec §11 en un dispositivo o emulador Android real:
- Escenarios 4.1 a 4.17 de forma secuencial.
- Verificar que cada mensaje de error y confirmación de spec §6 aparece con el texto exacto.
- Intentar acciones no autorizadas (otro usuario, estado incorrecto) y confirmar que son bloqueadas.
**Criterio de hecho:** todos los ítems del checklist de spec §11 están marcados como completados.
 