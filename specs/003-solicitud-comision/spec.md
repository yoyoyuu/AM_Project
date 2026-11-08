# Spec 003 — Solicitud de comisión

**Estado:** Borrador · **Versión:** 0.1 · **Fecha:** 2026-11-05
**Prioridad:** Must have
**Constitución:** v1.1
**Depende de:** Spec 001 (cuenta y perfiles), Spec 002 (catálogo de servicios y TOS)

> Esta spec describe **qué** debe hacer el sistema y **por qué**. Las decisiones de tecnología van en `plan.md`.

---

## 1. Contexto y objetivo

Cuando un cliente encuentra el perfil de un artista, necesita un camino claro y seguro para formalizar su encargo: seleccionar el tipo de servicio, conocer y aceptar las condiciones de trabajo del artista, describir lo que quiere, y adjuntar imágenes de referencia para que el artista entienda exactamente qué se le pide.

Sin este flujo, la solicitud queda en mensajes de texto no estructurados fuera de la app, lo que genera malentendidos, referencias perdidas y litigios sobre lo acordado.

**Objetivo:** que un cliente pueda enviar una solicitud de comisión formal —con descripción, referencias visuales y aceptación explícita de los TOS del artista— y que el sistema la registre con estado inicial `PENDIENTE` para que el artista la revise. La solicitud queda inmutable tras su envío; el artista la acepta o rechaza en la spec 004.

---

## 2. Historias de usuario

- **HU-3.1.** Como cliente, quiero seleccionar un servicio activo del catálogo de un artista para iniciar la solicitud con el tipo de comisión que deseo.
- **HU-3.2.** Como cliente, quiero leer los términos de servicio del artista y aceptarlos explícitamente antes de enviar mi solicitud, para que ambas partes queden protegidas.
- **HU-3.3.** Como cliente, quiero describir con detalle mi encargo —personaje, pose, elementos clave, uso previsto y notas adicionales— para que el artista entienda exactamente qué necesito.
- **HU-3.4.** Como cliente, quiero adjuntar imágenes de referencia desde mi galería para que el artista vea visualmente lo que tengo en mente.
- **HU-3.5.** Como cliente, quiero ver el costo base y el tiempo estimado del servicio que seleccioné, para saber qué esperar antes de enviar la solicitud.
- **HU-3.6.** Como cliente, quiero que el sistema me impida pedirme comisiones a mí mismo, para evitar confusiones si también soy artista.

---

## 3. Requerimientos funcionales

### RF-06 — Envía una solicitud de comisión (Must have)

El sistema deberá permitir a un cliente seleccionar un servicio activo de un artista, leer y aceptar los TOS del artista, completar el formulario de solicitud y enviar el encargo. El sistema registrará la solicitud con estado `PENDIENTE`.

**Reglas**

- Solo los usuarios autenticados pueden enviar solicitudes.
- El cliente no puede enviar una solicitud a su propio perfil de artista. Si el `artist_id` coincide con el `client_id`, el sistema bloquea la acción antes de mostrar el formulario.
- Solo se puede solicitar un servicio en estado `active`. Un servicio en estado `paused` no admite nuevas solicitudes.
- **Aceptación de TOS:** si el artista tiene TOS publicados, el cliente debe marcar explícitamente la casilla "He leído y acepto los términos de servicio" antes de poder enviar. Si el artista no tiene TOS, el paso se omite (la casilla no aparece). La fecha y hora de la aceptación se registra en la comisión (`terms_accepted_at`).
- **Campos del formulario de solicitud:**
  - **Descripción del encargo** (obligatoria): entre 20 y 2 000 caracteres. Debe incluir descripción del personaje o concepto.
  - **Pose o composición** (opcional): hasta 500 caracteres.
  - **Elementos clave** (opcional): hasta 500 caracteres. Objetos, colores, detalles importantes.
  - **Uso previsto** (obligatorio): selección entre `personal` o `comercial`.
  - **Notas adicionales** (opcional): hasta 500 caracteres.
- El sistema muestra, de forma no editable, el **precio base** y el **tiempo estimado de entrega** del servicio seleccionado antes de enviar.
- Una vez enviada, la solicitud no puede editarse. El estado inicial es siempre `PENDIENTE`.
- Una misma cuenta puede tener múltiples solicitudes simultáneas al mismo artista, siempre que sean de servicios distintos o en momentos distintos (no hay límite por pares cliente-artista en esta versión).

**Criterios de aceptación (Given / When / Then)**

**Escenario 3.1 — Solicitud exitosa con TOS**
- **Given** un usuario autenticado en el perfil de un artista distinto a él mismo, con al menos un servicio activo y TOS publicado,
- **When** selecciona un servicio activo, lee el TOS, marca la casilla de aceptación, completa todos los campos obligatorios y presiona "Enviar solicitud",
- **Then** el sistema registra la comisión con estado `PENDIENTE`, guarda la fecha de aceptación del TOS, presenta la pantalla de confirmación con el mensaje "Tu solicitud fue enviada. El artista la revisará pronto" y la solicitud aparece en el historial del cliente.

**Escenario 3.2 — Solicitud exitosa sin TOS del artista**
- **Given** un usuario autenticado en el perfil de un artista distinto a él mismo, con al menos un servicio activo y sin TOS publicado,
- **When** selecciona un servicio activo, completa todos los campos obligatorios y presiona "Enviar solicitud",
- **Then** el sistema registra la comisión con estado `PENDIENTE` y `terms_accepted_at` como nulo, y presenta la pantalla de confirmación con el mensaje "Tu solicitud fue enviada. El artista la revisará pronto".

**Escenario 3.3 — Intento de solicitud a sí mismo**
- **Given** un usuario autenticado con perfil de artista activo que entra a su propio perfil como si fuera un visitante,
- **When** intenta iniciar una solicitud sobre cualquier servicio de su propio catálogo,
- **Then** el sistema no muestra el botón de solicitar (o lo deshabilita con una nota) y muestra el mensaje "No puedes enviarte una solicitud a ti mismo".

**Escenario 3.4 — TOS no aceptado**
- **Given** un usuario autenticado en el formulario de solicitud de un artista que tiene TOS,
- **When** completa todos los campos obligatorios pero no marca la casilla de aceptación de TOS y presiona "Enviar solicitud",
- **Then** el sistema no envía la solicitud y muestra el mensaje "Debes aceptar los términos de servicio del artista para continuar".

**Escenario 3.5 — Descripción demasiado corta**
- **Given** un usuario autenticado en el formulario de solicitud,
- **When** escribe menos de 20 caracteres en la descripción y presiona "Enviar solicitud",
- **Then** el sistema no envía la solicitud y muestra el mensaje "La descripción debe tener al menos 20 caracteres".

**Escenario 3.6 — Uso previsto no seleccionado**
- **Given** un usuario autenticado en el formulario de solicitud,
- **When** no selecciona el uso previsto (personal o comercial) y presiona "Enviar solicitud",
- **Then** el sistema no envía la solicitud y muestra el mensaje "Indica el uso previsto de la comisión".

**Escenario 3.7 — Fallo de red al enviar**
- **Given** un usuario autenticado con el formulario de solicitud completado correctamente,
- **When** presiona "Enviar solicitud" y la conexión falla antes de que el servidor confirme,
- **Then** el sistema no envía la solicitud, conserva todos los datos ingresados en el formulario y muestra el mensaje "No se pudo enviar la solicitud, comprueba tu conexión e inténtalo de nuevo".

**Escenario 3.8 — Servicio pausado (acceso directo por ruta)**
- **Given** un usuario autenticado que accede a la pantalla de solicitud con un `service_id` de un servicio en estado `paused`,
- **When** el sistema verifica el estado del servicio,
- **Then** el sistema no muestra el formulario y muestra el mensaje "Este servicio no está disponible en este momento".

---

### RF-14 — Gestiona imágenes de referencia (Must have)

El sistema deberá permitir al cliente seleccionar imágenes desde la galería de su dispositivo, comprimirlas en el cliente y subirlas de forma segura al backend como adjuntos de la solicitud.

**Reglas**

- El cliente puede adjuntar entre **0 y 5 imágenes** de referencia por solicitud.
- Los **formatos aceptados** son JPEG, JPG y PNG.
- El **tamaño máximo** por imagen antes de compresión es de **10 MB**.
- Antes de acceder a la galería, el sistema solicita el permiso de lectura de medios con el mensaje: "Koma necesita acceso a tu galería para adjuntar referencias. Puedes cambiar esto en Ajustes del sistema en cualquier momento."
- Si el usuario deniega el permiso, la app no se rompe: el botón de adjuntar referencias queda visible pero deshabilitado y muestra el mensaje "Permiso de galería denegado. Puedes habilitarlo en Ajustes del sistema".
- Tras la selección, el sistema comprime cada imagen en el cliente (antes de subirla) para reducir el tamaño y el consumo de cuota de almacenamiento.
- Cada imagen se sube al bucket privado `commission-references`. Las imágenes no son públicas; solo el cliente y el artista de esa comisión pueden acceder a ellas.
- Si una imagen supera 10 MB antes de compresión, el sistema la rechaza sin subirla y muestra el mensaje "La imagen supera el tamaño máximo permitido de 10 MB".
- Si el formato no es JPEG, JPG o PNG, el sistema la rechaza y muestra el mensaje "Solo se aceptan imágenes en formato JPEG o PNG".
- El cliente puede eliminar una imagen seleccionada antes de enviar la solicitud.
- Una vez enviada la solicitud, las imágenes ya no pueden modificarse.

**Criterios de aceptación (Given / When / Then)**

**Escenario 3.9 — Selección y subida exitosa de referencias**
- **Given** un usuario autenticado en el formulario de solicitud con permiso de galería concedido,
- **When** toca "Agregar referencia", selecciona entre 1 y 5 imágenes JPEG o PNG de menos de 10 MB cada una,
- **Then** el sistema muestra las miniaturas de las imágenes seleccionadas en el formulario y las sube al bucket privado al momento de enviar la solicitud. Los registros en `commission_references` se crean asociados a la comisión.

**Escenario 3.10 — Permiso de galería denegado**
- **Given** un usuario autenticado en el formulario de solicitud que ha denegado el permiso de galería,
- **When** toca "Agregar referencia",
- **Then** el sistema no abre la galería, muestra el mensaje "Permiso de galería denegado. Puedes habilitarlo en Ajustes del sistema" y el resto del formulario sigue operable.

**Escenario 3.11 — Imagen con tamaño excedido**
- **Given** un usuario autenticado en el formulario de solicitud con permiso de galería concedido,
- **When** selecciona una imagen que supera los 10 MB,
- **Then** el sistema rechaza solo esa imagen, muestra el mensaje "La imagen supera el tamaño máximo permitido de 10 MB" y el resto de las imágenes seleccionadas permanece.

**Escenario 3.12 — Formato de imagen no soportado**
- **Given** un usuario autenticado en el formulario de solicitud con permiso de galería concedido,
- **When** selecciona una imagen en formato no soportado (por ejemplo, WEBP o GIF),
- **Then** el sistema rechaza solo esa imagen y muestra el mensaje "Solo se aceptan imágenes en formato JPEG o PNG".

**Escenario 3.13 — Límite de 5 imágenes alcanzado**
- **Given** un usuario autenticado en el formulario de solicitud que ya tiene 5 imágenes seleccionadas,
- **When** intenta agregar una imagen más,
- **Then** el sistema no abre el selector de imágenes y muestra el mensaje "Solo puedes adjuntar hasta 5 imágenes de referencia".

**Escenario 3.14 — Fallo de red al subir imagen**
- **Given** un usuario autenticado que envía la solicitud con imágenes adjuntas y la conexión falla durante la subida,
- **When** el sistema no puede completar la carga de al menos una imagen,
- **Then** el sistema no crea la comisión, mantiene todos los datos del formulario, y muestra el mensaje "No se pudo subir una o más imágenes. Comprueba tu conexión e inténtalo de nuevo".

**Escenario 3.15 — Eliminar imagen antes de enviar**
- **Given** un usuario autenticado en el formulario de solicitud con al menos una imagen seleccionada,
- **When** toca el botón de eliminar sobre una miniatura,
- **Then** la imagen se elimina de la vista previa y no se incluye en la solicitud. El resto permanece.

---

## 4. Errores y mensajes

| Situación | Comportamiento | Mensaje literal |
|---|---|---|
| Solicitud a sí mismo | Bloquea antes del formulario | "No puedes enviarte una solicitud a ti mismo" |
| TOS no aceptado | No envía | "Debes aceptar los términos de servicio del artista para continuar" |
| Descripción vacía o menor a 20 caracteres | No envía; marca el campo | "La descripción debe tener al menos 20 caracteres" |
| Descripción mayor a 2 000 caracteres | No envía | "La descripción no puede superar los 2 000 caracteres" |
| Uso previsto no seleccionado | No envía; marca el campo | "Indica el uso previsto de la comisión" |
| Pose / elementos / notas superan 500 caracteres | No envía | "Este campo no puede superar los 500 caracteres" |
| Servicio pausado o no disponible | No muestra formulario | "Este servicio no está disponible en este momento" |
| Permiso de galería denegado | Deshabilita adjuntos | "Permiso de galería denegado. Puedes habilitarlo en Ajustes del sistema" |
| Imagen supera 10 MB | Rechaza esa imagen | "La imagen supera el tamaño máximo permitido de 10 MB" |
| Formato de imagen no soportado | Rechaza esa imagen | "Solo se aceptan imágenes en formato JPEG o PNG" |
| Más de 5 imágenes | Bloquea la selección | "Solo puedes adjuntar hasta 5 imágenes de referencia" |
| Fallo de red al subir imagen | No crea la comisión | "No se pudo subir una o más imágenes. Comprueba tu conexión e inténtalo de nuevo" |
| Fallo de red al enviar el formulario | No envía | "No se pudo enviar la solicitud, comprueba tu conexión e inténtalo de nuevo" |
| Envío exitoso | Pantalla de confirmación | "Tu solicitud fue enviada. El artista la revisará pronto" |

---

## 5. Requerimientos no funcionales aplicables

| ID | Aplicación en esta spec | Métrica |
|---|---|---|
| RNF-01 | Envío del formulario y confirmación | ≤ 2.0 s sin incluir el tiempo de subida de imágenes |
| RNF-04 | Acceso a la solicitud y a las referencias solo por cliente y artista | 100 % de peticiones sin sesión válida reciben 401/403 |
| RNF-08 | Cobertura de pruebas en la lógica de solicitud y compresión | ≥ 60 % |
| RC-01 | El precio mostrado es solo referencia | El formulario no procesa ningún pago |
| RI-04 | Toda comunicación por HTTPS | Sin tráfico HTTP |
| Principio 8 | Permiso de galería con mensaje claro; app funcional si se deniega | El formulario es operable sin permiso de galería |

**Adicionales propuestos:**
- Las imágenes de referencia no deben ser accesibles públicamente; solo cliente y artista de la comisión pueden obtener una URL firmada para verlas.
- El flujo de compresión debe ejecutarse en el hilo principal pero sin bloquear la UI: el botón de enviar muestra un indicador de carga mientras se procesa.
- Los datos del formulario deben persistir si el usuario sale de la pantalla accidentalmente y regresa (dentro de la misma sesión de la app).

---

## 6. Entidades (conceptual)

- **Comisión:** vincula a un cliente, un artista y un servicio. Tiene estado (`PENDIENTE`, `ACEPTADA`, `RECHAZADA`, ...), descripción, uso previsto, campos opcionales, fecha de aceptación del TOS y fecha de creación. El estado inicial siempre es `PENDIENTE`.
- **Referencia de comisión:** imagen adjuntada a una comisión por el cliente. Tiene un identificador de ruta en el storage y el tamaño del archivo.

El diseño de tablas, políticas RLS y contratos TypeScript van en `plan.md`.

---

## 7. Fuera de alcance de esta spec

- Aceptar o rechazar la solicitud (spec 004).
- Cambios de estado posteriores a `PENDIENTE` (spec 004).
- Notificaciones push al artista cuando llega una nueva solicitud (spec 008).
- Captura de fotos en tiempo real con la cámara (solo galería en esta versión).
- Visualización de las referencias por parte del artista (spec 004).
- Historial de solicitudes del cliente (spec 005).
- Cupos máximos de comisiones simultáneas del artista (spec 009).
- Cancelación de la solicitud por el cliente (post-MVP).
- Adjuntar documentos que no sean imágenes (post-MVP).

---

## 8. Decisiones tomadas

| ID | Tema | Decisión |
|---|---|---|
| P-3.1 | Compresión de imágenes | **En el cliente**, antes de subir. Reduce el consumo de cuota de Supabase Storage gratuita y acelera la subida en redes móviles. |
| P-3.2 | Límite de imágenes | **5 por solicitud**. Equilibra la capacidad de referencia del cliente con el costo de almacenamiento. |
| P-3.3 | Formato aceptado | Solo **JPEG y PNG**. Son los formatos más comunes en galerías de Android y los que `expo-image-manipulator` soporta con compresión fiable. WEBP se omite para simplificar la validación. |
| P-3.4 | Tamaño máximo | **10 MB antes de compresión**. Tras compresión, el archivo resultante es significativamente menor. El límite protege el plan gratuito de Supabase Storage. |
| P-3.5 | Estado inicial de la comisión | `PENDIENTE`. El artista decide en la spec 004. No existe estado `BORRADOR` para simplificar el flujo. |
| P-3.6 | Inmutabilidad tras el envío | La solicitud no puede editarse una vez enviada. Si el cliente quiere cambiar algo, debe cancelar (post-MVP) y crear una nueva. Simplifica la gestión del artista. |
| P-3.7 | Bloqueo de auto-solicitud | Se verifica comparando el `user_id` del cliente autenticado con el `user_id` del propietario del perfil de artista. Se bloquea tanto en cliente como en la política RLS del servidor. |
| P-3.8 | Bucket de storage | Privado (`commission-references`). Las URLs de las imágenes nunca son públicas; se generan URLs firmadas con expiración para visualizarlas. |

---

## 9. Trazabilidad

| Requerimiento | Origen SRS | Estado |
|---|---|---|
| RF-06 (solicitud de comisión) | RF-06 del SRS v4.0 | Ampliado y detallado |
| RF-14 (imágenes de referencia) | RF-14 del SRS v4.0 | Ampliado y detallado |

---

## 10. Checklist de aceptación

- [ ] Todos los escenarios Given/When/Then de RF-06 y RF-14 pasan.
- [ ] Todos los mensajes de error de la sección 4 están cubiertos por una prueba con el texto exacto.
- [ ] Un usuario no puede enviar una solicitud a su propio perfil de artista (bloqueado en cliente y en RLS).
- [ ] Un servicio en estado `paused` no admite nuevas solicitudes.
- [ ] Si el artista tiene TOS, la solicitud no puede enviarse sin aceptarlo.
- [ ] Si el artista no tiene TOS, la casilla no aparece y la solicitud se envía sin `terms_accepted_at`.
- [ ] Las imágenes de referencia solo son accesibles por cliente y artista de la comisión (URL firmada).
- [ ] La app no se rompe si el permiso de galería es denegado.
- [ ] `expo lint` y `tsc` dan 0 errores.
- [ ] Cobertura ≥ 60 % en la lógica de formulario, validación y compresión.
- [ ] Las políticas RLS tienen prueba de acceso denegado en `supabase/tests/`.
- [ ] Las preguntas P-3.1 a P-3.8 están resueltas (sección 8).