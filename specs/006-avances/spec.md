# Spec 006 — Subida y Visualización de Avances (`006-avances`)

**Estado:** Borrador · **Versión:** 0.1 · **Fecha:** 2026-11-18
**Prioridad:** Must have
**Constitución:** v1.1
**Depende de:** Spec 001 (cuenta y perfiles), Spec 003 (solicitud de comisión), Spec 004 (gestión de comisión), Spec 005 (seguimiento del cliente)

> Esta spec describe **qué** debe hacer el sistema y **por qué**. Las decisiones de tecnología van en `plan.md`.

---

## 1. Contexto y objetivo

Cuando un artista acepta una comisión y comienza a trabajar en ella, el cliente no tiene visibilidad sobre el progreso concreto del dibujo. El artista puede cambiar de etapa creativa (Spec 004), pero eso solo indica en qué fase del proceso está, no cómo va luciendo el trabajo real. Esta falta de evidencia visual genera ansiedad en el cliente, mensajes de seguimiento innecesarios al artista y una percepción de falta de transparencia en el proceso.

Los avances (*Work in Progress*, WIP) son imágenes intermedias que el artista comparte con el cliente para demostrar el progreso real del encargo, alineado con la etapa creativa activa. Compartir avances construye confianza, reduce la fricción y sirve como registro cronológico del proceso creativo.

**Objetivo:** que el artista pueda adjuntar imágenes de progreso desde su dispositivo a una comisión activa, vinculadas a la etapa creativa en curso, y que tanto el artista como el cliente puedan consultar el historial cronológico de esos avances dentro del detalle de la comisión. Las imágenes se optimizan antes de subirse para proteger el almacenamiento gratuito.

---

## 2. Historias de usuario

- **HU-6.1.** Como artista, quiero seleccionar una o más imágenes de mi galería y adjuntarlas como avance de una comisión activa, para que mi cliente pueda ver el progreso real del encargo.
- **HU-6.2.** Como artista, quiero que el avance quede vinculado automáticamente a la etapa creativa en la que estoy trabajando (boceto, delineado o color), para que el historial refleje a qué fase del proceso corresponde cada imagen.
- **HU-6.3.** Como artista, quiero poder agregar una nota breve y opcional al avance (por ejemplo, comentarios sobre el boceto o ajustes que planeo hacer), para darle contexto al cliente sin necesidad de mensajes externos.
- **HU-6.4.** Como artista, quiero que la app me pida permiso para acceder a mi galería solo cuando voy a adjuntar un avance, con una explicación clara del motivo, y que si lo niego la app no quede inutilizable.
- **HU-6.5.** Como artista, quiero que el sistema me impida subir avances en comisiones que no están activas (pendientes, rechazadas, canceladas o completadas), para evitar cargar imágenes en el estado equivocado.
- **HU-6.6.** Como artista, quiero ver el historial de todos los avances que he subido a una comisión, en orden cronológico, para revisar mi propio registro del proceso.
- **HU-6.7.** Como cliente, quiero ver el historial cronológico de los avances que el artista ha subido a mi comisión, incluyendo la imagen, la etapa creativa a la que corresponde, la nota del artista (si existe) y la fecha de subida, para seguir el progreso visual del encargo.
- **HU-6.8.** Como cliente, quiero que los avances estén integrados en el detalle de mi comisión (el mismo tablero de seguimiento de la Spec 005), para no tener que buscarlos en un lugar separado.

---

## 3. Requerimientos funcionales

### RF-09-A — Subida de avance por el artista (Must have)

El sistema deberá permitir al artista propietario de una comisión en estado `EN_PROGRESO` adjuntar una o más imágenes de progreso, vinculadas a la etapa creativa activa.

**Reglas**

- Solo el artista cuyo `artist_id` coincide con el de la comisión puede subir avances.
- Solo se puede subir un avance si la comisión está en estado `EN_PROGRESO`. Los estados `PENDIENTE`, `RECHAZADA`, `CANCELADA` y `COMPLETADA` bloquean la acción.
- El artista selecciona las imágenes desde la galería de su dispositivo Android. No se permite captura directa con la cámara en esta spec.
- Se puede adjuntar **de una a tres imágenes por avance**. No se permite subir un avance sin al menos una imagen.
- **Compresión obligatoria:** antes de subir, cada imagen se redimensiona y comprime en el dispositivo para reducir su peso (parámetros en `plan.md`). Esta optimización es transparente para el artista; no requiere acción adicional de su parte.
- El artista puede agregar una **nota de texto opcional** de hasta 300 caracteres junto al avance.
- El avance queda vinculado automáticamente a la `current_stage` de la comisión en el momento de la subida.
- Si la subida de alguna imagen falla (error de red u otro), el sistema informa el error sin dejar registros huérfanos en la base de datos.

**Criterios de aceptación**

**Escenario 6.1 — Subida exitosa de un avance con imagen y nota**
- **Given** un artista autenticado en el panel de trabajo de una comisión en estado `EN_PROGRESO` (etapa `SKETCH`),
- **When** presiona "Agregar avance", selecciona una imagen desde la galería, escribe una nota y confirma la subida,
- **Then** el sistema comprime la imagen, la sube al almacenamiento, registra el avance vinculado a la etapa `SKETCH` y muestra el mensaje "Avance subido correctamente"; el nuevo avance aparece al inicio del historial de la comisión.

**Escenario 6.2 — Subida exitosa de un avance sin nota**
- **Given** un artista autenticado en el panel de trabajo de una comisión en estado `EN_PROGRESO`,
- **When** presiona "Agregar avance", selecciona una imagen y confirma sin escribir nota,
- **Then** el sistema registra el avance sin nota y muestra el mensaje "Avance subido correctamente".

**Escenario 6.3 — Permiso de galería denegado**
- **Given** un artista autenticado que presiona "Agregar avance" y el sistema operativo Android muestra el diálogo de permiso de acceso a la galería,
- **When** el artista deniega el permiso,
- **Then** el sistema no sube ninguna imagen, no cierra la pantalla del panel de trabajo y muestra el mensaje "No se puede acceder a la galería. Puedes habilitarlo en los ajustes de tu dispositivo".

**Escenario 6.4 — Intento de subida en comisión no activa**
- **Given** un artista autenticado que tiene acceso a una comisión en estado `COMPLETADA`, `PENDIENTE`, `RECHAZADA` o `CANCELADA`,
- **When** intenta ejecutar la acción de subir un avance,
- **Then** el sistema bloquea la acción y muestra el mensaje "No puedes subir avances en una comisión que no está en progreso".

**Escenario 6.5 — Fallo de red durante la carga**
- **Given** un artista autenticado que ha seleccionado una imagen y confirma la subida, pero pierde la conexión antes de que esta finalice,
- **When** la operación de subida falla por error de red,
- **Then** el sistema no registra ningún avance incompleto, no deja archivos huérfanos en el almacenamiento y muestra el mensaje "No se pudo subir el avance. Comprueba tu conexión e inténtalo de nuevo".

**Escenario 6.6 — Nota demasiado larga**
- **Given** un artista autenticado en el flujo de subida de avance,
- **When** escribe más de 300 caracteres en el campo de nota e intenta confirmar,
- **Then** el sistema no ejecuta la subida y muestra el mensaje "La nota no puede superar los 300 caracteres".

**Escenario 6.7 — Intento de subida en comisión ajena**
- **Given** un usuario autenticado que no es el artista propietario de la comisión,
- **When** intenta registrar un avance en esa comisión (por cualquier medio),
- **Then** el sistema deniega la operación y no almacena ni registra ningún dato.

---

### RF-09-B — Visualización del historial de avances (Must have)

El sistema deberá mostrar el historial cronológico de los avances de una comisión tanto al artista como al cliente dentro del detalle de la comisión.

**Reglas**

- Solo el artista (`artist_id`) y el cliente (`client_id`) vinculados a la comisión pueden consultar sus avances.
- Los avances se muestran en orden cronológico inverso (el más reciente primero) dentro del detalle de la comisión.
- Cada avance muestra:
  - La imagen (o imágenes, si se adjuntaron varias) como vista previa en miniatura. El usuario puede ampliar cada imagen tocándola.
  - La etiqueta de la etapa creativa a la que corresponde el avance (ej. "Boceto", "Delineado", "Color / Acabado final"), según la tabla de etapas de la Spec 004.
  - La nota del artista, si existe. Si no existe, no se muestra ningún espacio vacío para la nota.
  - La fecha y hora de subida en formato legible (ej. "hace 3 horas", "15 nov · 10:42").
- Si la comisión no tiene ningún avance registrado, se muestra el estado vacío de la sección con el mensaje:
  - Para el artista: "Aún no has subido avances para esta comisión."
  - Para el cliente: "El artista aún no ha compartido avances."
- La sección de avances se integra dentro del detalle de la comisión de la Spec 005 (vista del cliente) y del panel de trabajo de la Spec 004 (vista del artista). No es una pantalla independiente.
- Esta spec cubre únicamente la visualización dentro de la app. La descarga del entregable final en alta resolución y el guardado en galería del dispositivo corresponden a la Spec 007.

**Criterios de aceptación**

**Escenario 6.8 — Cliente visualiza el historial de avances**
- **Given** un cliente autenticado que abre el detalle de su comisión en estado `EN_PROGRESO`, cuyo artista ha subido dos avances en etapas distintas,
- **When** el sistema carga el detalle,
- **Then** la sección de avances muestra las dos entradas en orden cronológico inverso, cada una con su imagen en miniatura, la etiqueta de etapa correspondiente, la nota (si existe) y la fecha de subida.

**Escenario 6.9 — Artista visualiza el historial de avances**
- **Given** un artista autenticado en el panel de trabajo de una comisión con avances registrados,
- **When** el sistema carga el panel,
- **Then** la sección de avances muestra todas las entradas en orden cronológico inverso con imagen, etapa, nota y fecha.

**Escenario 6.10 — Comisión sin avances (vista del cliente)**
- **Given** un cliente autenticado que abre el detalle de una comisión en estado `EN_PROGRESO` sin avances,
- **When** el sistema carga la sección de avances,
- **Then** se muestra el mensaje "El artista aún no ha compartido avances."

**Escenario 6.11 — Comisión sin avances (vista del artista)**
- **Given** un artista autenticado en el panel de trabajo de una comisión sin avances,
- **When** el sistema carga la sección de avances,
- **Then** se muestra el mensaje "Aún no has subido avances para esta comisión."

**Escenario 6.12 — Intento de acceso no autorizado por un tercero**
- **Given** un usuario autenticado que no es ni el artista ni el cliente de la comisión,
- **When** intenta consultar los avances de esa comisión (por cualquier medio),
- **Then** el sistema no devuelve ningún registro (resultado vacío o error de autorización).

---

## 4. Requerimientos no funcionales

| ID | Aplicación en esta spec | Métrica |
|---|---|---|
| RNF-01 | Tiempo de respuesta de la subida completa (compresión + almacenamiento + registro) | ≤ 10 s por imagen en conexión 4G desde el momento de confirmar hasta "Avance subido correctamente" |
| RNF-04 | Acceso a avances solo por las partes involucradas | 100 % de peticiones de terceros reciben 0 filas o error 403 |
| RNF-08 | Cobertura de pruebas en la lógica de validación de subida y políticas RLS | ≥ 60 % en la lógica de validación de estado y permisos |
| Principio 2 | Optimización de peso de archivos antes de subir | Cada imagen comprimida no supera los 300 KB antes de llegar a Storage |
| Principio 5 | RLS en tabla `commission_advances` y bucket `commission-advances` | Sin excepción |
| Principio 8 | Permiso de galería solicitado solo al presionar "Agregar avance", con mensaje explicativo claro; la app funciona si el permiso es denegado | Sin excepción |
| Principio 11 | Solo se construye lo necesario: sin descarga, sin guardado en galería, sin comentarios del cliente en esta spec | Sin excepción |

---

## 5. Permisos de dispositivo

| Permiso | Sistema operativo | Momento de solicitud | Mensaje al usuario |
|---|---|---|---|
| Acceso a la galería de fotos (lectura) | Android | Al presionar "Agregar avance", antes de abrir el selector de imágenes | "Koma necesita acceso a tu galería para que puedas adjuntar imágenes de tus avances." |

Si el usuario deniega el permiso, el sistema muestra el mensaje "No se puede acceder a la galería. Puedes habilitarlo en los ajustes de tu dispositivo" y mantiene al artista en el panel de trabajo. No se requieren permisos adicionales para la subida (ocurre por red, no requiere permiso de almacenamiento de escritura en Android ≥ 10).

---

## 6. Mensajes de UI y errores

| Situación | Comportamiento | Mensaje literal |
|---|---|---|
| Subida completada con éxito | Toast/banner de confirmación | "Avance subido correctamente" |
| Permiso de galería denegado | Aviso en pantalla, no cierra el flujo | "No se puede acceder a la galería. Puedes habilitarlo en los ajustes de tu dispositivo" |
| Subida en comisión no activa | Bloquea la acción | "No puedes subir avances en una comisión que no está en progreso" |
| Fallo de red durante la carga | Aviso con retry | "No se pudo subir el avance. Comprueba tu conexión e inténtalo de nuevo" |
| Nota supera 300 caracteres | Bloquea la subida | "La nota no puede superar los 300 caracteres" |
| Acceso no autorizado | Sistema no devuelve datos | (Sin mensaje de UI; RLS retorna vacío o 403) |
| Sin avances (vista del cliente) | Estado vacío en la sección | "El artista aún no ha compartido avances." |
| Sin avances (vista del artista) | Estado vacío en la sección | "Aún no has subido avances para esta comisión." |

---

## 7. Entidades (conceptual)

- **Avance de comisión (`commission_advance`):** registro que agrupa las imágenes subidas por el artista para una comisión en un momento dado. Contiene la etapa creativa activa al momento de la subida, la nota opcional y una o más referencias a archivos en Storage.
- **Archivo de avance:** imagen individual optimizada, almacenada en el bucket privado `commission-advances`. Referenciada desde el avance con su ruta de Storage, tamaño en bytes e índice de orden dentro del avance.

El diseño detallado de tablas, políticas RLS, bucket y contratos TypeScript va en `plan.md`.

---

## 8. Fuera de alcance de esta spec

- Descarga del entregable final en alta resolución (Spec 007).
- Guardado de imágenes de avance en la galería del dispositivo del cliente (Spec 007).
- Comentarios del cliente sobre los avances (post-MVP).
- Captura directa con la cámara del dispositivo (post-MVP).
- Notificaciones push al cliente cuando el artista sube un nuevo avance (Spec 008).
- Eliminación o edición de un avance ya subido (post-MVP).

---

## 9. Decisiones tomadas

| ID | Tema | Decisión |
|---|---|---|
| P-6.1 | Límite de imágenes por avance | Máximo 3 imágenes por avance. Reduce la complejidad del flujo de selección y el consumo de cuota de Storage, sin limitar la expresividad del artista. |
| P-6.2 | Vinculación a etapa automática | La etapa se toma de `current_stage` en el momento de la subida. El artista no puede seleccionar manualmente la etapa; evita datos inconsistentes. |
| P-6.3 | Nota opcional con límite de 300 caracteres | Se limita a 300 caracteres (vs. los 500 del motivo de rechazo) porque es un comentario de progreso, no una explicación detallada. |
| P-6.4 | Visualización solo dentro del detalle | No se crea una pantalla independiente de avances. Mantener el historial dentro del detalle de la comisión reduce la complejidad de navegación (Principio 11). |
| P-6.5 | Sin descarga en esta spec | La descarga y guardado en galería se delegan a la Spec 007 para mantener el alcance acotado y no requerir `expo-media-library` antes de que sea necesario. |

---

## 10. Trazabilidad

| Requerimiento | Origen SRS | Estado |
|---|---|---|
| RF-09 (subida de avances WIP desde galería) | RF-09 del SRS v6 | Implementado y detallado en esta spec |
| Dependencia del modelo de etapas (Spec 004) | Spec 004, Sección 5 | Reutilizado sin modificaciones |
| Integración con vista de detalle del cliente (Spec 005) | Spec 005, RF-05-B | Extendida con sección de avances |

---

## 11. Checklist de aceptación

- [ ] El artista puede subir entre 1 y 3 imágenes como avance de una comisión `EN_PROGRESO`.
- [ ] El avance queda vinculado automáticamente a la `current_stage` de la comisión en el momento de la subida.
- [ ] La nota es opcional; si no se proporciona, no se muestra espacio vacío en el historial.
- [ ] La app solicita permiso de galería solo al presionar "Agregar avance", con el mensaje literal de la sección 5.
- [ ] Si el permiso es denegado, se muestra el mensaje literal y el artista permanece en el panel de trabajo.
- [ ] La subida está bloqueada si la comisión no está en estado `EN_PROGRESO`, con el mensaje literal de la sección 6.
- [ ] Si la subida falla por error de red, no quedan registros ni archivos huérfanos.
- [ ] El historial de avances se integra en el detalle de la comisión (Spec 005) y en el panel de trabajo (Spec 004).
- [ ] Los avances se muestran en orden cronológico inverso con imagen, etapa, nota y fecha.
- [ ] Los estados vacíos muestran los mensajes literales según el rol (artista / cliente).
- [ ] Un tercero autenticado no puede leer los avances de una comisión que no le pertenece.
- [ ] Todas las imágenes subidas pesan ≤ 300 KB tras la compresión en cliente.
- [ ] Todos los mensajes de la sección 6 aparecen con el texto exacto en español.
- [ ] `expo lint` y `tsc` dan 0 errores.
- [ ] Cobertura ≥ 60 % en la lógica de validación de estado y permisos.
- [ ] Las políticas RLS de la tabla `commission_advances` y del bucket `commission-advances` tienen prueba de acceso denegado en `supabase/tests/`.