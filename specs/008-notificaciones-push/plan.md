# Plan 008 — Notificaciones Push (`008-notificaciones-push`)

**Estado:** Borrador · **Versión:** 0.1 · **Fecha:** 2026-11-21
**Derivado de:** `008-notificaciones-push/spec.md`
**Constitución:** v1.1

> Este documento describe **cómo** se implementa la spec 008. Toda decisión técnica se deriva de los RF y RNF de la spec. Las APIs de `expo-notifications`, Supabase (pg_net, Vault, Edge Functions) y EAS citadas deben verificarse contra la documentación vigente antes de implementar (constitución, sección 3); los puntos sensibles a versión están marcados con ⚠️.

---

## 1. Visión general del flujo técnico

```
                    ┌──────────────────────────────────────────────────────────┐
                    │ Mutaciones EXISTENTES (specs 003, 004, 006, 007) — SIN CAMBIOS │
                    │  INSERT commissions · UPDATE commissions · RPC de pago/entrega │
                    │  INSERT commission_advance_files                               │
                    └──────────────────────────┬───────────────────────────────┘
                                               │ (misma transacción)
Postgres                                       ▼
  ├─ Triggers AFTER (008)  ── resolve_commission_push_event() ──► evento + destinatario
  │                                            │
  │                          enqueue_push_notification()  (SECURITY DEFINER, nunca lanza)
  │                                            │  net.http_post  (pg_net: cola asíncrona,
  │                                            │   se envía DESPUÉS del COMMIT; si hay
  │                                            │   ROLLBACK no se envía nada)
  │  Vault: push_function_url, push_webhook_secret
  ▼                                            ▼
Edge Function  send-push-notification  (verify_jwt = false; valida x-koma-webhook-secret)
  ├─ parsePushRequest → { event, commission_id, recipient_id }
  ├─ SELECT device_tokens WHERE user_id = recipient_id      (service role)
  ├─ buildMessages  → título «Koma» + texto discreto + data {commission_id, target, recipient_id}
  ├─ POST https://exp.host/--/api/v2/push/send   (hasta 3 intentos ante red/5xx/429)
  └─ tickets DeviceNotRegistered → DELETE device_tokens
                                               │
                                     Expo Push Service ──► FCM ──► Android
                                                                     │
Cliente Expo SDK 58 (src/features/notificaciones)                    ▼
  ├─ handler.ts            setNotificationHandler (banner solo si recipient_id = sesión)
  ├─ NotificationPermissionPrompt  (inicio autenticado) → canal «default» → permiso → token
  ├─ pushToken.ts          register_device_token() (RPC upsert) · unregisterCurrentDevice()
  ├─ usePushNotifications  sincroniza token · invalida ['commissions'] · navega al tocar
  └─ auth/api.ts signOut   unregisterCurrentDevice() ANTES de supabase.auth.signOut()
```

**Principio rector:** las specs 001–007 no cambian sus mutaciones. Toda la lógica de «qué pasó y a quién avisar» vive en triggers de Postgres versionados en una migración; toda la lógica de «cómo se entrega» vive en una Edge Function. Si cualquiera de las dos falla, la operación original ya quedó confirmada (RNF-NOT-8.4).

---

## 2. Correspondencia de eventos con el esquema real

El brief usa nombres genéricos (`ACCEPTED`, `REJECTED`, `COMPLETED`). El esquema real de las specs 004 y 007 usa el ENUM `public.commission_status` en español. Esta tabla es la fuente de verdad para el trigger y la Edge Function:

| Evento (`event`) | Spec | Tabla / operación | Condición exacta (OLD → NEW) | Destinatario | `target` | Texto |
|---|---|---|---|---|---|---|
| `NEW_REQUEST` | 003 | `commissions` INSERT | Toda fila nueva | `artist_id` | `artist_request` | «Tienes una nueva solicitud de comisión» |
| `PAYMENT_PROOF_SUBMITTED` | 007 | `commissions` UPDATE (vía `submit_payment_proof`) | `payment_status` ≠ `UNDER_REVIEW` → `UNDER_REVIEW` | `artist_id` | `artist_work` | «Un cliente subió un comprobante de pago» |
| `REQUEST_UPDATED` | 004 | `commissions` UPDATE | `status` `PENDIENTE` → `EN_PROGRESO` (aceptada) o `RECHAZADA` | `client_id` | `client_tracking` | «Hay una actualización en tu solicitud de comisión» |
| `STAGE_ADVANCED` | 004 | `commissions` UPDATE | `status` `EN_PROGRESO` → `EN_PROGRESO` y `current_stage` cambia a no nulo | `client_id` | `client_tracking` | «Tu comisión avanzó a una nueva etapa» |
| `NEW_ADVANCE` | 006 | `commission_advance_files` INSERT (por sentencia) | Archivos insertados de ≥ 1 avance | `client_id` | `client_tracking` | «Tienes un nuevo avance disponible» |
| `PAYMENT_UPDATED` | 007 | `commissions` UPDATE (vía `verify_payment` / `request_payment_correction`) | `payment_status` → `VERIFIED` o `NEEDS_CORRECTION` | `client_id` | `client_tracking` | «Se actualizó el estado de tu pago» |
| `DELIVERABLE_READY` | 007 | `commissions` UPDATE (vía `submit_deliverable` / `verify_payment`) | `status` → `COMPLETADA`, o `deliverable_path` cambia a no nulo | `client_id` | `client_tracking` | «Tu entregable final está listo» |

**Prioridad** (spec §5) implementada como el orden del `CASE` en `resolve_commission_push_event`: `DELIVERABLE_READY` > `REQUEST_UPDATED` > `PAYMENT_PROOF_SUBMITTED` > `PAYMENT_UPDATED` > `STAGE_ADVANCED`.

**Por qué el aviso de avance se dispara en `commission_advance_files` y no en `commission_advances`** (P-8.8): el hook `useUploadAdvance` de la Spec 006 inserta primero la fila de `commission_advances`, después sube las imágenes y por último inserta todas las filas de `commission_advance_files` en **una sola sentencia**. Un trigger `FOR EACH STATEMENT` sobre `commission_advance_files` dispara exactamente una vez por avance y solo cuando sus imágenes ya existen; si la subida falla, no hay sentencia de archivos y no se avisa (Escenario 8.16). Además, como pg_net envía después del `COMMIT`, un rollback nunca produce un aviso.

---

## 3. Esquema de base de datos

Migración única: `supabase/migrations/008_push_notifications.sql`. Cumple la convención de la constitución (§5): la tabla nueva incluye su RLS en la misma migración.

### 3.1 Tabla `device_tokens` y RLS

```sql
-- supabase/migrations/008_push_notifications.sql

-- ═══════════════════════════════════════════════════════════════════
-- 1. Tabla de dispositivos registrados (RF-25-A, RNF-NOT-8.2)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE public.device_tokens (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  expo_push_token text        NOT NULL
    CONSTRAINT device_tokens_token_format
      CHECK (char_length(expo_push_token) <= 200
             AND expo_push_token ~ '^Expo(nent)?PushToken\[.+\]$'),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT device_tokens_expo_push_token_key UNIQUE (expo_push_token)
);

-- La Edge Function busca por destinatario
CREATE INDEX idx_device_tokens_user_id ON public.device_tokens (user_id);

-- Reutiliza public.set_updated_at() (Spec 001 / Spec 004)
CREATE TRIGGER device_tokens_set_updated_at
  BEFORE UPDATE ON public.device_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────────
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.device_tokens FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_tokens TO authenticated;

CREATE POLICY "device_tokens_select_own"
  ON public.device_tokens FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "device_tokens_insert_own"
  ON public.device_tokens FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "device_tokens_update_own"
  ON public.device_tokens FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);   -- no se puede «regalar» un token a otra cuenta

CREATE POLICY "device_tokens_delete_own"
  ON public.device_tokens FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- anon: sin privilegios ni políticas ⇒ acceso denegado.
-- service_role (Edge Function) salta RLS para leer por destinatario y limpiar tokens inválidos.
```

### 3.2 Registro con reasignación: `register_device_token` (upsert)

Un `upsert` directo desde el cliente (`.upsert(..., { onConflict: 'expo_push_token' })`) **falla** en el caso del Escenario 8.8: si el token ya pertenece a la cuenta A, la rama `DO UPDATE` exige pasar la política `USING (auth.uid() = user_id)` sobre la fila de A, y B no la cumple. La RPC resuelve ese único caso sin abrir la tabla:

```sql
-- ═══════════════════════════════════════════════════════════════════
-- 2. Upsert con reasignación del dispositivo a la cuenta actual (P-8.7)
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.register_device_token(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  -- El CHECK device_tokens_token_format rechaza valores mal formados (23514).
  INSERT INTO public.device_tokens (user_id, expo_push_token)
  VALUES (auth.uid(), p_token)
  ON CONFLICT (expo_push_token)
  DO UPDATE SET user_id = EXCLUDED.user_id,
                updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.register_device_token(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_device_token(text) TO authenticated;
```

> **Análisis de riesgo:** para reasignar un token ajeno hay que conocerlo, y el `ExpoPushToken` solo existe en el dispositivo y en `device_tokens` (no legible para otras cuentas por RLS). Aun si se filtrara, el efecto sería que la víctima deje de recibir sus avisos y el atacante reciba los suyos propios: ningún dato de la víctima se expone, porque el contenido es discreto y la navegación exige que `recipient_id` coincida con la sesión (§6.5).

### 3.3 Encolado hacia la Edge Function (pg_net + Vault)

```sql
-- ═══════════════════════════════════════════════════════════════════
-- 3. pg_net: HTTP asíncrono desde Postgres (se envía tras el COMMIT)
-- ═══════════════════════════════════════════════════════════════════
-- Forma documentada por Supabase; las funciones quedan en el esquema «net» (net.http_post). ⚠️ verificar
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ═══════════════════════════════════════════════════════════════════
-- 4. Encolar un aviso. NUNCA lanza excepción (RNF-NOT-8.4).
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.enqueue_push_notification(
  p_event         text,
  p_commission_id uuid,
  p_recipient_id  uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_url    text;
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'push_function_url';
  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'push_webhook_secret';

  IF v_url IS NULL OR v_secret IS NULL THEN
    RAISE WARNING 'push notifications not configured (vault secrets missing)';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url                  := v_url,
    body                 := jsonb_build_object(
                              'event',         p_event,
                              'commission_id', p_commission_id,
                              'recipient_id',  p_recipient_id),
    headers              := jsonb_build_object(
                              'Content-Type',          'application/json',
                              'x-koma-webhook-secret', v_secret),
    timeout_milliseconds := 10000
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'enqueue_push_notification failed: %', SQLERRM;
END;
$$;

-- Nadie fuera de los triggers puede encolar avisos (evita spam vía RPC).
REVOKE ALL ON FUNCTION public.enqueue_push_notification(text, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
```

### 3.4 Resolución del evento (función pura, testeable)

```sql
-- ═══════════════════════════════════════════════════════════════════
-- 5. Decide qué aviso genera un UPDATE de commissions (spec §5).
--    Devuelve NULL si no hay aviso. El orden del CASE es la prioridad.
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.resolve_commission_push_event(
  p_old_status      public.commission_status,
  p_new_status      public.commission_status,
  p_old_stage       public.creative_stage,
  p_new_stage       public.creative_stage,
  p_old_payment     public.payment_status,
  p_new_payment     public.payment_status,
  p_old_deliverable text,
  p_new_deliverable text
)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT CASE
    -- 1. E7: comisión completada o entregable subido/reemplazado
    WHEN p_new_status = 'COMPLETADA'
         AND p_old_status IS DISTINCT FROM 'COMPLETADA'                 THEN 'DELIVERABLE_READY'
    WHEN p_new_deliverable IS NOT NULL
         AND p_new_deliverable IS DISTINCT FROM p_old_deliverable       THEN 'DELIVERABLE_READY'
    -- 2. E3: solicitud resuelta (absorbe la entrada a SKETCH al aceptar)
    WHEN p_old_status = 'PENDIENTE'
         AND p_new_status IN ('EN_PROGRESO', 'RECHAZADA')               THEN 'REQUEST_UPDATED'
    -- 3. E2: comprobante enviado / reenviado (al artista)
    WHEN p_new_payment = 'UNDER_REVIEW'
         AND p_old_payment IS DISTINCT FROM 'UNDER_REVIEW'              THEN 'PAYMENT_PROOF_SUBMITTED'
    -- 4. E6: pago confirmado o corrección solicitada
    WHEN p_new_payment IN ('VERIFIED', 'NEEDS_CORRECTION')
         AND p_new_payment IS DISTINCT FROM p_old_payment               THEN 'PAYMENT_UPDATED'
    -- 5. E4: avance de etapa dentro de EN_PROGRESO
    WHEN p_old_status = 'EN_PROGRESO' AND p_new_status = 'EN_PROGRESO'
         AND p_new_stage IS NOT NULL
         AND p_new_stage IS DISTINCT FROM p_old_stage                   THEN 'STAGE_ADVANCED'
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION public.resolve_commission_push_event(
  public.commission_status, public.commission_status,
  public.creative_stage, public.creative_stage,
  public.payment_status, public.payment_status, text, text
) FROM PUBLIC, anon;
```

### 3.5 Triggers

```sql
-- ═══════════════════════════════════════════════════════════════════
-- 6. Triggers. SECURITY DEFINER para poder ejecutar enqueue_push_notification
--    (los triggers corren con los privilegios del usuario que hizo el cambio).
--    Son AFTER: nunca modifican la fila ni bloquean la operación.
-- ═══════════════════════════════════════════════════════════════════

-- 6.1 E1 — nueva solicitud (Spec 003)
CREATE OR REPLACE FUNCTION public.notify_commission_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.enqueue_push_notification('NEW_REQUEST', NEW.id, NEW.artist_id);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_commission_insert failed: %', SQLERRM;
  RETURN NULL;
END;
$$;

CREATE TRIGGER commissions_push_on_insert
  AFTER INSERT ON public.commissions
  FOR EACH ROW EXECUTE FUNCTION public.notify_commission_insert();

-- 6.2 E2, E3, E4, E6, E7 — cambios de estado, etapa, pago y entregable (specs 004 y 007)
CREATE OR REPLACE FUNCTION public.notify_commission_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event text;
BEGIN
  v_event := public.resolve_commission_push_event(
    OLD.status, NEW.status,
    OLD.current_stage, NEW.current_stage,
    OLD.payment_status, NEW.payment_status,
    OLD.deliverable_path, NEW.deliverable_path);

  IF v_event IS NOT NULL THEN
    PERFORM public.enqueue_push_notification(
      v_event,
      NEW.id,
      CASE WHEN v_event = 'PAYMENT_PROOF_SUBMITTED' THEN NEW.artist_id ELSE NEW.client_id END);
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_commission_update failed: %', SQLERRM;
  RETURN NULL;
END;
$$;

-- WHEN filtra en el motor: los UPDATE que solo tocan updated_at, notas, etc. no ejecutan la función.
CREATE TRIGGER commissions_push_on_update
  AFTER UPDATE ON public.commissions
  FOR EACH ROW
  WHEN (   OLD.status           IS DISTINCT FROM NEW.status
        OR OLD.current_stage    IS DISTINCT FROM NEW.current_stage
        OR OLD.payment_status   IS DISTINCT FROM NEW.payment_status
        OR OLD.deliverable_path IS DISTINCT FROM NEW.deliverable_path)
  EXECUTE FUNCTION public.notify_commission_update();

-- 6.3 E5 — nuevo avance con sus imágenes (Spec 006). Una vez por avance.
CREATE OR REPLACE FUNCTION public.notify_advance_files_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT a.commission_id, c.client_id
      FROM new_files f
      JOIN public.commission_advances a ON a.id = f.advance_id
      JOIN public.commissions        c ON c.id = a.commission_id
  LOOP
    PERFORM public.enqueue_push_notification('NEW_ADVANCE', r.commission_id, r.client_id);
  END LOOP;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_advance_files_insert failed: %', SQLERRM;
  RETURN NULL;
END;
$$;

CREATE TRIGGER commission_advance_files_push_on_insert
  AFTER INSERT ON public.commission_advance_files
  REFERENCING NEW TABLE AS new_files
  FOR EACH STATEMENT EXECUTE FUNCTION public.notify_advance_files_insert();

REVOKE ALL ON FUNCTION public.notify_commission_insert()     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_commission_update()     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_advance_files_insert()  FROM PUBLIC, anon, authenticated;
```

**Garantías frente a las specs 001–007:**

| Riesgo de regresión | Mitigación |
|---|---|
| Un fallo del aviso rompe la mutación | Triggers `AFTER` con `EXCEPTION WHEN OTHERS` → `WARNING`; `enqueue_push_notification` también captura todo. |
| La mutación se vuelve lenta | `net.http_post` solo inserta en la cola `net.http_request_queue` (microsegundos); el HTTP real lo hace el worker de pg_net después del `COMMIT`. |
| Aviso de una operación revertida | La cola de pg_net es transaccional: con `ROLLBACK` no hay petición. |
| Cambios en privilegios de 007 (`GRANT UPDATE` por columna) | Los triggers no requieren privilegios de columna y no escriben en `commissions`. |
| Cambios en RLS de 003–007 | Ninguna política existente se toca. |

### 3.6 Secretos (fuera del repositorio — Principio 5)

No van en la migración. Se ejecutan **una vez por entorno** en el SQL Editor del panel (producción) y en `supabase db` local (desarrollo):

```sql
-- URL de la función (local: http://host.docker.internal:54321/functions/v1/send-push-notification ⚠️ según el entorno de Docker)
SELECT vault.create_secret(
  'https://<project-ref>.supabase.co/functions/v1/send-push-notification',
  'push_function_url');

-- Secreto compartido: cadena aleatoria de 32+ bytes, p. ej. `openssl rand -hex 32`
SELECT vault.create_secret('<valor-aleatorio>', 'push_webhook_secret');
```

El mismo valor del secreto se carga en la Edge Function: `supabase secrets set PUSH_WEBHOOK_SECRET=<valor-aleatorio>`. Para rotarlo: `vault.update_secret(...)` + `supabase secrets set` con el valor nuevo.

### 3.7 Vista resultante

```
device_tokens
─────────────────────────────────────────────────────────────────
 id               uuid        PK
 user_id          uuid        FK → auth.users.id  ON DELETE CASCADE   (idx)
 expo_push_token  text        NOT NULL UNIQUE  CHECK formato ExponentPushToken[...] ≤ 200
 created_at       timestamptz NOT NULL DEFAULT now()
 updated_at       timestamptz NOT NULL DEFAULT now()   (trigger set_updated_at)
 RLS: SELECT / INSERT / UPDATE / DELETE  ⇔  auth.uid() = user_id

Funciones nuevas
 register_device_token(text)             authenticated   SECURITY DEFINER (upsert + reasignación)
 enqueue_push_notification(text,uuid,uuid) solo triggers  SECURITY DEFINER (Vault + pg_net)
 resolve_commission_push_event(...)       sin EXECUTE público, función pura
 notify_commission_insert / _update / notify_advance_files_insert   (triggers)
```

---

## 4. Edge Function `send-push-notification`

### 4.1 Contrato

**Request** (solo desde pg_net):

```
POST /functions/v1/send-push-notification
Content-Type: application/json
x-koma-webhook-secret: <PUSH_WEBHOOK_SECRET>

{ "event": "STAGE_ADVANCED",
  "commission_id": "6f1c…-uuid",
  "recipient_id": "a2b9…-uuid" }
```

**Responses:**

| Código | Cuerpo | Cuándo |
|---|---|---|
| 200 | `{ "sent": n, "failed": n, "removed": n }` | Procesado (incluye `sent: 0` si el destinatario no tiene dispositivos) |
| 400 | `{ "error": "invalid_json" \| "invalid_payload" }` | Cuerpo no JSON, evento desconocido o UUID inválido |
| 401 | `{ "error": "unauthorized" }` | Falta o no coincide `x-koma-webhook-secret` |
| 405 | `{ "error": "method_not_allowed" }` | Método distinto de `POST` |
| 500 | `{ "error": "tokens_query_failed" }` | Error al leer `device_tokens` |
| 502 | `{ "error": "expo_send_failed" }` | Expo no respondió bien tras 3 intentos |

pg_net guarda la respuesta en `net._http_response` (diagnóstico); nadie la reintenta (los reintentos viven dentro de la función, RNF-NOT-8.4).

**Mensaje enviado a Expo por cada token:**

```json
{
  "to": "ExponentPushToken[xxxxxxxx]",
  "title": "Koma",
  "body": "Tu comisión avanzó a una nueva etapa",
  "data": { "commission_id": "6f1c…", "target": "client_tracking", "recipient_id": "a2b9…" },
  "channelId": "default",
  "priority": "high",
  "sound": "default"
}
```

`data` no es visible en la notificación; solo contiene identificadores opacos (RNF-NOT-8.1).

### 4.2 Lógica pura — `supabase/functions/send-push-notification/logic.ts`

Sin imports: la consumen `index.ts` (Deno) y Jest (`logic.test.ts`).

```typescript
// supabase/functions/send-push-notification/logic.ts

export const PUSH_EVENTS = [
  'NEW_REQUEST',
  'PAYMENT_PROOF_SUBMITTED',
  'REQUEST_UPDATED',
  'STAGE_ADVANCED',
  'NEW_ADVANCE',
  'PAYMENT_UPDATED',
  'DELIVERABLE_READY',
] as const;

export type PushEvent = (typeof PUSH_EVENTS)[number];
export type PushTarget = 'artist_request' | 'artist_work' | 'client_tracking';

export const NOTIFICATION_TITLE = 'Koma';
export const ANDROID_CHANNEL_ID = 'default';

/** Textos literales de la spec §5 / §8.3. Única fuente de contenido visible. */
export const EVENT_CONTENT: Record<PushEvent, { body: string; target: PushTarget }> = {
  NEW_REQUEST:             { body: 'Tienes una nueva solicitud de comisión',           target: 'artist_request' },
  PAYMENT_PROOF_SUBMITTED: { body: 'Un cliente subió un comprobante de pago',          target: 'artist_work' },
  REQUEST_UPDATED:         { body: 'Hay una actualización en tu solicitud de comisión', target: 'client_tracking' },
  STAGE_ADVANCED:          { body: 'Tu comisión avanzó a una nueva etapa',             target: 'client_tracking' },
  NEW_ADVANCE:             { body: 'Tienes un nuevo avance disponible',                target: 'client_tracking' },
  PAYMENT_UPDATED:         { body: 'Se actualizó el estado de tu pago',                target: 'client_tracking' },
  DELIVERABLE_READY:       { body: 'Tu entregable final está listo',                   target: 'client_tracking' },
};

export interface PushRequest {
  event: PushEvent;
  commission_id: string;
  recipient_id: string;
}

export interface PushData {
  commission_id: string;
  target: PushTarget;
  recipient_id: string;
}

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data: PushData;
  channelId: typeof ANDROID_CHANNEL_ID;
  priority: 'high';
  sound: 'default';
}

export interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parsePushRequest(body: unknown): PushRequest | null {
  if (typeof body !== 'object' || body === null) return null;
  const { event, commission_id, recipient_id } = body as Record<string, unknown>;
  if (typeof event !== 'string' || !(PUSH_EVENTS as readonly string[]).includes(event)) return null;
  if (typeof commission_id !== 'string' || !UUID_RE.test(commission_id)) return null;
  if (typeof recipient_id !== 'string' || !UUID_RE.test(recipient_id)) return null;
  return { event: event as PushEvent, commission_id, recipient_id };
}

export function buildMessages(req: PushRequest, tokens: string[]): ExpoPushMessage[] {
  const { body, target } = EVENT_CONTENT[req.event];
  return tokens.map((to) => ({
    to,
    title: NOTIFICATION_TITLE,
    body,
    data: { commission_id: req.commission_id, target, recipient_id: req.recipient_id },
    channelId: ANDROID_CHANNEL_ID,
    priority: 'high',
    sound: 'default',
  }));
}

/** Los tickets vienen en el mismo orden que los mensajes enviados. */
export function collectUnregisteredTokens(
  messages: ExpoPushMessage[],
  tickets: ExpoPushTicket[],
): string[] {
  return tickets.flatMap((t, i) =>
    t.status === 'error' && t.details?.error === 'DeviceNotRegistered' && messages[i]
      ? [messages[i].to]
      : [],
  );
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Comparación en tiempo constante para el secreto del webhook. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Reintentar solo errores transitorios: red (status null), 429 y 5xx. */
export function isRetryableStatus(status: number | null): boolean {
  return status === null || status === 429 || status >= 500;
}
```

### 4.3 Handler — `supabase/functions/send-push-notification/index.ts`

```typescript
// supabase/functions/send-push-notification/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  buildMessages,
  chunk,
  collectUnregisteredTokens,
  isRetryableStatus,
  parsePushRequest,
  timingSafeEqual,
  type ExpoPushMessage,
  type ExpoPushTicket,
} from './logic.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_BATCH_SIZE = 100;   // límite por petición de Expo Push API
const MAX_ATTEMPTS = 3;        // RNF-NOT-8.4 / SRS RF-08, RF-10

// Variables inyectadas por Supabase en el runtime de Edge Functions ⚠️ verificar nombres
// vigentes (claves API nuevas: SUPABASE_SECRET_KEYS); nunca se exponen al cliente.
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const WEBHOOK_SECRET = Deno.env.get('PUSH_WEBHOOK_SECRET') ?? '';

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function sendBatch(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
  let lastError = 'unknown';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let status: number | null = null;
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(messages),
      });
      status = res.status;
      if (res.ok) {
        const payload = (await res.json()) as { data?: ExpoPushTicket[] };
        return payload.data ?? [];
      }
      lastError = `expo_http_${res.status}`;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
    if (!isRetryableStatus(status) || attempt === MAX_ATTEMPTS) break;
    await delay(500 * attempt);   // 0.5 s, 1 s
  }
  throw new Error(lastError);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const provided = req.headers.get('x-koma-webhook-secret') ?? '';
  if (!WEBHOOK_SECRET || !timingSafeEqual(provided, WEBHOOK_SECRET)) {
    return json(401, { error: 'unauthorized' });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json(400, { error: 'invalid_json' });
  }
  const pushReq = parsePushRequest(raw);
  if (!pushReq) return json(400, { error: 'invalid_payload' });

  const { data: rows, error: tokensError } = await supabase
    .from('device_tokens')
    .select('expo_push_token')
    .eq('user_id', pushReq.recipient_id);
  if (tokensError) {
    console.error(JSON.stringify({ event: pushReq.event, error: 'tokens_query_failed' }));
    return json(500, { error: 'tokens_query_failed' });
  }

  const tokens = (rows ?? []).map((r: { expo_push_token: string }) => r.expo_push_token);
  if (tokens.length === 0) return json(200, { sent: 0, failed: 0, removed: 0 });

  const messages = buildMessages(pushReq, tokens);
  const tickets: ExpoPushTicket[] = [];
  try {
    for (const batch of chunk(messages, EXPO_BATCH_SIZE)) {
      tickets.push(...(await sendBatch(batch)));
    }
  } catch (e) {
    console.error(JSON.stringify({ event: pushReq.event, error: 'expo_send_failed', detail: String(e) }));
    return json(502, { error: 'expo_send_failed' });
  }

  // RNF-NOT-8.5: limpieza de dispositivos inexistentes
  const invalid = collectUnregisteredTokens(messages, tickets);
  if (invalid.length > 0) {
    const { error: deleteError } = await supabase
      .from('device_tokens')
      .delete()
      .in('expo_push_token', invalid);
    if (deleteError) console.error(JSON.stringify({ event: pushReq.event, error: 'cleanup_failed' }));
  }

  const failed = tickets.filter((t) => t.status === 'error').length;
  // Privacidad: nunca se registran tokens, textos ni IDs de usuario en los logs.
  console.log(JSON.stringify({ event: pushReq.event, sent: tickets.length - failed, failed, removed: invalid.length }));
  return json(200, { sent: tickets.length - failed, failed, removed: invalid.length });
});
```

### 4.4 Configuración y despliegue

```toml
# supabase/config.toml  (AGREGAR)
[functions.send-push-notification]
verify_jwt = false   # la llama pg_net, no un usuario; la autenticación es x-koma-webhook-secret
```

```bash
supabase secrets set PUSH_WEBHOOK_SECRET=<valor-aleatorio>
supabase functions deploy send-push-notification --no-verify-jwt
```

**TypeScript de la app:** el `index.ts` usa globals de Deno (`Deno.env`, `Deno.serve`) y un import `npm:`, que `tsc` de la app no reconoce. Se agrega `"supabase/functions"` a `exclude` de `tsconfig.json` (las funciones se validan con el runtime de Deno al desplegar). `logic.test.ts` lo ejecuta Jest con Babel (`jest-expo`), que no hace chequeo de tipos.

**Recibos de Expo (receipts):** `DeviceNotRegistered` también puede llegar en los recibos que Expo publica minutos después. Consultarlos exige un job periódico; queda fuera del MVP (Principio 11). Los tokens inválidos se detectan igual en el siguiente envío por ticket o al reasignarse el dispositivo.

---

## 5. Pruebas SQL

### 5.1 RLS de `device_tokens` — `supabase/tests/008_rls_test.sql`

```sql
-- Fixtures (como postgres): usuarios user-uuid-a, user-uuid-b
--   token-a : 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]' de user-uuid-a
BEGIN;
INSERT INTO public.device_tokens (user_id, expo_push_token)
VALUES ('user-uuid-a', 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]');

SET LOCAL ROLE authenticated;

-- D1: A ve su propio token
SET LOCAL request.jwt.claims = '{"sub":"user-uuid-a","role":"authenticated"}';
SELECT count(*) FROM public.device_tokens;                         -- Esperado: 1

-- D2: B NO ve el token de A (acceso denegado)
SET LOCAL request.jwt.claims = '{"sub":"user-uuid-b","role":"authenticated"}';
SELECT count(*) FROM public.device_tokens;                         -- Esperado: 0

-- D3: B NO puede insertar un token a nombre de A
INSERT INTO public.device_tokens (user_id, expo_push_token)
VALUES ('user-uuid-a', 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]');
-- Esperado: ERROR new row violates row-level security policy

-- D4: B NO puede actualizar el token de A
UPDATE public.device_tokens SET user_id = 'user-uuid-b'
 WHERE expo_push_token = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
-- Esperado: UPDATE 0

-- D5: B NO puede borrar el token de A
DELETE FROM public.device_tokens
 WHERE expo_push_token = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
-- Esperado: DELETE 0

-- D6: A NO puede «regalar» su token a B
SET LOCAL request.jwt.claims = '{"sub":"user-uuid-a","role":"authenticated"}';
UPDATE public.device_tokens SET user_id = 'user-uuid-b'
 WHERE expo_push_token = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
-- Esperado: ERROR new row violates row-level security policy (WITH CHECK)

-- D7: formato inválido rechazado
SELECT public.register_device_token('not-a-token');
-- Esperado: ERROR violates check constraint "device_tokens_token_format"

-- D8: register_device_token reasigna el dispositivo de A a B (Escenario 8.8)
SET LOCAL request.jwt.claims = '{"sub":"user-uuid-b","role":"authenticated"}';
SELECT public.register_device_token('ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]');
SELECT user_id FROM public.device_tokens;                          -- Esperado: 1 fila, user-uuid-b
SET LOCAL request.jwt.claims = '{"sub":"user-uuid-a","role":"authenticated"}';
SELECT count(*) FROM public.device_tokens;                         -- Esperado: 0

-- D9: A borra su propio token (logout, Escenario 8.10)
SELECT public.register_device_token('ExponentPushToken[cccccccccccccccccccccc]');
DELETE FROM public.device_tokens
 WHERE expo_push_token = 'ExponentPushToken[cccccccccccccccccccccc]';
-- Esperado: DELETE 1

-- D10: anon no lee ni ejecuta nada
RESET ROLE;
SET LOCAL ROLE anon;
SELECT count(*) FROM public.device_tokens;                          -- Esperado: ERROR permission denied
SELECT public.register_device_token('ExponentPushToken[dddddddddddddddddddddd]');
-- Esperado: ERROR permission denied for function

-- D11: authenticated no puede encolar avisos directamente
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"user-uuid-a","role":"authenticated"}';
SELECT public.enqueue_push_notification('NEW_REQUEST', gen_random_uuid(), 'user-uuid-a');
-- Esperado: ERROR permission denied for function

ROLLBACK;
```

### 5.2 Eventos y encolado — `supabase/tests/008_push_events_test.sql`

```sql
BEGIN;
-- ── Resolución pura (como postgres) ───────────────────────────────
-- E1: aceptar → REQUEST_UPDATED (no STAGE_ADVANCED)
SELECT public.resolve_commission_push_event('PENDIENTE','EN_PROGRESO', NULL,'SKETCH', 'UNPAID','UNPAID', NULL,NULL);
-- Esperado: 'REQUEST_UPDATED'
-- E2: rechazar
SELECT public.resolve_commission_push_event('PENDIENTE','RECHAZADA', NULL,NULL, 'UNPAID','UNPAID', NULL,NULL);
-- Esperado: 'REQUEST_UPDATED'
-- E3: SKETCH → LINEART
SELECT public.resolve_commission_push_event('EN_PROGRESO','EN_PROGRESO', 'SKETCH','LINEART', 'UNPAID','UNPAID', NULL,NULL);
-- Esperado: 'STAGE_ADVANCED'
-- E4: comprobante enviado / reenviado
SELECT public.resolve_commission_push_event('EN_PROGRESO','EN_PROGRESO', 'LINEART','LINEART', 'UNPAID','UNDER_REVIEW', NULL,NULL);
SELECT public.resolve_commission_push_event('EN_PROGRESO','EN_PROGRESO', 'LINEART','LINEART', 'NEEDS_CORRECTION','UNDER_REVIEW', NULL,NULL);
-- Esperado: 'PAYMENT_PROOF_SUBMITTED' (ambos)
-- E5: corrección / verificación sin entregable
SELECT public.resolve_commission_push_event('EN_PROGRESO','EN_PROGRESO', 'FINAL','FINAL', 'UNDER_REVIEW','NEEDS_CORRECTION', NULL,NULL);
SELECT public.resolve_commission_push_event('EN_PROGRESO','EN_PROGRESO', 'FINAL','FINAL', 'UNDER_REVIEW','VERIFIED', NULL,NULL);
-- Esperado: 'PAYMENT_UPDATED' (ambos)
-- E6: verificación con entregable ⇒ COMPLETADA ⇒ un solo aviso (Escenario 8.19)
SELECT public.resolve_commission_push_event('EN_PROGRESO','COMPLETADA', 'FINAL',NULL, 'UNDER_REVIEW','VERIFIED', 'c/final-1.png','c/final-1.png');
-- Esperado: 'DELIVERABLE_READY'
-- E7: entregable subido con pago pendiente
SELECT public.resolve_commission_push_event('EN_PROGRESO','EN_PROGRESO', 'FINAL','FINAL', 'UNPAID','UNPAID', NULL,'c/final-1.png');
-- Esperado: 'DELIVERABLE_READY'
-- E8: cambio sin evento (p. ej. solo rejection_reason/updated_at)
SELECT public.resolve_commission_push_event('RECHAZADA','RECHAZADA', NULL,NULL, 'UNPAID','UNPAID', NULL,NULL);
-- Esperado: NULL

-- ── Encolado real con pg_net (como postgres) ─────────────────────
SELECT vault.create_secret('http://localhost:54321/functions/v1/send-push-notification', 'push_function_url');
SELECT vault.create_secret('test-secret', 'push_webhook_secret');
-- Fixture: commission-uuid-1 (client-uuid-1 / artist-uuid-1) en EN_PROGRESO, SKETCH

CREATE TEMP TABLE q0 AS SELECT count(*) AS n FROM net.http_request_queue;

-- E9: UPDATE de etapa encola exactamente 1 petición con el destinatario correcto
UPDATE public.commissions SET current_stage = 'LINEART' WHERE id = 'commission-uuid-1';
SELECT (SELECT count(*) FROM net.http_request_queue) - n FROM q0;      -- Esperado: 1
SELECT convert_from(body, 'UTF8')::jsonb ->> 'recipient_id'
  FROM net.http_request_queue ORDER BY id DESC LIMIT 1;                -- Esperado: client-uuid-1

-- E10: UPDATE sin cambios relevantes no encola nada (WHEN del trigger)
UPDATE public.commissions SET rejection_reason = NULL WHERE id = 'commission-uuid-1';
SELECT (SELECT count(*) FROM net.http_request_queue) - n FROM q0;      -- Esperado: 1 (sin cambio)

-- E11: 3 archivos de un avance en una sentencia ⇒ 1 aviso NEW_ADVANCE
INSERT INTO public.commission_advances (id, commission_id, artist_id, stage)
VALUES ('advance-uuid-1', 'commission-uuid-1', 'artist-uuid-1', 'LINEART');
INSERT INTO public.commission_advance_files (advance_id, storage_path, file_size, sort_order) VALUES
  ('advance-uuid-1', 'commission-uuid-1/advance-uuid-1/0.webp', 1000, 0),
  ('advance-uuid-1', 'commission-uuid-1/advance-uuid-1/1.webp', 1000, 1),
  ('advance-uuid-1', 'commission-uuid-1/advance-uuid-1/2.webp', 1000, 2);
SELECT (SELECT count(*) FROM net.http_request_queue) - n FROM q0;      -- Esperado: 2

-- E12: sin secretos en Vault, la mutación NO falla (RNF-NOT-8.4)
DELETE FROM vault.secrets WHERE name IN ('push_function_url', 'push_webhook_secret');
UPDATE public.commissions SET current_stage = 'FINAL' WHERE id = 'commission-uuid-1';
-- Esperado: UPDATE 1 + WARNING «push notifications not configured»

ROLLBACK;
```

> ⚠️ Verificar el nombre de la tabla de cola (`net.http_request_queue`) y el tipo de `body` (`bytea`) en la versión de pg_net del proyecto.

---

## 6. Cliente Expo SDK 58

### 6.1 Dependencias y configuración nativa

```bash
npx expo install expo-notifications
# expo-constants ya viene con expo; AsyncStorage ya se usa en la Spec 001 (useAppMode).
```

`app.json` (AGREGAR plugin; el resto del archivo no cambia):

```json
{
  "expo": {
    "plugins": [
      ["expo-notifications", {
        "icon": "./assets/images/notification-icon.png",
        "defaultChannel": "default"
      }]
    ]
  }
}
```

- `icon`: PNG 96×96 monocromo blanco con fondo transparente (Android lo tiñe). Sin él, Android muestra un cuadro blanco.
- `defaultChannel`: canal usado por FCM si un mensaje llega sin `channelId`.
- El plugin agrega `POST_NOTIFICATIONS` (Android 13+) al manifest. ⚠️ Verificar claves del plugin en SDK 58.

`app.config.ts` (NUEVO): lee `app.json` y solo resuelve la ruta de `google-services.json` para que **el archivo no se versione** (Principio 5: ninguna credencial de Firebase en el repositorio):

```typescript
// app.config.ts
import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'Koma',
  slug: config.slug ?? 'koma',
  android: {
    ...config.android,
    // EAS Build: variable de entorno de tipo archivo. Local: archivo ignorado por git.
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
  },
});
```

`.gitignore` (AGREGAR): `google-services.json` y `*-firebase-adminsdk-*.json`.

### 6.2 Constantes y mensajes

```typescript
// src/features/notificaciones/constants.ts
export const ANDROID_CHANNEL_ID = 'default';
export const PUSH_TOKEN_STORAGE_KEY = 'koma.push.token';
export const PROMPT_DISMISSED_STORAGE_KEY = 'koma.push.promptDismissed';
export const UNREGISTER_TIMEOUT_MS = 3000;   // RF-25-B: logout nunca espera más
```

```typescript
// src/features/notificaciones/messages.ts — literales de la spec §8
export const NOTIFICATION_MESSAGES = {
  promptTitle: 'Activa las notificaciones',
  promptBody:
    'Koma te avisará cuando haya novedades en tus comisiones: nuevas solicitudes, avances, cambios de etapa y pagos. Los avisos nunca muestran montos, descripciones ni notas privadas.',
  promptAccept: 'Activar',
  promptDecline: 'Ahora no',
  enabled: 'Notificaciones activadas',
  disabled: 'Notificaciones desactivadas. Puedes activarlas cuando quieras desde tu perfil.',
  registerFailed: 'No se pudieron activar las notificaciones en este dispositivo. Inténtalo más tarde.',
  settingsLabel: 'Notificaciones',
  settingsOn: 'Activadas',
  settingsOff: 'Desactivadas',
  settingsEnable: 'Activar notificaciones',
  settingsBlocked: 'Las notificaciones están desactivadas en los ajustes de Android.',
  openSettings: 'Abrir ajustes',
  channelName: 'Actividad de comisiones',
  channelDescription: 'Avisos sobre solicitudes, avances, pagos y entregas de tus comisiones.',
} as const;
```

### 6.3 Canal y permiso

```typescript
// src/features/notificaciones/permission.ts
import * as Notifications from 'expo-notifications';
import { ANDROID_CHANNEL_ID } from './constants';
import { NOTIFICATION_MESSAGES } from './messages';

export type PushPermissionState = 'granted' | 'askable' | 'blocked';

/**
 * Android 13+: el canal debe existir ANTES de pedir el permiso para que aparezca el diálogo.
 * PRIVATE: en pantallas de bloqueo seguras con «ocultar contenido sensible», Android oculta el
 * texto (RNF-NOT-8.1, defensa adicional; el contenido ya es discreto).
 */
export async function ensureAndroidChannel(): Promise<void> {
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: NOTIFICATION_MESSAGES.channelName,
    description: NOTIFICATION_MESSAGES.channelDescription,
    importance: Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    showBadge: false,
  });
}

export async function getPushPermissionState(): Promise<PushPermissionState> {
  const p = await Notifications.getPermissionsAsync();
  if (p.granted) return 'granted';
  return p.canAskAgain ? 'askable' : 'blocked';
}

/** Muestra el diálogo de Android (si aplica). No registra nada. */
export async function requestPushPermission(): Promise<boolean> {
  await ensureAndroidChannel();
  const res = await Notifications.requestPermissionsAsync();
  return res.granted;
}
```

### 6.4 Token: obtener, registrar, desvincular

```typescript
// src/features/notificaciones/pushToken.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/lib/supabase';
import { PUSH_TOKEN_STORAGE_KEY, UNREGISTER_TIMEOUT_MS } from './constants';
import { ensureAndroidChannel } from './permission';

export async function getExpoPushToken(): Promise<string> {
  const projectId: string | undefined =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error('missing_eas_project_id');
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return data;
}

/** RF-25-A: upsert con reasignación (RPC register_device_token). Requiere permiso concedido. */
export async function syncPushRegistration(): Promise<void> {
  await ensureAndroidChannel();
  const token = await getExpoPushToken();
  const { error } = await supabase.rpc('register_device_token', { p_token: token });
  if (error) throw error;
  await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
}

function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

/**
 * RF-25-B. Se llama ANTES de supabase.auth.signOut(), con el JWT aún vigente (RLS DELETE).
 * Nunca lanza y nunca tarda más de UNREGISTER_TIMEOUT_MS en la parte de red.
 */
export async function unregisterCurrentDevice(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
    if (token) {
      await withTimeout(
        supabase.from('device_tokens').delete().eq('expo_push_token', token),
        UNREGISTER_TIMEOUT_MS,
      );
    }
  } catch {
    // Sin conexión o timeout: el dispositivo se reasigna en el próximo inicio de sesión (P-8.7).
  } finally {
    await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY).catch(() => undefined);
    await Notifications.dismissAllNotificationsAsync().catch(() => undefined);
  }
}
```

### 6.5 Navegación al tocar un aviso

```typescript
// src/features/notificaciones/routing.ts
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
```

> Si las rutas reales del repositorio difieren de las de los planes 004/005, se ajusta **solo** este archivo. Si la ruta destino es de artista y el modo guardado (Spec 001, `useAppMode`) es cliente, `usePushNotifications` cambia el modo antes de navegar para que la interfaz sea coherente.

### 6.6 Presentación en primer plano

```typescript
// src/features/notificaciones/handler.ts
import * as Notifications from 'expo-notifications';
import { supabase } from '@/lib/supabase';
import { parsePushData } from './routing';

/**
 * Se ejecuta al importar el módulo (una vez, en src/app/_layout.tsx).
 * Solo muestra el banner si el aviso es de la sesión actual (RNF-NOT-8.2).
 * ⚠️ SDK 53+: shouldShowBanner / shouldShowList reemplazan a shouldShowAlert.
 */
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = parsePushData(notification.request.content.data);
    const { data: auth } = await supabase.auth.getSession();
    const mine = data !== null && auth.session?.user.id === data.recipient_id;
    return {
      shouldShowBanner: mine,
      shouldShowList: mine,
      shouldPlaySound: mine,
      shouldSetBadge: false,
    };
  },
});
```

### 6.7 Hook `usePushNotifications`

```typescript
// src/features/notificaciones/usePushNotifications.ts
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { getPushPermissionState } from './permission';
import { syncPushRegistration } from './pushToken';
import { parsePushData, resolveNotificationRoute } from './routing';

/**
 * Se monta UNA vez en el layout autenticado. userId = null ⇒ no hace nada.
 * onArtistTarget: callback opcional para poner el modo artista (Spec 001, useAppMode).
 */
export function usePushNotifications(userId: string | null, onArtistTarget?: () => void) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // 1. Registro silencioso si el permiso ya está concedido (Escenario 8.7, 8.9 reintento)
  useEffect(() => {
    if (!userId) return;
    void (async () => {
      if ((await getPushPermissionState()) !== 'granted') return;
      await syncPushRegistration().catch(() => undefined);
    })();
  }, [userId]);

  // 2. Rotación del token de FCM ⇒ se vuelve a registrar
  useEffect(() => {
    if (!userId) return;
    const sub = Notifications.addPushTokenListener(() => {
      void syncPushRegistration().catch(() => undefined);
    });
    return () => sub.remove();
  }, [userId]);

  // 3. Aviso recibido con la app abierta ⇒ refrescar datos (Escenario 8.25).
  //    Todas las queries de las specs 004–007 cuelgan del prefijo ['commissions'].
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(() => {
      void queryClient.invalidateQueries({ queryKey: ['commissions'] });
    });
    return () => sub.remove();
  }, [queryClient]);

  // 4. Toque del aviso: app en segundo plano o cerrada (cold start) — RF-28-A
  useEffect(() => {
    if (!userId) return;

    const handle = (response: Notifications.NotificationResponse) => {
      const data = parsePushData(response.notification.request.content.data);
      const route = data ? resolveNotificationRoute(data, userId) : null;
      Notifications.clearLastNotificationResponse();   // ⚠️ verificar en SDK 58
      if (!route || !data) return;
      if (data.target !== 'client_tracking') onArtistTarget?.();
      void queryClient.invalidateQueries({ queryKey: ['commissions'] });
      router.push(route);
    };

    const last = Notifications.getLastNotificationResponse();   // ⚠️ síncrono desde SDK 53
    if (last) handle(last);

    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, [userId, router, queryClient, onArtistTarget]);
}
```

### 6.8 Explicación previa — `NotificationPermissionPrompt`

```typescript
// src/features/notificaciones/components/NotificationPermissionPrompt.tsx
import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PROMPT_DISMISSED_STORAGE_KEY } from '../constants';
import { NOTIFICATION_MESSAGES as M } from '../messages';
import { getPushPermissionState, requestPushPermission } from '../permission';
import { syncPushRegistration } from '../pushToken';

interface Props {
  showToast: (message: string) => void;
  /** Perfil (Escenario 8.5): mostrar aunque se haya elegido «Ahora no» antes. */
  forceVisible?: boolean;
  onClose?: (granted: boolean) => void;
}

export function NotificationPermissionPrompt({ showToast, forceVisible = false, onClose }: Props) {
  const [visible, setVisible] = useState(forceVisible);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (forceVisible) return;
    void (async () => {
      const [state, dismissed] = await Promise.all([
        getPushPermissionState(),
        AsyncStorage.getItem(PROMPT_DISMISSED_STORAGE_KEY),
      ]);
      setVisible(state === 'askable' && dismissed === null);   // RF-25-A, reglas de visibilidad
    })();
  }, [forceVisible]);

  const finish = async (granted: boolean) => {
    await AsyncStorage.setItem(PROMPT_DISMISSED_STORAGE_KEY, '1');
    setVisible(false);
    setBusy(false);
    onClose?.(granted);
  };

  const onDecline = async () => {
    showToast(M.disabled);                                     // Escenario 8.3
    await finish(false);
  };

  const onAccept = async () => {
    setBusy(true);
    const granted = await requestPushPermission();
    if (!granted) {
      showToast(M.disabled);                                   // Escenario 8.2
      return finish(false);
    }
    try {
      await syncPushRegistration();
      showToast(M.enabled);                                    // Escenario 8.1 / 8.5
    } catch {
      showToast(M.registerFailed);                             // Escenario 8.9
    }
    await finish(true);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDecline}>
      <View /* overlay + tarjeta con los estilos del proyecto */>
        <Text accessibilityRole="header">{M.promptTitle}</Text>
        <Text>{M.promptBody}</Text>
        <Pressable onPress={onAccept} disabled={busy} accessibilityRole="button">
          <Text>{M.promptAccept}</Text>
        </Pressable>
        <Pressable onPress={onDecline} disabled={busy} accessibilityRole="button">
          <Text>{M.promptDecline}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
```

No se crea una función `enablePushNotifications()` aparte: el componente es el único lugar que encadena permiso → registro, y el perfil (§6.9) lo reutiliza con `forceVisible` (Principio 11). Los estilos siguen los diálogos de confirmación ya usados en las specs 004 y 007.

### 6.9 Fila del perfil — `NotificationSettingsRow`

```typescript
// src/features/notificaciones/components/NotificationSettingsRow.tsx (lógica)
// - Lee getPushPermissionState() al montar y en cada AppState 'active'
//   (al volver de los ajustes de Android, Escenario 8.6).
// - 'granted'  → «Notificaciones» · «Activadas»; además llama syncPushRegistration() al pasar a granted.
// - 'askable'  → «Desactivadas» + botón «Activar notificaciones» → muestra la misma explicación previa
//                (reutiliza el diálogo del §6.8 con prop forceVisible) → Escenario 8.5.
// - 'blocked'  → «Desactivadas» + «Las notificaciones están desactivadas en los ajustes de Android.»
//                + botón «Abrir ajustes» → Linking.openSettings().
```

Para reutilizar el diálogo, `NotificationPermissionPrompt` acepta `forceVisible?: boolean` y `onClose?: () => void`; con `forceVisible` ignora la bandera `promptDismissed`.

### 6.10 Integración en el cierre de sesión (Spec 001)

```typescript
// src/features/auth/api.ts  (MODIFICAR — único cambio en la Spec 001)
import { unregisterCurrentDevice } from '@/features/notificaciones/pushToken';

export async function signOut(): Promise<void> {
  await unregisterCurrentDevice();          // RF-25-B: con JWT vigente; nunca lanza; ≤ 3 s
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
```

### 6.11 Montaje

| Archivo | Cambio |
|---|---|
| `src/app/_layout.tsx` | `import '@/features/notificaciones/handler';` (efecto de módulo, una línea) |
| `src/app/(app)/_layout.tsx` (layout con sesión, Spec 001) | `usePushNotifications(session?.user.id ?? null, () => setMode('artist'))` usando `AuthProvider` y `useAppMode` de la Spec 001 ⚠️ confirmar nombre del setter |
| `src/app/(app)/index.tsx` (inicio, Spec 001) | `<NotificationPermissionPrompt showToast={…} />` |
| `src/app/(app)/profile.tsx` (Spec 001) | `<NotificationSettingsRow />` antes del botón «Cerrar sesión» |

Si en el repositorio el layout autenticado que envuelve las rutas de las specs 004/005 (`artist/…`, `(tabs)/…`) es otro, el hook se monta en ese layout: debe estar por encima de todas las rutas con sesión.

---

## 7. Checklist de configuración (una vez por proyecto)

### 7.1 Firebase Cloud Messaging + EAS (Android)

1. **Firebase (plan Spark, gratuito):** crear proyecto → «Agregar app Android» con el `android.package` de `app.json` → descargar `google-services.json`.
2. **No versionar:** confirmar que `google-services.json` está en `.gitignore`. Para desarrollo local, dejarlo en la raíz del proyecto.
3. **EAS Build:** subirlo como variable de entorno de tipo archivo y visibilidad secreta, en los entornos `development` y `preview`:
   `eas env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --visibility secret --environment development` ⚠️ verificar flags en la versión de `eas-cli`.
4. **Credencial FCM V1 para Expo Push:** Firebase → Configuración del proyecto → Cuentas de servicio → «Generar nueva clave privada» (JSON). Luego `eas credentials -p android` → perfil → *Google Service Account* → *Manage your Google Service Account Key for Push Notifications (FCM V1)* → subir el JSON. **Borrar el JSON local** después; nunca se versiona.
5. **`projectId` de EAS:** `eas init` deja `extra.eas.projectId` en la configuración (lo lee `getExpoPushToken`).
6. **Nuevo development build** (cambio nativo): `eas build -p android --profile development`.
7. **Prueba de humo:** copiar un `ExpoPushToken` desde `device_tokens` y enviar un mensaje con la herramienta web de Expo (https://expo.dev/notifications); debe llegar al canal «Actividad de comisiones».

### 7.2 Supabase

1. `supabase db push` (aplica `008_push_notifications.sql`, incluye `pg_net`).
2. Crear los dos secretos de Vault (§3.6) en cada entorno.
3. `supabase secrets set PUSH_WEBHOOK_SECRET=<mismo valor>`.
4. `supabase functions deploy send-push-notification --no-verify-jwt`.
5. Verificar en `net._http_response` que las llamadas devuelven `200` tras un cambio de etapa de prueba.

---

## 8. Estructura de archivos

```
src/features/notificaciones/
├── components/
│   ├── NotificationPermissionPrompt.tsx   # Explicación previa (inicio y perfil)
│   └── NotificationSettingsRow.tsx        # Fila «Notificaciones» del perfil
├── __tests__/
│   ├── routing.test.ts
│   ├── pushToken.test.ts
│   └── permission.test.ts
├── constants.ts
├── handler.ts                             # setNotificationHandler (efecto de módulo)
├── messages.ts                            # Literales de la spec §8
├── permission.ts                          # Canal Android + estado/solicitud de permiso
├── pushToken.ts                           # Token Expo, registro (RPC), desvinculación
├── routing.ts                             # parsePushData + resolveNotificationRoute
└── usePushNotifications.ts                # Registro, rotación, refresco y navegación

supabase/
├── migrations/
│   └── 008_push_notifications.sql         # device_tokens + RLS + RPC + pg_net + triggers
├── functions/
│   └── send-push-notification/
│       ├── index.ts                       # Handler Deno
│       ├── logic.ts                       # Lógica pura (contenido, validación, limpieza)
│       └── logic.test.ts                  # Jest
├── tests/
│   ├── 008_rls_test.sql
│   └── 008_push_events_test.sql
└── config.toml                            # MODIFICAR: verify_jwt = false para la función

NUEVOS en raíz
├── app.config.ts                          # googleServicesFile desde EAS env / archivo local
└── assets/images/notification-icon.png    # Ícono monocromo 96×96

MODIFICADOS
├── app.json                               # plugin expo-notifications
├── .gitignore                             # google-services.json, claves de servicio
├── tsconfig.json                          # exclude "supabase/functions"
├── src/app/_layout.tsx                    # import del handler
├── src/app/(app)/_layout.tsx              # usePushNotifications
├── src/app/(app)/index.tsx                # NotificationPermissionPrompt
├── src/app/(app)/profile.tsx              # NotificationSettingsRow
└── src/features/auth/api.ts               # signOut → unregisterCurrentDevice primero

specs/008-notificaciones-push/
└── manual-tests.md                        # Casos manuales en dispositivo
```

**Archivos de las specs 003, 004, 005, 006 y 007: sin cambios.**

---

## 9. Estrategia de pruebas

| Nivel | Qué cubre | Archivo |
|---|---|---|
| SQL — RLS | D1–D11: aislamiento por `auth.uid()`, formato, reasignación, anon, encolado bloqueado | `supabase/tests/008_rls_test.sql` |
| SQL — eventos | Resolución E1–E8 (incluida prioridad), encolado real E9–E11, no-regresión E12 | `supabase/tests/008_push_events_test.sql` |
| Unitaria — Edge | `parsePushRequest`, `buildMessages` (textos literales, sin datos extra), `collectUnregisteredTokens`, `chunk`, `timingSafeEqual`, `isRetryableStatus` | `logic.test.ts` |
| Unitaria — cliente | `parsePushData`/`resolveNotificationRoute` (3 targets, otra cuenta, sin sesión, payload inválido); `unregisterCurrentDevice` (borra, traga errores, timeout 3 s, limpia storage siempre); `getPushPermissionState` | `src/features/notificaciones/__tests__/` |
| Manual | Escenarios 8.1–8.26 en dispositivo Android 13+ y Android ≤ 12, dos cuentas | `specs/008-notificaciones-push/manual-tests.md` |

Mocks: `expo-notifications`, `expo-constants`, `@react-native-async-storage/async-storage` y `@/lib/supabase` con `jest.mock`. Si `jest.config` restringe `roots` a `src/`, agregar `<rootDir>/supabase/functions`.

---

## 10. Rendimiento y cuota gratuita (Principio 2)

| Recurso | Consideración |
|---|---|
| Edge Functions (plan gratuito: 500 000 invocaciones/mes ⚠️ verificar límite vigente) | 1 invocación por evento. Una comisión completa genera ~10 eventos; 1 000 comisiones/mes ≈ 10 000 invocaciones. |
| pg_net | Incluido en Supabase. Cola asíncrona; la mutación solo inserta una fila en la cola. Las respuestas se purgan solas (TTL por defecto de pg_net). |
| Expo Push Service | Gratuito; límite de 600 notificaciones/s por proyecto ⚠️ verificar. Lotes de hasta 100 mensajes. |
| FCM | Gratuito (plan Spark). |
| Vault | Incluido en Supabase. |
| Latencia (RNF-NOT-8.3) | COMMIT → worker pg_net (≈ 1 s) → Edge Function (cold start ≈ 0.5–1 s) → Expo → FCM (segundos). Muy por debajo de 60 s. |
| Batería y datos del cliente | Sin polling: los avisos sustituyen la necesidad de refrescar; la invalidación de `['commissions']` solo re-ejecuta queries montadas. |

---

## 11. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Logout sin conexión deja el token vinculado | Contenido discreto + `setNotificationHandler` y `resolveNotificationRoute` verifican `recipient_id`; el token se reasigna en el siguiente login (P-8.7). |
| `google-services.json` o clave FCM en el repositorio | `.gitignore` + `app.config.ts` con variable de EAS de tipo archivo; checklist §7.1 obliga a borrar la clave local. |
| Endpoint público de la Edge Function | `verify_jwt = false` compensado con `x-koma-webhook-secret` (Vault + secret de la función), comparación en tiempo constante, validación estricta del payload. Un atacante sin el secreto obtiene `401`. |
| Rutas de Expo Router distintas en el repo (planes 004/005/001 usan grupos diferentes) | Centralizadas en `routing.ts`; ajuste en un solo archivo. |
| Cambios de API en `expo-notifications` SDK 58 | Puntos marcados ⚠️ (`shouldShowBanner`, `getLastNotificationResponse`, `clearLastNotificationResponse`); validar en el development build en T014. |
| Secretos de Vault ausentes en un entorno | `enqueue_push_notification` emite `WARNING` y no falla (prueba E12). |
| Emulador sin Google Play Services | `getExpoPushTokenAsync` falla; se captura y no afecta la app. Las pruebas manuales se hacen en un dispositivo físico. |

---

## 12. Decisiones técnicas

| ID | Tema | Decisión |
|---|---|---|
| DT-8.1 | Triggers SQL vs. Database Webhooks del panel | Triggers propios con pg_net en la migración: quedan versionados, filtran con `WHEN` (los Webhooks del panel disparan en cada UPDATE de la tabla) y deciden evento y destinatario en SQL. Usan el mismo mecanismo (pg_net) que los Webhooks. |
| DT-8.2 | Dónde se decide el evento | En Postgres (`resolve_commission_push_event`, función pura y probada con SQL). La Edge Function solo traduce evento → texto y entrega. Evita enviar filas completas (con montos o notas) fuera de la base. |
| DT-8.3 | Avance en `commission_advance_files` por sentencia | Un aviso por avance y solo con imágenes ya subidas (P-8.8), sin tocar el hook de la Spec 006. |
| DT-8.4 | Upsert vía RPC `SECURITY DEFINER` | Necesario para reasignar un dispositivo entre cuentas (P-8.7) sin abrir la RLS. Las cuatro políticas RLS siguen restringiendo todo acceso directo a `auth.uid() = user_id`. |
| DT-8.5 | Autenticación de la Edge Function | Secreto compartido en cabecera (`verify_jwt = false`) en vez de enviar la `service_role` desde Postgres: el secreto solo sirve para esta función y se rota sin afectar otras claves. |
| DT-8.6 | Reintentos | Dentro de la Edge Function (3 intentos, backoff 0.5 s / 1 s, solo red/429/5xx). pg_net no reintenta; así no hay duplicados por timeouts del lado de Postgres. |
| DT-8.7 | Limpieza de tokens | Solo por tickets `DeviceNotRegistered` del envío. Sin job de recibos (Principio 11). |
| DT-8.8 | Contenido | Constante en `logic.ts` (`EVENT_CONTENT`), única fuente; la base nunca envía texto. `data` solo con UUIDs y `target`. |
| DT-8.9 | Visibilidad en pantalla de bloqueo | Canal con `lockscreenVisibility: PRIVATE` como defensa adicional; la garantía principal es el texto discreto. |
| DT-8.10 | Sin `expo-device` | No se agrega dependencia para detectar emuladores; el fallo de obtención del token se captura (Principio 11). |
| DT-8.11 | Refresco de datos al recibir un aviso | `invalidateQueries(['commissions'])` (mismo prefijo que DT-7.7 de la Spec 007); no se agregan suscripciones Realtime. |
| DT-8.12 | `google-services.json` fuera del repo | Desviación consciente del brief («en `app.json`»): la constitución prohíbe credenciales de Firebase en el repositorio (Principio 5). `app.config.ts` resuelve la ruta desde EAS. |