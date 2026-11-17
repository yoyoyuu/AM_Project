# Spec 005 — Seguimiento de Comisiones del Cliente (`005-seguimiento-cliente`)

**Estado:** Borrador · **Versión:** 0.1 · **Fecha:** 2026-11-17
**Prioridad:** Must have
**Constitución:** v1.1
**Depende de:** Spec 001 (cuenta y perfiles), Spec 002 (catálogo de servicios y TOS), Spec 003 (solicitud de comisión), Spec 004 (gestión de comisión)

> Esta spec describe **qué** debe hacer el sistema y **por qué**. Las decisiones de tecnología van en `plan.md`.

---

## 1. Contexto y objetivo

Cuando un cliente envía una solicitud de comisión, comienza un proceso creativo que puede durar días o semanas. Sin visibilidad sobre el estado actual de su encargo, el cliente no sabe si el artista ya lo vio, si está trabajando en él, en qué etapa del proceso se encuentra ni si fue rechazado. Esta incertidumbre genera fricción, desconfianza y mensajes repetitivos al artista.

Esta spec cubre el lado del cliente: un tablero que centraliza todas sus solicitudes y una vista de detalle que refleja en tiempo real el avance del artista a través de las etapas creativas estandarizadas definidas en la Spec 004.

**Objetivo:** que el cliente pueda consultar, en cualquier momento y desde su dispositivo, el estado actualizado de todas sus comisiones y el progreso específico de cada una, sin necesidad de contactar al artista para obtener esa información. El cliente solo observa; no puede modificar el estado ni las etapas (esa capacidad pertenece al artista, Spec 004).

---

## 2. Historias de usuario

- **HU-5.1.** Como cliente, quiero ver una lista de todas mis comisiones solicitadas, para tener un lugar central donde consultar el estado de cada encargo sin perderme de nada.
- **HU-5.2.** Como cliente, quiero que mis comisiones estén organizadas por su estado actual (activas, pendientes, finalizadas/rechazadas), para identificar rápidamente cuáles necesitan mi atención y cuáles ya cerraron.
- **HU-5.3.** Como cliente, quiero ver en cada tarjeta de la lista el título del servicio, el nombre del artista, el estado actual y la fecha de última actualización, para obtener una lectura rápida sin tener que abrir cada comisión.
- **HU-5.4.** Como cliente, quiero que cuando aún no haya solicitado ninguna comisión, la pantalla me muestre un mensaje claro y una acción para ir a buscar artistas, para no quedarme frente a una pantalla vacía sin saber qué hacer.
- **HU-5.5.** Como cliente, quiero abrir una comisión y ver un indicador visual de progreso (línea de tiempo / stepper) con la etapa creativa en curso, para entender exactamente en qué punto del proceso creativo está el artista.
- **HU-5.6.** Como cliente, quiero ver en el detalle todos los datos del encargo que yo envié (descripción, referencias, uso, notas) junto con los datos del servicio contratado (precio base, tiempo estimado), para recordar el contexto completo de lo que pedí.
- **HU-5.7.** Como cliente, quiero que si mi solicitud fue rechazada, se me muestre el motivo que el artista indicó (si es que proporcionó uno), para entender por qué no fue posible y poder tomar una decisión informada sobre mi próxima solicitud.
- **HU-5.8.** Como cliente, quiero que los datos de mis comisiones se actualicen automáticamente cuando vuelvo a la pantalla o deslizo hacia abajo para refrescar, para ver siempre información vigente sin tener que cerrar y reabrir la app.
- **HU-5.9.** Como cliente, quiero que si hay un problema de conexión la app me lo informe claramente y me permita reintentar, para no confundir un error de red con la ausencia de comisiones.

---

## 3. Requerimientos funcionales

### RF-05-A — Tablero principal: Mis Comisiones (Must have)

El sistema deberá mostrar al cliente autenticado la lista de todas sus comisiones, organizadas por grupo de estado.

**Reglas**

- Solo se muestran las comisiones donde el `client_id` coincide con el `auth.uid()` del cliente autenticado.
- Las comisiones se agrupan en tres secciones visualmente diferenciadas:
  - **En curso** (`EN_PROGRESO`): encargos activos que el artista ya aceptó y está trabajando.
  - **Pendientes** (`PENDIENTE`): solicitudes enviadas esperando decisión del artista.
  - **Finalizadas** (`COMPLETADA`, `RECHAZADA`, `CANCELADA`): encargos cerrados.
- Dentro de cada grupo, las comisiones se ordenan de más reciente a más antigua según `updated_at`.
- Cada tarjeta muestra:
  - Título del servicio contratado.
  - Nombre o handle del artista.
  - Estado actual (con etiqueta y color de badge según la tabla de la sección 5).
  - Etapa creativa en curso (solo si `status = EN_PROGRESO`; en otro caso no se muestra).
  - Fecha de última actualización en formato legible (ej. "hace 2 horas", "ayer", "15 nov").
- Si el cliente no tiene ninguna comisión registrada, el sistema muestra el estado vacío definido en la sección 6.
- Si una sección de grupo (ej. "En curso") no tiene comisiones, esa sección no se muestra o se colapsa, para no mostrar encabezados vacíos.

**Criterios de aceptación**

**Escenario 5.1 — Lista con comisiones en múltiples estados**
- **Given** un cliente autenticado con al menos una comisión en estado `PENDIENTE` y al menos una en estado `EN_PROGRESO`,
- **When** abre la pantalla "Mis Comisiones",
- **Then** el sistema muestra ambas secciones ("Pendientes" y "En curso") cada una con su comisión correspondiente, mostrando título del servicio, handle del artista, badge de estado y fecha de última actualización.

**Escenario 5.2 — Lista con comisiones rechazadas**
- **Given** un cliente autenticado con al menos una comisión en estado `RECHAZADA`,
- **When** abre la pantalla "Mis Comisiones",
- **Then** la sección "Finalizadas" muestra la comisión rechazada con su badge correspondiente.

**Escenario 5.3 — Estado vacío: sin comisiones**
- **Given** un cliente autenticado que nunca ha solicitado ninguna comisión,
- **When** abre la pantalla "Mis Comisiones",
- **Then** el sistema muestra el mensaje "Aún no has solicitado ninguna comisión" junto con el botón "Explorar artistas".

**Escenario 5.4 — Acceso no autorizado a lista ajena**
- **Given** un usuario autenticado que intenta consultar las comisiones de otro cliente (por cualquier medio),
- **When** el sistema evalúa la solicitud,
- **Then** el sistema no devuelve ninguna comisión (resultado vacío o error de autorización); en ningún caso expone datos de otro usuario.

---

### RF-05-B — Vista detallada y línea de tiempo del progreso (Must have)

El sistema deberá mostrar al cliente autenticado el detalle completo de una comisión propia, incluyendo el avance visual en las etapas creativas.

**Reglas**

- Solo el cliente cuyo `client_id` coincide con `auth.uid()` puede acceder al detalle de una comisión.
- El detalle incluye los siguientes bloques de información:
  1. **Encabezado de estado:** estado actual y, si aplica, etapa creativa en curso con su nombre visible (ej. "Boceto", "Delineado", "Color / Acabado final").
  2. **Línea de tiempo / stepper:** indicador visual de las tres etapas creativas estandarizadas (`SKETCH` → `LINEART` → `FINAL`), mostrando cuáles están completadas, cuál está en curso y cuáles están pendientes. Este indicador solo es relevante cuando `status = EN_PROGRESO` o `COMPLETADA`.
  3. **Datos del servicio:** título del servicio, precio base acordado y tiempo estimado de entrega.
  4. **Datos del artista:** nombre o handle del artista.
  5. **Detalles del encargo enviado:** descripción, uso previsto (personal / comercial), pose (si se proporcionó), elementos clave (si se proporcionaron), notas adicionales (si se proporcionaron).
  6. **Galería de referencias:** miniaturas de las imágenes de referencia adjuntas (si las hay); el cliente puede ampliarlas.
  7. **Fechas:** fecha de creación de la solicitud y fecha de última actualización.
- Si la comisión está en estado `RECHAZADA`:
  - Se muestra un bloque específico de rechazo con la etiqueta "Solicitud rechazada".
  - Si el artista proporcionó un motivo (`rejection_reason` no es nulo), se muestra el motivo con la etiqueta "Motivo indicado por el artista:".
  - Si no se proporcionó motivo, se muestra el mensaje "El artista no indicó un motivo específico."
- El cliente no tiene ningún botón ni acción para modificar el estado, la etapa ni ningún campo de la comisión. Esta pantalla es estrictamente de solo lectura.

**Criterios de aceptación**

**Escenario 5.5 — Detalle de comisión en progreso**
- **Given** un cliente autenticado que toca una comisión en estado `EN_PROGRESO` (etapa `LINEART`) de su lista,
- **When** el sistema carga el detalle,
- **Then** se muestra el stepper con la etapa "Boceto" marcada como completada, "Delineado" como en curso y "Color / Acabado final" como pendiente, junto con los datos completos del encargo.

**Escenario 5.6 — Detalle de comisión rechazada con motivo**
- **Given** un cliente autenticado con una comisión en estado `RECHAZADA` cuyo artista proporcionó un motivo,
- **When** abre el detalle de esa comisión,
- **Then** el sistema muestra el bloque de rechazo con el mensaje del artista bajo la etiqueta "Motivo indicado por el artista:".

**Escenario 5.7 — Detalle de comisión rechazada sin motivo**
- **Given** un cliente autenticado con una comisión en estado `RECHAZADA` sin motivo registrado (`rejection_reason` nulo),
- **When** abre el detalle de esa comisión,
- **Then** el sistema muestra el bloque de rechazo con el mensaje "El artista no indicó un motivo específico."

**Escenario 5.8 — Detalle de comisión completada**
- **Given** un cliente autenticado con una comisión en estado `COMPLETADA`,
- **When** abre el detalle,
- **Then** el stepper muestra las tres etapas como completadas y el encabezado muestra el badge "Completada".

**Escenario 5.9 — Intento de acceso a comisión ajena**
- **Given** un usuario autenticado que intenta acceder al detalle de una comisión cuyo `client_id` no coincide con su `auth.uid()`,
- **When** el sistema evalúa la solicitud,
- **Then** el sistema no muestra el detalle y presenta el mensaje "No tienes permiso para ver esta comisión".

---

### RF-05-C — Sincronización y experiencia móvil (Must have)

El sistema deberá mantener los datos de las comisiones actualizados en el cliente móvil con mecanismos de refresco explícito y automático.

**Reglas**

- La pantalla de lista ("Mis Comisiones") soporta **pull-to-refresh** (deslizar hacia abajo para refrescar); al hacerlo, el sistema vuelve a consultar los datos y actualiza la lista.
- La pantalla de lista y la vista de detalle se revalidan automáticamente cuando el usuario vuelve a enfocar la pantalla (regresa desde otra pantalla o desde segundo plano).
- Durante la carga inicial de cualquier pantalla, el sistema muestra **indicadores de carga** (skeletons o spinners) que previenen mostrar una pantalla vacía.
- Si la consulta falla por error de red, el sistema muestra el mensaje de error definido en la sección 6, con la opción de reintentar.
- Si la consulta falla pero existen datos cacheados previos, el sistema muestra los datos cacheados junto con una indicación de que los datos pueden no estar actualizados.

**Criterios de aceptación**

**Escenario 5.10 — Pull-to-refresh**
- **Given** un cliente autenticado en la pantalla "Mis Comisiones" con datos cargados,
- **When** desliza hacia abajo para refrescar,
- **Then** el sistema muestra el indicador de refresco, vuelve a consultar las comisiones y actualiza la lista con los datos más recientes.

**Escenario 5.11 — Revalidación al volver a la pantalla**
- **Given** un cliente autenticado que estaba en el detalle de una comisión y regresa a la lista,
- **When** la pantalla de lista recibe el foco,
- **Then** el sistema vuelve a consultar en segundo plano y actualiza la lista si hay cambios.

**Escenario 5.12 — Error de conexión**
- **Given** un cliente autenticado sin conexión a internet que abre la pantalla "Mis Comisiones",
- **When** el sistema no puede obtener los datos,
- **Then** el sistema muestra el mensaje "No se pudo cargar tus comisiones. Comprueba tu conexión e intenta de nuevo" con la opción de reintentar.

---

## 4. Requerimientos no funcionales

| ID | Aplicación en esta spec | Métrica |
|---|---|---|
| RNF-01 | Tiempo de carga inicial de la lista | ≤ 2.0 s desde que el usuario abre la pantalla hasta que los datos son visibles |
| RNF-04 | Acceso solo a comisiones propias | 100 % de peticiones a comisiones ajenas reciben 0 filas o error 403 |
| RNF-08 | Cobertura de pruebas en hooks y mapeadores | ≥ 60 % en lógica de presentación (badges, stepper, fechas) |
| Principio 5 | RLS en todas las consultas | Sin excepción |
| Principio 6 | Permisos resueltos desde el `auth.uid()` del JWT, nunca desde parámetros enviados por el cliente | Sin excepciones |
| Principio 11 | Solo lectura: sin botones de acción, sin formularios, sin mutaciones desde este módulo | Sin excepciones |

---

## 5. Modelo de presentación: estados y etapas

### 5.1 Badges de estado de la comisión

| Estado (`CommissionStatus`) | Etiqueta visible | Descripción para el cliente |
|---|---|---|
| `PENDIENTE` | Pendiente | Tu solicitud fue enviada al artista y está esperando su respuesta. |
| `EN_PROGRESO` | En progreso | El artista aceptó tu encargo y está trabajando en él. |
| `COMPLETADA` | Completada | El artista finalizó tu encargo. |
| `RECHAZADA` | Rechazada | El artista no pudo tomar tu encargo en este momento. |
| `CANCELADA` | Cancelada | Este encargo fue cancelado. |

### 5.2 Etapas creativas (stepper)

| Orden | Código (`CreativeStage`) | Nombre visible | Descripción corta para el cliente |
|---|---|---|---|
| 1 | `SKETCH` | Boceto | El artista está trabajando en el boceto inicial. |
| 2 | `LINEART` | Delineado | El artista está refinando los trazos y el delineado. |
| 3 | `FINAL` | Color / Acabado final | El artista está aplicando color y los acabados finales. |

### 5.3 Estados del stepper por etapa

| Condición | Estado visual de la etapa |
|---|---|
| Etapa ya superada (el orden de la etapa < orden de `current_stage`) | Completada ✓ |
| Etapa actual (`código = current_stage`) | En curso (animación o resaltado) |
| Etapa futura (el orden de la etapa > orden de `current_stage`) | Pendiente (desactivada) |
| `status = COMPLETADA` | Las tres etapas se muestran como completadas ✓ |
| `status ≠ EN_PROGRESO` y `≠ COMPLETADA` | El stepper no se muestra o se muestra en estado inactivo |

---

## 6. Mensajes de UI, estados vacíos y errores

| Situación | Comportamiento | Mensaje literal |
|---|---|---|
| Sin comisiones (nunca ha solicitado) | Estado vacío con CTA | "Aún no has solicitado ninguna comisión" + botón "Explorar artistas" |
| Sin comisiones en un grupo específico | El encabezado del grupo no se muestra | — |
| Acceso a comisión ajena | Niega el acceso y muestra mensaje | "No tienes permiso para ver esta comisión" |
| Comisión rechazada sin motivo | Bloque de rechazo sin motivo | "El artista no indicó un motivo específico." |
| Comisión rechazada con motivo | Bloque de rechazo con motivo | "Motivo indicado por el artista: [motivo]" |
| Error de red al cargar la lista | Pantalla de error con retry | "No se pudo cargar tus comisiones. Comprueba tu conexión e intenta de nuevo" |
| Error de red al cargar el detalle | Pantalla de error con retry | "No se pudo cargar el detalle. Comprueba tu conexión e intenta de nuevo" |
| Carga inicial en progreso | Skeletons de tarjetas / spinner | — (indicador visual, sin texto) |
| Datos desactualizados por caché offline | Banner informativo | "Mostrando datos guardados. Es posible que no estén actualizados." |

---

## 7. Reglas de negocio y seguridad

1. **Solo lectura total:** desde este módulo el cliente exclusivamente consulta datos. No existe ninguna acción que modifique el estado, la etapa, el motivo ni ningún campo de la comisión.
2. **Identidad desde el JWT:** el `client_id` que filtra las comisiones se obtiene exclusivamente de `auth.uid()` en el servidor (política RLS). El cliente nunca envía su propio `user_id` como parámetro de filtro que el servidor deba creer ciegamente (Principio 6 de la constitución).
3. **Acceso solo a propias:** un cliente solo puede ver sus propias comisiones. La política RLS garantiza que `auth.uid() = client_id` sea condición necesaria para cualquier SELECT.
4. **Sin tokens públicos anónimos:** todas las consultas se realizan con la sesión autenticada del cliente. No existe ningún endpoint de lectura pública de comisiones (corrección #2 del SRS, Principio 6 de la constitución).
5. **Visibilidad del motivo de rechazo:** el `rejection_reason` es visible para el cliente en el detalle, tal como fue definido en la Spec 004 (RF-07-D). Si es nulo, se muestra el mensaje neutro correspondiente.

---

## 8. Fuera de alcance de esta spec

- Cancelación de una comisión por parte del cliente (post-MVP).
- Calificación o reseña del artista tras la finalización (post-MVP).
- Notificaciones push al cliente cuando el artista cambia el estado o la etapa (Spec 008).
- Subida de entregables por el artista y su descarga por el cliente (Spec 006).
- Disputas, escalaciones o solicitudes de revisión (post-MVP).
- Historial completo de cambios de estado (audit log, post-MVP).
- Comunicación directa entre cliente y artista desde el detalle de la comisión (post-MVP).
- Búsqueda o filtrado avanzado de comisiones (post-MVP).

---

## 9. Decisiones tomadas

| ID | Tema | Decisión |
|---|---|---|
| P-5.1 | Agrupación por estado | Se agrupa en tres secciones (En curso / Pendientes / Finalizadas) en lugar de un filtro de pestañas. Reduce la navegación para ver el panorama completo de un vistazo. |
| P-5.2 | Solo lectura estricta | No se incluye ningún botón de acción en este módulo. Mantiene la separación de responsabilidades entre el rol del cliente (observar) y el del artista (gestionar). Principio 11. |
| P-5.3 | Visibilidad del motivo de rechazo | Se muestra si está disponible, con un mensaje neutro si no lo está. Mejora la experiencia del cliente sin exponer información sensible del artista. |
| P-5.4 | Stepper con 3 etapas fijas | Se replica la secuencia `SKETCH → LINEART → FINAL` definida en Spec 004. No se introduce un nuevo concepto de presentación; se reutiliza el modelo ya establecido. |
| P-5.5 | Revalidación por foco de pantalla | Se elige revalidación automática al enfocar la pantalla (en lugar de polling) para mantener datos frescos sin costo en batería ni en cuota de Supabase. |

---

## 10. Trazabilidad

| Requerimiento | Origen SRS | Estado |
|---|---|---|
| RF-01 (seguimiento de comisiones del cliente) | RF-01 del SRS v6 | Implementado y detallado en esta spec |
| Corrección #2 del SRS (sin tokens públicos anónimos) | Sección 8 de constitution.md / Principio 6 | Implementada: 100 % de consultas con sesión autenticada |
| Dependencia de modelo de etapas (Spec 004) | Spec 004, Sección 5 | Reutilizado sin modificaciones |

---

## 11. Checklist de aceptación

- [ ] El cliente solo ve sus propias comisiones (`client_id = auth.uid()`).
- [ ] Las comisiones se agrupan correctamente en "En curso", "Pendientes" y "Finalizadas".
- [ ] El estado vacío aparece cuando no hay ninguna comisión, con el CTA "Explorar artistas".
- [ ] Los grupos vacíos no se muestran (no hay encabezados sin contenido).
- [ ] El detalle muestra todos los bloques descritos en RF-05-B.
- [ ] El stepper refleja correctamente el avance: etapas completadas ✓, en curso y pendiente.
- [ ] La comisión rechazada muestra el motivo si existe, o el mensaje neutro si no existe.
- [ ] No existe ningún botón de acción que modifique el estado o la etapa.
- [ ] Pull-to-refresh funciona en la lista.
- [ ] La pantalla se revalida automáticamente al volver a enfocarla.
- [ ] Los errores de red muestran el mensaje literal de la sección 6 con opción de retry.
- [ ] Un tercero autenticado no puede acceder al detalle de una comisión ajena.
- [ ] Todos los mensajes de la sección 6 aparecen con el texto exacto en español.
- [ ] `expo lint` y `tsc` dan 0 errores.
- [ ] Cobertura ≥ 60 % en mapeadores de presentación (badges, stepper, fechas relativas).
- [ ] Las políticas RLS de SELECT para `client_id` tienen prueba de acceso denegado en `supabase/tests/`.