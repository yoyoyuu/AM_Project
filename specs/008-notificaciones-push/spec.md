# Spec 008 — Notificaciones Push (`008-notificaciones-push`)

**Estado:** Borrador · **Versión:** 0.1 · **Fecha:** 2026-11-21
**Prioridad:** Must have
**Constitución:** v1.1
**Depende de:** Spec 001 (cuenta, sesión y perfiles), Spec 003 (solicitud de comisión), Spec 004 (gestión de comisión), Spec 005 (seguimiento del cliente), Spec 006 (avances), Spec 007 (pagos y entregable)

> Esta spec describe **qué** debe hacer el sistema y **por qué**. Las decisiones de tecnología van en `plan.md`.

---

## 1. Contexto y objetivo

Hoy artista y cliente solo se enteran de lo que pasa en una comisión si abren la app y revisan el detalle. El artista no sabe que llegó una solicitud nueva o que el cliente ya subió su comprobante; el cliente no sabe que su solicitud fue aceptada, que hay un avance nuevo o que su entregable ya está listo. El SRS v6 resolvía esto con correos (RF-08 y RF-10), pero la constitución (Principio 7 y corrección #3 de la sección 8) establece que **las notificaciones de eventos de comisión son push**, tanto para el artista como para el cliente, y que el correo se reserva para la autenticación.

**Objetivo:** que cada persona reciba en su teléfono Android un aviso breve y discreto cuando ocurra un evento relevante en una comisión en la que participa, y que al tocarlo la app la lleve directamente a esa comisión.

Tres condiciones no se negocian:

1. **Privacidad:** los avisos nunca muestran montos, descripciones, notas, motivos, nombres ni ningún otro dato de la comisión. Se pueden leer en la pantalla de bloqueo sin revelar nada sensible (Principio 7, LFPDPPP).
2. **Vinculación a la cuenta:** los avisos llegan al dispositivo solo mientras la persona tiene la sesión iniciada en él. Al cerrar sesión, el dispositivo deja de recibirlos (Principio 7).
3. **Permiso mínimo:** el permiso de notificaciones se pide una sola vez, en el momento adecuado y con una explicación propia. Si se niega, la app funciona igual (Principio 8).

Esta spec **no modifica** ninguna regla de las specs 001 a 007: los avisos son una consecuencia de los cambios que esas specs ya realizan, y un fallo al enviar un aviso nunca bloquea ni revierte esos cambios.

---

## 2. Glosario de la spec

| Término | Significado |
|---|---|
| **Aviso** | Notificación que aparece en la barra de notificaciones de Android (y, según la configuración del teléfono, en la pantalla de bloqueo) aunque la app esté cerrada. |
| **Dispositivo registrado** | Teléfono que quedó vinculado a una cuenta para recibir avisos, después de que la persona concedió el permiso de notificaciones con la sesión iniciada. |
| **Evento** | Cambio en una comisión que genera un aviso (sección 5). |
| **Destinatario** | Persona que recibe el aviso de un evento: siempre la **otra parte** de la comisión, nunca quien provocó el cambio. |
| **Explicación previa** | Diálogo propio de Koma que explica para qué sirven los avisos antes de que Android muestre su diálogo de permiso. |
| **Contenido discreto** | Texto genérico del aviso que indica que hay una novedad sin decir cuál es su contenido (sección 5). |

---

## 3. Historias de usuario

### Ambos roles

- **HU-8.1.** Como usuario recién llegado a mi inicio, quiero que Koma me explique para qué quiere enviarme notificaciones antes de pedirme el permiso, para decidir con información.
- **HU-8.2.** Como usuario que no quiere notificaciones, quiero poder negar el permiso y seguir usando la app sin interrupciones ni insistencias.
- **HU-8.3.** Como usuario que antes dijo «Ahora no», quiero poder activar las notificaciones más tarde desde mi perfil.
- **HU-8.4.** Como usuario que comparte o presta su teléfono, quiero que al cerrar sesión ese teléfono deje de recibir avisos de mis comisiones, para que nadie más los vea.
- **HU-8.5.** Como usuario, quiero que los avisos no revelen montos, descripciones ni notas en la pantalla de bloqueo, para que alguien que mire mi teléfono no conozca los detalles de mis encargos.
- **HU-8.6.** Como usuario, quiero que al tocar un aviso la app se abra directamente en la comisión correspondiente, para no tener que buscarla.

### Artista

- **HU-8.7.** Como artista, quiero recibir un aviso cuando un cliente me envía una nueva solicitud, para responder a tiempo.
- **HU-8.8.** Como artista, quiero recibir un aviso cuando un cliente sube su comprobante de pago, para revisarlo sin tener que estar consultando la app.

### Cliente

- **HU-8.9.** Como cliente, quiero recibir un aviso cuando el artista acepta o rechaza mi solicitud, para saber si mi encargo sigue adelante.
- **HU-8.10.** Como cliente, quiero recibir un aviso cuando mi comisión avanza de etapa o cuando el artista sube un avance, para seguir el progreso sin revisar la app a cada rato.
- **HU-8.11.** Como cliente, quiero recibir un aviso cuando el artista confirma mi pago o me pide corregir el comprobante, para actuar si me falta algo.
- **HU-8.12.** Como cliente, quiero recibir un aviso cuando mi entregable final está listo, para descargarlo en cuanto esté disponible.

---

## 4. Requerimientos funcionales

> Numeración: se conserva el identificador del SRS v6 con sufijo de letra, como en las specs 004–007. RF-08-A y RF-10-A **reemplazan** a RF-08 y RF-10 del SRS (de correo a push). RF-25 a RF-28 son nuevos y se reportan como parte de la corrección #3 de la sección 8 de la constitución.

### RF-25-A — Activación de notificaciones y registro del dispositivo (Must have)

El sistema debe pedir el permiso de notificaciones con una explicación previa la primera vez que la persona llega a su inicio con la sesión iniciada y, si lo concede, registrar el dispositivo para que reciba los avisos de esa cuenta.

**Reglas**

- La explicación previa se muestra **solo** si se cumplen todas estas condiciones:
  - la persona tiene la sesión iniciada y está en su pantalla de inicio (no durante el registro, la verificación del correo ni la configuración del perfil);
  - el permiso de notificaciones aún no está concedido y Android todavía permite pedirlo;
  - la persona no eligió antes «Ahora no» en ese dispositivo.
- La explicación previa tiene el título, el texto y los botones de la sección 8. El diálogo de permiso de Android solo aparece si la persona pulsa «Activar».
- Si la persona concede el permiso, el sistema registra el dispositivo para su cuenta y muestra «Notificaciones activadas».
- Si la persona elige «Ahora no» o niega el permiso de Android, el sistema no vuelve a mostrar la explicación previa automáticamente en ese dispositivo y muestra «Notificaciones desactivadas. Puedes activarlas cuando quieras desde tu perfil.».
- Negar el permiso **no** bloquea, cierra ni limita ninguna función de la app: todo sigue disponible y la información se consulta abriendo la app (specs 004 a 007).
- Si el permiso ya estaba concedido (por ejemplo, la persona volvió a iniciar sesión), el sistema registra el dispositivo de forma automática en cada inicio de sesión y cada vez que abre la app, sin mostrar diálogos.
- Un dispositivo queda registrado para **una sola cuenta a la vez**: si otra persona inicia sesión en ese mismo teléfono y el permiso está concedido, el dispositivo pasa a su cuenta y deja de recibir avisos de la cuenta anterior.
- Una persona puede tener varios dispositivos registrados; cada uno recibe los avisos de su cuenta.
- Si el registro del dispositivo falla (por ejemplo, sin conexión), la app sigue funcionando, no muestra errores bloqueantes y lo reintenta la próxima vez que se abra. Si el fallo ocurrió justo después de pulsar «Activar», muestra «No se pudieron activar las notificaciones en este dispositivo. Inténtalo más tarde.».
- En la pantalla de perfil (Spec 001) aparece la fila «Notificaciones» con el estado «Activadas» o «Desactivadas»:
  - si están desactivadas y Android aún permite pedir el permiso, ofrece el botón «Activar notificaciones», que inicia el mismo flujo de la explicación previa;
  - si Android ya no permite pedir el permiso, muestra «Las notificaciones están desactivadas en los ajustes de Android.» y el botón «Abrir ajustes», que abre los ajustes de la app en Android;
  - al volver de los ajustes con el permiso concedido, la fila muestra «Activadas» y el dispositivo se registra.
- Los avisos se agrupan en Android bajo la categoría «Actividad de comisiones», con la descripción «Avisos sobre solicitudes, avances, pagos y entregas de tus comisiones.», para que la persona pueda gestionarla desde los ajustes del sistema.

**Criterios de aceptación**

**Escenario 8.1 — Permiso concedido**
- **Given** una persona que inicia sesión por primera vez en un dispositivo Android, completa su perfil y llega a su pantalla de inicio sin haber concedido el permiso de notificaciones,
- **When** ve la explicación previa «Activa las notificaciones», pulsa «Activar» y concede el permiso en el diálogo de Android,
- **Then** el sistema registra el dispositivo para su cuenta, muestra «Notificaciones activadas» y, a partir de ese momento, el dispositivo recibe los avisos de los eventos de sus comisiones.

**Escenario 8.2 — Permiso denegado sin bloquear la app**
- **Given** una persona con la sesión iniciada que ve el diálogo de permiso de notificaciones de Android tras pulsar «Activar»,
- **When** niega el permiso,
- **Then** el sistema no registra el dispositivo, muestra «Notificaciones desactivadas. Puedes activarlas cuando quieras desde tu perfil.», la persona permanece en su inicio y puede usar todas las funciones de la app (ver catálogo, solicitar, gestionar, subir avances, pagos y entregables) sin ningún bloqueo.

**Escenario 8.3 — «Ahora no» en la explicación previa**
- **Given** una persona con la sesión iniciada que ve la explicación previa en su inicio,
- **When** pulsa «Ahora no»,
- **Then** Android no muestra su diálogo de permiso, el sistema muestra «Notificaciones desactivadas. Puedes activarlas cuando quieras desde tu perfil.» y la explicación previa no vuelve a aparecer al cerrar y abrir la app.

**Escenario 8.4 — Sin solicitud de permiso fuera del inicio**
- **Given** una persona que está registrándose, verificando su correo o completando su perfil,
- **When** recorre esas pantallas,
- **Then** el sistema no muestra la explicación previa ni el diálogo de permiso de notificaciones.

**Escenario 8.5 — Activación posterior desde el perfil**
- **Given** una persona con la sesión iniciada que antes eligió «Ahora no» y cuyo Android aún permite pedir el permiso,
- **When** abre su perfil, ve «Notificaciones: Desactivadas», pulsa «Activar notificaciones», luego «Activar» en la explicación previa y concede el permiso,
- **Then** el sistema registra el dispositivo, muestra «Notificaciones activadas» y la fila cambia a «Activadas».

**Escenario 8.6 — Permiso bloqueado en Android**
- **Given** una persona con la sesión iniciada cuyo Android ya no permite volver a pedir el permiso de notificaciones,
- **When** abre su perfil,
- **Then** la fila «Notificaciones» muestra «Desactivadas», el texto «Las notificaciones están desactivadas en los ajustes de Android.» y el botón «Abrir ajustes», que abre los ajustes de Koma en Android; la app no muestra la explicación previa en el inicio.

**Escenario 8.7 — Registro automático con permiso ya concedido**
- **Given** una persona que ya concedió el permiso de notificaciones en un dispositivo y cerró sesión,
- **When** vuelve a iniciar sesión en ese dispositivo,
- **Then** el sistema registra de nuevo el dispositivo para su cuenta sin mostrar ningún diálogo y vuelve a recibir avisos.

**Escenario 8.8 — Cambio de cuenta en el mismo dispositivo**
- **Given** un dispositivo con el permiso concedido que estaba registrado para la cuenta A (por ejemplo, porque la sesión de A expiró sin cerrarse),
- **When** la persona B inicia sesión en ese dispositivo,
- **Then** el dispositivo queda registrado para la cuenta B y deja de recibir avisos de las comisiones de A.

**Escenario 8.9 — Fallo al registrar el dispositivo**
- **Given** una persona con la sesión iniciada y sin conexión a internet,
- **When** pulsa «Activar» en la explicación previa y concede el permiso,
- **Then** la app sigue funcionando, muestra «No se pudieron activar las notificaciones en este dispositivo. Inténtalo más tarde.» y, la siguiente vez que abra la app con conexión, registra el dispositivo sin mostrar diálogos.

---

### RF-25-B — Desvinculación del dispositivo al cerrar sesión (Must have)

El sistema debe dejar de enviar avisos a un dispositivo en cuanto la persona cierra sesión en él.

**Reglas**

- Al pulsar «Cerrar sesión» (Spec 001), el sistema desvincula el dispositivo de la cuenta **antes** de terminar la sesión.
- Además, retira de la barra de notificaciones del teléfono los avisos de Koma que aún estuvieran visibles.
- Cerrar sesión nunca se bloquea ni se retrasa más de 3 segundos por la desvinculación: si no hay conexión, la sesión se cierra igual.
- Si la desvinculación no pudo completarse por falta de conexión, el dispositivo queda pendiente de reasignarse: en cuanto cualquier persona inicie sesión en él con el permiso concedido, queda vinculado solo a esa nueva cuenta (RF-25-A). Mientras tanto, los avisos que pudieran llegar son de contenido discreto (RNF-NOT-8.1) y la app no muestra ni abre ninguna comisión sin una sesión válida de su destinatario (RF-28-A).
- Cerrar sesión no cambia el permiso de notificaciones de Android: si la persona vuelve a entrar, el dispositivo se registra automáticamente (Escenario 8.7).

**Criterios de aceptación**

**Escenario 8.10 — Desvinculación al cerrar sesión**
- **Given** una persona con la sesión iniciada en un dispositivo registrado que tiene avisos de Koma en la barra de notificaciones,
- **When** pulsa «Cerrar sesión»,
- **Then** el sistema desvincula el dispositivo de su cuenta, retira los avisos de Koma de la barra de notificaciones, cierra la sesión y muestra la pantalla de inicio de sesión.

**Escenario 8.11 — Sin avisos después de cerrar sesión**
- **Given** un cliente que cerró sesión en su dispositivo con conexión a internet,
- **When** el artista de una de sus comisiones avanza la etapa creativa,
- **Then** ese dispositivo no recibe ningún aviso; los demás dispositivos del cliente con la sesión iniciada sí lo reciben.

**Escenario 8.12 — Cerrar sesión sin conexión**
- **Given** una persona con la sesión iniciada en un dispositivo registrado y sin conexión a internet,
- **When** pulsa «Cerrar sesión»,
- **Then** la sesión se cierra en un máximo de 3 segundos sin mostrar errores y la app muestra la pantalla de inicio de sesión.

---

### RF-08-A — Aviso de resolución de la solicitud (Must have)

Reemplaza a RF-08 del SRS v6. El sistema debe avisar al cliente cuando el artista acepta o rechaza su solicitud de comisión.

**Reglas**

- Se envía cuando una solicitud pasa de `PENDIENTE` a `EN_PROGRESO` (aceptada, Spec 004) o a `RECHAZADA` (rechazada, Spec 004).
- El texto es el mismo para ambos casos: «Hay una actualización en tu solicitud de comisión». El resultado (aceptada o rechazada) y el motivo de rechazo solo se ven dentro de la app (P-8.1).
- Al aceptar, la comisión también entra en la etapa «Boceto»; esto **no** genera un segundo aviso de cambio de etapa (P-8.3).

**Criterios de aceptación**

**Escenario 8.13 — Aviso al aceptar la solicitud**
- **Given** un cliente con un dispositivo registrado y una solicitud `PENDIENTE`,
- **When** el artista acepta la solicitud,
- **Then** el dispositivo del cliente recibe, en menos de 60 segundos, un único aviso con el título «Koma» y el texto «Hay una actualización en tu solicitud de comisión», sin el nombre del artista, el servicio ni ningún otro dato de la comisión.

**Escenario 8.14 — Aviso al rechazar la solicitud**
- **Given** un cliente con un dispositivo registrado y una solicitud `PENDIENTE`,
- **When** el artista la rechaza con el motivo «No tengo capacidad esta semana»,
- **Then** el dispositivo del cliente recibe el aviso «Hay una actualización en tu solicitud de comisión» y el texto del aviso no incluye el motivo de rechazo.

---

### RF-10-A — Aviso de nuevo avance (Should have)

Reemplaza a RF-10 del SRS v6. El sistema debe avisar al cliente cuando el artista sube un nuevo avance de su comisión (Spec 006).

**Reglas**

- Se envía una sola vez por avance, aunque el avance tenga varias imágenes, y solo cuando sus imágenes ya están disponibles para el cliente (P-8.8).
- Si la subida del avance falla (Spec 006), no se envía ningún aviso.
- Texto: «Tienes un nuevo avance disponible». No incluye la nota del avance ni la etapa.

**Criterios de aceptación**

**Escenario 8.15 — Aviso de nuevo avance**
- **Given** un cliente con un dispositivo registrado y una comisión `EN_PROGRESO`,
- **When** el artista sube un avance con tres imágenes y la nota «Boceto inicial listo»,
- **Then** el dispositivo del cliente recibe un único aviso «Tienes un nuevo avance disponible» y el texto no incluye la nota.

**Escenario 8.16 — Subida de avance fallida**
- **Given** un artista que sube un avance de una comisión `EN_PROGRESO`,
- **When** la subida de las imágenes falla y la app muestra el error de la Spec 006,
- **Then** el cliente no recibe ningún aviso de nuevo avance.

---

### RF-26-A — Avisos de seguimiento al cliente (Must have)

El sistema debe avisar al cliente cuando cambia la etapa creativa de su comisión, cuando el artista resuelve su comprobante de pago y cuando su entregable final queda listo.

**Reglas**

| Evento (specs 004 y 007) | Texto del aviso |
|---|---|
| La comisión `EN_PROGRESO` pasa a la siguiente etapa creativa (Boceto → Delineado → Color / Acabado final) | «Tu comisión avanzó a una nueva etapa» |
| El artista confirma el pago («Pagado») o pide corregir el comprobante («Requiere corrección») | «Se actualizó el estado de tu pago» |
| El artista sube o reemplaza el entregable final, o la comisión pasa a `COMPLETADA` | «Tu entregable final está listo» |

- Si un mismo cambio cumple varias condiciones a la vez (por ejemplo, el artista confirma el pago y eso cierra la comisión porque el entregable ya estaba subido), el cliente recibe **un solo aviso**, el de mayor prioridad según la sección 5.
- Los avisos de pago no incluyen el monto, el motivo de corrección ni la referencia del comprobante.

**Criterios de aceptación**

**Escenario 8.17 — Aviso al cambiar la etapa**
- **Given** un cliente con un dispositivo registrado y una comisión `EN_PROGRESO` en etapa «Boceto»,
- **When** el artista completa la etapa y la comisión pasa a «Delineado»,
- **Then** el dispositivo del cliente recibe en menos de 60 segundos el aviso «Tu comisión avanzó a una nueva etapa», sin el nombre de la etapa.

**Escenario 8.18 — Aviso al pedir corrección del comprobante**
- **Given** un cliente con un dispositivo registrado y un comprobante en «Comprobante en revisión»,
- **When** el artista elige «Requiere corrección» con el motivo «Monto incompleto. Faltan $150»,
- **Then** el dispositivo del cliente recibe el aviso «Se actualizó el estado de tu pago» y el texto del aviso no incluye el motivo ni ninguna cantidad.

**Escenario 8.19 — Un solo aviso al confirmar el pago con entregable ya subido**
- **Given** un cliente con un dispositivo registrado, una comisión en etapa «Color / Acabado final» con entregable subido y comprobante en «Comprobante en revisión»,
- **When** el artista confirma el pago y la comisión pasa a `COMPLETADA`,
- **Then** el dispositivo del cliente recibe un único aviso: «Tu entregable final está listo».

**Escenario 8.20 — Aviso de entregable con pago pendiente**
- **Given** un cliente con un dispositivo registrado y una comisión en etapa «Color / Acabado final» con pago distinto de «Pagado»,
- **When** el artista sube el entregable final,
- **Then** el dispositivo del cliente recibe el aviso «Tu entregable final está listo» y, al abrir la comisión, ve la tarjeta con candado de la Spec 007 (el aviso no desbloquea nada).

---

### RF-27-A — Avisos al artista (Must have)

El sistema debe avisar al artista cuando recibe una nueva solicitud de comisión y cuando un cliente sube un comprobante de pago.

**Reglas**

| Evento (specs 003 y 007) | Texto del aviso |
|---|---|
| Un cliente envía una nueva solicitud de comisión al artista | «Tienes una nueva solicitud de comisión» |
| Un cliente envía o reenvía su comprobante de pago («Comprobante en revisión») | «Un cliente subió un comprobante de pago» |

- Los avisos no incluyen el nombre o handle del cliente, el servicio, el precio, la descripción, la referencia ni la nota del comprobante.

**Criterios de aceptación**

**Escenario 8.21 — Aviso de nueva solicitud**
- **Given** un artista con un dispositivo registrado,
- **When** un cliente le envía una solicitud de comisión,
- **Then** el dispositivo del artista recibe en menos de 60 segundos el aviso «Tienes una nueva solicitud de comisión» y el cliente no recibe ningún aviso por su propia acción.

**Escenario 8.22 — Aviso de comprobante subido**
- **Given** un artista con un dispositivo registrado y una comisión `EN_PROGRESO` con pago «Pendiente de pago» o «Requiere corrección»,
- **When** el cliente envía su comprobante,
- **Then** el dispositivo del artista recibe el aviso «Un cliente subió un comprobante de pago», sin la referencia, la nota ni el nombre del cliente.

---

### RF-28-A — Apertura de la comisión al tocar un aviso (Must have)

El sistema debe abrir la app directamente en la comisión del aviso cuando la persona lo toca, tanto si la app estaba cerrada como si estaba en segundo plano.

**Reglas**

| Aviso | Pantalla que se abre |
|---|---|
| «Tienes una nueva solicitud de comisión» | Detalle de la solicitud en el panel del artista (Spec 004) |
| «Un cliente subió un comprobante de pago» | Panel de trabajo de la comisión, con la sección «Pago y entrega» (specs 004 y 007) |
| Cualquier aviso del cliente | Detalle de seguimiento de la comisión (Spec 005) |

- Solo se abre la comisión si la sesión iniciada pertenece al destinatario del aviso. Si no hay sesión, la app muestra la pantalla de inicio de sesión; si la sesión es de otra cuenta, la app abre el inicio sin mostrar ningún dato de la comisión.
- Con la app abierta en primer plano, el aviso se muestra igualmente como banner y la información visible en la app se actualiza sin que la persona tenga que refrescar.
- Koma **no** tiene bandeja interna de notificaciones: el historial de lo ocurrido se consulta en el detalle de cada comisión (P-8.4).

**Criterios de aceptación**

**Escenario 8.23 — Abrir la comisión desde un aviso con la app cerrada**
- **Given** un cliente con la sesión iniciada, la app completamente cerrada y el aviso «Tienes un nuevo avance disponible» en la barra de notificaciones,
- **When** toca el aviso,
- **Then** la app se abre directamente en el detalle de seguimiento de esa comisión y la sección de avances muestra el avance nuevo.

**Escenario 8.24 — Abrir el comprobante desde un aviso del artista**
- **Given** un artista con la sesión iniciada y la app en segundo plano,
- **When** toca el aviso «Un cliente subió un comprobante de pago»,
- **Then** la app se abre en el panel de trabajo de esa comisión, donde la sección «Pago y entrega» muestra «Revisa el comprobante del cliente».

**Escenario 8.25 — Aviso con la app en primer plano**
- **Given** un cliente que está viendo el detalle de seguimiento de su comisión en etapa «Boceto»,
- **When** el artista avanza la comisión a «Delineado»,
- **Then** aparece el banner «Tu comisión avanzó a una nueva etapa» y el detalle se actualiza a «Delineado» sin que el cliente tenga que refrescar.

**Escenario 8.26 — Aviso de otra cuenta**
- **Given** un dispositivo con la sesión de la cuenta B que aún conserva un aviso dirigido a la cuenta A,
- **When** la persona toca ese aviso,
- **Then** la app abre el inicio de la cuenta B y no muestra ningún dato de la comisión de A.

---

## 5. Eventos, destinatarios y contenido discreto

Todos los avisos tienen el título **«Koma»** y uno de estos textos. Ningún aviso agrega otra información visible.

| # | Evento | Destinatario | Texto literal del aviso | Al tocarlo abre |
|---|---|---|---|---|
| E1 | Nueva solicitud de comisión (Spec 003) | Artista | «Tienes una nueva solicitud de comisión» | Detalle de la solicitud |
| E2 | Comprobante enviado o reenviado → «Comprobante en revisión» (Spec 007) | Artista | «Un cliente subió un comprobante de pago» | Panel de trabajo |
| E3 | Solicitud aceptada (`PENDIENTE` → `EN_PROGRESO`) o rechazada (`PENDIENTE` → `RECHAZADA`) (Spec 004) | Cliente | «Hay una actualización en tu solicitud de comisión» | Detalle de seguimiento |
| E4 | Cambio de etapa creativa en una comisión `EN_PROGRESO` (Spec 004) | Cliente | «Tu comisión avanzó a una nueva etapa» | Detalle de seguimiento |
| E5 | Nuevo avance con sus imágenes disponibles (Spec 006) | Cliente | «Tienes un nuevo avance disponible» | Detalle de seguimiento |
| E6 | Pago → «Pagado» o «Requiere corrección» (Spec 007) | Cliente | «Se actualizó el estado de tu pago» | Detalle de seguimiento |
| E7 | Entregable final subido o reemplazado, o comisión → `COMPLETADA` (Spec 007) | Cliente | «Tu entregable final está listo» | Detalle de seguimiento |

**Prioridad cuando un solo cambio cumple varias condiciones** (se envía únicamente el primero que aplique):

1. E7 — Entregable final listo / comisión completada.
2. E3 — Solicitud resuelta (incluye la entrada a «Boceto» al aceptar).
3. E2 — Comprobante enviado.
4. E6 — Estado de pago actualizado.
5. E4 — Cambio de etapa.

**Nunca se genera aviso** por: cambios hechos por el propio destinatario; comisiones `CANCELADA` o `EN_REVISION` (sin flujo en el MVP); ediciones de perfil, catálogo o servicios; descargas o guardado en galería.

---

## 6. Requerimientos no funcionales

| ID | Aplicación en esta spec | Métrica |
|---|---|---|
| RNF-NOT-8.1 (privacidad de notificaciones, nuevo — corrección #3) | El contenido de todo aviso es discreto: solo el título «Koma» y uno de los siete textos de la sección 5. Se puede mostrar en la pantalla de bloqueo sin revelar datos. Si la persona configuró Android para ocultar contenido sensible en la pantalla de bloqueo, Koma lo respeta. | 0 avisos con montos, precios, referencias, notas, descripciones, motivos, nombres, handles, nombres de servicio o de etapa |
| RNF-NOT-8.2 (vinculación) | Los avisos se dirigen a la cuenta, no al teléfono: un dispositivo recibe avisos solo de la cuenta con la que está vinculado, y solo mientras la sesión está iniciada | 100 % de los dispositivos desvinculados al cerrar sesión con conexión; un dispositivo vinculado a una sola cuenta a la vez |
| RNF-NOT-8.3 (oportunidad) | Tiempo desde que se guarda el cambio de la comisión hasta que el aviso llega a un dispositivo con conexión | ≤ 60 s en el 95 % de los casos (equivale a RF-08 del SRS v6) |
| RNF-NOT-8.4 (independencia y confiabilidad) | Un fallo al generar o enviar un aviso nunca bloquea, retrasa ni revierte la acción que lo originó (specs 003 a 007). Si el servicio de avisos no responde, el sistema reintenta el envío hasta 3 veces | 0 operaciones de comisión fallidas por causa de un aviso; hasta 3 reintentos por envío |
| RNF-NOT-8.5 (limpieza) | Los dispositivos que ya no existen (app desinstalada, datos borrados) dejan de recibir envíos y se eliminan del registro automáticamente cuando el servicio de avisos lo informa | 100 % de los dispositivos reportados como inexistentes se eliminan en el mismo envío |
| RNF-04 | Los registros de dispositivos son accesibles solo por su dueño | 100 % de las peticiones de lectura, alta, cambio o baja sobre dispositivos de otra cuenta reciben 0 filas o error de autorización |
| RNF-08 | Cobertura de la lógica de eventos, contenido, navegación, registro y desvinculación | ≥ 60 % |
| Principio 2 | Servicios de avisos dentro de su plan gratuito | Costo $0 |
| Principio 8 | Permiso de notificaciones pedido solo en el inicio autenticado, con explicación previa; la app funciona completa si se niega | Sin excepción |
| Principio 11 | Sin bandeja interna, sin preferencias por tipo de aviso, sin avisos programados ni recordatorios | Sin excepción |

---

## 7. Permisos de dispositivo

| Permiso | Momento de solicitud | Explicación previa (propia de Koma) | Si se deniega |
|---|---|---|---|
| Notificaciones (Android 13 o superior) | Primera llegada al inicio con la sesión iniciada, o al pulsar «Activar notificaciones» en el perfil | Título «Activa las notificaciones» y texto «Koma te avisará cuando haya novedades en tus comisiones: nuevas solicitudes, avances, cambios de etapa y pagos. Los avisos nunca muestran montos, descripciones ni notas privadas.» con los botones «Activar» y «Ahora no» | «Notificaciones desactivadas. Puedes activarlas cuando quieras desde tu perfil.»; la app sigue funcionando completa |

En Android 12 o inferior el sistema concede las notificaciones por defecto, sin diálogo: no se muestra la explicación previa, el dispositivo se registra automáticamente al iniciar sesión (como en el Escenario 8.7) y la persona puede desactivarlas desde los ajustes de Android; en ese caso la fila del perfil muestra «Desactivadas» con el botón «Abrir ajustes».

Ningún otro permiso se solicita en esta spec.

---

## 8. Mensajes de UI, avisos y errores (literales)

### 8.1 Explicación previa y perfil

| Situación | Comportamiento | Mensaje literal |
|---|---|---|
| Título de la explicación previa | Diálogo | «Activa las notificaciones» |
| Texto de la explicación previa | Diálogo | «Koma te avisará cuando haya novedades en tus comisiones: nuevas solicitudes, avances, cambios de etapa y pagos. Los avisos nunca muestran montos, descripciones ni notas privadas.» |
| Botón de aceptación | Acción | «Activar» |
| Botón de rechazo | Acción | «Ahora no» |
| Permiso concedido y dispositivo registrado | Toast | «Notificaciones activadas» |
| «Ahora no» o permiso denegado | Toast | «Notificaciones desactivadas. Puedes activarlas cuando quieras desde tu perfil.» |
| Fallo al registrar tras pulsar «Activar» | Toast | «No se pudieron activar las notificaciones en este dispositivo. Inténtalo más tarde.» |
| Fila del perfil | Etiqueta | «Notificaciones» |
| Estado activado | Valor | «Activadas» |
| Estado desactivado | Valor | «Desactivadas» |
| Botón de activación en el perfil | Acción | «Activar notificaciones» |
| Permiso bloqueado en Android | Texto de ayuda | «Las notificaciones están desactivadas en los ajustes de Android.» |
| Botón hacia los ajustes | Acción | «Abrir ajustes» |

### 8.2 Categoría de Android

| Elemento | Texto literal |
|---|---|
| Nombre de la categoría | «Actividad de comisiones» |
| Descripción de la categoría | «Avisos sobre solicitudes, avances, pagos y entregas de tus comisiones.» |

### 8.3 Avisos

| Elemento | Texto literal |
|---|---|
| Título de todos los avisos | «Koma» |
| E1 | «Tienes una nueva solicitud de comisión» |
| E2 | «Un cliente subió un comprobante de pago» |
| E3 | «Hay una actualización en tu solicitud de comisión» |
| E4 | «Tu comisión avanzó a una nueva etapa» |
| E5 | «Tienes un nuevo avance disponible» |
| E6 | «Se actualizó el estado de tu pago» |
| E7 | «Tu entregable final está listo» |

### 8.4 Errores sin mensaje visible

| Situación | Comportamiento |
|---|---|
| Fallo al registrar el dispositivo de forma automática (sin pulsar «Activar») | Silencioso; se reintenta en la siguiente apertura de la app |
| Fallo al desvincular al cerrar sesión | Silencioso; la sesión se cierra igual (RF-25-B) |
| Fallo al enviar un aviso | Silencioso para ambas partes; la acción de la comisión ya quedó guardada (RNF-NOT-8.4) |

---

## 9. Entidades (conceptual)

- **Dispositivo registrado:** vínculo entre una cuenta y un teléfono capaz de recibir avisos. Guarda el identificador de avisos del teléfono (único en todo el sistema), la cuenta dueña y las fechas de alta y última actualización. Solo su dueño puede consultarlo, crearlo, cambiarlo o borrarlo. Se elimina al cerrar sesión, cuando el servicio de avisos informa que el teléfono ya no existe, o al eliminarse la cuenta.
- **Evento de comisión:** no se almacena; se deriva en el servidor de los cambios que las specs 003, 004, 006 y 007 ya guardan.

El diseño de tablas, políticas, contratos y servicios va en `plan.md`.

---

## 10. Interfaces externas

**RI-02 (actualizada, corrección #3):** interfaz con el servicio de mensajería push que entrega avisos a teléfonos Android. El servidor de Koma le envía, por cada aviso, el identificador del dispositivo, el título, el texto discreto y datos internos no visibles para abrir la comisión correcta. El servicio responde con el resultado por dispositivo, incluido el caso «dispositivo ya no registrado». Toda la comunicación es por HTTPS (RI-04). Ninguna credencial del servicio se guarda en el código de la app (Principio 5). El detalle técnico va en `plan.md`.

---

## 11. Impacto sobre specs anteriores

| Spec | Cambio |
|---|---|
| 001 | «Cerrar sesión» desvincula primero el dispositivo y retira los avisos visibles (RF-25-B). El perfil incorpora la fila «Notificaciones» (RF-25-A). El inicio puede mostrar una vez la explicación previa. Ninguna otra regla cambia. |
| 003 | Sin cambios. Enviar una solicitud genera el aviso E1 al artista. |
| 004 | Sin cambios. Aceptar o rechazar genera E3; avanzar de etapa genera E4. El texto «El cliente será notificado» de la Spec 004 queda cubierto por estos avisos. |
| 005 | Sin cambios. El detalle de seguimiento es el destino de todos los avisos del cliente y se actualiza al recibir uno con la app abierta. |
| 006 | Sin cambios. Un avance con sus imágenes guardadas genera E5. |
| 007 | Sin cambios. Comprobante enviado genera E2; pago confirmado o corrección genera E6; entregable subido o comisión completada genera E7. Se cumple el pendiente de su sección 10. |

---

## 12. Fuera de alcance de esta spec

- Notificaciones por correo de eventos de comisión (fuera de alcance v1 según la constitución).
- Bandeja o historial de notificaciones dentro de la app.
- Preferencias por tipo de aviso, horarios de silencio o resúmenes diarios.
- Avisos programados o recordatorios (plazos, inactividad, cupos): Spec 009.
- Avisos de mensajes de chat, revisiones del cliente sobre avances o disputas (no existen en el MVP).
- Contador de avisos sin leer en el ícono de la app.
- iOS y web (Principio 3).
- Confirmación de lectura de un aviso.

---

## 13. Decisiones tomadas

| ID | Tema | Decisión |
|---|---|---|
| P-8.1 | Contenido de los avisos | Genérico y sin datos de la comisión. El SRS v6 (RF-08) pedía incluir el folio de la solicitud; se omite porque el aviso puede leerse en la pantalla de bloqueo y el folio no aporta al destinatario más que el enlace directo a la comisión. Se reporta en la corrección #3. |
| P-8.2 | Aviso de aceptación | RF-08 del SRS solo cubría el rechazo. Se avisa también la aceptación, con el mismo texto, porque es igual de relevante para el cliente y evita revelar el resultado en la pantalla de bloqueo. |
| P-8.3 | Un aviso por cambio | Si un cambio cumple varias condiciones, se envía uno solo con la prioridad de la sección 5, para no duplicar avisos (por ejemplo, aceptar + entrar a «Boceto», o pago confirmado + comisión completada). |
| P-8.4 | Sin bandeja interna | El detalle de cada comisión ya es el historial (estado, etapas, avances, pago y entrega). Una bandeja duplicaría esa información (Principio 11). |
| P-8.5 | Momento del permiso | En la primera llegada al inicio con la sesión iniciada, no al instalar ni durante el registro: es el primer momento en que los avisos tienen sentido para la persona. «Ahora no» se respeta y no se insiste; se puede activar después desde el perfil (Principio 8). |
| P-8.6 | Destinatario | Siempre la otra parte de la comisión. Nadie recibe avisos de sus propias acciones. |
| P-8.7 | Dispositivo compartido | Un dispositivo pertenece a una sola cuenta a la vez; el último que inicia sesión con el permiso concedido se queda con él. Resuelve el caso de sesiones expiradas sin cierre explícito. |
| P-8.8 | Momento del aviso de avance | Cuando las imágenes del avance ya están guardadas, no cuando se crea el registro del avance (Spec 006 crea primero el registro y luego sube las imágenes). Así el cliente nunca abre un avance vacío. |
| P-8.9 | Avisos del entregable antes del pago | Se avisa en cuanto el entregable se sube, aunque el pago no esté confirmado, porque es la señal para que el cliente complete su pago (HU-7.5 de la Spec 007). El aviso no desbloquea nada. |
| P-8.10 | Reintentos | Se mantiene el criterio de confiabilidad del SRS (hasta 3 reintentos) aplicado al envío push, sin afectar el estado de la comisión. |

---

## 14. Trazabilidad

| Requerimiento de esta spec | Origen SRS v6 / constitución | Estado |
|---|---|---|
| RF-08-A | RF-08 (Notifica el rechazo de la solicitud) | Reemplazado: de correo a push; amplía a la aceptación (P-8.2) |
| RF-10-A | RF-10 (Notifica el nuevo avance) | Reemplazado: de correo a push |
| RF-25-A | Corrección #3: «RF de registro de dispositivo» | Nuevo |
| RF-25-B | Principio 7: «se eliminan al cerrar sesión» | Nuevo |
| RF-26-A | Specs 004 y 007 (etapas, pago, entregable); Spec 007 §10 | Nuevo |
| RF-27-A | Specs 003 y 007 (solicitud, comprobante) | Nuevo |
| RF-28-A | Principio 7; experiencia de RF-01 | Nuevo |
| RNF-NOT-8.1 | Corrección #3: «RNF de privacidad de notificaciones»; Principio 7 | Nuevo |
| RNF-NOT-8.2 a 8.5 | Principio 7; atributo de confiabilidad del SRS (sección 7) | Nuevos |
| RI-02 | Corrección #3: interfaces con el servicio push | Actualizada |
| Correcciones al SRS a reportar | Constitución, sección 8, #3 | P-8.1 y P-8.2 deben reflejarse en el SRS v7 |

---

## 15. Checklist de aceptación

- [ ] La explicación previa aparece solo en el inicio autenticado, solo si el permiso no está concedido, Android permite pedirlo y no se eligió «Ahora no».
- [ ] Conceder el permiso registra el dispositivo; negarlo deja la app completamente usable.
- [ ] El perfil muestra el estado de las notificaciones y permite activarlas o abrir los ajustes de Android.
- [ ] Un dispositivo pertenece a una sola cuenta a la vez; volver a iniciar sesión lo registra sin diálogos.
- [ ] Cerrar sesión desvincula el dispositivo, retira los avisos visibles y nunca tarda más de 3 s por esta causa.
- [ ] Los siete eventos de la sección 5 generan exactamente un aviso a la otra parte, con el texto literal.
- [ ] Ningún aviso contiene montos, referencias, notas, descripciones, motivos, nombres, handles, servicios ni etapas.
- [ ] Tocar un aviso abre la pantalla indicada en RF-28-A, con la app cerrada o en segundo plano, solo para el destinatario.
- [ ] Con la app en primer plano, el aviso se muestra y la información de la comisión se actualiza.
- [ ] Un fallo al enviar avisos no afecta ninguna operación de las specs 003 a 007.
- [ ] Los dispositivos reportados como inexistentes se eliminan del registro.
- [ ] Una cuenta no puede leer, crear, cambiar ni borrar registros de dispositivos de otra cuenta (prueba de acceso denegado).
- [ ] Todos los mensajes de la sección 8 aparecen con el texto exacto.
- [ ] `expo lint` y `tsc` dan 0 errores.
- [ ] Cobertura ≥ 60 % en la lógica de eventos, contenido, navegación, registro y desvinculación.