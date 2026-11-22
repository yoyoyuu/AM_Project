# Pruebas manuales — Spec 008 · Notificaciones Push

**Estado:** Pendiente · **Fecha:** 2026-11-22
**Derivado de:** `008-notificaciones-push/spec.md` (Escenarios 8.1–8.26) y `plan.md`

> Las pruebas se ejecutan **en dispositivos Android físicos** sobre el development build (`eas build -p android --profile development`). Expo Go no incluye los módulos nativos necesarios.

---

## Preparación

### Entorno

- [ ] Migración `012_push_notifications.sql` aplicada en la instancia de Supabase.
- [ ] Secretos de Vault configurados: `push_function_url`, `push_webhook_secret` (ver T007).
- [ ] Edge Function `send-push-notification` desplegada con `--no-verify-jwt`.
- [ ] `PUSH_WEBHOOK_SECRET` del lado de la función es idéntico al de Vault.
- [ ] Credencial FCM V1 subida a EAS (ver T008).

### Dispositivos

Idealmente dos teléfonos físicos distintos:

| Alias | Marca / modelo | Versión Android | Instalado | Cuenta inicial |
|---|---|---|---|---|
| **A13+** | | **13 o superior** | | |
| **A≤12** | | 12 o inferior | | |

### Cuentas

| Rol | Email | Handle | Notas |
|---|---|---|---|
| Artista | | | debe tener al menos un servicio publicado (Spec 002) |
| Cliente | | | |

### Comisiones de prueba

Antes de empezar, crear al menos **tres comisiones** de distintos estados para los escenarios 8.13–8.22:

- `C1` — PENDIENTE (para 8.13 / 8.14 / 8.21)
- `C2` — EN_PROGRESO en etapa `SKETCH`, pago `UNPAID` (para 8.15, 8.17, 8.22)
- `C3` — EN_PROGRESO en etapa `FINAL`, con entregable subido y pago `UNDER_REVIEW` (para 8.19 / 8.20)

---

## Tabla de resultados

Para cada caso, registrar: resultado obtenido (OK / FALLA + descripción), dispositivo y versión, hora de ejecución. Para los avisos, medir el tiempo transcurrido entre el cambio de la comisión y la llegada a la barra (≤ 60 s). Fotografiar la pantalla de bloqueo cuando aplique.

Leyenda: ✔ = esperado, ✖ = defecto.

---

## Fase 1 — Permiso y registro (RF-25-A, RF-25-B)

### 8.1 — Permiso concedido

- **Precondición:** usuario recién instalado en `A13+`, sesión iniciada por primera vez, perfil completo, llega a la pantalla de inicio sin permiso de notificaciones.
- **Pasos:** aparece la explicación previa «Activa las notificaciones» → tocar **Activar** → Android muestra su diálogo → tocar **Permitir**.
- **Esperado:** toast «Notificaciones activadas». La fila `device_tokens` para esa cuenta aparece en Supabase (ver `select * from public.device_tokens where user_id = ...`).
- **Resultado obtenido:** ___________ · **Dispositivo:** ___________ · **Hora:** ___________

### 8.2 — Permiso denegado sin bloquear la app

- **Precondición:** sesión iniciada; aparece el diálogo de Android tras tocar **Activar**.
- **Pasos:** denegar el permiso. Después: recorrer catálogo, solicitar una comisión (Spec 003), navegar al seguimiento (Spec 005).
- **Esperado:** toast «Notificaciones desactivadas. Puedes activarlas cuando quieras desde tu perfil.»; el usuario puede usar **todas** las funciones sin bloqueos.
- **Resultado obtenido:** ___________

### 8.3 — «Ahora no» y reinicio

- **Precondición:** sesión iniciada; explicación previa visible en inicio.
- **Pasos:** tocar **Ahora no** → cerrar la app → volver a abrirla y llegar al inicio.
- **Esperado:** toast «Notificaciones desactivadas…»; **no** aparece Android; **al reabrir**, la explicación previa ya no se muestra.
- **Resultado obtenido:** ___________

### 8.4 — Sin solicitud fuera del inicio

- **Precondición:** usuario sin sesión (o en proceso de registro).
- **Pasos:** recorrer registro → verificación de correo → `profile-setup`.
- **Esperado:** en ninguna de esas pantallas aparece la explicación previa ni el diálogo de Android.
- **Resultado obtenido:** ___________

### 8.5 — Activación posterior desde el perfil

- **Precondición:** usuario que eligió «Ahora no» antes; Android todavía permite pedir el permiso.
- **Pasos:** ir a inicio → ver la fila «Notificaciones · Desactivadas» → tocar **Activar notificaciones** → en la explicación previa tocar **Activar** → conceder en Android.
- **Esperado:** toast «Notificaciones activadas»; la fila cambia a «Activadas».
- **Resultado obtenido:** ___________

### 8.6 — Permiso bloqueado en Android

- **Precondición:** permiso denegado y `canAskAgain = false` (dos negaciones + ajustes del sistema).
- **Pasos:** ir a inicio → ver la fila. Tocar **Abrir ajustes**. En Android Settings, conceder la notificación. Volver a la app.
- **Esperado:** la fila muestra «Desactivadas», el texto «Las notificaciones están desactivadas en los ajustes de Android.» y el botón **Abrir ajustes**. Al volver de los ajustes con permiso concedido, la fila cambia a «Activadas» y el dispositivo queda registrado automáticamente (verificar `device_tokens`).
- **Resultado obtenido:** ___________

### 8.7 — Registro automático con permiso ya concedido

- **Precondición:** la cuenta ya concedió permiso en `A13+` anteriormente; cerró sesión.
- **Pasos:** volver a iniciar sesión.
- **Esperado:** se registra sin mostrar diálogos; fila `device_tokens` presente con el nuevo `updated_at`; recibe avisos.
- **Resultado obtenido:** ___________

### 8.8 — Cambio de cuenta en el mismo dispositivo (RNF-NOT-8.2)

- **Precondición:** `A13+` con sesión de **Cuenta A** registrado. La sesión de A todavía está activa.
- **Pasos:** cerrar sesión de A → iniciar sesión de **Cuenta B** → ir a inicio.
- **Esperado:** `select user_id from public.device_tokens where expo_push_token = '<token>'` ahora apunta a **B**; A deja de recibir avisos; B empieza a recibirlos.
- **Resultado obtenido:** ___________

### 8.9 — Fallo al registrar (sin conexión)

- **Precondición:** sesión iniciada; Wi-Fi + datos apagados antes de tocar **Activar**.
- **Pasos:** tocar **Activar** → conceder permiso de Android.
- **Esperado:** toast «No se pudieron activar las notificaciones en este dispositivo. Inténtalo más tarde.»; la app sigue utilizable. **Después:** reactivar conexión y abrir la app → la fila `device_tokens` aparece sin diálogos.
- **Resultado obtenido:** ___________

---

## Fase 2 — Desvinculación al cerrar sesión (RF-25-B)

### 8.10 — Logout con avisos visibles

- **Precondición:** sesión iniciada en `A13+`; al menos un aviso de Koma visible en la barra de notificaciones (provocar uno antes, por ejemplo cambiando una etapa).
- **Pasos:** tocar **Cerrar sesión**.
- **Esperado:** los avisos visibles de Koma **desaparecen** de la barra; la fila `device_tokens` del dispositivo se elimina; vuelve a la pantalla de login.
- **Resultado obtenido:** ___________

### 8.11 — Sin avisos después de cerrar sesión

- **Precondición:** cliente cerró sesión con conexión (8.10 completado).
- **Pasos:** desde otra cuenta (artista en `A≤12` u otro navegador), avanzar una comisión de ese cliente a la siguiente etapa.
- **Esperado:** el dispositivo del cliente **no recibe** aviso; si tiene otro dispositivo con sesión iniciada, ese sí lo recibe.
- **Resultado obtenido:** ___________

### 8.12 — Logout sin conexión (≤ 3 s)

- **Precondición:** sesión iniciada; **modo avión activado**.
- **Pasos:** cronometrar desde tocar **Cerrar sesión**.
- **Esperado:** la sesión se cierra en **≤ 3 s** sin mostrar errores; aparece la pantalla de login.
- **Resultado obtenido:** ___________ · **Tiempo medido:** _____ s

---

## Fase 3 — Eventos de comisión end-to-end (RF-08-A, RF-10-A, RF-26-A, RF-27-A)

En cada caso: medir el tiempo entre la acción en la app del remitente y la llegada del aviso al destinatario (≤ 60 s). Fotografiar la pantalla de bloqueo del destinatario y verificar que el contenido es discreto (solo «Koma» + texto genérico).

### 8.13 — Aviso al aceptar la solicitud (E3)

- **Precondición:** `C1` PENDIENTE, cliente con dispositivo registrado.
- **Pasos:** artista abre `C1` → **Aceptar**.
- **Esperado:** cliente recibe **un único** aviso «Hay una actualización en tu solicitud de comisión» en ≤ 60 s. **NO** llega un segundo aviso de cambio de etapa (P-8.3).
- **Resultado obtenido:** ___________ · **Tiempo:** _____ s · **Foto pantalla de bloqueo:** ___________

### 8.14 — Aviso al rechazar la solicitud (E3)

- **Precondición:** `C1` PENDIENTE (otra comisión equivalente).
- **Pasos:** artista rechaza con motivo «No tengo capacidad esta semana».
- **Esperado:** cliente recibe «Hay una actualización en tu solicitud de comisión»; el texto **no** incluye el motivo.
- **Resultado obtenido:** ___________ · **Tiempo:** _____ s

### 8.15 — Nuevo avance (E5)

- **Precondición:** `C2` EN_PROGRESO; cliente registrado.
- **Pasos:** artista sube un avance con **3 imágenes** y la nota «Boceto inicial listo».
- **Esperado:** cliente recibe **un único** aviso «Tienes un nuevo avance disponible»; el texto **no** incluye la nota; al abrir la comisión, el avance ya tiene las 3 imágenes.
- **Resultado obtenido:** ___________ · **Tiempo:** _____ s

### 8.16 — Subida de avance fallida

- **Precondición:** `C2` EN_PROGRESO; simular falla (apagar Wi-Fi tras elegir imágenes).
- **Pasos:** artista intenta subir; la app muestra el error de la Spec 006.
- **Esperado:** cliente **no recibe** ningún aviso. Verificar también en `net._http_response` que no hay petición nueva.
- **Resultado obtenido:** ___________

### 8.17 — Cambio de etapa (E4)

- **Precondición:** `C2` EN_PROGRESO etapa `SKETCH`.
- **Pasos:** artista completa `SKETCH` y pasa la comisión a `LINEART`.
- **Esperado:** cliente recibe «Tu comisión avanzó a una nueva etapa»; el texto **no** menciona la etapa.
- **Resultado obtenido:** ___________ · **Tiempo:** _____ s

### 8.18 — Pedir corrección de comprobante (E6)

- **Precondición:** `C2` con pago en `UNDER_REVIEW`.
- **Pasos:** artista elige **Requiere corrección** con motivo «Monto incompleto. Faltan $150».
- **Esperado:** cliente recibe «Se actualizó el estado de tu pago»; el texto **no** incluye el motivo ni cantidades.
- **Resultado obtenido:** ___________

### 8.19 — Un solo aviso al confirmar pago con entregable subido (E7, prioridad sobre E6)

- **Precondición:** `C3` — etapa `FINAL`, entregable ya subido, pago `UNDER_REVIEW`.
- **Pasos:** artista confirma el pago → la comisión pasa a `COMPLETADA`.
- **Esperado:** cliente recibe **UN SOLO** aviso: «Tu entregable final está listo». **NO** llega el aviso de pago.
- **Resultado obtenido:** ___________ · **Tiempo:** _____ s

### 8.20 — Entregable con pago pendiente (E7)

- **Precondición:** comisión en etapa `FINAL`, pago distinto de `VERIFIED`.
- **Pasos:** artista sube el entregable final.
- **Esperado:** cliente recibe «Tu entregable final está listo»; al abrir la comisión, ve la tarjeta con **candado** (Spec 007) — el aviso no desbloquea nada.
- **Resultado obtenido:** ___________

### 8.21 — Nueva solicitud (E1)

- **Precondición:** artista con dispositivo registrado.
- **Pasos:** cliente envía una solicitud de comisión.
- **Esperado:** artista recibe «Tienes una nueva solicitud de comisión» en ≤ 60 s. El cliente **no** recibe ningún aviso por su propia acción (P-8.6).
- **Resultado obtenido:** ___________

### 8.22 — Comprobante subido (E2)

- **Precondición:** `C2` con pago `UNPAID` o `NEEDS_CORRECTION`; artista con dispositivo registrado.
- **Pasos:** cliente envía su comprobante.
- **Esperado:** artista recibe «Un cliente subió un comprobante de pago»; sin referencia, nota ni nombre del cliente.
- **Resultado obtenido:** ___________

---

## Fase 4 — Toque del aviso y primer plano (RF-28-A)

### 8.23 — Toque con app cerrada (cold start)

- **Precondición:** cliente con sesión iniciada; app **completamente cerrada** (recientes también). En la barra hay un aviso «Tienes un nuevo avance disponible» del Escenario 8.15.
- **Pasos:** tocar el aviso.
- **Esperado:** la app abre directamente en `/commissions/[commissionId]` (seguimiento) y la sección de avances muestra el avance nuevo.
- **Resultado obtenido:** ___________

### 8.24 — Toque con app en segundo plano (artista)

- **Precondición:** artista con sesión iniciada; app en segundo plano.
- **Pasos:** cliente envía comprobante → artista recibe aviso «Un cliente subió un comprobante de pago» → tocar aviso.
- **Esperado:** la app abre en `/artist/commissions/[commissionId]/work` con la sección «Pago y entrega» mostrando «Revisa el comprobante del cliente».
- **Resultado obtenido:** ___________

### 8.25 — App en primer plano: banner + refresco

- **Precondición:** cliente viendo el detalle de seguimiento de `C2` en etapa `SKETCH`.
- **Pasos:** artista avanza `C2` a `LINEART`.
- **Esperado:** aparece el banner «Tu comisión avanzó a una nueva etapa» mientras la pantalla está abierta; el detalle se actualiza **sin que el cliente tenga que refrescar** (gracias al `invalidateQueries(['commissions'])`).
- **Resultado obtenido:** ___________

### 8.26 — Aviso de otra cuenta

- **Precondición:** dispositivo con sesión de **Cuenta B** que aún conserva un aviso dirigido a **Cuenta A** (provocar antes de cambiar sesión).
- **Pasos:** tocar el aviso que era para A.
- **Esperado:** la app abre el **inicio de B** y **no muestra ningún dato de la comisión de A**.
- **Resultado obtenido:** ___________

---

## Fase 5 — Limpieza automática (RNF-NOT-8.5)

### D-1 — Dispositivo desinstalado

- **Precondición:** `A≤12` con sesión y dispositivo registrado. Fila de `device_tokens` presente.
- **Pasos:** **desinstalar la app** desde ese teléfono. Desde la otra cuenta, provocar un evento dirigido a esta cuenta (por ejemplo, avanzar una etapa de una comisión en la que participa).
- **Esperado:** Expo devuelve `DeviceNotRegistered`; la Edge Function hace `DELETE FROM device_tokens WHERE expo_push_token IN (...)`. Verificar: `select count(*) from public.device_tokens where user_id = '<uuid>'` → 0 (o uno menos si había varios).
- **Resultado obtenido:** ___________

---

## Fase 6 — Regresión specs 003–007

Ejecutar el flujo end-to-end completo y confirmar que **ningún** comportamiento de esas specs cambia:

- [ ] Spec 003: solicitud de comisión (crear, enviar, ver en lista pendiente).
- [ ] Spec 004: aceptar / rechazar / avanzar etapa.
- [ ] Spec 005: seguimiento del cliente (ver detalle, badge de estado).
- [ ] Spec 006: subir avance con múltiples imágenes.
- [ ] Spec 007: enviar comprobante → verificar pago → subir entregable → guardar en galería.

En cualquiera de estos pasos, si el servicio de push falla (p. ej. Vault vacío o Edge Function caída), la mutación debe **seguir funcionando** (RNF-NOT-8.4). Para validarlo:

- [ ] Temporalmente `delete from vault.secrets where name in ('push_function_url', 'push_webhook_secret');`
- [ ] Repetir un cambio de etapa.
- [ ] Verificar: el UPDATE **se aplica**, no llegan avisos, los logs de Postgres tienen `WARNING «push notifications not configured»`.
- [ ] Restaurar los secretos al terminar.

---

## Resumen de ejecución

| Fase | Casos | OK | FALLA | Notas |
|---|---|---|---|---|
| 1 — Permiso | 8.1–8.9 | | | |
| 2 — Logout | 8.10–8.12 | | | |
| 3 — Eventos | 8.13–8.22 | | | |
| 4 — Navegación | 8.23–8.26 | | | |
| 5 — Limpieza | D-1 | | | |
| 6 — Regresión | 003–007 + RNF-NOT-8.4 | | | |

**Firma y fecha de ejecución:** _______________________

---

## Checklist final (criterio de hecho de T021 + §15 de la spec)

- [ ] La explicación previa aparece solo en el inicio autenticado, solo si el permiso no está concedido, Android permite pedirlo y no se eligió «Ahora no».
- [ ] Conceder el permiso registra el dispositivo; negarlo deja la app completamente usable.
- [ ] El perfil muestra el estado de las notificaciones y permite activarlas o abrir los ajustes de Android.
- [ ] Un dispositivo pertenece a una sola cuenta a la vez; volver a iniciar sesión lo registra sin diálogos.
- [ ] Cerrar sesión desvincula el dispositivo, retira los avisos visibles y nunca tarda más de 3 s por esta causa.
- [ ] Los siete eventos generan exactamente un aviso a la otra parte, con el texto literal.
- [ ] Ningún aviso contiene montos, referencias, notas, descripciones, motivos, nombres, handles, servicios ni etapas.
- [ ] Tocar un aviso abre la pantalla indicada, con la app cerrada o en segundo plano, solo para el destinatario.
- [ ] Con la app en primer plano, el aviso se muestra y la información de la comisión se actualiza.
- [ ] Un fallo al enviar avisos no afecta ninguna operación de las specs 003 a 007.
- [ ] Los dispositivos reportados como inexistentes se eliminan del registro.
- [ ] Tiempo entre cambio y llegada ≤ 60 s en ≥ 95 % de los casos (RNF-NOT-8.3).
