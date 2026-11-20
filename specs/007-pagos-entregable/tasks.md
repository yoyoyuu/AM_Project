# Tasks 007 — Registro de Pagos, Comprobantes y Entregable Final (`007-pagos-entregable`)

**Estado:** Pendiente · **Versión:** 0.1 · **Fecha:** 2026-11-20
**Derivado de:** `007-pagos-entregable/spec.md` y `007-pagos-entregable/plan.md`
**Constitución:** v1.1

> Cada tarea es atómica y trazable a un RF/RNF. Se implementan en el orden indicado. Los commits los hace la persona con Conventional Commits y el ID de tarea (por ejemplo, `feat: T001 payments migration`).

---

## Fase A — Base de datos y seguridad

### T001 — Migración: ENUM, columnas e invariantes [x]

**Traza:** RF-11-A, RF-24-B, RNF-SEG-7.2, Principio 5
**Archivos a crear:**
- `supabase/migrations/011_payments_deliverables.sql`

**Descripción:**
Crear la migración con las secciones 1–3 de `plan.md` §2.2:
1. `CREATE TYPE public.payment_status` (`UNPAID`, `UNDER_REVIEW`, `NEEDS_CORRECTION`, `VERIFIED`).
2. `ALTER TABLE public.commissions` con las 10 columnas nuevas y sus `CHECK` de longitud/rango.
3. Constraints `payment_proof_required`, `payment_correction_reason_required`, `paid_verified_at_required`, `deliverable_fields_consistent` y `completed_requires_payment_and_deliverable` (`NOT VALID`).
4. Índice `idx_commissions_artist_payment` (§2.4).

**Criterio de hecho:** `supabase db reset` aplica 001–007 sin errores; las filas existentes quedan con `payment_status = 'UNPAID'`.

---

### T002 — Migración: blindaje de columnas (trigger de INSERT y privilegios de UPDATE) [x]

**Traza:** RF-11-A (Escenario 7.2), RNF-SEG-7.2, Principio 6
**Archivos a modificar:**
- `supabase/migrations/011_payments_deliverables.sql`

**Descripción:**
Agregar la sección 4 de `plan.md` §2.2:
1. Función `public.commissions_reset_payment_fields()` y trigger `BEFORE INSERT`.
2. `REVOKE UPDATE ON public.commissions FROM anon, authenticated;`
3. `GRANT UPDATE (status, current_stage, rejection_reason) ON public.commissions TO authenticated;`

**Criterio de hecho:** un `UPDATE … SET payment_status = 'VERIFIED'` como `authenticated` falla con *permission denied*; el flujo de aceptar/rechazar/avanzar de la Spec 004 sigue funcionando en la app.

---

### T003 — Migración: funciones RPC [x]

**Traza:** RF-21-A, RF-20-A, RF-11-B, RF-15-A, RF-24-A, RF-24-B
**Archivos a modificar:**
- `supabase/migrations/011_payments_deliverables.sql`

**Descripción:**
Agregar las cuatro funciones de `plan.md` §2.3 (`submit_payment_proof`, `verify_payment`, `request_payment_correction`, `submit_deliverable`) con `SECURITY DEFINER`, `SET search_path = ''`, `SELECT … FOR UPDATE`, códigos de error de texto estables y el bloque de `REVOKE`/`GRANT EXECUTE` (§2.3.5).

**Criterio de hecho:** las funciones aparecen en `supabase gen types` con sus argumentos; `anon` no puede ejecutarlas.

---

### T004 — Migración: buckets privados y políticas de Storage [x]

**Traza:** RF-21-A, RF-24-A, RF-12-A (Escenarios 7.33, 7.34, 7.36, 7.37), RNF-SEG-7.1, Principios 2 y 5
**Archivos a modificar:**
- `supabase/migrations/011_payments_deliverables.sql`

**Descripción:**
1. `INSERT INTO storage.buckets` para `payment-proofs` (privado, 1 MB, `image/jpeg`) y `commission-deliverables` (privado, 10 MB, JPEG/PNG/WEBP), con `ON CONFLICT DO NOTHING` (§3.1).
2. Políticas de `payment-proofs`: `payment_proofs_insert_client`, `payment_proofs_select_parties`, `payment_proofs_delete_orphans` (§3.3).
3. Políticas de `commission-deliverables`: `deliverables_insert_artist`, `deliverables_select_artist_or_paid_client`, `deliverables_delete_orphans` (§3.4).

**Criterio de hecho:** ambos buckets aparecen como privados en el dashboard local; no existe ninguna política `UPDATE` sobre estos buckets.

---

### T005 — Pruebas de RLS, privilegios y RPC [x]

**Traza:** RNF-04, RNF-SEG-7.1, RNF-SEG-7.2, Escenarios 7.2, 7.4, 7.10, 7.11, 7.15, 7.17, 7.30, 7.32, 7.34, 7.36, 7.37; Principio 9
**Archivos a crear:**
- `supabase/tests/007_rls_test.sql`

**Descripción:**
Implementar los casos P1–P22 de `plan.md` §3.6 dentro de una transacción con `ROLLBACK`, incluyendo los fixtures (comisiones 1–4, objetos de Storage con `owner_id`). Cada caso documenta el resultado esperado.

**Criterio de hecho:** todos los casos devuelven el resultado esperado contra la instancia local; los casos P14 (cliente sin `VERIFIED` → 0 filas) y P16 (cliente con `VERIFIED` → solo el objeto vigente) pasan.

---

## Fase B — Código base compartido

### T006 — Configuración nativa de permisos [x]

**Traza:** Principio 8, RF-12-B, RF-21-A, RF-24-A
**Archivos a modificar:**
- `app.json`

**Descripción:**
Agregar/ajustar los config plugins de `expo-image-picker` y `expo-media-library` según `plan.md` §4.1 (`isAccessMediaLocationEnabled: false`, `granularPermissions: ["photo"]`, sin permiso de cámara). Verificar las claves en la documentación de SDK 58. Instalar `expo-media-library` y `expo-file-system` con `npx expo install` si aún no están.

**Criterio de hecho:** nuevo development build con EAS; el `AndroidManifest.xml` generado no incluye `ACCESS_MEDIA_LOCATION` ni permisos de cámara.

---

### T007 — Tipos de dominio de pagos y extensión de `Commission` [x]

**Traza:** RF-11-A, RF-12-A
**Archivos a crear:**
- `src/features/pagos/types.ts`
**Archivos a modificar:**
- `src/features/gestion/types.ts`

**Descripción:**
Definir `PaymentStatus`, `CommissionPayment` y `PaymentRpcErrorCode` (`plan.md` §4.2). Agregar `payment_status`, `deliverable_path` y `delivered_at` a la interfaz `Commission` de la Spec 004 (import solo de tipo). Regenerar los tipos de Supabase si el proyecto los usa.

**Criterio de hecho:** `tsc --noEmit` da 0 errores; sin `any`.

---

### T008 — Presenters de pagos y entregables [x]

**Traza:** RF-11-A, RF-12-A, RF-24-A
**Archivos a crear:**
- `src/features/pagos/presenters.ts`
- `src/features/entregables/presenters.ts`

**Descripción:**
Implementar las funciones puras de `plan.md` §4.3: `getPaymentBadge`, `canClientSubmitProof`, `canArtistReviewPayment`, `CLIENT_PAYMENT_MESSAGES`, `ARTIST_PAYMENT_MESSAGES`, `CORRECTION_SUGGESTIONS`, `getClientDeliverableView`, `canArtistUploadDeliverable` y `formatFileSize`. Todos los textos, literales de la spec §5 y §8.

**Criterio de hecho:** `tsc` y `expo lint` dan 0 errores.

---

### T009 — Esquemas Zod de comprobante y corrección [x]

**Traza:** RF-21-A (Escenario 7.12), RF-15-A (Escenarios 7.19, 7.20)
**Archivos a crear:**
- `src/features/pagos/schemas.ts`

**Descripción:**
Implementar `paymentProofSchema` (referencia ≤ 60, nota ≤ 300, opcionales) y `paymentCorrectionSchema` (motivo con `trim`, 5–300) con los mensajes literales (`plan.md` §4.5).

**Criterio de hecho:** probado en T026.

---

### T010 — Traducción de errores de RPC [x]

**Traza:** RF-11-B (Escenarios 7.15, 7.16), RF-15-A (Escenario 7.22), RF-21-A (Escenarios 7.9, 7.10), RF-24-A (Escenarios 7.26, 7.27, 7.29)
**Archivos a crear:**
- `src/features/pagos/errors.ts`

**Descripción:**
Implementar `PaymentError` y `toPaymentError(action, error)` con la tabla de `plan.md` §4.6: código de la RPC + acción → mensaje literal; si no hay coincidencia, mensaje de respaldo por acción.

**Criterio de hecho:** probado en T026.

---

### T011 — Utilidades de medios y Storage compartidas [x]

**Traza:** RF-21-A, RF-24-A, RF-20-A, Principio 8, RNF-09 (sin EXIF)
**Archivos a crear:**
- `src/lib/media/pickSingleImage.ts`
- `src/lib/storage/uploadLocalFile.ts`

**Descripción:**
1. `pickSingleImage()` y `isAllowedSource()` (`plan.md` §4.7): `mediaTypes: ['images']`, una sola imagen, `quality: 1`, `exif: false`; valida JPG/PNG/WEBP y ≤ 10 MB.
2. `newObjectId()`, `uploadLocalFile()` (subida como `ArrayBuffer`, `upsert: false`) y `removeQuietly()` (`plan.md` §4.10).
3. Reutilizar `requestGalleryPermission()` de `src/features/avances/utils/` (sin moverlo).

**Criterio de hecho:** `tsc` y `expo lint` dan 0 errores.

---

## Fase C — Pagos (cliente y artista)

### T012 — Optimización del comprobante

**Traza:** RF-21-A, RF-20-A, Principio 2
**Archivos a crear:**
- `src/features/pagos/utils/compressPaymentProof.ts`

**Descripción:**
Implementar `compressPaymentProof()` con la API contextual de `expo-image-manipulator` (`plan.md` §4.8): lado largo ≤ 1600 px, JPEG 0.8 → 0.65, resultado ≤ 1 MB; si no se logra, lanza `proof_too_large`.

**Criterio de hecho:** prueba manual con una captura de 4 MB produce un JPEG ≤ 1 MB con texto legible; `tsc` sin errores.

---

### T013 — Query `useCommissionPayment`

**Traza:** RF-11-A (Escenarios 7.1, 7.3, 7.21), RF-12-A
**Archivos a crear:**
- `src/features/pagos/hooks/useCommissionPayment.ts`

**Descripción:**
Hook con clave `['commissions','payment',id]`, `select` de las columnas de pago y entrega + `services.base_price`, `staleTime` de 15 s (`plan.md` §4.11).

**Criterio de hecho:** devuelve `CommissionPayment` tipado; un tercero obtiene error/0 filas (cubierto por RLS de la Spec 003).

---

### T014 — Mutación `useSubmitPaymentProof`

**Traza:** RF-21-A (Escenarios 7.5, 7.6, 7.9, 7.10), RF-20-A (Escenarios 7.23, 7.24)
**Archivos a crear:**
- `src/features/pagos/hooks/useSubmitPaymentProof.ts`

**Descripción:**
Pipeline de `plan.md` §4.11: comprimir → subir a `payment-proofs/{commissionId}/{id}.jpg` → `rpc('submit_payment_proof')` → si la RPC falla, `removeQuietly` del objeto → `invalidateQueries(['commissions'])` en `onSettled`. Errores con `toPaymentError('SUBMIT_PROOF', …)`.

**Criterio de hecho:** probado en T026 (sin huérfanos ante fallo de RPC).

---

### T015 — Mutaciones `useVerifyPayment` y `useRequestPaymentCorrection` + query `usePaymentProofUrl`

**Traza:** RF-11-B (Escenarios 7.13–7.16), RF-15-A (Escenarios 7.18, 7.22), RNF-SEG-7.3
**Archivos a crear:**
- `src/features/pagos/hooks/useVerifyPayment.ts`
- `src/features/pagos/hooks/useRequestPaymentCorrection.ts`
- `src/features/pagos/hooks/usePaymentProofUrl.ts`

**Descripción:**
Según `plan.md` §4.11. `useVerifyPayment` devuelve el `CommissionStatus` resultante para elegir el mensaje («Pago confirmado» o el de cierre). `usePaymentProofUrl` firma por 300 s.

**Criterio de hecho:** `tsc` y `expo lint` dan 0 errores.

---

### T016 — Componentes de estado de pago (`PaymentStatusBadge`, `PaymentProofViewer`)

**Traza:** RF-11-A, RF-11-B, RF-15-A (Escenario 7.21)
**Archivos a crear:**
- `src/features/pagos/components/PaymentStatusBadge.tsx`
- `src/features/pagos/components/PaymentProofViewer.tsx`

**Descripción:**
1. Badge con `getPaymentBadge` (colores coherentes con `CommissionStatusBadge` de las specs 004/005).
2. Visor a pantalla completa con zoom (`expo-image`) que usa `usePaymentProofUrl`; muestra referencia, nota y fecha de envío; si la URL falla, «No se pudo cargar el comprobante. Inténtalo de nuevo» con reintento.

**Criterio de hecho:** snapshot de los 4 badges; `expo lint` sin errores.

---

### T017 — `SubmitPaymentProofSheet` (cliente)

**Traza:** RF-21-A (Escenarios 7.5–7.9, 7.12), RF-20-A, Principio 8
**Archivos a crear:**
- `src/features/pagos/components/SubmitPaymentProofSheet.tsx`

**Descripción:**
Bottom sheet con React Hook Form + `paymentProofSchema`:
1. Diálogo previo «Koma necesita acceso a tu galería para que puedas seleccionar la captura o foto de tu comprobante de pago.» → `requestGalleryPermission()`; si se niega: «No se puede acceder a la galería. Puedes habilitarlo en los ajustes de tu dispositivo» sin cerrar la pantalla.
2. `pickSingleImage()` → `isAllowedSource()`; si falla: «Formato o tamaño no permitido».
3. Vista previa + campos «Referencia o folio (opcional)» y «Nota para el artista (opcional)».
4. «Enviar comprobante» → `useSubmitPaymentProof`; botón deshabilitado mientras `isPending`.
5. Éxito: toast «Comprobante enviado. El artista lo revisará pronto» y cierre; error: mensaje de `PaymentError` y el sheet permanece abierto.

**Criterio de hecho:** prueba manual de los escenarios 7.5–7.9 y 7.12 documentada en T027.

---

### T018 — `ClientPaymentPanel`

**Traza:** RF-11-A (Escenarios 7.1, 7.3), RF-15-A (Escenario 7.21), RF-20-A
**Archivos a crear:**
- `src/features/pagos/components/ClientPaymentPanel.tsx`

**Descripción:**
Sección «Pago y entrega» del cliente: título, aviso «Koma no procesa pagos…», «Monto de referencia: $[precio] MXN», badge y mensaje `CLIENT_PAYMENT_MESSAGES`. Si `NEEDS_CORRECTION`, muestra «Motivo: [motivo]» y la miniatura del comprobante devuelto. Botón «Subir comprobante» (UNPAID) o «Enviar nuevo comprobante» (NEEDS_CORRECTION) solo si `canClientSubmitProof`. En `PENDIENTE`: «Podrás subir tu comprobante cuando el artista acepte la comisión».

**Criterio de hecho:** renderiza correctamente los 4 estados de pago y el caso `PENDIENTE` (snapshot).

---

### T019 — `ConfirmPaymentDialog`, `RequestCorrectionSheet` y `ArtistPaymentPanel`

**Traza:** RF-11-B (Escenarios 7.13–7.16), RF-15-A (Escenarios 7.18–7.20, 7.22)
**Archivos a crear:**
- `src/features/pagos/components/ConfirmPaymentDialog.tsx`
- `src/features/pagos/components/RequestCorrectionSheet.tsx`
- `src/features/pagos/components/ArtistPaymentPanel.tsx`

**Descripción:**
1. Diálogo con «¿Confirmas que recibiste el pago completo de esta comisión? Esta acción no se puede deshacer.».
2. Sheet «¿Qué debe corregir el cliente?» con RHF + `paymentCorrectionSchema`, chips de `CORRECTION_SUGGESTIONS` que hacen `setValue('reason', …)`, botón «Enviar al cliente»; éxito: «Se pidió al cliente corregir su comprobante».
3. Panel: badge, `ARTIST_PAYMENT_MESSAGES`, miniatura que abre `PaymentProofViewer`, botones «Confirmar pago» / «Requiere corrección» solo si `canArtistReviewPayment`. Tras verificar, toast según el estado devuelto: «Pago confirmado» o «Pago confirmado. ¡Comisión finalizada! El cliente ya puede descargar el entregable».

**Criterio de hecho:** prueba manual de 7.13–7.22 documentada en T027.

---

## Fase D — Entregable final

### T020 — Preparación del entregable

**Traza:** RF-24-A (Escenarios 7.25, 7.27, 7.28), Principio 2
**Archivos a crear:**
- `src/features/entregables/utils/prepareDeliverableImage.ts`

**Descripción:**
Implementar `prepareDeliverableImage()` (`plan.md` §4.9): original sin recompresión si ≤ 10 MB y ≤ 4096 px; si no, redimensionar (PNG→PNG, fallback JPEG 0.92); lanzar `unsupported_format` o `file_too_large`.

**Criterio de hecho:** probado en T026.

---

### T021 — `useSubmitDeliverable` y `useDeliverablePreviewUrl`

**Traza:** RF-24-A (Escenarios 7.25, 7.29), RF-24-B (Escenario 7.31), RF-12-A, RNF-SEG-7.3
**Archivos a crear:**
- `src/features/entregables/hooks/useSubmitDeliverable.ts`
- `src/features/entregables/hooks/useDeliverablePreviewUrl.ts`

**Descripción:**
Según `plan.md` §4.11: preparar → subir a `commission-deliverables/{id}/final-{id}.{ext}` → `rpc('submit_deliverable')` → borrar huérfano si falla → borrar versión anterior si tuvo éxito → invalidar `['commissions']`. Vista previa firmada por 600 s con `retry: false`; si Storage rechaza: «La descarga se habilitará cuando el pago esté liquidado».

**Criterio de hecho:** `tsc` y `expo lint` dan 0 errores.

---

### T022 — `ArtistDeliverablePanel`

**Traza:** RF-24-A (Escenarios 7.25–7.29), RF-24-B (Escenario 7.31), Principio 8
**Archivos a crear:**
- `src/features/entregables/components/ArtistDeliverablePanel.tsx`

**Descripción:**
Visible solo si `canArtistUploadDeliverable` o si ya existe entregable. Flujo: diálogo previo «Koma necesita acceso a tu galería para que puedas seleccionar la ilustración final de la comisión.» → permiso → `pickSingleImage()` → confirmación «¿Subir esta imagen como entregable final? …» (o la de reemplazo) → `useSubmitDeliverable`. Toast según estado devuelto: «Entregable subido. Se liberará al cliente cuando confirmes su pago» o «¡Comisión finalizada! El cliente ya puede descargar el entregable». Muestra vista previa, fecha y peso (`formatFileSize`). Botón «Reemplazar entregable» oculto si `COMPLETADA`.

**Criterio de hecho:** prueba manual de 7.25–7.29 y 7.31 documentada en T027.

---

### T023 — Permiso de escritura y guardado en galería

**Traza:** RF-12-B (Escenarios 7.38–7.42), Principio 8, RNF-SEG-7.3
**Archivos a crear:**
- `src/features/entregables/utils/requestMediaLibraryWritePermission.ts`
- `src/features/entregables/utils/saveDeliverableToGallery.ts`
- `src/features/entregables/hooks/useSaveDeliverable.ts`

**Descripción:**
Según `plan.md` §4.12: permiso `writeOnly` (consulta antes de pedir; respeta `canAskAgain`); URL firmada de 60 s; `File.downloadFileAsync` a `Paths.cache`; `MediaLibrary.saveToLibraryAsync`; borrado del temporal en `finally`; mapeo de errores `locked` / `network` / `no_space` / `unknown` a los mensajes literales; `openAppSettings()` con `Linking.openSettings()`.

**Criterio de hecho:** probado en T026; `tsc` sin errores.

---

### T024 — `DeliverableLockedCard`, `SaveToGalleryButton` y `ClientDeliverablePanel`

**Traza:** RF-12-A (Escenarios 7.33–7.35), RF-12-B (Escenarios 7.38–7.42)
**Archivos a crear:**
- `src/features/entregables/components/DeliverableLockedCard.tsx`
- `src/features/entregables/components/SaveToGalleryButton.tsx`
- `src/features/entregables/components/ClientDeliverablePanel.tsx`

**Descripción:**
1. Tarjeta con candado: «Entregable listo — Completa o verifica tu pago para desbloquearlo». **No** solicita ninguna URL del entregable.
2. Botón «Guardar en galería»: diálogo previo «Koma necesita permiso para guardar la ilustración final en la galería de tu dispositivo.» solo si el permiso no está concedido; estado «Guardando…»; éxito «Ilustración guardada en tu galería»; denegado → mensaje + botón «Abrir ajustes».
3. Panel según `getClientDeliverableView`: `NOT_UPLOADED` → «El artista aún no ha subido el entregable final»; `LOCKED` → tarjeta; `UNLOCKED` → vista previa (`useDeliverablePreviewUrl` habilitado), «Tu entregable está listo», fecha, peso y botón.
4. **Caso manual de seguridad (Escenario 7.34):** con un cliente en `UNDER_REVIEW`, llamar desde la consola de depuración a `supabase.storage.from('commission-deliverables').createSignedUrl(<ruta>, 60)` y documentar que devuelve error.

**Criterio de hecho:** el panel nunca monta `useDeliverablePreviewUrl` en `LOCKED`; el caso manual queda documentado en T027.

---

## Fase E — Integración con specs anteriores

### T025 — Integración en specs 004 y 005

**Traza:** RF-24-B (Escenario 7.32), RF-11-A (Escenario 7.1), RF-12-A (Escenario 7.35); impacto spec §10
**Archivos a modificar:**
- `src/features/gestion/stateMachine.ts`
- `src/features/gestion/__tests__/stateMachine.test.ts`
- `src/features/gestion/screens/CommissionWorkScreen.tsx`
- `src/features/seguimiento/types.ts`
- `src/features/seguimiento/hooks/useMyCommissions.ts`
- `src/features/seguimiento/components/CommissionCard.tsx`
- `src/features/seguimiento/screens/CommissionTrackingDetailScreen.tsx`

**Descripción:**
1. `applyTransition('ADVANCE_STAGE')` en `FINAL` lanza «Sube el entregable final para cerrar la comisión» (`plan.md` §4.4); actualizar el test que antes esperaba `COMPLETADA`.
2. `CommissionWorkScreen`: ocultar «Completar etapa» en `FINAL`; agregar `ArtistPaymentPanel` y `ArtistDeliverablePanel` bajo la sección de avances (Spec 006) para `EN_PROGRESO` y `COMPLETADA`.
3. Seguimiento: agregar `payment_status` a `ClientCommissionSummary`/`Detail` y al `select` de `useMyCommissions`; `CommissionCard` muestra `PaymentStatusBadge` en «En curso».
4. `CommissionTrackingDetailScreen`: agregar `ClientPaymentPanel` y `ClientDeliverablePanel` después de los avances (si el archivo en el repositorio se llama `CommissionDetailScreen.tsx`, modificar ese).

**Criterio de hecho:** flujo completo de punta a punta (aceptar → etapas → comprobante → corrección → reenvío → confirmar → entregable → guardar) funciona en el development build; tests de la Spec 004 en verde.

---

## Fase F — Calidad

### T026 — Pruebas unitarias

**Traza:** RNF-08 (≥ 60 %), Principio 9; Escenarios 7.6, 7.9, 7.12, 7.15, 7.19, 7.20, 7.27, 7.28, 7.33, 7.39–7.42
**Archivos a crear:**
- `src/features/pagos/__tests__/presenters.test.ts`
- `src/features/pagos/__tests__/schemas.test.ts`
- `src/features/pagos/__tests__/errors.test.ts`
- `src/features/pagos/__tests__/useSubmitPaymentProof.test.ts`
- `src/features/entregables/__tests__/presenters.test.ts`
- `src/features/entregables/__tests__/prepareDeliverableImage.test.ts`
- `src/features/entregables/__tests__/saveDeliverableToGallery.test.ts`
- `src/features/entregables/__tests__/useSaveDeliverable.test.ts`

**Descripción (casos mínimos):**
- `presenters` (pagos): `canClientSubmitProof` verdadero solo en `EN_PROGRESO` + `UNPAID|NEEDS_CORRECTION`; `canArtistReviewPayment` solo en `UNDER_REVIEW`; etiquetas de los 4 badges.
- `schemas`: referencia 60 ✓ / 61 ✗; nota 300 ✓ / 301 ✗; motivo `"   ab "` ✗ con «Indica el motivo…», 5 ✓, 301 ✗.
- `errors`: `invalid_payment_state` → mensaje por acción; código desconocido → respaldo.
- `useSubmitPaymentProof` (Supabase mock): RPC falla → se llama `remove([path])` y se lanza «No se pudo subir el comprobante, inténtalo de nuevo»; upload falla → no se llama la RPC.
- `presenters` (entregables): tabla de RF-12-A (`NOT_UPLOADED` / `LOCKED` ×3 estados / `UNLOCKED`).
- `prepareDeliverableImage` (mocks de manipulator y FS): original 3 MB/3000 px se devuelve sin procesar; 15 MB → reducido; sigue > 10 MB → `file_too_large`; `image/gif` → `unsupported_format`.
- `saveDeliverableToGallery`: `createSignedUrl` con error → `locked` y no descarga; fallo de descarga → `network` y temporal borrado; éxito → `saveToLibraryAsync` llamado y temporal borrado.
- `useSaveDeliverable`: permiso denegado → mensaje de denegación + `showOpenSettings: true` y **no** se pide URL.

**Criterio de hecho:** `jest --coverage` ≥ 60 % en `src/features/pagos` y `src/features/entregables` (lógica); `expo lint` y `tsc` con 0 errores.

---

### T027 — Casos de prueba manuales en dispositivo Android

**Traza:** Principio 9; todos los escenarios con interacción nativa (7.5, 7.7, 7.13, 7.14, 7.18, 7.21, 7.23, 7.25, 7.31, 7.34, 7.35, 7.38, 7.39, 7.40, 7.41)
**Archivos a crear:**
- `specs/007-pagos-entregable/manual-tests.md`

**Descripción:**
Documentar cada escenario como caso manual (precondición, pasos, resultado esperado, resultado obtenido, dispositivo/versión de Android) con dos cuentas (artista y cliente). Incluir obligatoriamente:
- Denegación de permiso de galería (lectura) y de guardado (escritura), y la denegación permanente con «Abrir ajustes» (Android 13+).
- Verificación de que la imagen guardada aparece en la galería con la misma resolución que el archivo subido.
- Caso de seguridad de T024 (URL firmada rechazada antes de `VERIFIED`).
- Modo avión durante la subida del comprobante, del entregable y durante el guardado.

**Criterio de hecho:** todos los casos ejecutados y en verde sobre el development build; la spec refleja lo implementado (definición de hecho, constitución §6).

---

## Mapa de trazabilidad

| Tarea | RF / RNF | Escenarios cubiertos |
|---|---|---|
| T001 | RF-11-A, RF-24-B, RNF-SEG-7.2 | 7.32 (servidor) |
| T002 | RF-11-A, RNF-SEG-7.2, Principio 6 | 7.2 |
| T003 | RF-21-A, RF-20-A, RF-11-B, RF-15-A, RF-24-A, RF-24-B | 7.10, 7.11, 7.15, 7.17, 7.26, 7.30, 7.31 |
| T004 | RF-12-A, RF-21-A, RF-24-A, RNF-SEG-7.1 | 7.33, 7.34, 7.36, 7.37 |
| T005 | RNF-04, RNF-SEG-7.1, RNF-SEG-7.2 | 7.2, 7.4, 7.10, 7.11, 7.15, 7.17, 7.30, 7.32, 7.34, 7.36, 7.37 |
| T006 | Principio 8, RF-12-B | 7.7, 7.39 |
| T007 | RF-11-A, RF-12-A | — (tipos) |
| T008 | RF-11-A, RF-12-A, RF-24-A | 7.1, 7.3, 7.21, 7.33 |
| T009 | RF-21-A, RF-15-A | 7.12, 7.19, 7.20 |
| T010 | RF-11-B, RF-15-A, RF-21-A, RF-24-A | 7.9, 7.10, 7.15, 7.16, 7.22, 7.26, 7.27, 7.29 |
| T011 | RF-21-A, RF-24-A, Principio 8, RNF-09 | 7.7, 7.8, 7.28 |
| T012 | RF-21-A, Principio 2 | 7.5, 7.8 |
| T013 | RF-11-A, RF-12-A | 7.1, 7.3, 7.21 |
| T014 | RF-21-A, RF-20-A | 7.5, 7.6, 7.9, 7.10, 7.23, 7.24 |
| T015 | RF-11-B, RF-15-A, RNF-SEG-7.3 | 7.13–7.16, 7.18, 7.22 |
| T016 | RF-11-A, RF-11-B | 7.21 |
| T017 | RF-21-A, RF-20-A, Principio 8 | 7.5–7.9, 7.12, 7.23 |
| T018 | RF-11-A, RF-15-A, RF-20-A | 7.1, 7.3, 7.21 |
| T019 | RF-11-B, RF-15-A | 7.13–7.16, 7.18–7.20, 7.22 |
| T020 | RF-24-A, Principio 2 | 7.25, 7.27, 7.28 |
| T021 | RF-24-A, RF-24-B, RF-12-A | 7.25, 7.29, 7.31, 7.34 |
| T022 | RF-24-A, RF-24-B, Principio 8 | 7.25–7.29, 7.31 |
| T023 | RF-12-B, Principio 8, RNF-SEG-7.3 | 7.38–7.42 |
| T024 | RF-12-A, RF-12-B | 7.33–7.35, 7.38–7.42 |
| T025 | RF-24-B, RF-11-A, RF-12-A | 7.1, 7.32, 7.35 |
| T026 | RNF-08, Principio 9 | 7.6, 7.9, 7.12, 7.15, 7.19, 7.20, 7.27, 7.28, 7.33, 7.39–7.42 |
| T027 | Principio 9 | 7.5, 7.7, 7.13, 7.14, 7.18, 7.21, 7.23, 7.25, 7.31, 7.34, 7.35, 7.38–7.41 |
