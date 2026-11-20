# Tasks 006 — Subida y Visualización de Avances (`006-avances`)

**Estado:** Pendiente · **Versión:** 0.1 · **Fecha:** 2026-11-18
**Derivado de:** `006-avances/spec.md` y `006-avances/plan.md`
**Constitución:** v1.1

> Cada tarea es atómica, independiente y trazable a un RF/RNF. Se implementan en el orden indicado.

---

## T001 — Migración de base de datos: tablas, índices y bucket [x]

**Traza:** RF-09-A, RF-09-B, RNF (Principio 5)
**Tipo:** Infraestructura
**Archivos a crear:**
- `supabase/migrations/010_commission_advances.sql`

**Descripción:**
Crear el archivo de migración completo que incluye:
1. Tabla `commission_advances` con todas sus columnas, restricciones y CHECK constraint de nota ≤ 300 caracteres.
2. Tabla `commission_advance_files` con FK a `commission_advances` (CASCADE) y CHECK de `file_size > 0`.
3. Índices: `idx_commission_advances_commission_id` y `idx_advance_files_advance_id`.
4. Creación del bucket `commission-advances` (privado, límite 300 KB, tipos MIME permitidos).
5. Políticas RLS en ambas tablas (INSERT y SELECT según `plan.md`, sección 3.4).
6. Políticas RLS en `storage.objects` para el bucket (INSERT y SELECT según `plan.md`, sección 3.3).

**Criterio de hecho:** `supabase db push` ejecuta sin errores; RLS habilitado en ambas tablas; bucket creado y privado.

---

## T002 — Pruebas RLS [x]

**Traza:** RF-09-A (escenario 6.7), RF-09-B (escenario 6.12), RNF-04, Principio 5
**Tipo:** Pruebas de infraestructura
**Archivos a crear:**
- `supabase/tests/006_rls_test.sql`

**Descripción:**
Implementar las 10 pruebas SQL documentadas en `plan.md`, sección 6:
- T2.1: artista puede insertar avance en comisión propia `EN_PROGRESO`.
- T2.2: artista no puede insertar avance en comisión ajena.
- T2.3: artista no puede insertar avance en comisión que no está `EN_PROGRESO`.
- T2.4: artista puede leer sus propios avances.
- T2.5: cliente puede leer avances de su comisión.
- T2.6: tercero no puede leer avances de comisión ajena (resultado 0 filas).
- T2.7: nadie puede hacer UPDATE en un avance.
- T2.8: nadie puede hacer DELETE en un avance.
- T2.9: nota > 300 caracteres falla por CHECK constraint.
- T2.10: archivo huérfano falla por FK constraint.

**Criterio de hecho:** todos los casos retornan el resultado esperado al ejecutar contra la instancia local de Supabase.

---

## T003 — Tipos de dominio TypeScript [x]

**Traza:** RF-09-A, RF-09-B, Principio 5
**Tipo:** Código base
**Archivos a crear:**
- `src/features/avances/types.ts`

**Descripción:**
Definir las interfaces `CommissionAdvance` y `CommissionAdvanceFile` según `plan.md`, sección 4.4.
- `CommissionAdvance`: `id`, `commission_id`, `artist_id`, `stage: CreativeStage`, `note: string | null`, `created_at: string`, `files: CommissionAdvanceFile[]`.
- `CommissionAdvanceFile`: `id`, `advance_id`, `storage_path`, `file_size`, `sort_order`, `signed_url: string | null`.
- Importar `CreativeStage` desde `@/features/gestion/types` (ya definido en Spec 004).

**Criterio de hecho:** `tsc --noEmit` da 0 errores con los tipos nuevos.

---

## T004 — Esquema de validación Zod [x]

**Traza:** RF-09-A (escenario 6.6), RNF-08
**Tipo:** Código base
**Archivos a crear:**
- `src/features/avances/schemas.ts`

**Descripción:**
Implementar `uploadAdvanceSchema` con Zod:
- Campo `note`: `string`, máx. 300 caracteres con mensaje `'La nota no puede superar los 300 caracteres'`, opcional o cadena vacía.
- Exportar el tipo inferido `UploadAdvanceFormValues`.

**Criterio de hecho:** test unitario verifica que nota de 301 caracteres falla y nota de 300 caracteres pasa.

---

## T005 — Utilidad de solicitud de permiso de galería [x]

**Traza:** RF-09-A (escenario 6.3), Principio 8
**Tipo:** Utilidad de dispositivo
**Archivos a crear:**
- `src/features/avances/utils/requestGalleryPermission.ts`

**Descripción:**
Implementar la función `requestGalleryPermission()` que usa `expo-image-picker`:
- Llama a `ImagePicker.requestMediaLibraryPermissionsAsync()`.
- Retorna `{ granted: true }` si el permiso es concedido.
- Retorna `{ granted: false, canAskAgain: boolean }` si es denegado.
- No lanza excepciones; el llamador maneja la denegación.

**Criterio de hecho:** función tipada correctamente; `tsc --noEmit` da 0 errores.

---

## T006 — Utilidad de selección de imágenes desde galería [x]

**Traza:** RF-09-A (escenarios 6.1, 6.2), Principio 8
**Tipo:** Utilidad de dispositivo
**Archivos a crear:**
- `src/features/avances/utils/pickAdvanceImages.ts`

**Descripción:**
Implementar la función `pickAdvanceImages()` que usa `expo-image-picker`:
- `MediaTypeOptions.Images`, `allowsMultipleSelection: true`, `selectionLimit: 3`, `quality: 1`, `exif: false`.
- Retorna `PickedImage[]` (con `uri`, `width`, `height`) o `null` si el usuario cancela.

**Criterio de hecho:** función tipada correctamente; `tsc --noEmit` da 0 errores.

---

## T007 — Utilidad de compresión de imágenes [x]

**Traza:** RF-09-A, RNF (Principio 2, ≤ 300 KB)
**Tipo:** Utilidad de procesamiento
**Archivos a crear:**
- `src/features/avances/utils/compressAdvanceImage.ts`

**Descripción:**
Implementar la función `compressAdvanceImage(uri: string)` usando `expo-image-manipulator`:
- Redimensionar al ancho máximo de 1080 px manteniendo proporción.
- Comprimir con calidad 0.72 en formato WebP.
- Leer el tamaño del archivo resultante con `expo-file-system`.
- Retornar `CompressedImage` con `uri`, `width`, `height` y `fileSize`.

**Criterio de hecho:** test manual con una imagen de más de 1 MB retorna un archivo de menos de 300 KB; `tsc --noEmit` da 0 errores.

---

## T008 — Hook `useCommissionAdvances` (query) [x]

**Traza:** RF-09-B (escenarios 6.8, 6.9, 6.10, 6.11)
**Tipo:** Lógica de datos
**Archivos a crear:**
- `src/features/avances/hooks/useCommissionAdvances.ts`

**Descripción:**
Implementar el hook `useCommissionAdvances(commissionId: string)` con TanStack Query:
- Query a `commission_advances` con JOIN a `commission_advance_files`.
- Ordenar por `created_at DESC`.
- Generar URLs firmadas (1 hora) para cada archivo con `supabase.storage.createSignedUrl`.
- `staleTime: 60_000` (1 minuto).
- Exportar `commissionAdvancesQueryKey` para invalidación en la mutación.

**Criterio de hecho:** test unitario verifica que el hook retorna un array vacío para una comisión sin avances y un array ordenado para una con avances.

---

## T009 — Hook `useUploadAdvance` (mutación) [x]

**Traza:** RF-09-A (escenarios 6.1, 6.2, 6.4, 6.5, 6.7)
**Tipo:** Lógica de datos
**Archivos a crear:**
- `src/features/avances/hooks/useUploadAdvance.ts`

**Descripción:**
Implementar el hook `useUploadAdvance()` con TanStack Query `useMutation` según `plan.md`, sección 4.6:
1. Validar `currentStatus === 'EN_PROGRESO'`; lanzar error `'No puedes subir avances en una comisión que no está en progreso'` si no.
2. Comprimir todas las imágenes en paralelo (`compressAdvanceImage`).
3. INSERT en `commission_advances` (obtener `advance_id`).
4. Subir archivos al bucket `commission-advances` en paralelo.
5. INSERT en `commission_advance_files`.
6. En caso de error en paso 5: limpiar archivos de Storage y eliminar el registro de `commission_advances`.
7. `onSuccess`: invalidar `commissionAdvancesQueryKey(commissionId)`.

**Criterio de hecho:** test unitario con Supabase mock verifica que un fallo en la subida de archivos no deja registros huérfanos; `tsc --noEmit` da 0 errores.

---

## T010 — Componente `AdvanceStageBadge`

**Traza:** RF-09-B (escenarios 6.8, 6.9)
**Tipo:** Componente UI
**Archivos a crear:**
- `src/features/avances/components/AdvanceStageBadge.tsx`

**Descripción:**
Chip visual que muestra el nombre de la etapa creativa del avance:
- Props: `stage: CreativeStage`.
- Usar la función `getStageName` de `src/features/gestion/stateMachine.ts` (ya implementada en Spec 004) para obtener el nombre visible ("Boceto", "Delineado", "Color / Acabado final").
- Distinción visual (color o icono) por etapa, coherente con el `CreativeStageIndicator` de Spec 004.

**Criterio de hecho:** `expo lint` da 0 errores; renderiza correctamente las tres etapas en Storybook o snapshot test.

---

## T011 — Componente `AdvanceImageGrid`

**Traza:** RF-09-B (escenarios 6.8, 6.9)
**Tipo:** Componente UI
**Archivos a crear:**
- `src/features/avances/components/AdvanceImageGrid.tsx`

**Descripción:**
Grid de miniaturas de imágenes para un avance (1 a 3 imágenes):
- Props: `files: CommissionAdvanceFile[]`.
- Muestra las miniaturas usando `signed_url`; si `signed_url` es null, muestra un placeholder de error.
- Al tocar una miniatura, abre la imagen en pantalla completa (lightbox). Usar `expo-image` para carga optimizada.
- Layout: 1 imagen → centrada; 2 imágenes → fila de dos; 3 imágenes → fila de tres o cuadrícula 2+1.

**Criterio de hecho:** `expo lint` da 0 errores; renderiza correctamente 1, 2 y 3 imágenes sin desbordamiento.

---

## T012 — Componente `AdvanceCard`

**Traza:** RF-09-B (escenarios 6.8, 6.9)
**Tipo:** Componente UI
**Archivos a crear:**
- `src/features/avances/components/AdvanceCard.tsx`

**Descripción:**
Tarjeta que representa un avance individual en el historial:
- Props: `advance: CommissionAdvance`.
- Muestra `AdvanceImageGrid` con los archivos del avance.
- Muestra `AdvanceStageBadge` con la etapa del avance.
- Muestra la nota del artista si `note` no es null. Si `note` es null, no renderiza el espacio de nota.
- Muestra la fecha/hora de `created_at` en formato relativo (ej. "hace 3 horas", "15 nov · 10:42"); usar la misma utilidad de fechas relativas de Spec 005.

**Criterio de hecho:** `expo lint` da 0 errores; test snapshot cubre los casos con y sin nota.

---

## T013 — Componente `AdvancesList`

**Traza:** RF-09-B (escenarios 6.8, 6.9, 6.10, 6.11)
**Tipo:** Componente UI
**Archivos a crear:**
- `src/features/avances/components/AdvancesList.tsx`

**Descripción:**
Lista de avances reutilizable para artista y cliente:
- Props: `commissionId: string`, `role: 'artist' | 'client'`.
- Usa `useCommissionAdvances(commissionId)` internamente.
- Muestra skeletons durante la carga inicial.
- Si hay avances, renderiza una `FlatList` de `AdvanceCard` en orden cronológico inverso.
- Si no hay avances (array vacío), muestra el estado vacío según el rol:
  - `role === 'artist'`: "Aún no has subido avances para esta comisión."
  - `role === 'client'`: "El artista aún no ha compartido avances."

**Criterio de hecho:** `expo lint` da 0 errores; renderiza el estado vacío correcto para cada rol.

---

## T014 — Componente `UploadAdvanceSheet`

**Traza:** RF-09-A (escenarios 6.1, 6.2, 6.3, 6.4, 6.5, 6.6)
**Tipo:** Componente UI + lógica de flujo
**Archivos a crear:**
- `src/features/avances/components/UploadAdvanceSheet.tsx`

**Descripción:**
Bottom sheet que gestiona el flujo completo de subida de un avance:
- Props: `commissionId: string`, `artistId: string`, `currentStatus: CommissionStatus`, `currentStage: CreativeStage`, `onClose: () => void`.
- Paso 1 (selección): botón "Seleccionar imágenes" que llama a `requestGalleryPermission()` y luego `pickAdvanceImages()`.
  - Si el permiso es denegado: mostrar mensaje literal "No se puede acceder a la galería. Puedes habilitarlo en los ajustes de tu dispositivo". No cerrar el sheet.
  - Si el usuario cancela el picker: volver al estado inicial sin error.
- Paso 2 (previsualización + nota): muestra `AdvanceImageGrid` con las imágenes seleccionadas y un `TextInput` para la nota.
  - Usar `React Hook Form` + `uploadAdvanceSchema` para validación del campo `note`.
- Paso 3 (subida): al confirmar, llama a `useUploadAdvance`.
  - Durante la subida: mostrar indicador de carga; deshabilitar el botón de confirmar.
  - En éxito: mostrar toast "Avance subido correctamente" y cerrar el sheet.
  - En error: mostrar mensaje de error literal y mantener el sheet abierto para reintentar.
- Validar `currentStatus === 'EN_PROGRESO'` al abrir; si no cumple, mostrar el error y cerrar el sheet.

**Criterio de hecho:** `expo lint` da 0 errores; los mensajes literales de la spec aparecen en los escenarios correspondientes.

---

## T015 — Integrar `AdvancesList` en `CommissionWorkScreen` (artista)

**Traza:** RF-09-A, RF-09-B (escenarios 6.1, 6.9, 6.11)
**Tipo:** Integración en pantalla existente
**Archivos a modificar:**
- `src/features/gestion/screens/CommissionWorkScreen.tsx`

**Descripción:**
Modificar `CommissionWorkScreen` para incluir la sección de avances:
1. Agregar el componente `AdvancesList` con `role="artist"` en la sección inferior del panel de trabajo.
2. Agregar el botón "Agregar avance" visible solo cuando `status === 'EN_PROGRESO'`.
3. Al presionar "Agregar avance", abrir `UploadAdvanceSheet` con los props correspondientes (`commissionId`, `artistId`, `currentStatus`, `currentStage`).
4. No modificar ninguna lógica existente de gestión de etapas (RF-07-E).

**Criterio de hecho:** el artista puede subir un avance y ver el historial actualizado sin reiniciar la app; `expo lint` da 0 errores.

---

## T016 — Integrar `AdvancesList` en `CommissionDetailScreen` (cliente)

**Traza:** RF-09-B (escenarios 6.8, 6.10, 6.12)
**Tipo:** Integración en pantalla existente
**Archivos a modificar:**
- `src/features/seguimiento/screens/CommissionDetailScreen.tsx`

**Descripción:**
Modificar `CommissionDetailScreen` (Spec 005) para incluir la sección de avances:
1. Agregar el componente `AdvancesList` con `role="client"` en el detalle de la comisión, después del stepper de etapas.
2. No agregar ningún botón de acción en esta pantalla (solo lectura, Principio 11 y regla 7 de Spec 005).
3. No modificar ninguna lógica existente de seguimiento.

**Criterio de hecho:** el cliente puede ver el historial de avances en el detalle de su comisión; `expo lint` da 0 errores.

---

## T017 — Tests unitarios de lógica de validación

**Traza:** RNF-08 (cobertura ≥ 60 %), Principio 9
**Tipo:** Pruebas
**Archivos a crear:**
- `src/features/avances/__tests__/schemas.test.ts`
- `src/features/avances/__tests__/useUploadAdvance.test.ts`

**Descripción:**
Implementar las pruebas unitarias necesarias para alcanzar cobertura ≥ 60 %:

`schemas.test.ts`:
- Nota de 300 caracteres: pasa la validación.
- Nota de 301 caracteres: falla con mensaje `'La nota no puede superar los 300 caracteres'`.
- Nota vacía: pasa (campo opcional).
- Nota `undefined`: pasa (campo opcional).

`useUploadAdvance.test.ts` (con mock de Supabase):
- Cuando `currentStatus !== 'EN_PROGRESO'`: lanza error con mensaje `'No puedes subir avances en una comisión que no está en progreso'`.
- Cuando el INSERT de `commission_advance_files` falla: el hook elimina los archivos subidos y el registro de `commission_advances`.
- Subida exitosa: invalida `commissionAdvancesQueryKey`.

**Criterio de hecho:** `jest --coverage` reporta ≥ 60 % en la lógica de los archivos cubiertos; `expo lint` da 0 errores.

---

## Mapa de trazabilidad

| Tarea | RF/RNF | Escenarios cubiertos |
|---|---|---|
| T001 | RF-09-A, RF-09-B, Principio 5 | — (infraestructura) |
| T002 | RF-09-A esc. 6.7, RF-09-B esc. 6.12, RNF-04 | 6.7, 6.12 |
| T003 | RF-09-A, RF-09-B | — (tipos base) |
| T004 | RF-09-A esc. 6.6 | 6.6 |
| T005 | RF-09-A esc. 6.3, Principio 8 | 6.3 |
| T006 | RF-09-A esc. 6.1, 6.2, Principio 8 | 6.1, 6.2 |
| T007 | RF-09-A, Principio 2 | 6.1, 6.2 |
| T008 | RF-09-B esc. 6.8, 6.9, 6.10, 6.11 | 6.8, 6.9, 6.10, 6.11 |
| T009 | RF-09-A esc. 6.1, 6.2, 6.4, 6.5, 6.7 | 6.1, 6.2, 6.4, 6.5, 6.7 |
| T010 | RF-09-B esc. 6.8, 6.9 | 6.8, 6.9 |
| T011 | RF-09-B esc. 6.8, 6.9 | 6.8, 6.9 |
| T012 | RF-09-B esc. 6.8, 6.9 | 6.8, 6.9 |
| T013 | RF-09-B esc. 6.8, 6.9, 6.10, 6.11 | 6.8, 6.9, 6.10, 6.11 |
| T014 | RF-09-A esc. 6.1–6.6 | 6.1, 6.2, 6.3, 6.4, 6.5, 6.6 |
| T015 | RF-09-A, RF-09-B esc. 6.9, 6.11 | 6.1, 6.9, 6.11 |
| T016 | RF-09-B esc. 6.8, 6.10 | 6.8, 6.10 |
| T017 | RNF-08, Principio 9 | 6.4, 6.5, 6.6 |