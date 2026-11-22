# Tasks 008 — Notificaciones Push (`008-notificaciones-push`)

**Estado:** Pendiente · **Versión:** 0.1 · **Fecha:** 2026-11-21
**Derivado de:** `008-notificaciones-push/spec.md` y `008-notificaciones-push/plan.md`
**Constitución:** v1.1

> Cada tarea es atómica y trazable a un RF/RNF. Se implementan en el orden indicado. Los commits los hace la persona con Conventional Commits y el ID de tarea (por ejemplo, `feat: T001 device tokens table`).
>
> **Regla de no regresión:** ninguna tarea modifica archivos de las specs 003, 004, 005, 006 ni 007. De la Spec 001 solo se tocan `src/features/auth/api.ts` y los archivos de ruta indicados en T016–T018.

---

## Fase A — Base de datos (Supabase)

### T001 — Migración: tabla `device_tokens`, RLS y RPC de registro ✓

**Traza:** RF-25-A, RNF-NOT-8.2, RNF-04, Principio 5
**Archivos a crear:**
- `supabase/migrations/008_push_notifications.sql`

**Descripción:**
Secciones 1 y 2 de `plan.md` §3.1–§3.2:
1. `CREATE TABLE public.device_tokens` (`id`, `user_id` → `auth.users` `ON DELETE CASCADE`, `expo_push_token`, `created_at`, `updated_at`), `UNIQUE (expo_push_token)`, `CHECK device_tokens_token_format`, índice `idx_device_tokens_user_id` y trigger `set_updated_at`.
2. `ENABLE ROW LEVEL SECURITY`, `REVOKE ALL … FROM anon, authenticated`, `GRANT SELECT, INSERT, UPDATE, DELETE … TO authenticated`.
3. Políticas `device_tokens_select_own`, `_insert_own`, `_update_own` (con `WITH CHECK`), `_delete_own`, todas con `(SELECT auth.uid()) = user_id`.
4. Función `register_device_token(text)` `SECURITY DEFINER` con `ON CONFLICT (expo_push_token) DO UPDATE SET user_id, updated_at`; `REVOKE` de `PUBLIC, anon` y `GRANT EXECUTE` a `authenticated`.

**Criterio de hecho:** `supabase db reset` aplica 001–008 sin errores; la tabla aparece con RLS activa.

---

### T002 — Migración: pg_net, encolado, resolución de eventos y triggers ✓

**Traza:** RF-08-A, RF-10-A, RF-26-A, RF-27-A, RNF-NOT-8.4
**Archivos a modificar:**
- `supabase/migrations/008_push_notifications.sql`

**Descripción:**
Secciones 3–6 de `plan.md` §3.3–§3.5:
1. `CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;`
2. `enqueue_push_notification(text, uuid, uuid)` `SECURITY DEFINER`: lee `push_function_url` y `push_webhook_secret` de `vault.decrypted_secrets`, llama `net.http_post` con cabecera `x-koma-webhook-secret` y `timeout_milliseconds := 10000`; `EXCEPTION WHEN OTHERS → RAISE WARNING`. `REVOKE ALL … FROM PUBLIC, anon, authenticated`.
3. `resolve_commission_push_event(...)` con el `CASE` en el orden de prioridad del plan §2.
4. `notify_commission_insert()` + trigger `commissions_push_on_insert` (`AFTER INSERT`).
5. `notify_commission_update()` + trigger `commissions_push_on_update` (`AFTER UPDATE … WHEN` sobre `status`, `current_stage`, `payment_status`, `deliverable_path`); destinatario `artist_id` solo para `PAYMENT_PROOF_SUBMITTED`.
6. `notify_advance_files_insert()` + trigger `commission_advance_files_push_on_insert` (`AFTER INSERT … REFERENCING NEW TABLE AS new_files FOR EACH STATEMENT`).
7. `REVOKE ALL` de las tres funciones de trigger.

**Criterio de hecho:** `supabase db reset` sin errores; con la app, aceptar/rechazar/avanzar (Spec 004), subir avance (006) y las RPC de pago/entrega (007) siguen funcionando igual **sin** secretos en Vault (solo aparece `WARNING` en los logs de Postgres).

---

### T003 — Pruebas SQL de RLS de `device_tokens` ✓

**Traza:** RNF-04, RNF-NOT-8.2, RF-25-A (Escenario 8.8), RF-25-B (Escenario 8.10); Principio 9
**Archivos a crear:**
- `supabase/tests/008_rls_test.sql`

**Descripción:**
Implementar los casos D1–D11 de `plan.md` §5.1 dentro de `BEGIN … ROLLBACK`, con fixtures de dos usuarios. Incluye explícitamente la **prueba de acceso denegado**: B no puede leer (D2), insertar a nombre de A (D3), actualizar (D4) ni borrar (D5) el token de A; `anon` no accede (D10); `authenticated` no puede encolar avisos (D11).

**Criterio de hecho:** todos los casos devuelven el resultado documentado contra la instancia local.

---

### T004 — Pruebas SQL de eventos y encolado ✓

**Traza:** RF-08-A, RF-10-A, RF-26-A, RF-27-A, RNF-NOT-8.4; Escenarios 8.13–8.22 (servidor); Principio 9
**Archivos a crear:**
- `supabase/tests/008_push_events_test.sql`

**Descripción:**
Implementar E1–E12 de `plan.md` §5.2: resolución pura de los 7 eventos y de la prioridad (aceptar ⇒ solo `REQUEST_UPDATED`; verificar con entregable ⇒ solo `DELIVERABLE_READY`; cambio irrelevante ⇒ `NULL`), encolado real con secretos de Vault temporales (1 petición por cambio de etapa con `recipient_id` del cliente; 0 por cambios irrelevantes; 1 por avance de 3 archivos) y no-regresión sin secretos (E12). Verificar el nombre de la cola de pg_net en la versión instalada.

**Criterio de hecho:** todos los casos pasan contra la instancia local.

---

## Fase B — Edge Function

### T005 — Lógica pura de la Edge Function ✓

**Traza:** RNF-NOT-8.1, RNF-NOT-8.5, RF-28-A, RI-02
**Archivos a crear:**
- `supabase/functions/send-push-notification/logic.ts`

**Descripción:**
Copiar `plan.md` §4.2: `PUSH_EVENTS`, `EVENT_CONTENT` (los 7 textos literales de la spec §8.3 y su `target`), `NOTIFICATION_TITLE = 'Koma'`, `parsePushRequest`, `buildMessages` (`channelId: 'default'`, `priority: 'high'`, `data` solo con `commission_id`, `target`, `recipient_id`), `collectUnregisteredTokens`, `chunk`, `timingSafeEqual`, `isRetryableStatus`. Sin imports.

**Criterio de hecho:** probado en T020.

---

### T006 — Handler de la Edge Function y configuración ✓

**Traza:** RF-08-A, RF-10-A, RF-26-A, RF-27-A, RNF-NOT-8.4 (3 reintentos), RNF-NOT-8.5, RI-02, Principio 5
**Archivos a crear:**
- `supabase/functions/send-push-notification/index.ts`
**Archivos a modificar:**
- `supabase/config.toml`
- `tsconfig.json`

**Descripción:**
1. `index.ts` según `plan.md` §4.3: 405/401/400/500/502/200; consulta de `device_tokens` por `recipient_id` con el cliente de service role; envío por lotes de 100 a `https://exp.host/--/api/v2/push/send` con hasta 3 intentos (solo red/429/5xx, backoff 0.5 s y 1 s); borrado de tokens `DeviceNotRegistered`; logs sin tokens, textos ni IDs.
2. `config.toml`: `[functions.send-push-notification] verify_jwt = false`.
3. `tsconfig.json`: agregar `"supabase/functions"` a `exclude`.

**Criterio de hecho:** `supabase functions serve send-push-notification` arranca; un `curl` sin cabecera devuelve `401`; con cabecera y payload inválido, `400`; `tsc --noEmit` de la app sigue en 0 errores.

---

### T007 — Secretos y despliegue en Supabase ✓

**Traza:** RI-02, Principio 5, RNF-NOT-8.3
**Archivos:** ninguno (configuración del entorno; checklist `plan.md` §3.6 y §7.2)

**Descripción:**
1. Generar el secreto (`openssl rand -hex 32`).
2. Crear `push_function_url` y `push_webhook_secret` en Vault (local y producción) con `vault.create_secret`.
3. `supabase secrets set PUSH_WEBHOOK_SECRET=<valor>`.
4. `supabase db push` y `supabase functions deploy send-push-notification --no-verify-jwt`.
5. Cambiar la etapa de una comisión de prueba y verificar en `net._http_response` un `200` con `sent: 0` (aún sin dispositivos).

**Criterio de hecho:** la llamada desde Postgres llega a la función y responde `200`; ningún secreto queda en el repositorio.

---

## Fase C — Configuración nativa y FCM

### T008 — Instalar `expo-notifications`, configuración de app y FCM

**Traza:** RF-25-A, RI-02, Principios 3 y 5
**Archivos a crear:**
- `app.config.ts`
- `assets/images/notification-icon.png`
**Archivos a modificar:**
- `app.json`
- `.gitignore`
- `package.json` (vía `npx expo install expo-notifications`)

**Descripción:**
1. `npx expo install expo-notifications`.
2. `app.json`: plugin `["expo-notifications", { "icon": "./assets/images/notification-icon.png", "defaultChannel": "default" }]` (`plan.md` §6.1). Verificar claves en SDK 58.
3. `notification-icon.png`: 96×96, silueta blanca del logotipo sobre fondo transparente.
4. `app.config.ts`: `android.googleServicesFile = process.env.GOOGLE_SERVICES_JSON ?? './google-services.json'`.
5. `.gitignore`: `google-services.json` y `*-firebase-adminsdk-*.json`.
6. Checklist `plan.md` §7.1: proyecto Firebase Spark, variable EAS `GOOGLE_SERVICES_JSON` (archivo, secreta), clave FCM V1 subida con `eas credentials`, borrar la clave local, `extra.eas.projectId` presente.
7. Nuevo development build: `eas build -p android --profile development`.

**Criterio de hecho:** el build instala; el `AndroidManifest.xml` generado incluye `POST_NOTIFICATIONS`; `git status` no muestra archivos de credenciales.

---

## Fase D — Cliente (`src/features/notificaciones/`)

### T009 — Constantes y mensajes literales

**Traza:** RF-25-A, RF-25-B, spec §8
**Archivos a crear:**
- `src/features/notificaciones/constants.ts`
- `src/features/notificaciones/messages.ts`

**Descripción:**
`ANDROID_CHANNEL_ID`, `PUSH_TOKEN_STORAGE_KEY`, `PROMPT_DISMISSED_STORAGE_KEY`, `UNREGISTER_TIMEOUT_MS = 3000` y `NOTIFICATION_MESSAGES` con todos los textos de la spec §8.1–§8.2 (`plan.md` §6.2).

**Criterio de hecho:** textos idénticos a la spec (revisión cruzada); `tsc` sin errores.

---

### T010 — Canal de Android y permiso

**Traza:** RF-25-A (Escenarios 8.1, 8.2, 8.6), RNF-NOT-8.1, Principio 8
**Archivos a crear:**
- `src/features/notificaciones/permission.ts`

**Descripción:**
`ensureAndroidChannel()` (canal `default`, nombre y descripción literales, `AndroidImportance.HIGH`, `lockscreenVisibility: PRIVATE`), `getPushPermissionState()` → `'granted' | 'askable' | 'blocked'` y `requestPushPermission()` que crea el canal **antes** de pedir el permiso (`plan.md` §6.3).

**Criterio de hecho:** probado en T019.

---

### T011 — Token: registro y desvinculación

**Traza:** RF-25-A (Escenarios 8.1, 8.7, 8.8, 8.9), RF-25-B (Escenarios 8.10, 8.12), RNF-NOT-8.2
**Archivos a crear:**
- `src/features/notificaciones/pushToken.ts`

**Descripción:**
`getExpoPushToken()` (con `projectId` de EAS), `syncPushRegistration()` (canal → token → `rpc('register_device_token')` → guarda el token en AsyncStorage) y `unregisterCurrentDevice()` (DELETE por token con timeout de 3 s, nunca lanza, siempre limpia AsyncStorage y ejecuta `dismissAllNotificationsAsync`) según `plan.md` §6.4.

**Criterio de hecho:** probado en T019.

---

### T012 — Parseo de datos y resolución de rutas

**Traza:** RF-28-A (Escenarios 8.23, 8.24, 8.26), RNF-NOT-8.2
**Archivos a crear:**
- `src/features/notificaciones/routing.ts`

**Descripción:**
`parsePushData()` (valida UUIDs y `target`) y `resolveNotificationRoute()` según `plan.md` §6.5: `artist_request` → `/artist/commissions/[commissionId]`, `artist_work` → `/artist/commissions/[commissionId]/work`, `client_tracking` → `/commissions/[commissionId]`; `null` si no hay sesión o `recipient_id` no coincide. Confirmar las rutas contra `src/app/` del repositorio y ajustar solo aquí si difieren.

**Criterio de hecho:** probado en T019.

---

### T013 — Handler de presentación en primer plano

**Traza:** RF-28-A (Escenario 8.25), RNF-NOT-8.2
**Archivos a crear:**
- `src/features/notificaciones/handler.ts`
**Archivos a modificar:**
- `src/app/_layout.tsx`

**Descripción:**
`Notifications.setNotificationHandler` que muestra banner, lista y sonido solo si `data.recipient_id` coincide con el usuario de `supabase.auth.getSession()` (`plan.md` §6.6). Importar el módulo en `src/app/_layout.tsx` (una línea). Verificar `shouldShowBanner`/`shouldShowList` en SDK 58.

**Criterio de hecho:** con la app abierta, un aviso propio muestra banner; uno con otro `recipient_id` (enviado desde la herramienta de Expo) no se muestra.

---

### T014 — Hook `usePushNotifications`

**Traza:** RF-25-A (Escenarios 8.7, 8.9), RF-28-A (Escenarios 8.23–8.26)
**Archivos a crear:**
- `src/features/notificaciones/usePushNotifications.ts`

**Descripción:**
Según `plan.md` §6.7: (1) `syncPushRegistration()` silencioso si el permiso está concedido; (2) `addPushTokenListener` → re-registro; (3) `addNotificationReceivedListener` → `invalidateQueries({ queryKey: ['commissions'] })`; (4) respuesta al toque con `getLastNotificationResponse()` (cold start) + `addNotificationResponseReceivedListener`, `clearLastNotificationResponse()`, callback `onArtistTarget` y `router.push(route)`. Verificar firmas en SDK 58.

**Criterio de hecho:** `tsc` y `expo lint` sin errores; comportamiento validado en T021.

---

### T015 — Componentes de permiso y perfil

**Traza:** RF-25-A (Escenarios 8.1, 8.2, 8.3, 8.5, 8.6, 8.9), Principio 8
**Archivos a crear:**
- `src/features/notificaciones/components/NotificationPermissionPrompt.tsx`
- `src/features/notificaciones/components/NotificationSettingsRow.tsx`

**Descripción:**
1. `NotificationPermissionPrompt` (`plan.md` §6.8): visible si `askable` y sin bandera `promptDismissed` (o `forceVisible`); «Activar» → `requestPushPermission()` → `syncPushRegistration()`; toasts «Notificaciones activadas», «Notificaciones desactivadas. Puedes activarlas cuando quieras desde tu perfil.» o «No se pudieron activar las notificaciones en este dispositivo. Inténtalo más tarde.»; «Ahora no» guarda la bandera. Estilo de los diálogos de las specs 004/007.
2. `NotificationSettingsRow` (`plan.md` §6.9): «Notificaciones» · «Activadas»/«Desactivadas»; `askable` → «Activar notificaciones» (abre el prompt con `forceVisible`); `blocked` → «Las notificaciones están desactivadas en los ajustes de Android.» + «Abrir ajustes» (`Linking.openSettings()`); re-evalúa en `AppState` `active` y registra al pasar a `granted`.

**Criterio de hecho:** escenarios 8.1–8.6 y 8.9 validados en T021.

---

## Fase E — Integración con la Spec 001

### T016 — Cierre de sesión con desvinculación

**Traza:** RF-25-B (Escenarios 8.10, 8.11, 8.12), RNF-NOT-8.2, Principio 7
**Archivos a modificar:**
- `src/features/auth/api.ts`

**Descripción:**
En `signOut()`, llamar `await unregisterCurrentDevice()` **antes** de `supabase.auth.signOut()` (`plan.md` §6.10). No cambiar ninguna otra función de `api.ts`.

**Criterio de hecho:** tras cerrar sesión con conexión, la fila del token desaparece de `device_tokens`; en modo avión, la sesión se cierra en ≤ 3 s.

---

### T017 — Montaje en el layout autenticado y el inicio

**Traza:** RF-25-A, RF-28-A
**Archivos a modificar:**
- `src/app/(app)/_layout.tsx`
- `src/app/(app)/index.tsx`

**Descripción:**
1. Layout con sesión: `usePushNotifications(session?.user.id ?? null, () => setMode('artist'))` con `AuthProvider` y `useAppMode` de la Spec 001 (confirmar nombre del setter). Debe envolver también las rutas `artist/…` y `(tabs)/…` de las specs 004/005; si el layout real es otro, montarlo ahí.
2. Inicio: `<NotificationPermissionPrompt showToast={…} />` con el mecanismo de toast existente.

**Criterio de hecho:** el prompt aparece en el inicio y nunca en registro, verificación ni `profile-setup` (Escenario 8.4).

---

### T018 — Fila de notificaciones en el perfil

**Traza:** RF-25-A (Escenarios 8.5, 8.6)
**Archivos a modificar:**
- `src/app/(app)/profile.tsx`

**Descripción:**
Insertar `<NotificationSettingsRow />` antes del botón «Cerrar sesión». Sin otros cambios.

**Criterio de hecho:** la fila refleja el estado real del permiso al volver de los ajustes de Android.

---

## Fase F — Calidad

### T019 — Pruebas unitarias del cliente

**Traza:** RNF-08 (≥ 60 %), Principio 9; Escenarios 8.2, 8.6, 8.8, 8.10, 8.12, 8.23, 8.24, 8.26
**Archivos a crear:**
- `src/features/notificaciones/__tests__/routing.test.ts`
- `src/features/notificaciones/__tests__/pushToken.test.ts`
- `src/features/notificaciones/__tests__/permission.test.ts`

**Descripción (casos mínimos):**
- `routing`: los 3 `target` producen la ruta y el `commissionId` correctos; `recipient_id` distinto → `null`; sin sesión → `null`; payload sin UUID válido o `target` desconocido → `parsePushData` devuelve `null`.
- `pushToken`: `syncPushRegistration` llama la RPC con el token y lo guarda; error de RPC → lanza y no guarda; `unregisterCurrentDevice` borra por token, no lanza si Supabase falla, resuelve en ≤ 3 s si la petición no responde (fake timers), siempre elimina la clave de AsyncStorage y llama `dismissAllNotificationsAsync`; sin token guardado no llama a Supabase.
- `permission`: `granted` / `askable` / `blocked` según `getPermissionsAsync`; `requestPushPermission` crea el canal antes de pedir el permiso.

**Criterio de hecho:** `jest --coverage` ≥ 60 % en `src/features/notificaciones` (lógica); `expo lint` y `tsc` con 0 errores.

---

### T020 — Pruebas unitarias de la Edge Function

**Traza:** RNF-NOT-8.1, RNF-NOT-8.4, RNF-NOT-8.5, RNF-08; Escenarios 8.13–8.22 (contenido)
**Archivos a crear:**
- `supabase/functions/send-push-notification/logic.test.ts`

**Descripción (casos mínimos):**
- `parsePushRequest`: payload válido; evento desconocido, UUID inválido, `null` o string → `null`.
- `buildMessages`: para cada uno de los 7 eventos, título `Koma`, texto literal exacto, `channelId: 'default'`, `target` correcto y `data` con exactamente 3 claves; un mensaje por token.
- **Privacidad:** ningún `body` de `EVENT_CONTENT` contiene dígitos, `$`, ni las palabras de nombres de etapa («Boceto», «Delineado», «Color»).
- `collectUnregisteredTokens`: solo tokens con `DeviceNotRegistered`; ignora `MessageTooBig` y `ok`.
- `chunk` (250 → 100/100/50), `timingSafeEqual`, `isRetryableStatus` (`null`, 429, 500 → `true`; 400 → `false`).
- Si `jest.config` limita `roots` a `src/`, agregar `<rootDir>/supabase/functions`.

**Criterio de hecho:** todas las pruebas pasan con `jest`.

---

### T021 — Casos de prueba manuales en dispositivo Android

**Traza:** Principio 9; Escenarios 8.1–8.26
**Archivos a crear:**
- `specs/008-notificaciones-push/manual-tests.md`

**Descripción:**
Documentar cada escenario como caso manual (precondición, pasos, resultado esperado, resultado obtenido, dispositivo/versión de Android), con una cuenta de artista y una de cliente en **dos teléfonos físicos** (Android 13+ y, si es posible, Android ≤ 12). Incluir obligatoriamente:
- Permiso concedido (8.1), denegado sin bloquear la app recorriendo catálogo → solicitud → seguimiento (8.2), «Ahora no» y reinicio de la app (8.3), permiso bloqueado y «Abrir ajustes» (8.6).
- Los 7 eventos de punta a punta (8.13–8.22), midiendo el tiempo hasta la llegada (≤ 60 s) y fotografiando la **pantalla de bloqueo** para verificar contenido discreto.
- Un solo aviso al aceptar (no dos) y al confirmar pago con entregable (8.19).
- Cierre de sesión con avisos visibles (8.10), ausencia de avisos tras cerrar sesión (8.11) y cierre en modo avión (8.12).
- Cambio de cuenta en el mismo teléfono (8.8) y toque de un aviso de otra cuenta (8.26).
- Toque con app cerrada (8.23), en segundo plano (8.24) y banner + refresco en primer plano (8.25).
- Desinstalar la app en un teléfono, provocar un evento y verificar que su fila desaparece de `device_tokens` (RNF-NOT-8.5).
- Regresión: flujo completo de las specs 003–007 sin errores nuevos.

**Criterio de hecho:** todos los casos ejecutados y en verde sobre el development build; la spec refleja lo implementado (definición de hecho, constitución §6).

---

## Mapa de trazabilidad

| Tarea | RF / RNF | Escenarios cubiertos |
|---|---|---|
| T001 | RF-25-A, RNF-NOT-8.2, RNF-04 | 8.8 (servidor) |
| T002 | RF-08-A, RF-10-A, RF-26-A, RF-27-A, RNF-NOT-8.4 | 8.13–8.22 (servidor) |
| T003 | RNF-04, RNF-NOT-8.2 | 8.8, 8.10 (acceso denegado) |
| T004 | RF-08-A, RF-10-A, RF-26-A, RF-27-A, RNF-NOT-8.4 | 8.13–8.22 |
| T005 | RNF-NOT-8.1, RNF-NOT-8.5, RF-28-A, RI-02 | 8.13–8.22 (contenido) |
| T006 | RF-08-A, RF-10-A, RF-26-A, RF-27-A, RNF-NOT-8.4, RNF-NOT-8.5, RI-02 | 8.13–8.22 |
| T007 | RI-02, Principio 5, RNF-NOT-8.3 | — (configuración) |
| T008 | RF-25-A, RI-02, Principios 3 y 5 | 8.1 (prerrequisito) |
| T009 | RF-25-A, RF-25-B | — (textos) |
| T010 | RF-25-A, RNF-NOT-8.1, Principio 8 | 8.1, 8.2, 8.6 |
| T011 | RF-25-A, RF-25-B, RNF-NOT-8.2 | 8.1, 8.7–8.10, 8.12 |
| T012 | RF-28-A, RNF-NOT-8.2 | 8.23, 8.24, 8.26 |
| T013 | RF-28-A, RNF-NOT-8.2 | 8.25, 8.26 |
| T014 | RF-25-A, RF-28-A | 8.7, 8.9, 8.23–8.26 |
| T015 | RF-25-A, Principio 8 | 8.1–8.3, 8.5, 8.6, 8.9 |
| T016 | RF-25-B, RNF-NOT-8.2 | 8.10–8.12 |
| T017 | RF-25-A, RF-28-A | 8.1, 8.4 |
| T018 | RF-25-A | 8.5, 8.6 |
| T019 | RNF-08, Principio 9 | 8.2, 8.6, 8.8, 8.10, 8.12, 8.23, 8.24, 8.26 |
| T020 | RNF-NOT-8.1, RNF-NOT-8.4, RNF-NOT-8.5, RNF-08 | 8.13–8.22 |
| T021 | Principio 9 | 8.1–8.26 |