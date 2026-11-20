# Spec 007 — Registro de Pagos, Comprobantes y Entregable Final (`007-pagos-entregable`)

**Estado:** Borrador · **Versión:** 0.1 · **Fecha:** 2026-11-20
**Prioridad:** Must have
**Constitución:** v1.1
**Depende de:** Spec 001 (cuenta y perfiles), Spec 002 (catálogo y TOS), Spec 003 (solicitud de comisión), Spec 004 (gestión de comisión), Spec 005 (seguimiento del cliente), Spec 006 (avances)

> Esta spec describe **qué** debe hacer el sistema y **por qué**. Las decisiones de tecnología van en `plan.md`.

---

## 1. Contexto y objetivo

En las comisiones de arte digital, el pago y la entrega del archivo final son el punto de mayor fricción y desconfianza entre artista y cliente. Hoy se resuelve por mensajes directos: el cliente envía una captura de su transferencia por chat, el artista la busca entre conversaciones largas, y el archivo final se envía por cualquier medio sin una regla clara de cuándo puede liberarse. El artista teme entregar sin cobrar y el cliente teme pagar sin recibir.

Koma **no procesa, no custodia y no reembolsa dinero** (Principio 4, RC-01). El pago se realiza fuera de la app, por el medio que artista y cliente acordaron (transferencia, depósito, PayPal u otro). Lo que Koma sí hace es **registrar el estado del pago y la evidencia** de ese pago, y usar ese estado como llave para liberar el entregable final.

**Objetivo:** que, dentro de la ficha de cada comisión aceptada:

1. el cliente pueda subir la captura o foto de su comprobante de pago;
2. el artista pueda revisarlo y confirmarlo o pedir una corrección con un motivo;
3. el artista pueda subir la ilustración final en calidad de entrega;
4. el cliente solo pueda ver y descargar esa ilustración cuando el artista haya confirmado el pago, y pueda guardarla directamente en la galería de su dispositivo Android.

El bloqueo del entregable se garantiza en el servidor; ocultar botones en la app no es suficiente (Principios 5 y 6).

---

## 2. Glosario de la spec

| Término | Significado |
|---|---|
| **Comprobante** | Imagen (captura de pantalla o foto) que el cliente sube como evidencia de un pago realizado fuera de Koma. |
| **Estado de pago** | Situación del pago de una comisión, independiente del estado de la comisión (Spec 004). Ver sección 5. |
| **Entregable final** | Archivo de imagen de la obra terminada que el artista sube para el cliente. Es único por comisión (la versión vigente). |
| **Desbloqueo** | Momento en que el cliente obtiene acceso al entregable: ocurre cuando el estado de pago es *Pagado* y el entregable existe. |
| **Sección «Pago y entrega»** | Bloque dentro del detalle de la comisión (vista del artista de la Spec 004 y vista del cliente de la Spec 005) donde viven todas las funciones de esta spec. |

---

## 3. Historias de usuario

### Cliente

- **HU-7.1.** Como cliente, quiero subir desde mi galería la captura de mi transferencia o depósito, para demostrarle al artista que ya pagué sin tener que buscarlo en otro chat.
- **HU-7.2.** Como cliente, quiero poder agregar una referencia de la operación y una nota opcionales a mi comprobante, para que el artista lo identifique fácilmente.
- **HU-7.3.** Como cliente, quiero ver en todo momento en qué estado está mi pago (pendiente, en revisión, requiere corrección o pagado), para saber si me falta hacer algo.
- **HU-7.4.** Como cliente, si el artista me pide corregir mi comprobante, quiero ver el motivo y poder enviar un comprobante nuevo, para resolver el problema sin salir de la app.
- **HU-7.5.** Como cliente, quiero saber cuándo el entregable final ya está listo aunque mi pago aún no esté confirmado, para entender que solo me falta completar ese paso.
- **HU-7.6.** Como cliente, una vez confirmado mi pago, quiero ver la ilustración final y guardarla en la galería de mi teléfono con un solo botón.
- **HU-7.7.** Como cliente, quiero que la app me pida permiso para usar mi galería solo cuando voy a subir un comprobante o a guardar la ilustración, explicándome por qué, y que siga funcionando si lo niego.

### Artista

- **HU-7.8.** Como artista, quiero ver el comprobante que subió mi cliente en tamaño completo, para verificar contra mi cuenta que el pago es correcto.
- **HU-7.9.** Como artista, quiero confirmar el pago cuando lo verifiqué, para que quede registrado y el cliente pueda recibir su entregable.
- **HU-7.10.** Como artista, quiero marcar un comprobante como «Requiere corrección» indicando el motivo (por ejemplo, «Comprobante ilegible» o «Monto incompleto»), para que el cliente sepa exactamente qué debe corregir.
- **HU-7.11.** Como artista, quiero subir la ilustración final desde mi galería con buena calidad, sin que se degrade como un avance, para entregar el trabajo terminado dentro de la app.
- **HU-7.12.** Como artista, quiero que el cliente no pueda ver ni descargar mi ilustración final hasta que yo confirme el pago, para no entregar sin cobrar.
- **HU-7.13.** Como artista, quiero que la comisión se marque como finalizada automáticamente cuando el pago está confirmado y el entregable está subido, para no tener que hacer un paso extra.

---

## 4. Requerimientos funcionales

> Numeración: se conserva el identificador del SRS v6 y se agrega un sufijo de letra, igual que en las specs 004–006. Los RF-20, RF-21 y RF-24 del SRS v6 corresponden a las correcciones #6 y #7 de la sección 8 de la constitución.

### RF-11-A — Estado de pago de la comisión (Must have)

El sistema debe mantener un estado de pago para cada comisión, visible para el artista y el cliente de la comisión, y que solo cambia por las acciones definidas en esta spec.

**Reglas**

- Toda comisión nace con estado de pago **«Pendiente de pago»**.
- Los cuatro estados de pago y sus transiciones son los de la sección 5. No existe ninguna otra transición.
- El cliente **nunca** puede fijar el estado de pago directamente; solo puede *enviar un comprobante*, lo que lleva el estado a «Comprobante en revisión».
- Solo el artista de la comisión puede llevar el estado a «Pagado» o a «Requiere corrección».
- El estado de pago se muestra con una etiqueta (badge) en la sección «Pago y entrega» del detalle de la comisión, tanto para el artista como para el cliente, y en la tarjeta de la comisión en «Mis Comisiones» (Spec 005) para las comisiones aceptadas.
- Junto al estado, el sistema muestra como referencia el precio base del servicio contratado (Spec 002): «Monto de referencia: $[precio] MXN». Koma no registra el monto realmente pagado.
- La sección «Pago y entrega» incluye siempre el aviso: «Koma no procesa pagos. Realiza el pago por el medio que acordaste con el artista y sube aquí tu comprobante.» (vista del cliente).
- Para comisiones `PENDIENTE`, `RECHAZADA` o `CANCELADA` la sección «Pago y entrega» no ofrece acciones. En `PENDIENTE` el cliente ve: «Podrás subir tu comprobante cuando el artista acepte la comisión».
- Un tercero (que no es artista ni cliente de la comisión) no puede consultar ni modificar el estado de pago.

**Criterios de aceptación**

**Escenario 7.1 — Estado inicial de una comisión aceptada**
- **Given** un cliente autenticado cuya comisión acaba de pasar a `EN_PROGRESO`,
- **When** abre el detalle de la comisión,
- **Then** la sección «Pago y entrega» muestra el badge «Pendiente de pago», el monto de referencia del servicio, el aviso de pagos externos y el botón «Subir comprobante».

**Escenario 7.2 — El cliente intenta fijar el estado de pago directamente**
- **Given** un cliente autenticado dueño de una comisión `EN_PROGRESO` con estado de pago «Pendiente de pago»,
- **When** intenta cambiar el estado de pago a «Pagado» por cualquier medio distinto del flujo de la app (por ejemplo, una petición manipulada),
- **Then** el sistema rechaza la operación y el estado de pago permanece «Pendiente de pago».

**Escenario 7.3 — Comisión aún no aceptada**
- **Given** un cliente autenticado con una comisión en estado `PENDIENTE`,
- **When** abre el detalle,
- **Then** la sección «Pago y entrega» no muestra el botón «Subir comprobante» y presenta el mensaje «Podrás subir tu comprobante cuando el artista acepte la comisión».

**Escenario 7.4 — Tercero intenta consultar el estado de pago**
- **Given** un usuario autenticado que no es ni el artista ni el cliente de la comisión,
- **When** intenta consultar el estado de pago o el comprobante de esa comisión por cualquier medio,
- **Then** el sistema no devuelve ningún dato (resultado vacío o error de autorización).

---

### RF-21-A — Subida del comprobante por el cliente (Must have)

El sistema debe permitir al cliente de una comisión aceptada subir una imagen de su comprobante de pago desde la galería de su dispositivo, con referencia y nota opcionales, y dejar el estado de pago en «Comprobante en revisión».

**Reglas**

- Solo el cliente cuyo `client_id` coincide con el de la comisión puede subir comprobantes.
- Solo se permite subir un comprobante si la comisión está en `EN_PROGRESO` **y** el estado de pago es «Pendiente de pago» o «Requiere corrección». En «Comprobante en revisión» o «Pagado» la acción no está disponible.
- El comprobante es **una sola imagen** seleccionada de la galería (JPG, PNG o WEBP), de hasta **10 MB** en origen. No se admite cámara ni PDF en esta versión (ver P-7.2).
- Antes de subirla, la imagen se optimiza en el dispositivo conservando la legibilidad del texto (parámetros en `plan.md`). La optimización es transparente para el cliente.
- Campos opcionales:
  - **Referencia de la operación:** hasta 60 caracteres (por ejemplo, folio o clave de rastreo).
  - **Nota:** hasta 300 caracteres.
- El cliente ve una vista previa de la imagen elegida antes de confirmar el envío con el botón «Enviar comprobante».
- Al enviarse con éxito, el estado de pago cambia a «Comprobante en revisión», se registra la fecha de envío y el comprobante queda visible para el artista.
- Si la subida falla, el sistema no cambia el estado de pago, no deja archivos ni registros huérfanos y muestra el error.
- El permiso de galería se pide solo al pulsar «Subir comprobante», con el mensaje de la sección 7.

**Criterios de aceptación**

**Escenario 7.5 — Subida exitosa de comprobante**
- **Given** un cliente autenticado en el detalle de su comisión `EN_PROGRESO` con estado de pago «Pendiente de pago» y permiso de galería concedido,
- **When** pulsa «Subir comprobante», elige una captura de su transferencia, escribe la referencia «ABC123» y pulsa «Enviar comprobante»,
- **Then** el sistema optimiza y sube la imagen, cambia el estado de pago a «Comprobante en revisión», muestra el mensaje «Comprobante enviado. El artista lo revisará pronto» y la sección muestra el badge «Comprobante en revisión» con la vista previa del comprobante enviado.

**Escenario 7.6 — Subida sin campos opcionales**
- **Given** un cliente autenticado en el flujo de subida de comprobante con una imagen seleccionada,
- **When** deja vacías la referencia y la nota y pulsa «Enviar comprobante»,
- **Then** el sistema registra el comprobante sin referencia ni nota y el estado de pago pasa a «Comprobante en revisión».

**Escenario 7.7 — Permiso de galería denegado al subir comprobante**
- **Given** un cliente autenticado que pulsa «Subir comprobante» y Android muestra el diálogo de permiso de galería,
- **When** el cliente deniega el permiso,
- **Then** el sistema no abre el selector, mantiene al cliente en el detalle de la comisión, conserva el estado de pago y muestra el mensaje «No se puede acceder a la galería. Puedes habilitarlo en los ajustes de tu dispositivo».

**Escenario 7.8 — Archivo no permitido**
- **Given** un cliente autenticado en el flujo de subida de comprobante,
- **When** selecciona una imagen de más de 10 MB o en un formato distinto de JPG, PNG o WEBP,
- **Then** el sistema no la sube, conserva el estado de pago y muestra el mensaje «Formato o tamaño no permitido».

**Escenario 7.9 — Fallo de red durante la subida**
- **Given** un cliente autenticado que confirmó el envío de su comprobante,
- **When** la conexión se pierde antes de que termine la operación,
- **Then** el sistema no cambia el estado de pago, no deja archivos huérfanos y muestra el mensaje «No se pudo subir el comprobante, inténtalo de nuevo».

**Escenario 7.10 — Intento de subir comprobante cuando ya está en revisión o pagado**
- **Given** un cliente autenticado cuya comisión tiene estado de pago «Comprobante en revisión» o «Pagado»,
- **When** intenta subir un comprobante por cualquier medio,
- **Then** el sistema rechaza la operación, conserva el estado de pago y, si la acción se origina en la app, muestra el mensaje «No puedes subir un comprobante en este momento».

**Escenario 7.11 — Tercero o artista intenta subir comprobante**
- **Given** un usuario autenticado que no es el cliente de la comisión (incluido el propio artista),
- **When** intenta subir un comprobante a esa comisión por cualquier medio,
- **Then** el sistema deniega la operación y no almacena ningún archivo ni modifica datos.

**Escenario 7.12 — Referencia o nota demasiado largas**
- **Given** un cliente autenticado en el flujo de subida de comprobante,
- **When** escribe más de 60 caracteres en la referencia o más de 300 en la nota e intenta enviar,
- **Then** el sistema no envía el comprobante y muestra, según el campo, «La referencia no puede superar los 60 caracteres» o «La nota no puede superar los 300 caracteres».

---

### RF-11-B — Confirmación del pago por el artista (Must have)

El sistema debe permitir al artista de la comisión revisar el comprobante enviado y confirmar el pago, cambiando el estado de pago a «Pagado».

**Reglas**

- Solo el artista cuyo `artist_id` coincide con el de la comisión puede confirmar el pago.
- Solo se puede confirmar un pago cuyo estado sea «Comprobante en revisión» en una comisión `EN_PROGRESO`.
- El artista puede abrir el comprobante en pantalla completa con zoom, y ve la referencia, la nota y la fecha de envío.
- El sistema pide confirmación: «¿Confirmas que recibiste el pago completo de esta comisión? Esta acción no se puede deshacer.».
- La confirmación es **irreversible** desde la app (ver P-7.6). Se registra la fecha de verificación.
- Si en ese momento el entregable final ya está subido, la comisión pasa automáticamente a `COMPLETADA` (RF-24-B).
- Si el cambio no puede guardarse, el estado anterior se conserva.

**Criterios de aceptación**

**Escenario 7.13 — Aprobación de pago sin entregable subido**
- **Given** un artista autenticado en el panel de trabajo de su comisión `EN_PROGRESO`, con estado de pago «Comprobante en revisión» y sin entregable final,
- **When** abre el comprobante, pulsa «Confirmar pago» y acepta el diálogo de confirmación,
- **Then** el estado de pago cambia a «Pagado», se registra la fecha de verificación, el sistema muestra «Pago confirmado» y la comisión permanece `EN_PROGRESO`.

**Escenario 7.14 — Aprobación de pago con entregable ya subido**
- **Given** un artista autenticado con una comisión `EN_PROGRESO` en etapa «Color / Acabado final», entregable final subido y estado de pago «Comprobante en revisión»,
- **When** pulsa «Confirmar pago» y acepta la confirmación,
- **Then** el estado de pago cambia a «Pagado», la comisión pasa a `COMPLETADA` y el sistema muestra «Pago confirmado. ¡Comisión finalizada! El cliente ya puede descargar el entregable».

**Escenario 7.15 — Intento de confirmar un pago sin comprobante**
- **Given** un artista autenticado con una comisión cuyo estado de pago es «Pendiente de pago» o «Requiere corrección»,
- **When** intenta confirmar el pago por cualquier medio,
- **Then** el sistema rechaza la operación, conserva el estado y, si se origina en la app, muestra «Este comprobante ya no está en revisión».

**Escenario 7.16 — Fallo al guardar la confirmación**
- **Given** un artista autenticado que confirma un pago en revisión,
- **When** la operación no puede guardarse (por ejemplo, sin conexión),
- **Then** el estado de pago permanece «Comprobante en revisión» y el sistema muestra «No se pudo actualizar el estado del pago».

**Escenario 7.17 — Cliente o tercero intenta confirmar el pago**
- **Given** un usuario autenticado que no es el artista de la comisión (incluido el cliente),
- **When** intenta confirmar el pago por cualquier medio,
- **Then** el sistema deniega la operación y no modifica ningún dato.

---

### RF-15-A — Devolución del comprobante: «Requiere corrección» (Must have)

El sistema debe permitir al artista devolver un comprobante en revisión, registrando un motivo obligatorio visible para el cliente, y dejar el estado de pago en «Requiere corrección».

**Reglas**

- Solo el artista de la comisión puede devolver un comprobante, y solo si el estado de pago es «Comprobante en revisión» en una comisión `EN_PROGRESO`.
- Al pulsar «Requiere corrección» se abre un formulario con el título «¿Qué debe corregir el cliente?».
- El motivo es **obligatorio**: entre 5 y 300 caracteres tras eliminar espacios al inicio y al final.
- El formulario ofrece sugerencias que rellenan el campo de motivo con un toque (el artista puede editarlas): «Comprobante ilegible», «Monto incompleto», «No se recibió el depósito», «Los datos no coinciden con mi cuenta».
- Al guardar, el estado de pago cambia a «Requiere corrección» y el motivo queda visible para el cliente en la sección «Pago y entrega».
- El comprobante devuelto se sigue mostrando al cliente como referencia de lo que envió, junto al motivo.
- Si el cambio no puede guardarse, el estado anterior se conserva.

**Criterios de aceptación**

**Escenario 7.18 — Rechazo de comprobante con motivo**
- **Given** un artista autenticado revisando un comprobante con estado de pago «Comprobante en revisión»,
- **When** pulsa «Requiere corrección», elige la sugerencia «Monto incompleto», la completa con «Faltan $150» y pulsa «Enviar al cliente»,
- **Then** el estado de pago cambia a «Requiere corrección», se guarda el motivo «Monto incompleto. Faltan $150» y el sistema muestra «Se pidió al cliente corregir su comprobante».

**Escenario 7.19 — Rechazo sin motivo**
- **Given** un artista autenticado en el formulario «¿Qué debe corregir el cliente?»,
- **When** deja el motivo vacío (o con menos de 5 caracteres) y pulsa «Enviar al cliente»,
- **Then** el sistema no cambia el estado de pago y muestra «Indica el motivo de la corrección (mínimo 5 caracteres)».

**Escenario 7.20 — Motivo demasiado largo**
- **Given** un artista autenticado en el formulario de corrección,
- **When** escribe más de 300 caracteres en el motivo y pulsa «Enviar al cliente»,
- **Then** el sistema no cambia el estado de pago y muestra «El motivo no puede superar los 300 caracteres».

**Escenario 7.21 — El cliente ve el motivo de corrección**
- **Given** un cliente autenticado cuya comisión tiene estado de pago «Requiere corrección» con el motivo «Comprobante ilegible»,
- **When** abre el detalle de la comisión,
- **Then** la sección «Pago y entrega» muestra el badge «Requiere corrección», el mensaje «El artista pidió corregir tu comprobante», el texto «Motivo: Comprobante ilegible», la miniatura del comprobante devuelto y el botón «Enviar nuevo comprobante».

**Escenario 7.22 — Fallo al guardar la devolución**
- **Given** un artista autenticado que envía una corrección con motivo válido,
- **When** la operación no puede guardarse,
- **Then** el estado de pago permanece «Comprobante en revisión» y el sistema muestra «No se pudo procesar la devolución del comprobante».

---

### RF-20-A — Reenvío del comprobante corregido (Must have)

El sistema debe permitir al cliente subir un nuevo comprobante cuando el estado de pago sea «Requiere corrección».

**Reglas**

- Aplican las mismas reglas de archivo, permisos y campos opcionales de RF-21-A.
- El nuevo comprobante reemplaza al anterior como comprobante vigente; el motivo de corrección anterior deja de mostrarse.
- El estado de pago vuelve a «Comprobante en revisión».
- No se permite reenviar si el comprobante anterior no fue devuelto (estado «Comprobante en revisión» o «Pagado»).
- Si el reenvío falla, el estado permanece «Requiere corrección».

**Criterios de aceptación**

**Escenario 7.23 — Reenvío exitoso**
- **Given** un cliente autenticado con estado de pago «Requiere corrección»,
- **When** pulsa «Enviar nuevo comprobante», elige una imagen válida y pulsa «Enviar comprobante»,
- **Then** el sistema guarda el nuevo comprobante, cambia el estado a «Comprobante en revisión», deja de mostrar el motivo anterior y muestra «Comprobante enviado. El artista lo revisará pronto».

**Escenario 7.24 — Reenvío fallido**
- **Given** un cliente autenticado con estado de pago «Requiere corrección» que confirma el envío de un nuevo comprobante,
- **When** la subida falla,
- **Then** el estado permanece «Requiere corrección», el motivo sigue visible y el sistema muestra «No se pudo subir el comprobante, inténtalo de nuevo».

---

### RF-24-A — Subida del entregable final por el artista (Must have)

El sistema debe permitir al artista de una comisión en su última etapa creativa subir desde su galería la ilustración final en calidad de entrega.

**Reglas**

- Solo el artista de la comisión puede subir el entregable.
- Solo se puede subir si la comisión está en `EN_PROGRESO` **y** su etapa creativa es «Color / Acabado final» (`FINAL`, Spec 004).
- El entregable es **un solo archivo de imagen** (JPG, PNG o WEBP) elegido de la galería.
- **Calidad de entrega:** el sistema conserva el archivo original sin recomprimirlo si pesa como máximo 10 MB y su lado más largo mide como máximo 4096 px. Si excede alguno de esos límites, el sistema lo reduce a 4096 px en su lado más largo con compresión de alta calidad. Si aun así supera 10 MB, la subida se bloquea. (Fundamento de cuota en `plan.md`.)
- Se pide confirmación antes de subir: «¿Subir esta imagen como entregable final? El cliente podrá descargarla cuando el pago esté confirmado.».
- Mientras la comisión no esté `COMPLETADA`, el artista puede **reemplazar** el entregable (botón «Reemplazar entregable», confirmación «¿Reemplazar el entregable actual? El cliente solo podrá descargar la versión más reciente.»). Una vez `COMPLETADA`, el entregable no se puede reemplazar.
- Se registra la fecha de entrega.
- El artista puede ver su propio entregable en cualquier momento.
- Si la subida falla, no se modifica el entregable vigente ni quedan archivos huérfanos.
- El permiso de galería se pide solo al pulsar «Subir entregable final», con el mensaje de la sección 7.

**Criterios de aceptación**

**Escenario 7.25 — Subida del entregable con pago pendiente**
- **Given** un artista autenticado en el panel de trabajo de una comisión `EN_PROGRESO` en etapa «Color / Acabado final», con estado de pago distinto de «Pagado»,
- **When** pulsa «Subir entregable final», elige su ilustración y confirma,
- **Then** el sistema sube el archivo conservando su calidad, registra la fecha de entrega, la comisión permanece `EN_PROGRESO` y se muestra «Entregable subido. Se liberará al cliente cuando confirmes su pago».

**Escenario 7.26 — Subida en etapa no final**
- **Given** un artista autenticado con una comisión `EN_PROGRESO` en etapa «Boceto» o «Delineado»,
- **When** intenta subir el entregable final por cualquier medio,
- **Then** el sistema bloquea la acción y, si se origina en la app, muestra «Solo puedes subir el entregable final en la etapa Color / Acabado final».

**Escenario 7.27 — Archivo demasiado pesado aun optimizado**
- **Given** un artista autenticado en el flujo de subida del entregable,
- **When** elige una imagen que supera 10 MB incluso después de reducirla a 4096 px,
- **Then** el sistema no la sube y muestra «El archivo supera el tamaño máximo de 10 MB incluso después de optimizarlo».

**Escenario 7.28 — Formato no permitido**
- **Given** un artista autenticado en el flujo de subida del entregable,
- **When** elige un archivo que no es JPG, PNG ni WEBP,
- **Then** el sistema no lo sube y muestra «Formato no permitido. Usa una imagen JPG, PNG o WEBP».

**Escenario 7.29 — Fallo de red al subir el entregable**
- **Given** un artista autenticado que confirmó la subida del entregable,
- **When** la conexión se pierde antes de terminar,
- **Then** el entregable vigente (si existía) no cambia, no quedan archivos huérfanos y se muestra «No se pudo subir el entregable. Comprueba tu conexión e inténtalo de nuevo».

**Escenario 7.30 — Cliente o tercero intenta subir un entregable**
- **Given** un usuario autenticado que no es el artista de la comisión,
- **When** intenta subir un entregable por cualquier medio,
- **Then** el sistema deniega la operación y no almacena ningún archivo.

---

### RF-24-B — Cierre automático de la comisión (Must have)

El sistema debe marcar la comisión como `COMPLETADA` («Finalizada») en cuanto se cumplan ambos hitos: estado de pago «Pagado» **y** entregable final subido, sin importar el orden en que ocurran.

**Reglas**

- Si el artista sube el entregable y el pago ya está «Pagado», la comisión pasa a `COMPLETADA` en la misma operación.
- Si el artista confirma el pago y el entregable ya existe, la comisión pasa a `COMPLETADA` en la misma operación.
- Al pasar a `COMPLETADA`, la etapa creativa se limpia (igual que en la Spec 004, P-4.5).
- **Ninguna** comisión puede quedar en `COMPLETADA` sin pago «Pagado» y entregable subido; el sistema lo impide aun ante peticiones manipuladas.
- **Modificación a la Spec 004:** en la etapa «Color / Acabado final» el botón «Completar etapa» deja de cerrar la comisión. En su lugar el panel muestra «Subir entregable final». Si se intenta completar la etapa final por otra vía, el sistema muestra «Sube el entregable final para cerrar la comisión».

**Criterios de aceptación**

**Escenario 7.31 — Cierre al subir entregable con pago verificado**
- **Given** un artista autenticado con una comisión `EN_PROGRESO` en etapa «Color / Acabado final» y estado de pago «Pagado»,
- **When** sube el entregable final y confirma,
- **Then** la comisión pasa a `COMPLETADA`, la etapa se limpia y el sistema muestra «¡Comisión finalizada! El cliente ya puede descargar el entregable».

**Escenario 7.32 — Intento de completar la etapa final sin entregable**
- **Given** un artista autenticado con una comisión `EN_PROGRESO` en etapa «Color / Acabado final» sin entregable subido,
- **When** intenta completar la etapa o marcar la comisión como `COMPLETADA` por cualquier medio,
- **Then** el sistema rechaza la operación, la comisión permanece `EN_PROGRESO` y, si se origina en la app, muestra «Sube el entregable final para cerrar la comisión».

---

### RF-12-A — Bloqueo y desbloqueo del entregable final (Must have)

El sistema debe impedir que el cliente vea o descargue el entregable final mientras el estado de pago no sea «Pagado», y habilitarlo en cuanto lo sea.

**Reglas**

- El bloqueo lo aplica el **servidor**: mientras el estado de pago no sea «Pagado», ninguna petición del cliente (ni de terceros) puede leer el archivo ni obtener un enlace de descarga, aunque conozca su ubicación.
- Antes del desbloqueo el cliente **no ve ninguna versión** del entregable (ni miniatura ni versión reducida). Solo ve el indicador correspondiente.
- El cliente solo puede acceder a la **versión vigente** del entregable; las versiones reemplazadas no son accesibles para él.
- Vista del cliente según la situación:

| Entregable subido | Estado de pago | Lo que ve el cliente |
|---|---|---|
| No | Cualquiera | «El artista aún no ha subido el entregable final» |
| Sí | «Pendiente de pago», «Comprobante en revisión» o «Requiere corrección» | Tarjeta con candado: «Entregable listo — Completa o verifica tu pago para desbloquearlo» |
| Sí | «Pagado» | Vista previa de la ilustración, fecha de entrega, peso del archivo y botón «Guardar en galería» con el mensaje «Tu entregable está listo» |

- Si la consulta del estado o la obtención del enlace falla, el entregable permanece bloqueado.

**Criterios de aceptación**

**Escenario 7.33 — Intento de acceso al entregable antes de verificar el pago**
- **Given** un cliente autenticado cuya comisión tiene el entregable subido y estado de pago «Comprobante en revisión»,
- **When** abre el detalle de la comisión,
- **Then** la sección «Pago y entrega» muestra la tarjeta con candado «Entregable listo — Completa o verifica tu pago para desbloquearlo», no muestra ninguna imagen del entregable y no ofrece el botón «Guardar en galería».

**Escenario 7.34 — Intento de evadir el bloqueo**
- **Given** un cliente autenticado que conoce la ubicación del archivo del entregable de su comisión y cuyo estado de pago no es «Pagado»,
- **When** solicita directamente al servidor el archivo o un enlace de descarga,
- **Then** el servidor deniega la petición, no entrega ningún dato del archivo y, si la app recibe ese rechazo, muestra «La descarga se habilitará cuando el pago esté liquidado».

**Escenario 7.35 — Desbloqueo tras la confirmación del pago**
- **Given** un cliente autenticado con entregable subido y estado de pago «Comprobante en revisión»,
- **When** el artista confirma el pago y el cliente vuelve a abrir (o refresca) el detalle,
- **Then** la sección muestra la vista previa de la ilustración, el mensaje «Tu entregable está listo» y el botón «Guardar en galería», y el badge de la comisión es «Completada».

**Escenario 7.36 — Versión reemplazada no accesible**
- **Given** un artista que reemplazó el entregable de una comisión y un cliente con pago «Pagado»,
- **When** el cliente solicita la versión anterior por cualquier medio,
- **Then** el servidor deniega la petición; solo la versión vigente es accesible.

**Escenario 7.37 — Tercero intenta acceder al entregable**
- **Given** un usuario autenticado que no es el artista ni el cliente de la comisión,
- **When** solicita el entregable por cualquier medio, aun con el pago «Pagado»,
- **Then** el servidor deniega la petición.

---

### RF-12-B — Guardado del entregable en la galería del dispositivo (Must have)

El sistema debe permitir al cliente, una vez desbloqueado el entregable, descargarlo y guardarlo en la galería de su dispositivo Android.

**Reglas**

- El botón «Guardar en galería» solo existe cuando el entregable está desbloqueado (RF-12-A).
- Al pulsarlo, si la app aún no tiene permiso para guardar en la galería, primero muestra una explicación propia con el mensaje de la sección 7 y luego el diálogo de permiso de Android.
- El archivo se descarga con un enlace temporal de corta vida generado en el momento, se guarda en la galería del dispositivo con su calidad original y el archivo temporal se elimina del almacenamiento interno de la app.
- Durante la descarga, el botón muestra el estado «Guardando…» y no puede pulsarse de nuevo.
- Si el permiso se deniega, la app no descarga nada, no se cierra y muestra el mensaje de denegación con la acción «Abrir ajustes».
- El cliente puede guardar el entregable las veces que quiera.
- La descarga no requiere ningún permiso adicional fuera del de guardar en la galería.

**Criterios de aceptación**

**Escenario 7.38 — Guardado exitoso en galería**
- **Given** un cliente autenticado con el entregable desbloqueado y permiso de galería concedido (o que lo concede en el diálogo),
- **When** pulsa «Guardar en galería»,
- **Then** el sistema descarga el archivo, lo guarda en la galería de Android con su calidad original, elimina el archivo temporal y muestra «Ilustración guardada en tu galería».

**Escenario 7.39 — Permiso de almacenamiento denegado en Android**
- **Given** un cliente autenticado con el entregable desbloqueado que pulsa «Guardar en galería» y Android muestra el diálogo de permiso,
- **When** deniega el permiso,
- **Then** el sistema no descarga ni guarda el archivo, mantiene al cliente en el detalle de la comisión con el entregable aún visible y muestra «No se pudo guardar porque no diste permiso de acceso a tu galería. Puedes habilitarlo en los ajustes de tu dispositivo» con el botón «Abrir ajustes».

**Escenario 7.40 — Permiso denegado de forma permanente**
- **Given** un cliente que denegó antes el permiso y Android ya no permite volver a mostrar el diálogo,
- **When** pulsa «Guardar en galería»,
- **Then** el sistema muestra directamente el mensaje de denegación con el botón «Abrir ajustes», que abre los ajustes de la app en Android.

**Escenario 7.41 — Fallo de red durante la descarga**
- **Given** un cliente autenticado con permiso concedido que pulsa «Guardar en galería»,
- **When** la descarga falla por falta de conexión,
- **Then** el sistema no guarda ningún archivo parcial en la galería, elimina cualquier archivo temporal y muestra «No se pudo descargar el entregable. Comprueba tu conexión e inténtalo de nuevo».

**Escenario 7.42 — Sin espacio en el dispositivo**
- **Given** un cliente autenticado cuyo dispositivo no tiene espacio suficiente,
- **When** pulsa «Guardar en galería»,
- **Then** el sistema no guarda el archivo y muestra «No hay espacio suficiente en tu dispositivo para guardar el archivo».

---

## 5. Máquina de estados del pago

```
                ┌───────────────────┐
                │  Pendiente de pago │  ← estado inicial de toda comisión
                │      (UNPAID)      │
                └─────────┬─────────┘
                          │ Cliente envía comprobante (RF-21-A)
                          ▼
                ┌───────────────────────┐
     ┌────────▶│ Comprobante en revisión│
     │          │    (UNDER_REVIEW)      │
     │          └─────┬───────────┬─────┘
     │   Artista pide │           │ Artista confirma
     │   corrección   │           │ pago (RF-11-B)
     │   (RF-15-A)    ▼           ▼
     │   ┌───────────────────┐  ┌──────────────┐
     └───│ Requiere corrección│  │    Pagado     │  (terminal)
 Cliente │ (NEEDS_CORRECTION) │  │  (VERIFIED)   │
 reenvía └───────────────────┘  └──────────────┘
 (RF-20-A)
```

| Desde | Acción | Actor | Hacia | Condición adicional |
|---|---|---|---|---|
| Pendiente de pago | Enviar comprobante | Cliente | Comprobante en revisión | Comisión `EN_PROGRESO` |
| Requiere corrección | Enviar nuevo comprobante | Cliente | Comprobante en revisión | Comisión `EN_PROGRESO` |
| Comprobante en revisión | Confirmar pago | Artista | Pagado | Comisión `EN_PROGRESO` |
| Comprobante en revisión | Pedir corrección (con motivo) | Artista | Requiere corrección | Comisión `EN_PROGRESO`; motivo de 5 a 300 caracteres |

**Etiquetas visibles del estado de pago**

| Código interno | Etiqueta | Mensaje para el cliente | Mensaje para el artista |
|---|---|---|---|
| `UNPAID` | Pendiente de pago | «Aún no has enviado tu comprobante de pago» | «El cliente aún no ha enviado su comprobante de pago» |
| `UNDER_REVIEW` | Comprobante en revisión | «Tu comprobante está en revisión por el artista» | «Revisa el comprobante del cliente» |
| `NEEDS_CORRECTION` | Requiere corrección | «El artista pidió corregir tu comprobante» | «Pediste al cliente corregir su comprobante» |
| `VERIFIED` | Pagado | «Pago verificado por el artista» | «Pago confirmado» |

**Relación con el estado de la comisión (Spec 004), actualizada por esta spec**

```
PENDIENTE ──aceptar──▶ EN_PROGRESO [SKETCH → LINEART → FINAL] ──(Pagado + entregable)──▶ COMPLETADA
```

En `COMPLETADA` el estado de pago es siempre «Pagado» y el entregable existe.

---

## 6. Requerimientos no funcionales

| ID | Aplicación en esta spec | Métrica |
|---|---|---|
| RNF-01 | Subida de comprobante (optimización + envío + registro) | ≤ 10 s en 4G desde «Enviar comprobante» hasta el mensaje de éxito |
| RNF-01 | Confirmar pago / pedir corrección | ≤ 2.0 s desde la confirmación hasta la actualización visible |
| RNF-01 | Subida del entregable final de 10 MB | ≤ 60 s en 4G |
| RNF-01 | Descarga y guardado en galería de un entregable de 10 MB | ≤ 30 s en 4G |
| RNF-04 | Comprobantes, estado de pago y entregable accesibles solo por las partes de la comisión | 100 % de peticiones de terceros reciben 0 filas o error de autorización |
| RNF-SEG-7.1 | Bloqueo del entregable en servidor | 100 % de las peticiones de lectura o enlace del cliente con pago distinto de «Pagado» son rechazadas por el servidor |
| RNF-SEG-7.2 | Integridad del estado de pago | 0 caminos para que el cliente fije el estado; 0 comisiones `COMPLETADA` sin pago «Pagado» y entregable |
| RNF-SEG-7.3 | Enlaces temporales | Enlace de descarga del entregable válido ≤ 60 s; enlace de visualización de comprobante ≤ 5 min |
| RNF-08 | Cobertura de la lógica de transiciones de pago, reglas de bloqueo y validaciones | ≥ 60 % |
| RNF-09 (privacidad) | Los comprobantes contienen datos financieros personales (LFPDPPP) | Sin metadatos EXIF en los archivos subidos; sin datos del comprobante en notificaciones ni en registros de la app |
| Principio 2 | Cuota gratuita de almacenamiento | Comprobante ≤ 1 MB tras optimizar; entregable ≤ 10 MB |
| Principio 4 | Pagos fuera del sistema | Koma no solicita ni almacena datos bancarios, montos pagados ni credenciales de pago |
| Principio 8 | Permisos de galería (lectura al subir, escritura al guardar) solicitados solo al ejecutar la acción, con explicación; la app sigue funcionando si se niegan | Sin excepción |
| Principio 11 | Un solo pago por comisión, un solo entregable vigente, sin PDF ni cámara | Sin excepción |

---

## 7. Permisos de dispositivo

| Permiso | Momento de solicitud | Mensaje previo (propio de Koma) | Si se deniega |
|---|---|---|---|
| Acceso a la galería (lectura) — cliente | Al pulsar «Subir comprobante» o «Enviar nuevo comprobante» | «Koma necesita acceso a tu galería para que puedas seleccionar la captura o foto de tu comprobante de pago.» | «No se puede acceder a la galería. Puedes habilitarlo en los ajustes de tu dispositivo» |
| Acceso a la galería (lectura) — artista | Al pulsar «Subir entregable final» o «Reemplazar entregable» | «Koma necesita acceso a tu galería para que puedas seleccionar la ilustración final de la comisión.» | «No se puede acceder a la galería. Puedes habilitarlo en los ajustes de tu dispositivo» |
| Guardar en la galería (escritura) — cliente | Al pulsar «Guardar en galería» | «Koma necesita permiso para guardar la ilustración final en la galería de tu dispositivo.» | «No se pudo guardar porque no diste permiso de acceso a tu galería. Puedes habilitarlo en los ajustes de tu dispositivo» + botón «Abrir ajustes» |

Ningún permiso se solicita al abrir la app ni al abrir el detalle de la comisión.

---

## 8. Mensajes de UI y errores (literales)

### 8.1 Cliente

| Situación | Comportamiento | Mensaje literal |
|---|---|---|
| Título de la sección | Encabezado | «Pago y entrega» |
| Aviso permanente | Texto informativo | «Koma no procesa pagos. Realiza el pago por el medio que acordaste con el artista y sube aquí tu comprobante.» |
| Monto de referencia | Texto informativo | «Monto de referencia: $[precio] MXN» |
| Comisión no aceptada | Sin acciones | «Podrás subir tu comprobante cuando el artista acepte la comisión» |
| Botón de subida inicial | Acción | «Subir comprobante» |
| Botón de reenvío | Acción | «Enviar nuevo comprobante» |
| Botón de confirmación del envío | Acción | «Enviar comprobante» |
| Campo referencia (placeholder) | Formulario | «Referencia o folio (opcional)» |
| Campo nota (placeholder) | Formulario | «Nota para el artista (opcional)» |
| Comprobante enviado | Toast | «Comprobante enviado. El artista lo revisará pronto» |
| Fallo al subir | Aviso con reintento | «No se pudo subir el comprobante, inténtalo de nuevo» |
| Formato/tamaño inválido | Bloquea la selección | «Formato o tamaño no permitido» |
| Referencia > 60 | Error de campo | «La referencia no puede superar los 60 caracteres» |
| Nota > 300 | Error de campo | «La nota no puede superar los 300 caracteres» |
| Estado no permite subir | Bloquea la acción | «No puedes subir un comprobante en este momento» |
| Pago en revisión | Estado | «Tu comprobante está en revisión por el artista» |
| Requiere corrección | Estado | «El artista pidió corregir tu comprobante» |
| Motivo de corrección | Estado | «Motivo: [motivo]» |
| Pago verificado | Estado | «Pago verificado por el artista» |
| Sin entregable | Estado | «El artista aún no ha subido el entregable final» |
| Entregable bloqueado | Tarjeta con candado | «Entregable listo — Completa o verifica tu pago para desbloquearlo» |
| Entregable desbloqueado | Estado | «Tu entregable está listo» |
| Botón de guardado | Acción | «Guardar en galería» |
| Guardado en curso | Botón deshabilitado | «Guardando…» |
| Guardado exitoso | Toast | «Ilustración guardada en tu galería» |
| Permiso de escritura denegado | Aviso + botón «Abrir ajustes» | «No se pudo guardar porque no diste permiso de acceso a tu galería. Puedes habilitarlo en los ajustes de tu dispositivo» |
| Fallo de descarga | Aviso con reintento | «No se pudo descargar el entregable. Comprueba tu conexión e inténtalo de nuevo» |
| Servidor rechaza la descarga | Mantiene el bloqueo | «La descarga se habilitará cuando el pago esté liquidado» |
| Sin espacio | Aviso | «No hay espacio suficiente en tu dispositivo para guardar el archivo» |

### 8.2 Artista

| Situación | Comportamiento | Mensaje literal |
|---|---|---|
| Sin comprobante | Estado | «El cliente aún no ha enviado su comprobante de pago» |
| Comprobante por revisar | Estado + acciones | «Revisa el comprobante del cliente» |
| Botón aprobar | Acción | «Confirmar pago» |
| Botón devolver | Acción | «Requiere corrección» |
| Diálogo de confirmación de pago | Diálogo | «¿Confirmas que recibiste el pago completo de esta comisión? Esta acción no se puede deshacer.» |
| Pago confirmado | Toast | «Pago confirmado» |
| Pago confirmado y comisión cerrada | Toast | «Pago confirmado. ¡Comisión finalizada! El cliente ya puede descargar el entregable» |
| Fallo al confirmar | Conserva estado | «No se pudo actualizar el estado del pago» |
| Estado cambió / ya revisado | Bloquea la acción | «Este comprobante ya no está en revisión» |
| Título del formulario de corrección | Encabezado | «¿Qué debe corregir el cliente?» |
| Sugerencias de motivo | Chips | «Comprobante ilegible» · «Monto incompleto» · «No se recibió el depósito» · «Los datos no coinciden con mi cuenta» |
| Botón de envío de la corrección | Acción | «Enviar al cliente» |
| Motivo vacío o corto | Error de campo | «Indica el motivo de la corrección (mínimo 5 caracteres)» |
| Motivo > 300 | Error de campo | «El motivo no puede superar los 300 caracteres» |
| Corrección enviada | Toast | «Se pidió al cliente corregir su comprobante» |
| Fallo al devolver | Conserva estado | «No se pudo procesar la devolución del comprobante» |
| Comprobante no carga | Aviso con reintento | «No se pudo cargar el comprobante. Inténtalo de nuevo» |
| Botón de entregable | Acción | «Subir entregable final» |
| Botón de reemplazo | Acción | «Reemplazar entregable» |
| Confirmación de subida | Diálogo | «¿Subir esta imagen como entregable final? El cliente podrá descargarla cuando el pago esté confirmado.» |
| Confirmación de reemplazo | Diálogo | «¿Reemplazar el entregable actual? El cliente solo podrá descargar la versión más reciente.» |
| Entregable subido con pago pendiente | Toast | «Entregable subido. Se liberará al cliente cuando confirmes su pago» |
| Entregable subido y comisión cerrada | Toast | «¡Comisión finalizada! El cliente ya puede descargar el entregable» |
| Etapa no final | Bloquea la acción | «Solo puedes subir el entregable final en la etapa Color / Acabado final» |
| Archivo > 10 MB optimizado | Bloquea la subida | «El archivo supera el tamaño máximo de 10 MB incluso después de optimizarlo» |
| Formato no permitido | Bloquea la subida | «Formato no permitido. Usa una imagen JPG, PNG o WEBP» |
| Fallo de red | Aviso con reintento | «No se pudo subir el entregable. Comprueba tu conexión e inténtalo de nuevo» |
| Completar etapa final sin entregable (Spec 004) | Bloquea la acción | «Sube el entregable final para cerrar la comisión» |

### 8.3 Badges de estado de pago

«Pendiente de pago» · «Comprobante en revisión» · «Requiere corrección» · «Pagado»

---

## 9. Entidades (conceptual)

- **Comisión (ampliada):** además de lo definido en las specs 003 y 004, guarda el estado de pago, el comprobante vigente (ubicación, fecha de envío, referencia y nota opcionales), el motivo de corrección vigente, la fecha de verificación del pago, el entregable vigente (ubicación y peso) y la fecha de entrega.
- **Archivo de comprobante:** imagen optimizada en un almacenamiento privado; legible solo por el artista y el cliente de la comisión.
- **Archivo de entregable:** imagen en calidad de entrega en un almacenamiento privado; legible por el artista siempre y por el cliente solo con pago «Pagado» y solo la versión vigente.

El diseño de tablas, almacenamiento, políticas y contratos va en `plan.md`.

---

## 10. Impacto sobre specs anteriores

| Spec | Cambio |
|---|---|
| 004 | La acción «Completar etapa» en `FINAL` ya no lleva a `COMPLETADA`. El Escenario 4.14 y el mensaje «¡Comisión completada! El cliente será notificado» quedan **reemplazados** por RF-24-B (Escenarios 7.31 y 7.32). El panel de trabajo incorpora la sección «Pago y entrega». |
| 005 | El detalle de seguimiento incorpora la sección «Pago y entrega» (vista del cliente). Las tarjetas de «En curso» muestran además el badge del estado de pago. `COMPLETADA` se sigue agrupando en «Finalizadas». |
| 006 | Sin cambios funcionales. Los avances siguen siendo visibles sin depender del pago. |
| 008 | Los eventos de esta spec (comprobante enviado, pago confirmado, corrección solicitada, entregable listo, comisión finalizada) serán notificados por push en la Spec 008. |

---

## 11. Fuera de alcance de esta spec

- Procesamiento, custodia, reembolso o conciliación de dinero (Principio 4, RC-01).
- Pagos en dos partes (anticipo y saldo) — ver P-7.1.
- Comprobantes en PDF o tomados con la cámara — ver P-7.2.
- Más de un archivo entregable por comisión, archivos fuente (PSD, CLIP) o formatos no imagen.
- Vista previa con marca de agua del entregable antes del pago (RF-23 aplica a avances, no a esta spec).
- Revertir un pago confirmado o reabrir una comisión `COMPLETADA`.
- Disputas o mediación entre artista y cliente.
- Notificaciones push de estos eventos (Spec 008).
- Historial de comisiones finalizadas (Spec 009, RF-13).
- Eliminación automática de comprobantes o entregables antiguos.

---

## 12. Decisiones tomadas

| ID | Tema | Decisión |
|---|---|---|
| P-7.1 | Pago único vs. anticipo + saldo | El SRS v6 (RF-11) distingue «Anticipo pagado» y «Liquidado». Para el MVP se usa **un solo pago por comisión** con cuatro estados. «Pagado» equivale a «Liquidado» del SRS para efectos de RF-12. El esquema de anticipo + saldo se registra como corrección pendiente al SRS y como trabajo post-MVP. |
| P-7.2 | Formato del comprobante | El RI-03 del SRS permite PDF. El stack aprobado (constitución, sección 3) solo incluye selector de imágenes de galería; agregar un selector de documentos requiere enmienda. En el MVP el comprobante es **una imagen** (JPG, PNG o WEBP, máx. 10 MB en origen). |
| P-7.3 | Formato y tamaño del entregable | Resuelve el pendiente del RI-03 para RF-24: imagen JPG, PNG o WEBP de hasta 10 MB y hasta 4096 px en su lado más largo. Se conserva el original si cumple; si no, se optimiza con alta calidad. |
| P-7.4 | Cierre de la comisión | Automático cuando hay pago «Pagado» y entregable subido, en cualquier orden. Evita un paso manual extra y garantiza que «Finalizada» siempre signifique «cobrado y entregado». |
| P-7.5 | Visibilidad previa al pago | El cliente no ve ninguna versión del entregable antes del pago. Es la forma más simple de cumplir RF-12 sin depender de marcas de agua. |
| P-7.6 | Irreversibilidad de «Pagado» | Confirmar el pago no se puede deshacer en la app; por eso se pide confirmación explícita. Simplifica la máquina de estados y protege al cliente de que su acceso sea revocado. |
| P-7.7 | Reemplazo del entregable | Permitido mientras la comisión no esté `COMPLETADA`, para corregir un archivo equivocado. El cliente solo accede a la versión vigente. |
| P-7.8 | Momento del pago | El comprobante solo puede subirse con la comisión `EN_PROGRESO` (aceptada). No tiene sentido pagar algo que el artista aún no acepta. |
| P-7.9 | Confirmar pago sin comprobante | No permitido: el artista solo confirma un comprobante en revisión. Si el cliente pagó por otro medio, sube una captura de ese pago. Mantiene una sola ruta de evidencia. |
| P-7.10 | Motivo de corrección | Obligatorio (5–300 caracteres), con sugerencias editables. Cumple RF-15 del SRS («motivo de devolución obligatorio»). |

---

## 13. Trazabilidad

| Requerimiento de esta spec | Origen SRS v6 / constitución | Estado |
|---|---|---|
| RF-11-A, RF-11-B | RF-11 (Registra el estado del pago) | Adaptado a pago único (P-7.1) |
| RF-12-A, RF-12-B | RF-12 (Desbloquea el entregable final) | Ampliado con guardado nativo en galería |
| RF-15-A | RF-15 (Devuelve el comprobante de pago); corrección #7 | Implementado con estado «Requiere corrección» |
| RF-20-A | RF-20 (Reenvía el comprobante corregido) | Implementado |
| RF-21-A | RF-21 (Sube el comprobante de pago); corrección #6 | Implementado; solo imagen (P-7.2) |
| RF-24-A, RF-24-B | RF-24 (Subir archivo final); corrección #6 | Implementado; formato definido (P-7.3) |
| Correcciones al SRS a reportar | Constitución, sección 8 | P-7.1 (anticipo/saldo) y P-7.2 (PDF) deben reflejarse en el SRS v7 |

---

## 14. Checklist de aceptación

- [ ] Toda comisión nueva tiene estado de pago «Pendiente de pago».
- [ ] El cliente solo puede subir un comprobante con la comisión `EN_PROGRESO` y el pago en «Pendiente de pago» o «Requiere corrección».
- [ ] Subir un comprobante lleva el pago a «Comprobante en revisión»; el cliente no puede fijar ningún otro estado.
- [ ] El artista puede confirmar el pago (irreversible, con confirmación) o pedir corrección con motivo obligatorio de 5–300 caracteres.
- [ ] El cliente ve el motivo de corrección y puede reenviar un comprobante.
- [ ] El artista solo puede subir el entregable en `EN_PROGRESO` + etapa `FINAL`; puede reemplazarlo hasta que la comisión se cierre.
- [ ] El entregable se conserva sin recompresión si cumple ≤ 10 MB y ≤ 4096 px.
- [ ] La comisión pasa a `COMPLETADA` automáticamente al cumplirse pago «Pagado» + entregable, y nunca sin ellos.
- [ ] El servidor rechaza la lectura y los enlaces del entregable para el cliente mientras el pago no sea «Pagado» (prueba de acceso denegado).
- [ ] El cliente no ve ninguna versión del entregable antes del desbloqueo; ve la tarjeta con candado.
- [ ] «Guardar en galería» descarga con enlace temporal, guarda en la galería de Android y borra el temporal.
- [ ] Los permisos de galería (lectura y escritura) se piden solo al ejecutar la acción, con el mensaje de la sección 7; la app sigue usable si se niegan.
- [ ] Un tercero no puede leer el estado de pago, el comprobante ni el entregable (pruebas de acceso denegado).
- [ ] Todos los mensajes de la sección 8 aparecen con el texto exacto.
- [ ] `expo lint` y `tsc` dan 0 errores.
- [ ] Cobertura ≥ 60 % en la lógica de transiciones de pago, bloqueo y validaciones.
