# Tareas de implementación 002 — Catálogo de servicios, TOS y búsqueda de artistas
 
**Spec:** `spec.md` v0.1 · **Plan:** `plan.md` · **Constitución:** v1.1 · **Fecha:** 2026-11-03
**Depende de:** T001–T041 (Spec 001 completada)
 
> Cada tarea es atómica: completa un cambio verificable. Las tareas deben realizarse en el orden indicado; el bloqueo entre ellas se señala con `Requiere:`.
 
---
 
## Bloque A — Migración de base de datos
 
### [x] T100 — Crear migración `0002_catalogo_tos.sql`
 
**RF:** RF-02, RF-03, RF-02B
**Archivos:**
- `supabase/migrations/0002_catalogo_tos.sql` ← crear
**Descripción:** Crear el archivo de migración con todo el SQL del plan §2: tablas `services` y `artist_tos`, restricciones `check`, índices, triggers `updated_at`, trigger de límite de 20 servicios (`check_services_limit`), trigger de rol de artista (`check_artist_role`), función `get_artist_public_profile` y todas las políticas RLS.
 
**Criterio de verificación:** `supabase db push` aplica la migración sin errores; `supabase db diff` muestra 0 diferencias pendientes.
 
---
 
### [x] T101 — Verificar y documentar comportamientos de `supabase-js` ⚠️
 
**RF:** RF-02, RF-03, RF-02B
**Archivos:**
- `specs/002-catalogo-tos/plan.md` ← actualizar notas ⚠️
**Descripción:** Verificar en la versión instalada de `supabase-js`:
1. Cómo se recibe el error `services_limit_reached` del trigger (code, message).
2. Qué devuelve `.rpc('get_artist_public_profile')` cuando el artista no existe: `null`, `{}` o `[]`.
3. Cómo llega el error de FK `23503` al cliente cuando hay comisiones activas.
Actualizar `errors.ts` y los comentarios ⚠️ del `plan.md` con los valores reales.
 
**Criterio de verificación:** Los tres comportamientos están documentados con código de ejemplo y los tests unitarios de `errors.ts` los cubren.
 
**Requiere:** T100
 
---
 
## Bloque B — Pruebas de RLS
 
### [x] T102 — Escribir script de pruebas RLS para `services`
 
**RF:** RF-02, RNF-04
**Archivos:**
- `supabase/tests/002_rls_services.sql` ← crear
**Descripción:** Script SQL que usa dos usuarios de prueba (`user_a`, `user_b`) y verifica:
1. `user_a` crea un servicio y lo lee (éxito).
2. `user_b` no puede leer el servicio de `user_a` (0 filas).
3. `user_b` no puede actualizar ni eliminar el servicio de `user_a` (error de RLS).
4. `anon` (sin JWT) recibe error al intentar cualquier operación sobre `services`.
5. El trigger de límite rechaza el servicio número 21.
6. El trigger de artista rechaza la inserción si el usuario no tiene handle.
7. *(Placeholder)* La FK impide eliminar un servicio con comisión activa — marcar como `TODO: spec 004`.
**Criterio de verificación:** Ejecutar el script en Supabase Studio; todos los asserts pasan.
 
**Requiere:** T100
 
---
 
### T103 — Escribir script de pruebas RLS para `artist_tos`
 
**RF:** RF-03, RNF-04
**Archivos:**
- `supabase/tests/002_rls_tos.sql` ← crear
**Descripción:** Script SQL que verifica:
1. `user_a` hace upsert de TOS y lo lee (éxito).
2. `user_b` no puede leer el TOS de `user_a`.
3. `user_b` no puede actualizar el TOS de `user_a`.
4. `anon` recibe error al intentar cualquier operación sobre `artist_tos`.
5. El check de longitud rechaza contenido < 10 y > 5000 caracteres.
**Criterio de verificación:** Todos los asserts pasan.
 
**Requiere:** T100
 
---
 
### T104 — Verificar función `get_artist_public_profile`
 
**RF:** RF-02B, RNF-04
**Archivos:**
- `supabase/tests/002_rls_public_profile.sql` ← crear
**Descripción:** Verificar que:
1. Un usuario autenticado puede llamar `get_artist_public_profile` con un handle válido y recibe el perfil con servicios activos y TOS.
2. Los servicios pausados **no** aparecen en el retorno.
3. Llamar con un handle inexistente devuelve `null`.
4. `anon` no puede ejecutar la función (error de permiso).
5. El perfil no incluye el correo del artista ni ningún campo privado.
**Criterio de verificación:** Todos los asserts pasan.
 
**Requiere:** T100, T102
 
---
 
## Bloque C — Módulo TypeScript base
 
### T105 — Crear `src/features/catalogo/types.ts`
 
**RF:** RF-02, RF-03, RF-02B
**Archivos:**
- `src/features/catalogo/types.ts` ← crear
**Descripción:** Copiar los tipos del plan §3. Verificar que `tsc --noEmit` pasa sin errores.
 
**Criterio de verificación:** `tsc` 0 errores. Sin uso de `any`.
 
---
 
### T106 — Crear `src/features/catalogo/messages.ts`
 
**RF:** RF-02, RF-03, RF-02B
**Archivos:**
- `src/features/catalogo/messages.ts` ← crear
**Descripción:** Copiar el objeto `MESSAGES` del plan §8. Cada mensaje debe coincidir literalmente con la tabla de la spec §4.
 
**Criterio de verificación:** Comparación manual entre `MESSAGES` y la tabla spec §4; 0 discrepancias.
 
---
 
### T107 — Crear `src/features/catalogo/schemas.ts`
 
**RF:** RF-02, RF-03, RF-02B
**Archivos:**
- `src/features/catalogo/schemas.ts` ← crear
**Descripción:** Implementar los esquemas Zod del plan §4: `serviceSchema`, `tosSchema`, `searchHandleSchema`. Incluir el transform que elimina el `@` del handle.
 
**Criterio de verificación:** Tests unitarios Jest cubren:
- Todos los campos con valores válidos en el borde (min, max).
- Campos obligatorios vacíos generan el mensaje correcto.
- `searchHandleSchema` normaliza `@usuario` → `usuario`.
---
 
### T108 — Crear `src/features/catalogo/errors.ts`
 
**RF:** RF-02, RF-03, RF-02B
**Archivos:**
- `src/features/catalogo/errors.ts` ← crear
**Descripción:** Implementar `catalogoErrors.handle` del plan §8, con los mapeos de código de error Postgres/Supabase a mensajes (actualizando los ⚠️ resueltos en T101).
 
**Criterio de verificación:** Tests unitarios Jest cubren cada rama del `switch/if`; mensajes coinciden con `MESSAGES`.
 
**Requiere:** T101, T106
 
---
 
### T109 — Crear `src/features/catalogo/api.ts`
 
**RF:** RF-02, RF-03, RF-02B
**Archivos:**
- `src/features/catalogo/api.ts` ← crear
**Descripción:** Implementar las funciones del plan §6: `getMyServices`, `createService`, `updateService`, `deleteService`, `getMyTos`, `upsertTos`, `getArtistPublicProfile`.
 
**Criterio de verificación:** `tsc` 0 errores. Sin `any`.
 
**Requiere:** T105, T108
 
---
 
### T110 — Crear `src/features/catalogo/queries.ts`
 
**RF:** RF-02, RF-03, RF-02B
**Archivos:**
- `src/features/catalogo/queries.ts` ← crear
**Descripción:** Implementar los hooks de TanStack Query del plan §7: `useMyServices`, `useMyTos`, `useCreateService`, `useUpdateService`, `useDeleteService`, `useUpsertTos`, `useArtistPublicProfile`.
 
**Criterio de verificación:** `tsc` 0 errores.
 
**Requiere:** T109
 
---
 
### T111 — Crear `src/features/catalogo/hooks/useServiceForm.ts` y `useTosForm.ts`
 
**RF:** RF-02, RF-03
**Archivos:**
- `src/features/catalogo/hooks/useServiceForm.ts` ← crear
- `src/features/catalogo/hooks/useTosForm.ts` ← crear
**Descripción:** Implementar los hooks de React Hook Form con `zodResolver` del plan §5.
 
**Criterio de verificación:** `tsc` 0 errores.
 
**Requiere:** T107
 
---
 
## Bloque D — Pantallas de gestión del artista
 
### T112 — Crear pantalla `catalogo/index.tsx` (lista de servicios del artista)
 
**RF:** RF-02
**Archivos:**
- `src/app/(app)/catalogo/index.tsx` ← crear
**Descripción:** Pantalla que muestra la lista de servicios del artista autenticado (activos y pausados). Incluye:
- `FlatList` con cada servicio: título, precio, tiempo, estado (etiqueta "Pausado" si corresponde).
- Botón flotante "Nuevo servicio" que navega a `catalogo/nuevo`.
- Si el usuario no tiene `is_artist`, muestra un CTA para activar el perfil de artista (navega a `artist-setup`).
- Si la lista está vacía, muestra un estado vacío con invitación a crear el primer servicio.
- Maneja el estado de carga y error con mensajes del `MESSAGES`.
- Bloquea el botón "Nuevo servicio" si ya hay 20 servicios, mostrando `MESSAGES.limitReached`.
**Criterio de verificación:** Escenarios 2.1 y 2.3 de la spec pasan en dispositivo Android físico o emulador.
 
**Requiere:** T110
 
---
 
### T113 — Crear pantalla `catalogo/nuevo.tsx` (formulario de creación)
 
**RF:** RF-02
**Archivos:**
- `src/app/(app)/catalogo/nuevo.tsx` ← crear
**Descripción:** Formulario con campos: Título, Descripción (opcional), Precio (MXN), Tiempo de entrega (días). Usa `useServiceForm` y `useCreateService`. Al guardar con éxito, regresa a `catalogo/index` y la lista se actualiza. Muestra errores de validación campo por campo.
 
**Criterio de verificación:** Escenarios 2.1 y 2.2 pasan.
 
**Requiere:** T111, T112
 
---
 
### T114 — Crear pantalla `catalogo/[id].tsx` (editar / pausar / eliminar)
 
**RF:** RF-02
**Archivos:**
- `src/app/(app)/catalogo/[id].tsx` ← crear
**Descripción:** Pantalla que carga el servicio por `id`. Permite:
- Editar todos los campos (usa `useServiceForm` prellenado y `useUpdateService`).
- Pausar (si `status = 'active'`) o activar (si `status = 'paused'`): usa `useUpdateService` con `{ status }`.
- Eliminar: muestra un `Alert.alert` de confirmación. Si la eliminación falla por comisiones activas, muestra `MESSAGES.activeCommissions`.
**Criterio de verificación:** Escenarios 2.4, 2.5, 2.6, 2.7 y 2.8 pasan.
 
**Requiere:** T113
 
---
 
### T115 — Crear pantalla `catalogo/tos.tsx` (editor de TOS)
 
**RF:** RF-03
**Archivos:**
- `src/app/(app)/catalogo/tos.tsx` ← crear
**Descripción:** Pantalla con un `TextInput` multilinea para el TOS. Muestra un contador de caracteres (`X / 5000`). Usa `useTosForm` y `useUpsertTos`. Al abrir, carga el TOS actual con `useMyTos` y pone el contenido en el formulario. Al guardar con éxito, muestra confirmación y permanece en la pantalla.
 
**Criterio de verificación:** Escenarios 3.1, 3.2 y 3.3 pasan.
 
**Requiere:** T111, T110
 
---
 
## Bloque E — Pantalla de búsqueda pública
 
### T116 — Crear pantalla `buscar.tsx` (búsqueda por handle y perfil público)
 
**RF:** RF-02B
**Archivos:**
- `src/app/(app)/buscar.tsx` ← crear
**Descripción:** Pantalla con un campo de texto para buscar por handle. Al ejecutar la búsqueda:
- Normaliza el input (elimina `@`) con `searchHandleSchema`.
- Llama a `useArtistPublicProfile`.
- Si el resultado es `null`, muestra `MESSAGES.handleNotFound`.
- Si el resultado existe, renderiza el perfil público:
  - Nombre del artista y handle.
  - Sección "Catálogo": lista de servicios activos (`PublicServiceItem[]`). Si está vacía, muestra `MESSAGES.catalogEmpty`.
  - Sección "Términos de servicio": contenido del TOS. Si es `null`, muestra `MESSAGES.noTos`.
- La pantalla solo es accesible para usuarios autenticados (guarda de Expo Router ya activa en `(app)`).
**Criterio de verificación:** Escenarios 2B.1, 2B.2, 2B.3 y 2B.5 pasan en dispositivo Android.
 
**Requiere:** T110
 
---
 
## Bloque F — Acceso a "Buscar" desde la navegación
 
### T117 — Agregar enlace a "Buscar" en la navegación principal
 
**RF:** RF-02B
**Archivos:**
- `src/app/(app)/_layout.tsx` ← modificar
- `src/app/(app)/index.tsx` ← modificar (agregar CTA "Buscar artista" para usuarios cliente)
**Descripción:** Agregar `buscar` a la navegación principal (tab o menú según el diseño vigente). El enlace debe ser visible para todos los usuarios autenticados (tanto artistas como clientes).
 
**Criterio de verificación:** El usuario puede llegar a `buscar.tsx` desde la pantalla de inicio en un paso.
 
**Requiere:** T116
 
---
 
## Bloque G — Integración con navegación del catálogo artista
 
### T118 — Agregar acceso al catálogo y TOS desde el panel del artista
 
**RF:** RF-02, RF-03
**Archivos:**
- `src/app/(app)/index.tsx` ← modificar
**Descripción:** En el `index.tsx` del artista (modo artista activo), agregar tarjetas o botones para "Gestionar catálogo" (navega a `catalogo/index`) y "Mis términos de servicio" (navega a `catalogo/tos`).
 
**Criterio de verificación:** El artista puede navegar a su catálogo y TOS desde la pantalla de inicio en un paso.
 
**Requiere:** T112, T115
 
---
 
## Bloque H — Pruebas unitarias
 
### T119 — Tests unitarios de `schemas.ts`
 
**RF:** RF-02, RF-03, RF-02B
**Archivos:**
- `src/features/catalogo/__tests__/schemas.test.ts` ← crear
**Descripción:** Tests Jest para cada esquema Zod:
- `serviceSchema`: valores válidos, campos vacíos, valores en el borde de cada restricción.
- `tosSchema`: longitud mínima, máxima, exactamente 10 y 5000 caracteres.
- `searchHandleSchema`: normalización de `@`, string vacío, string válido.
Meta: ≥ 60 % de cobertura en `schemas.ts`.
 
**Criterio de verificación:** `jest --coverage` reporta ≥ 60 % para `schemas.ts`; 0 fallos.
 
**Requiere:** T107
 
---
 
### T120 — Tests unitarios de `errors.ts`
 
**RF:** RF-02, RF-03, RF-02B
**Archivos:**
- `src/features/catalogo/__tests__/errors.test.ts` ← crear
**Descripción:** Tests Jest para `catalogoErrors.handle`: una prueba por rama (cada código de error mapeado en T108 + el caso genérico).
 
**Criterio de verificación:** Todos los mensajes de `MESSAGES` usados en `errors.ts` tienen al menos una prueba.
 
**Requiere:** T108
 
---
 
## Bloque I — Lint, tipos y checklist final
 
### T121 — Verificar `expo lint` y `tsc` sin errores
 
**RF:** Todos
**Archivos:** Todos los archivos del módulo `src/features/catalogo/` y `src/app/(app)/catalogo/`
 
**Descripción:** Ejecutar `npx expo lint` y `tsc --noEmit`. Corregir todos los errores y warnings.
 
**Criterio de verificación:** 0 errores en `expo lint` y `tsc`.
 
**Requiere:** T119, T120
 
---
 
### T122 — Ejecutar el checklist de aceptación de la spec
 
**RF:** Todos
**Archivos:**
- `specs/002-catalogo-tos/spec.md` ← marcar checkboxes
**Descripción:** Recorrer cada ítem del checklist §10 de `spec.md` en un dispositivo Android real o emulador. Marcar cada ítem como completado. Si alguno falla, crear una tarea de corrección antes de dar por cerrada esta spec.
 
**Criterio de verificación:** Todos los checkboxes de spec §10 marcados.
 
**Requiere:** T121
 
---
 
## Resumen de trazabilidad
 
| Tarea | RF / RNF |
|---|---|
| T100 | RF-02, RF-03, RF-02B, RNF-04 |
| T101 | RF-02, RF-03, RF-02B |
| T102 | RF-02, RNF-04 |
| T103 | RF-03, RNF-04 |
| T104 | RF-02B, RNF-04 |
| T105 | RF-02, RF-03, RF-02B |
| T106 | RF-02, RF-03, RF-02B |
| T107 | RF-02, RF-03, RF-02B |
| T108 | RF-02, RF-03, RF-02B |
| T109 | RF-02, RF-03, RF-02B |
| T110 | RF-02, RF-03, RF-02B |
| T111 | RF-02, RF-03 |
| T112 | RF-02 |
| T113 | RF-02 |
| T114 | RF-02 |
| T115 | RF-03 |
| T116 | RF-02B |
| T117 | RF-02B |
| T118 | RF-02, RF-03 |
| T119 | RF-02, RF-03, RF-02B, RNF-08 |
| T120 | RF-02, RF-03, RF-02B |
| T121 | Todos |
| T122 | Todos |
 