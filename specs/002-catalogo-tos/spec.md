# Spec 002 — Catálogo de servicios, TOS y búsqueda de artistas
 
**Estado:** Borrador · **Versión:** 0.1 · **Fecha:** 2026-11-03
**Prioridad:** Must have (habilita la solicitud de comisiones — spec 003)
**Constitución:** v1.1
**Depende de:** Spec 001 (perfil de artista con handle activo)
 
> Esta spec describe **qué** debe hacer el sistema y **por qué**. Las decisiones de tecnología van en `plan.md`.
 
---
 
## 1. Contexto y objetivo
 
Para que un cliente pueda solicitar una comisión necesita saber, antes de hacerlo, qué ofrece el artista, a qué precio, en cuánto tiempo, y bajo qué condiciones. Hoy esa información viaja por mensajes privados o por redes sociales externas a la app, lo que genera malentendidos y solicitudes incompletas.
 
**Objetivo:** que un artista pueda publicar sus tipos de servicio con precio y tiempo de entrega, declarar sus términos de trabajo, y que cualquier usuario autenticado pueda encontrar ese perfil por handle y leer esa información antes de solicitar.
 
Este módulo no procesa pagos. Los precios son informativos; el artista y el cliente los acuerdan fuera de Koma (RC-01).
 
---
 
## 2. Historias de usuario
 
- **HU-2.1.** Como artista, quiero crear un servicio con nombre, descripción, precio y tiempo de entrega para que mis clientes sepan qué ofreces y cuánto cobra.
- **HU-2.2.** Como artista, quiero pausar temporalmente un servicio para que no reciba nuevas solicitudes mientras estoy ocupado, sin perder su configuración.
- **HU-2.3.** Como artista, quiero eliminar un servicio que ya no ofrezco para mantener mi catálogo limpio.
- **HU-2.4.** Como artista, quiero redactar mis términos de servicio para que mis clientes sepan mis condiciones antes de solicitar una comisión.
- **HU-2.5.** Como cliente, quiero buscar a un artista por su handle dentro de la app para encontrar su catálogo sin salir de ella.
- **HU-2.6.** Como cliente, quiero ver el catálogo activo y los términos de servicio de un artista para decidir si quiero pedirle una comisión.
---
 
## 3. Requerimientos funcionales
 
### RF-02 — Gestiona el catálogo de servicios (Must have)
 
El sistema deberá permitir a un artista crear, editar, pausar y eliminar servicios de su catálogo. Cada servicio representa un tipo de comisión que el artista ofrece (por ejemplo: Busto, Cuerpo Completo, Chibi).
 
**Reglas**
 
- Solo los usuarios con perfil de artista activo (handle asignado) pueden gestionar un catálogo.
- Cada servicio pertenece al artista que lo crea y solo él puede editarlo, pausarlo o eliminarlo.
- **Campos de un servicio:**
  - **Título** (obligatorio): entre 3 y 80 caracteres.
  - **Descripción** (opcional): hasta 1 000 caracteres. Describe qué incluye el servicio: nivel de detalle, número de personajes, fondo, etc.
  - **Precio base** (obligatorio): número entero positivo mayor que cero, en la moneda local del artista (por defecto MXN). Koma no procesa ni custodia este valor; es solo referencia.
  - **Tiempo estimado de entrega** (obligatorio): número entero positivo de días (entre 1 y 365).
  - **Estado**: `active` (visible al público) o `paused` (oculto para nuevas solicitudes, conserva la configuración).
- Un artista puede tener como máximo **20 servicios** (activos + pausados). Esta restricción protege la usabilidad del catálogo para los clientes.
- No existe un límite mínimo: el catálogo puede estar vacío (el artista existe pero aún no publica servicios).
- Eliminar un servicio es permanente y no recuperable. El sistema muestra una confirmación antes de ejecutarlo.
- Si existen comisiones activas vinculadas a un servicio que se intenta eliminar, el sistema no lo permite y muestra el error correspondiente. (La gestión de comisiones es de la spec 004).
- El estado por defecto al crear es `active`.
**Criterios de aceptación (Given / When / Then)**
 
**Escenario 2.1 — Crear un servicio válido**
- **Given** un artista autenticado con perfil de artista activo y menos de 20 servicios en su catálogo,
- **When** completa el formulario con título, precio base y tiempo estimado válidos, y presiona "Guardar",
- **Then** el sistema crea el servicio con estado `active`, lo muestra al tope del catálogo del artista, y la operación se confirma visualmente sin salir de la pantalla de catálogo.
**Escenario 2.2 — Crear un servicio: campos obligatorios vacíos**
- **Given** un artista autenticado en el formulario de nuevo servicio,
- **When** deja título, precio base o tiempo estimado vacíos y presiona "Guardar",
- **Then** el sistema no crea el servicio, marca en rojo cada campo vacío u obligatorio y muestra el mensaje "Completa todos los campos obligatorios".
**Escenario 2.3 — Crear un servicio: límite de 20 alcanzado**
- **Given** un artista autenticado que ya tiene 20 servicios (activos o pausados),
- **When** intenta crear uno nuevo,
- **Then** el sistema no muestra el formulario de creación y muestra el mensaje "Alcanzaste el límite de 20 servicios. Elimina uno antes de crear otro".
**Escenario 2.4 — Editar un servicio existente**
- **Given** un artista autenticado y dueño de un servicio,
- **When** modifica uno o más campos válidos y presiona "Guardar",
- **Then** el sistema actualiza el servicio y refleja los cambios inmediatamente en el catálogo.
**Escenario 2.5 — Pausar un servicio activo**
- **Given** un artista autenticado con un servicio en estado `active`,
- **When** elige la opción "Pausar" sobre ese servicio,
- **Then** el servicio cambia a estado `paused`, deja de aparecer en el perfil público del artista y el artista ve una etiqueta "Pausado" en su panel.
**Escenario 2.6 — Reactivar un servicio pausado**
- **Given** un artista autenticado con un servicio en estado `paused`,
- **When** elige la opción "Activar" sobre ese servicio,
- **Then** el servicio cambia a estado `active` y vuelve a aparecer en el perfil público del artista.
**Escenario 2.7 — Eliminar un servicio sin comisiones activas**
- **Given** un artista autenticado con un servicio que no tiene comisiones activas vinculadas,
- **When** elige la opción "Eliminar" y confirma en el diálogo de confirmación,
- **Then** el sistema elimina el servicio permanentemente y este desaparece del catálogo.
**Escenario 2.8 — Intentar eliminar un servicio con comisiones activas**
- **Given** un artista autenticado con un servicio que tiene al menos una comisión activa vinculada,
- **When** elige la opción "Eliminar",
- **Then** el sistema no elimina el servicio y muestra el mensaje "No puedes eliminar este servicio porque tiene comisiones activas".
**Escenario 2.9 — Acceso no autorizado: otro usuario no puede editar servicios ajenos**
- **Given** un usuario autenticado que no es el dueño de un servicio,
- **When** intenta modificar o eliminar ese servicio por cualquier medio,
- **Then** el sistema rechaza la operación sin exponer datos del artista.
---
 
### RF-03 — Redacta y edita los términos de servicio (Must have)
 
El sistema deberá permitir a un artista redactar y actualizar un documento de términos de servicio (TOS) que quedará visible en su perfil público.
 
**Reglas**
 
- Solo los usuarios con perfil de artista activo pueden gestionar su TOS.
- Cada artista tiene **un único** documento TOS (se crea o actualiza; no hay versiones múltiples visibles al cliente en esta versión).
- El TOS es texto libre, entre 10 y 5 000 caracteres.
- El TOS puede incluir, entre otros: condiciones de uso (comercial vs. personal), política de correcciones o revisiones, instrucciones de pago y reembolso fuera de la app, plazos y penalizaciones.
- El TOS es **opcional**. Un artista puede no tenerlo; el perfil público mostrará una nota al respecto.
- Si el TOS existe, se muestra completo en el perfil público del artista, antes del catálogo o en sección separada.
- El artista puede dejar el TOS vacío para "eliminar" su contenido (el registro queda pero con texto nulo).
**Criterios de aceptación (Given / When / Then)**
 
**Escenario 3.1 — Crear o actualizar el TOS**
- **Given** un artista autenticado con perfil de artista activo,
- **When** escribe texto válido en el campo de TOS y presiona "Guardar",
- **Then** el sistema guarda el TOS, lo muestra en la vista previa del artista y queda visible en el perfil público.
**Escenario 3.2 — TOS demasiado corto**
- **Given** un artista autenticado editando su TOS,
- **When** escribe menos de 10 caracteres y presiona "Guardar",
- **Then** el sistema no guarda el TOS y muestra el mensaje "Los términos de servicio deben tener al menos 10 caracteres".
**Escenario 3.3 — TOS demasiado largo**
- **Given** un artista autenticado editando su TOS,
- **When** el texto supera los 5 000 caracteres,
- **Then** el campo no acepta más caracteres (límite en la UI) o, si llega de otra forma, el sistema muestra el mensaje "Los términos de servicio no pueden superar los 5 000 caracteres".
**Escenario 3.4 — Artista sin TOS: perfil público lo indica**
- **Given** un usuario autenticado visitando el perfil de un artista que no tiene TOS redactado,
- **When** llega a la sección de términos en ese perfil,
- **Then** el sistema muestra el texto "Este artista aún no ha publicado sus términos de servicio".
**Escenario 3.5 — Acceso no autorizado al TOS ajeno**
- **Given** un usuario autenticado que no es el artista,
- **When** intenta modificar el TOS de otro artista,
- **Then** el sistema rechaza la operación.
---
 
### RF-02B — Busca artistas por handle y visualiza su perfil público (Must have)
 
El sistema deberá permitir a cualquier usuario autenticado buscar a un artista por su handle dentro de la app y ver su perfil público, que incluye su catálogo de servicios activos y sus TOS.
 
> Este requerimiento se derivó de la constitución (sección 1) y está fuera del SRS original; se trazará como nuevo RF en las correcciones al SRS (sección 8 de la constitución).
 
**Reglas**
 
- La búsqueda acepta el handle con o sin el prefijo `@`. La búsqueda es exacta (no parcial en esta versión): si el handle no existe, se informa con el mensaje correspondiente.
- Solo los usuarios autenticados pueden buscar y ver perfiles públicos.
- El perfil público muestra: nombre del artista, handle, catálogo de servicios en estado `active` (ordenados por fecha de creación, más recientes primero), y TOS (si existe).
- Los servicios en estado `paused` **no** se muestran en el perfil público.
- El perfil público no muestra el correo del artista ni ningún dato privado.
- Si el perfil buscado existe pero no tiene servicios activos, se muestra el perfil con un mensaje indicando que el catálogo está vacío.
**Criterios de aceptación (Given / When / Then)**
 
**Escenario 2B.1 — Buscar un artista que existe**
- **Given** un usuario autenticado en la pantalla de búsqueda,
- **When** escribe el handle exacto de un artista registrado (con o sin `@`) y ejecuta la búsqueda,
- **Then** el sistema muestra el perfil público del artista con su catálogo de servicios activos y, si tiene TOS, su contenido.
**Escenario 2B.2 — Buscar un artista que no existe**
- **Given** un usuario autenticado en la pantalla de búsqueda,
- **When** escribe un handle que no corresponde a ningún artista registrado,
- **Then** el sistema muestra el mensaje "No se encontró ningún artista con ese identificador".
**Escenario 2B.3 — Artista sin servicios activos**
- **Given** un usuario autenticado que llega al perfil de un artista que tiene el perfil activo pero ningún servicio en estado `active`,
- **When** ve el catálogo,
- **Then** el sistema muestra el mensaje "Este artista aún no tiene servicios disponibles".
**Escenario 2B.4 — Búsqueda sin autenticación**
- **Given** un visitante sin sesión,
- **When** intenta acceder a la pantalla de búsqueda o a la URL de un perfil de artista,
- **Then** el sistema lo redirige a la pantalla de inicio de sesión.
**Escenario 2B.5 — Los servicios pausados no aparecen en el perfil público**
- **Given** un artista con un servicio en estado `paused` y al menos uno en `active`,
- **When** cualquier usuario autenticado visita el perfil del artista,
- **Then** solo los servicios en estado `active` son visibles; los pausados no aparecen.
---
 
## 4. Errores y mensajes
 
| Situación | Comportamiento | Mensaje |
|---|---|---|
| Campo obligatorio vacío en servicio | No guarda; marca el campo | "Completa todos los campos obligatorios" |
| Título fuera de longitud (< 3 o > 80 caracteres) | No guarda | "El título debe tener entre 3 y 80 caracteres" |
| Precio base ≤ 0 o no numérico | No guarda | "El precio debe ser un número entero mayor que cero" |
| Tiempo de entrega ≤ 0 o > 365 | No guarda | "El tiempo de entrega debe ser entre 1 y 365 días" |
| Descripción supera 1 000 caracteres | No guarda | "La descripción no puede superar los 1 000 caracteres" |
| Límite de 20 servicios alcanzado | Bloquea la creación | "Alcanzaste el límite de 20 servicios. Elimina uno antes de crear otro" |
| Eliminar servicio con comisiones activas | No elimina | "No puedes eliminar este servicio porque tiene comisiones activas" |
| TOS menor a 10 caracteres | No guarda | "Los términos de servicio deben tener al menos 10 caracteres" |
| TOS mayor a 5 000 caracteres | No guarda / no acepta | "Los términos de servicio no pueden superar los 5 000 caracteres" |
| Handle no encontrado en búsqueda | Informa sin error | "No se encontró ningún artista con ese identificador" |
| Catálogo vacío en perfil público | Informa sin error | "Este artista aún no tiene servicios disponibles" |
| Sin TOS en perfil público | Informa sin error | "Este artista aún no ha publicado sus términos de servicio" |
| Fallo de conexión | Conserva lo capturado | "No se pudo conectar, reintente más tarde" |
| Operación no autorizada | Rechaza silenciosamente | "No se pudo completar la acción, inténtalo de nuevo" |
 
---
 
## 5. Requerimientos no funcionales aplicables
 
| ID | Aplicación en esta spec | Métrica |
|---|---|---|
| RNF-01 | Búsqueda por handle y carga del perfil | ≤ 2.0 s con 50 usuarios concurrentes |
| RNF-04 | Solo el artista dueño puede editar su catálogo y TOS | 100 % de peticiones sin sesión válida reciben 401/403 |
| RNF-08 | Cobertura de pruebas en la lógica del catálogo | ≥ 60 % |
| RC-01 | El precio es solo referencia; Koma no procesa pagos | Sin campo de procesamiento de pago |
| RI-04 | Todo por HTTPS | Sin tráfico HTTP |
 
**Adicionales propuestos (nuevos RNF):**
- El perfil público de un artista solo expone nombre, handle, servicios activos y TOS: sin correo, sin ID interno ni ningún otro dato privado.
- El catálogo del artista debe mantenerse legible en dispositivos con pantalla ≥ 360 px de ancho.
---
 
## 6. Entidades (conceptual)
 
- **Servicio:** pertenece a un artista, tiene título, descripción, precio base, tiempo estimado de entrega y estado (activo/pausado).
- **TOS del artista:** pertenece a un artista, es texto libre. Un artista tiene cero o un TOS.
- **Perfil público del artista:** vista compuesta por datos de `profiles` (spec 001), servicios activos y TOS.
El diseño de tablas, políticas RLS y contratos TypeScript van en `plan.md`.
 
---
 
## 7. Fuera de alcance de esta spec
 
- Búsqueda parcial, por categoría, por estilo o por rango de precios (post-MVP).
- Búsqueda por código QR (post-MVP; la constitución lo menciona como alternativa futura).
- Precios en monedas distintas a MXN o conversión de moneda.
- Reseñas, valoraciones o insignias de artista.
- Cupos y límites de comisiones simultáneas (spec 009).
- Galería de trabajos anteriores del artista (post-MVP).
- Historial de versiones del TOS visibles al cliente.
- Categorías o etiquetas en servicios (post-MVP).
---
 
## 8. Decisiones tomadas
 
| ID | Tema | Decisión |
|---|---|---|
| P-2.1 | Búsqueda exacta vs. parcial | **Exacta** en el MVP. La búsqueda parcial requiere índice de texto completo o búsqueda vectorial; se evalúa post-MVP. El cliente necesita saber el handle del artista de antemano (lo comparte por redes externas o QR). |
| P-2.2 | Límite de servicios por artista | **20** servicios (activos + pausados). Equilibra la libertad del artista con la usabilidad del cliente. |
| P-2.3 | Un solo TOS por artista | Sin historial de versiones en el MVP. Simplicidad (principio 11 de la constitución). |
| P-2.4 | Precio en texto vs. número entero | **Número entero** (centavos no; en MXN los precios de comisiones van en pesos completos). Facilita validación y evita ambigüedades de formato. |
| P-2.5 | Estado de servicio: activo/pausado | Sin estado `draft` ni `archived` en el MVP. Dos estados son suficientes y mantienen la UI simple. |
| P-2.6 | Eliminar con comisiones activas | **Bloquear la eliminación**. Proteger la integridad de las comisiones en curso es más importante que la comodidad del artista en este caso. |
 
---
 
## 9. Trazabilidad
 
| Requerimiento | Origen SRS | Estado |
|---|---|---|
| RF-02 (gestión de catálogo) | RF-02 del SRS v4.0 | Ampliado y detallado |
| RF-03 (TOS) | RF-03 del SRS v4.0 | Ampliado y detallado |
| RF-02B (búsqueda y perfil público) | Constitución §1, §8 | **Nuevo** (a agregar al SRS v5.0) |
 
---
 
## 10. Checklist de aceptación
 
- [ ] Todos los escenarios Given/When/Then de RF-02, RF-03 y RF-02B pasan.
- [ ] Todos los mensajes de error de la sección 4 están cubiertos por una prueba con el texto exacto.
- [ ] Un usuario no autenticado no puede ver perfiles públicos (redirige a login).
- [ ] Un artista no puede ver ni modificar los servicios o TOS de otro artista.
- [ ] Los servicios pausados no aparecen en el perfil público.
- [ ] Un artista sin handle no puede crear servicios.
- [ ] `expo lint` y `tsc` dan 0 errores.
- [ ] Cobertura ≥ 60 % en la lógica del catálogo.
- [ ] Las políticas RLS tienen prueba de acceso denegado documentada en `supabase/tests/`.
- [ ] Las preguntas P-2.1 a P-2.6 están resueltas (sección 8).
 