# Tasks 003 — Solicitud de comisión

**Estado:** Pendiente de implementación · **Versión:** 0.1 · **Fecha:** 2026-11-05
**Derivado de:** `003-spec.md` y `003-plan.md`
**Constitución:** v1.1

> Cada tarea es atómica, trazable a un RF/RNF y lista para ser tomada en orden. El desarrollador marca la tarea como completa solo cuando `expo lint`, `tsc` y sus pruebas asociadas pasan sin errores.

---

## Bloque 1 — Base de datos y almacenamiento

### [x] T001 — Migración: tabla `commissions` con RLS ✅
**Trazabilidad:** RF-06 · RNF-04 (Principio 5)
**Archivos a crear:**
- `supabase/migrations/003_commissions.sql`

**Descripción:**
Crear la tabla `commissions` con todas sus columnas, restricciones (`CHECK`, `CONSTRAINT client_ne_artist`), índices y políticas RLS (insert para cliente, select para cliente y artista, update para artista, sin delete). Habilitar RLS con `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.

**Criterio de hecho:** `supabase db push` aplica la migración sin errores; `tsc` y `expo lint` siguen en 0 errores.

---

### [x] T002 — Migración: tabla `commission_references` con RLS ✅
**Trazabilidad:** RF-14 · RNF-04 (Principio 5)
**Archivos a modificar:**
- `supabase/migrations/003_commissions.sql` (misma migración que T001)

**Descripción:**
Agregar la tabla `commission_references` con `CASCADE` sobre `commissions.id`, índice sobre `commission_id`, y políticas RLS (insert para cliente de la comisión, select para cliente y artista, sin delete por UI).

**Criterio de hecho:** migración completa aplica sin errores y los índices existen en la base de datos.

---

### [x] T003 — Bucket de Storage `commission-references` ✅
**Trazabilidad:** RF-14 · RNF-04 · P-3.8
**Archivos a crear:**
- `supabase/storage/003_commission_references_bucket.sql`

**Descripción:**
Crear el bucket `commission-references` como privado, con `file_size_limit = 10485760` (10 MB) y `allowed_mime_types = ['image/jpeg','image/png']`. Definir las políticas RLS de Storage: upload solo para el cliente de la comisión en estado `PENDIENTE`; select para cliente y artista; sin delete.

**Criterio de hecho:** el bucket aparece en el dashboard de Supabase como privado; una petición de subida sin JWT válido recibe 403.

---

### [x] T004 — Pruebas de RLS en Postgres y Storage
**Trazabilidad:** RF-06 · RF-14 · RNF-04 · Principio 9
**Archivos a crear:**
- `supabase/tests/003_rls_test.sql`

**Descripción:**
Implementar los 5 escenarios de prueba de RLS del `plan.md` (sección 11): cliente puede insertar su propia comisión, cliente no puede usurpar `client_id` de otro, tercero no ve comisiones ajenas, artista sí ve las suyas, CHECK constraint bloquea `client_id = artist_id`. Documentar resultado esperado en comentarios SQL.

**Criterio de hecho:** todos los escenarios producen el resultado esperado al ejecutarse contra la base de datos de desarrollo.

---

## Bloque 2 — Tipos, esquemas y utilidades

### [x] T005 — Tipos de dominio TypeScript
**Trazabilidad:** RF-06 · RF-14
**Archivos a crear:**
- `src/features/solicitud/types.ts`

**Descripción:**
Definir `CommissionStatus`, `IntendedUse`, `Commission`, `CommissionReference` y `LocalImageAsset` tal como se especifica en `plan.md` §5.1. Sin `any`; TypeScript estricto.

**Criterio de hecho:** `tsc` compila sin errores.

---

### [x] T006 — Esquema Zod y tipos de formulario
**Trazabilidad:** RF-06
**Archivos a crear:**
- `src/features/solicitud/schemas.ts`

**Descripción:**
Implementar `commissionRequestSchema` con Zod: validaciones de longitud mínima/máxima para `description`, `pose`, `key_elements`, `intended_use` (enum), `additional_notes` y `terms_accepted`. Los mensajes de error deben coincidir literalmente con los definidos en `003-spec.md` §4.

**Criterio de hecho:** tests unitarios cubren todos los campos con valores válidos e inválidos; mensajes de error coinciden al carácter.

---

### [x] T007 — Utilidad de compresión de imágenes
**Trazabilidad:** RF-14 · P-3.1
**Archivos a crear:**
- `src/features/solicitud/utils/compressImage.ts`

**Descripción:**
Implementar `compressImage(asset: LocalImageAsset)` usando `expo-image-manipulator`: redimensionar al máximo 1 920 px en el lado más largo, calidad JPEG 75 %, formato de salida JPEG. Retornar `{ blob: Blob, size: number }`. La función no debe llamar a ningún servicio externo.

**Criterio de hecho:** test unitario con una imagen de prueba muestra que el archivo resultante es más pequeño que el original y es un JPEG válido; `tsc` compila sin errores.

---

### [x] T008 — Hook de permisos de galería
**Trazabilidad:** RF-14 · Principio 8
**Archivos a crear:**
- `src/features/solicitud/hooks/useGalleryPermission.ts`

**Descripción:**
Implementar `requestGalleryPermission()` usando `expo-image-picker`. Si el permiso ya está concedido, retornar `true`. Si fue denegado permanentemente, mostrar el `Alert` con las opciones "Cancelar" y "Ir a Ajustes" (con `Linking.openSettings()`). El mensaje literal del Alert debe ser: "Permiso de galería denegado. Puedes habilitarlo en Ajustes del sistema".

**Criterio de hecho:** en un development build real (Android), denegar el permiso muestra el Alert con el mensaje correcto y el botón "Ir a Ajustes" abre la pantalla de permisos del sistema.

---

## Bloque 3 — Lógica de negocio y datos

### [x] T009 — Hook de mutación `useSubmitCommission`
**Trazabilidad:** RF-06 · RF-14
**Archivos a crear:**
- `src/features/solicitud/hooks/useSubmitCommission.ts`

**Descripción:**
Implementar el hook con `useMutation` de TanStack Query según `plan.md` §5.3. El flujo debe ser:
1. Comprimir cada imagen con `compressImage`.
2. Subir al bucket con `supabase.storage`.
3. INSERT en `commissions`.
4. INSERT en `commission_references`.
Los mensajes de error lanzados deben coincidir literalmente con los de `003-spec.md` §4. En caso de error en cualquier paso, no se crea la comisión (atomicidad manual; si el INSERT de comisión falla tras subir imágenes, dejar las imágenes huérfanas es aceptable en esta versión — se limpiarán manualmente o por una Edge Function futura).

**Criterio de hecho:** test de integración (con Supabase local o mock) crea correctamente una comisión con sus referencias; los errores de red producen los mensajes correctos.

---

## Bloque 4 — Componentes de UI

### [x] T010 — Componente `ServiceSummaryCard`
**Trazabilidad:** RF-06 (visualización de precio y tiempo)
**Archivos a crear:**
- `src/features/solicitud/components/ServiceSummaryCard.tsx`

**Descripción:**
Componente de solo lectura que recibe `{ title: string, base_price: number, estimated_days: number }` y los muestra de forma clara. No permite edición. Texto: "Precio base: $X MXN · Tiempo estimado: N día(s)".

**Criterio de hecho:** `tsc` compila; en la pantalla de solicitud se ve el resumen correcto del servicio seleccionado.

---

### [x] T011 — Componente `TosAcceptanceBlock`
**Trazabilidad:** RF-06 (aceptación de TOS) · Escenarios 3.1 y 3.4
**Archivos a crear:**
- `src/features/solicitud/components/TosAcceptanceBlock.tsx`

**Descripción:**
Recibe `{ tosText: string | null, onAcceptChange: (accepted: boolean) => void }`. Si `tosText` es `null`, renderiza `null` (no muestra nada). Si existe, muestra el texto del TOS en un ScrollView con altura máxima y una casilla de verificación "He leído y acepto los términos de servicio". El estado de la casilla se propaga hacia el formulario.

**Criterio de hecho:** con TOS, la casilla es requerida para habilitar el botón de envío. Sin TOS, el bloque no renderiza nada y el botón no depende de ella.

---

### T012 — Componente `ReferenceImageThumbnail`
**Trazabilidad:** RF-14 · Escenario 3.15
**Archivos a crear:**
- `src/features/solicitud/components/ReferenceImageThumbnail.tsx`

**Descripción:**
Recibe `{ uri: string, onRemove: () => void }`. Muestra una miniatura cuadrada de 80 × 80 dp con un botón "×" en la esquina superior derecha. Al pulsar "×" llama a `onRemove`.

**Criterio de hecho:** `tsc` compila; la imagen se muestra correctamente y el botón elimina la miniatura.

---

### T013 — Componente `ReferenceImagePicker`
**Trazabilidad:** RF-14 · Escenarios 3.9 a 3.15
**Archivos a crear:**
- `src/features/solicitud/components/ReferenceImagePicker.tsx`

**Descripción:**
Gestiona la lista local de imágenes seleccionadas (máx. 5). Al tocar "Agregar referencia":
1. Llama a `requestGalleryPermission()`.
2. Si concedido, abre `ImagePicker.launchImageLibraryAsync` con `allowsMultipleSelection: true`, `mediaTypes: Images`, `quality: 1` (sin compresión de Expo; la compresión se hace con `compressImage` en el hook de submit).
3. Valida formato (JPEG/PNG) y tamaño (≤ 10 MB) por imagen; las inválidas se rechazan con el mensaje correspondiente.
4. Si ya hay 5 imágenes, muestra el mensaje "Solo puedes adjuntar hasta 5 imágenes de referencia".
Renderiza las miniaturas con `ReferenceImageThumbnail` en fila horizontal con scroll.

**Criterio de hecho:** en device real, se pueden seleccionar hasta 5 imágenes; las inválidas son rechazadas con el mensaje correcto; las miniaturas se muestran y el botón × las elimina.

---

## Bloque 5 — Pantallas y rutas

### T014 — Ruta de Expo Router para la solicitud
**Trazabilidad:** RF-06
**Archivos a crear:**
- `src/app/commission/request/[serviceId].tsx`

**Descripción:**
Ruta dinámica que recibe `serviceId` como parámetro. Debe:
1. Leer el servicio y el perfil del artista desde la caché de TanStack Query (ya cargados en spec 002).
2. Verificar que `session.user.id !== artistUserId`; si son iguales, renderizar `ErrorState` con el mensaje "No puedes enviarte una solicitud a ti mismo".
3. Verificar que el servicio está en estado `active`; si no, renderizar `ErrorState` con "Este servicio no está disponible en este momento".
4. Renderizar `CommissionRequestScreen` con los datos del artista, el servicio y el TOS.

**Criterio de hecho:** navegar a la ruta con un `serviceId` válido muestra el formulario; con `serviceId` de un servicio pausado muestra el error; con el propio perfil muestra el bloqueo.

---

### T015 — Pantalla `CommissionRequestScreen`
**Trazabilidad:** RF-06 · RF-14
**Archivos a crear:**
- `src/features/solicitud/screens/CommissionRequestScreen.tsx`

**Descripción:**
Pantalla principal del formulario. Compone:
- `ServiceSummaryCard`
- `TosAcceptanceBlock` (condicional)
- Campos de formulario con `React Hook Form` + `commissionRequestSchema`
- `ReferenceImagePicker`
- Botón "Enviar solicitud" (deshabilitado mientras `useSubmitCommission` está en `isPending` o si el TOS no fue aceptado cuando corresponde)
- Indicador de carga durante el submit

La validación de TOS se hace en el handler de submit: si `hasArtistTos && !form.getValues('terms_accepted')`, mostrar el error "Debes aceptar los términos de servicio del artista para continuar" en el campo correspondiente sin enviar.

Al éxito de `useSubmitCommission`, navegar a `CommissionSuccessScreen`.
Al error, mostrar el mensaje literal del error en un toast o banner.

**Criterio de hecho:** todos los escenarios Given/When/Then de RF-06 y RF-14 son reproducibles en la pantalla; `tsc` y `expo lint` dan 0 errores.

---

### T016 — Pantalla `CommissionSuccessScreen`
**Trazabilidad:** RF-06 · Escenario 3.1
**Archivos a crear:**
- `src/features/solicitud/screens/CommissionSuccessScreen.tsx`

**Descripción:**
Pantalla de confirmación sin estado de formulario. Muestra el mensaje "Tu solicitud fue enviada. El artista la revisará pronto" y un botón "Volver al perfil del artista". Al pulsar el botón, navega de vuelta al perfil del artista (pop o replace en el stack de Expo Router). No permite regresar al formulario con el botón "atrás" del sistema (usar `router.replace` o limpiar el historial en este punto).

**Criterio de hecho:** tras un envío exitoso, la pantalla de éxito aparece y el botón atrás del sistema no regresa al formulario.

---

## Bloque 6 — Pruebas

### T017 — Tests unitarios de Zod y mensajes de error
**Trazabilidad:** RF-06 · Principio 9
**Archivos a crear:**
- `src/features/solicitud/__tests__/schemas.test.ts`

**Descripción:**
Tests con Jest que validan todos los caminos del esquema Zod: descripción vacía, corta (< 20), larga (> 2 000), `intended_use` inválido, campos opcionales sobre 500 caracteres. Cada test afirma el mensaje de error exacto de la spec.

**Criterio de hecho:** `jest --coverage` muestra ≥ 60 % en `schemas.ts`; todos los tests pasan.

---

### T018 — Tests unitarios de `compressImage`
**Trazabilidad:** RF-14 · P-3.1 · Principio 9
**Archivos a crear:**
- `src/features/solicitud/__tests__/compressImage.test.ts`

**Descripción:**
Tests que comprueban: (a) el archivo de salida es JPEG, (b) el tamaño del archivo de salida es menor que el de entrada, (c) la función no lanza con una imagen JPEG válida. Usar un fixture de imagen de prueba pequeño en el repositorio.

**Criterio de hecho:** todos los tests pasan; cobertura en `compressImage.ts` ≥ 60 %.

---

### T019 — Tests de integración del hook `useSubmitCommission` (mock)
**Trazabilidad:** RF-06 · RF-14 · Principio 9
**Archivos a crear:**
- `src/features/solicitud/__tests__/useSubmitCommission.test.ts`

**Descripción:**
Usando mocks de Supabase y de `compressImage`, probar: (a) flujo exitoso crea comisión y referencias; (b) error en la subida de imágenes lanza el mensaje correcto; (c) error en el INSERT de comisión lanza el mensaje correcto. No se hacen llamadas reales a Supabase.

**Criterio de hecho:** todos los tests pasan; cobertura en `useSubmitCommission.ts` ≥ 60 %.

---

## Resumen de trazabilidad

| Tarea | RF/RNF | Archivos clave |
|---|---|---|
| T001 | RF-06, RNF-04 | `supabase/migrations/003_commissions.sql` |
| T002 | RF-14, RNF-04 | `supabase/migrations/003_commissions.sql` |
| T003 | RF-14, P-3.8 | `supabase/storage/003_commission_references_bucket.sql` |
| T004 | RF-06, RF-14, Principio 9 | `supabase/tests/003_rls_test.sql` |
| T005 | RF-06, RF-14 | `src/features/solicitud/types.ts` |
| T006 | RF-06 | `src/features/solicitud/schemas.ts` |
| T007 | RF-14, P-3.1 | `src/features/solicitud/utils/compressImage.ts` |
| T008 | RF-14, Principio 8 | `src/features/solicitud/hooks/useGalleryPermission.ts` |
| T009 | RF-06, RF-14 | `src/features/solicitud/hooks/useSubmitCommission.ts` |
| T010 | RF-06 | `src/features/solicitud/components/ServiceSummaryCard.tsx` |
| T011 | RF-06 | `src/features/solicitud/components/TosAcceptanceBlock.tsx` |
| T012 | RF-14 | `src/features/solicitud/components/ReferenceImageThumbnail.tsx` |
| T013 | RF-14 | `src/features/solicitud/components/ReferenceImagePicker.tsx` |
| T014 | RF-06 | `src/app/commission/request/[serviceId].tsx` |
| T015 | RF-06, RF-14 | `src/features/solicitud/screens/CommissionRequestScreen.tsx` |
| T016 | RF-06 | `src/features/solicitud/screens/CommissionSuccessScreen.tsx` |
| T017 | RF-06, Principio 9 | `src/features/solicitud/__tests__/schemas.test.ts` |
| T018 | RF-14, P-3.1 | `src/features/solicitud/__tests__/compressImage.test.ts` |
| T019 | RF-06, RF-14 | `src/features/solicitud/__tests__/useSubmitCommission.test.ts` |

**Orden de implementación recomendado:** T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010 → T011 → T012 → T013 → T014 → T015 → T016 → T017 → T018 → T019.