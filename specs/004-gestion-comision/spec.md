# Spec 004 — Gestión de comisión
 
**Estado:** Borrador · **Versión:** 0.1 · **Fecha:** 2026-11-08
**Prioridad:** Must have
**Constitución:** v1.1
**Depende de:** Spec 001 (cuenta y perfiles), Spec 002 (catálogo de servicios y TOS), Spec 003 (solicitud de comisión)
 
> Esta spec describe **qué** debe hacer el sistema y **por qué**. Las decisiones de tecnología van en `plan.md`.
 
---
 
## 1. Contexto y objetivo
 
Cuando un cliente envía una solicitud de comisión, esta queda en estado `PENDIENTE` esperando la decisión del artista. Sin un panel claro de gestión, el artista no tiene forma de revisar los detalles del encargo, tomar una decisión informada ni llevar el seguimiento del trabajo una vez aceptado.
 
Esta spec cubre el lado del artista: revisar las solicitudes que llegan, decidir si las acepta o rechaza, y avanzar el encargo a través de las etapas creativas hasta su finalización.
 
**Objetivo:** que el artista pueda gestionar el ciclo de vida completo de una comisión desde su panel; tomando decisiones explícitas (aceptar / rechazar) y avanzando el trabajo etapa a etapa hasta marcarlo como completado. El cliente puede observar el estado en la spec 005.
 
---
 
## 2. Historias de usuario
 
- **HU-4.1.** Como artista, quiero ver una lista de las solicitudes que tengo pendientes de revisión, para saber cuántos encargos esperan mi decisión y poder priorizarlos.
- **HU-4.2.** Como artista, quiero ver el detalle completo de una solicitud —servicio solicitado, descripción del cliente, uso previsto, notas y galería de referencias— para tomar una decisión informada.
- **HU-4.3.** Como artista, quiero aceptar una solicitud para indicar que comienzo a trabajar en el encargo y dar inicio a la primera etapa creativa.
- **HU-4.4.** Como artista, quiero rechazar una solicitud y poder indicar opcionalmente el motivo, para que el cliente entienda por qué no puedo tomar su encargo.
- **HU-4.5.** Como artista, quiero ver en qué etapa creativa se encuentra mi trabajo activo, para saber exactamente qué debo hacer a continuación.
- **HU-4.6.** Como artista, quiero marcar una etapa creativa como completada y avanzar a la siguiente, para reflejar el progreso real de mi trabajo.
- **HU-4.7.** Como artista, quiero marcar la última etapa creativa como completada para indicar que el encargo está terminado y listo para entrega.
- **HU-4.8.** Como artista, quiero que el sistema me impida ejecutar acciones sobre comisiones que no me pertenecen, para proteger mi trabajo y el de otros artistas.
---
 
## 3. Requerimientos funcionales
 
### RF-07-A — Panel de solicitudes pendientes (Must have)
 
El sistema deberá mostrar al artista autenticado la lista de sus comisiones en estado `PENDIENTE`, ordenadas de más reciente a más antigua.
 
**Reglas**
 
- Solo se muestran las comisiones donde el `artist_id` coincide con el usuario autenticado.
- Cada elemento de la lista muestra: nombre del servicio, nombre o handle del cliente, fecha de solicitud y estado `PENDIENTE`.
- Si no hay solicitudes pendientes, el sistema muestra el estado vacío con el mensaje "No tienes solicitudes pendientes".
- La lista se actualiza automáticamente cuando llega una nueva solicitud (sincronización en tiempo real o al volver a la pantalla).
**Criterios de aceptación**
 
**Escenario 4.1 — Lista con solicitudes pendientes**
- **Given** un artista autenticado con al menos una comisión en estado `PENDIENTE` asignada a su cuenta,
- **When** abre su panel de gestión de comisiones,
- **Then** el sistema muestra la lista de solicitudes pendientes, cada una con el nombre del servicio, el handle del cliente y la fecha de solicitud.
**Escenario 4.2 — Lista vacía**
- **Given** un artista autenticado sin comisiones en estado `PENDIENTE`,
- **When** abre su panel de gestión de comisiones,
- **Then** el sistema muestra el mensaje "No tienes solicitudes pendientes".
**Escenario 4.3 — Acceso no autorizado a lista ajena**
- **Given** un usuario autenticado que no es el artista propietario,
- **When** intenta consultar las solicitudes de otro artista por cualquier medio,
- **Then** el sistema no devuelve ninguna comisión (resultado vacío o error de autorización).
---
 
### RF-07-B — Vista detallada de una solicitud (Must have)
 
El sistema deberá mostrar al artista el detalle completo de una comisión en estado `PENDIENTE` antes de que tome su decisión.
 
**Reglas**
 
- El detalle incluye: nombre del servicio, precio base y tiempo estimado del servicio, descripción del encargo, uso previsto (personal / comercial), pose, elementos clave, notas adicionales y galería de imágenes de referencia.
- Las imágenes de referencia se muestran como miniaturas; el artista puede ampliarlas.
- Si la comisión no pertenece al artista autenticado, el sistema niega el acceso.
**Criterios de aceptación**
 
**Escenario 4.4 — Vista de detalle correcta**
- **Given** un artista autenticado que toca una solicitud pendiente de su lista,
- **When** el sistema carga el detalle,
- **Then** se muestran todos los campos de la solicitud, el resumen del servicio contratado y las miniaturas de las imágenes de referencia (si las hay).
**Escenario 4.5 — Artista sin acceso a comisión ajena**
- **Given** un usuario autenticado que intenta acceder al detalle de una comisión cuyo `artist_id` no coincide con su `user_id`,
- **When** el sistema evalúa la solicitud,
- **Then** el sistema no muestra el detalle y presenta el mensaje "No tienes permiso para ver esta comisión".
---
 
### RF-07-C — Aceptar una solicitud (Must have)
 
El sistema deberá permitir al artista propietario aceptar una comisión en estado `PENDIENTE`, transicionándola a `EN_PROGRESO` e iniciando la primera etapa creativa.
 
**Reglas**
 
- Solo el artista cuyo `artist_id` coincide con el de la comisión puede aceptar.
- Solo se puede aceptar una comisión en estado `PENDIENTE`. Cualquier otro estado bloquea la acción.
- Al aceptar, el estado cambia a `EN_PROGRESO` y la etapa creativa se establece en la primera etapa del servicio contratado.
- La acción es irreversible desde esta spec; no existe un botón de "desaceptar" (retiro de comisión activa: post-MVP).
- El sistema debe pedir confirmación antes de ejecutar la aceptación: "¿Confirmas que deseas aceptar esta comisión?".
**Criterios de aceptación**
 
**Escenario 4.6 — Aceptación exitosa**
- **Given** un artista autenticado que visualiza el detalle de una comisión en estado `PENDIENTE` que le pertenece,
- **When** presiona "Aceptar comisión" y confirma en el diálogo,
- **Then** el sistema actualiza el estado a `EN_PROGRESO`, establece la etapa creativa en la primera etapa, presenta el mensaje "Comisión aceptada. ¡A trabajar!" y redirige al artista al panel de trabajo de la comisión.
**Escenario 4.7 — Intento de aceptar comisión en estado no PENDIENTE**
- **Given** un artista autenticado que tiene acceso a una comisión cuyo estado no es `PENDIENTE` (por ejemplo, ya fue aceptada o rechazada),
- **When** intenta ejecutar la acción de aceptar,
- **Then** el sistema bloquea la acción y muestra el mensaje "Esta comisión ya no puede ser aceptada".
**Escenario 4.8 — Intento de aceptar comisión ajena**
- **Given** un usuario autenticado que no es el artista propietario de la comisión,
- **When** intenta aceptar la comisión,
- **Then** el sistema deniega la operación y no modifica ningún dato.
---
 
### RF-07-D — Rechazar una solicitud (Must have)
 
El sistema deberá permitir al artista propietario rechazar una comisión en estado `PENDIENTE`, transicionándola a `RECHAZADA` y registrando opcionalmente un motivo.
 
**Reglas**
 
- Solo el artista cuyo `artist_id` coincide con el de la comisión puede rechazar.
- Solo se puede rechazar una comisión en estado `PENDIENTE`.
- El motivo de rechazo es **opcional**: hasta 500 caracteres. Si no se proporciona, se guarda como nulo.
- El motivo de rechazo es visible para el cliente (spec 005).
- El sistema debe pedir confirmación antes de rechazar: "¿Confirmas que deseas rechazar esta comisión?".
- Una vez rechazada, la comisión es inmutable desde esta spec.
**Criterios de aceptación**
 
**Escenario 4.9 — Rechazo con motivo**
- **Given** un artista autenticado en el detalle de una comisión en estado `PENDIENTE` que le pertenece,
- **When** presiona "Rechazar comisión", escribe un motivo en el campo de texto y confirma,
- **Then** el sistema actualiza el estado a `RECHAZADA`, guarda el motivo, presenta el mensaje "Comisión rechazada" y el artista regresa a su lista de solicitudes.
**Escenario 4.10 — Rechazo sin motivo**
- **Given** un artista autenticado en el detalle de una comisión en estado `PENDIENTE` que le pertenece,
- **When** presiona "Rechazar comisión", deja el campo de motivo vacío y confirma,
- **Then** el sistema actualiza el estado a `RECHAZADA` con `rejection_reason` nulo, presenta el mensaje "Comisión rechazada" y el artista regresa a su lista de solicitudes.
**Escenario 4.11 — Motivo demasiado largo**
- **Given** un artista autenticado en el flujo de rechazo,
- **When** escribe más de 500 caracteres en el campo de motivo e intenta confirmar,
- **Then** el sistema no ejecuta el rechazo y muestra el mensaje "El motivo no puede superar los 500 caracteres".
**Escenario 4.12 — Intento de rechazar comisión ajena**
- **Given** un usuario autenticado que no es el artista propietario de la comisión,
- **When** intenta rechazar la comisión,
- **Then** el sistema deniega la operación y no modifica ningún dato.
---
 
### RF-07-E — Gestión de etapas creativas (Must have)
 
El sistema deberá permitir al artista propietario avanzar el encargo a través de etapas creativas estandarizadas mientras la comisión está `EN_PROGRESO`.
 
**Reglas**
 
- Las etapas creativas son **estandarizadas y ordenadas**: cada servicio sigue la misma secuencia de etapas definida por el sistema.
- La secuencia de etapas es: `SKETCH` → `LINEART` → `FINAL`. Esta secuencia es fija y aplica a todas las comisiones sin excepción en esta versión.
- Al aceptar una comisión, la etapa inicial es siempre `SKETCH`.
- El artista puede **avanzar** a la siguiente etapa solo desde la etapa actual (no se permiten saltos).
- No existe transición de retroceso de etapa en esta versión (simplifica el flujo del MVP).
- Al avanzar desde la última etapa (`FINAL`), el sistema cambia el estado de la comisión a `COMPLETADA` y limpia la etapa creativa (`current_stage` a nulo).
- Solo el artista propietario puede cambiar la etapa.
- Los cambios de etapa solo son posibles mientras el estado es `EN_PROGRESO`.
- El sistema debe pedir confirmación antes de avanzar de etapa: "¿Confirmas que completaste la etapa [nombre de etapa]?".
- El sistema debe pedir confirmación antes de completar la última etapa: "¿Confirmas que el encargo está terminado y listo para entrega?".
**Criterios de aceptación**
 
**Escenario 4.13 — Avance de etapa exitoso (etapa intermedia)**
- **Given** un artista autenticado en el panel de trabajo de una comisión `EN_PROGRESO` en etapa `SKETCH`,
- **When** presiona "Completar etapa" y confirma,
- **Then** el sistema actualiza `current_stage` a `LINEART`, presenta el mensaje "Etapa completada. Ahora estás en: Delineado" y el panel refleja la nueva etapa.
**Escenario 4.14 — Completar última etapa (comisión completada)**
- **Given** un artista autenticado en el panel de trabajo de una comisión `EN_PROGRESO` en etapa `FINAL`,
- **When** presiona "Completar etapa" y confirma,
- **Then** el sistema actualiza el estado a `COMPLETADA` y `current_stage` a nulo, presenta el mensaje "¡Comisión completada! El cliente será notificado" y el panel muestra el estado final.
**Escenario 4.15 — Intento de salto de etapa**
- **Given** un artista autenticado con una comisión `EN_PROGRESO` en etapa `SKETCH`,
- **When** el sistema evalúa una solicitud para pasar directamente a `FINAL` sin pasar por `LINEART`,
- **Then** el sistema rechaza la transición y muestra el mensaje "Debes completar la etapa actual antes de avanzar".
**Escenario 4.16 — Intento de cambiar etapa en comisión no activa**
- **Given** un artista autenticado con una comisión en estado `COMPLETADA` o `RECHAZADA`,
- **When** intenta cambiar la etapa creativa,
- **Then** el sistema bloquea la acción y muestra el mensaje "Esta comisión ya no está en progreso".
**Escenario 4.17 — Intento de cambiar etapa de comisión ajena**
- **Given** un usuario autenticado que no es el artista propietario de la comisión,
- **When** intenta cambiar la etapa creativa,
- **Then** el sistema deniega la operación y no modifica ningún dato.
---
 
## 4. Requerimientos no funcionales aplicables
 
| ID | Aplicación en esta spec | Métrica |
|---|---|---|
| RNF-01 | Tiempo de respuesta al aceptar / rechazar / avanzar etapa | ≤ 2.0 s desde la confirmación hasta la actualización visible |
| RNF-04 | Acceso a comisiones solo por las partes involucradas | 100 % de peticiones de terceros reciben 0 filas o error 403 |
| RNF-08 | Cobertura de pruebas en la máquina de estados y lógica de transición | ≥ 60 % |
| Principio 5 | RLS en todas las tablas modificadas | Sin excepción |
| Principio 6 | Permisos resueltos desde el `user_id` del JWT, nunca desde datos enviados por el cliente | Sin excepciones |
| Principio 11 | Solo se construye lo mínimo que cumple la spec | Sin retroceso de etapa, sin estados intermedios no especificados |
 
---
 
## 5. Máquina de estados de la comisión
 
```
                    ┌──────────────┐
                    │   PENDIENTE  │  ← estado inicial (spec 003)
                    └──────┬───────┘
               ┌───────────┴───────────┐
               ▼                       ▼
        ┌────────────┐         ┌──────────────┐
        │ EN_PROGRESO│         │  RECHAZADA   │  (estado terminal)
        └─────┬──────┘         └──────────────┘
              │
    etapas creativas internas:
    SKETCH → LINEART → FINAL
              │
              ▼ (al completar FINAL)
        ┌────────────┐
        │ COMPLETADA │  (estado terminal)
        └────────────┘
```
 
**Estados definidos en el sistema (para uso futuro en otras specs):**
 
| Estado | Descripción | ¿Terminal? |
|---|---|---|
| `PENDIENTE` | Solicitud recibida, esperando decisión del artista | No |
| `EN_PROGRESO` | Artista aceptó; trabajo activo | No |
| `RECHAZADA` | Artista declinó la solicitud | Sí (en esta spec) |
| `COMPLETADA` | Artista finalizó todas las etapas | Sí (en esta spec) |
| `CANCELADA` | Reservado para cancelación (post-MVP) | — |
 
**Transiciones válidas en esta spec:**
 
| Desde | Acción | Hacia |
|---|---|---|
| `PENDIENTE` | Artista acepta | `EN_PROGRESO` |
| `PENDIENTE` | Artista rechaza | `RECHAZADA` |
| `EN_PROGRESO` (etapa ≠ FINAL) | Artista avanza etapa | `EN_PROGRESO` (siguiente etapa) |
| `EN_PROGRESO` (etapa = FINAL) | Artista completa última etapa | `COMPLETADA` |
 
**Secuencia de etapas creativas:**
 
| Orden | Código interno | Nombre visible |
|---|---|---|
| 1 | `SKETCH` | Boceto |
| 2 | `LINEART` | Delineado |
| 3 | `FINAL` | Color / Acabado final |
 
---
 
## 6. Mensajes de error y confirmación
 
| Situación | Comportamiento | Mensaje literal |
|---|---|---|
| Sin solicitudes pendientes | Estado vacío en la lista | "No tienes solicitudes pendientes" |
| Acceso a comisión ajena | Niega el acceso | "No tienes permiso para ver esta comisión" |
| Comisión ya no puede aceptarse | Bloquea la acción | "Esta comisión ya no puede ser aceptada" |
| Aceptación confirmada | Redirige al panel de trabajo | "Comisión aceptada. ¡A trabajar!" |
| Rechazo confirmado | Regresa a la lista | "Comisión rechazada" |
| Motivo de rechazo supera 500 caracteres | No ejecuta el rechazo | "El motivo no puede superar los 500 caracteres" |
| Avance de etapa confirmado (etapa intermedia) | Panel actualizado | "Etapa completada. Ahora estás en: [nombre de etapa siguiente]" |
| Comisión completada (última etapa) | Estado final visible | "¡Comisión completada! El cliente será notificado" |
| Intento de salto de etapa | Bloquea la transición | "Debes completar la etapa actual antes de avanzar" |
| Comisión no activa al intentar cambiar etapa | Bloquea la acción | "Esta comisión ya no está en progreso" |
| Fallo de red al ejecutar una acción | Conserva el estado anterior | "No se pudo completar la acción, comprueba tu conexión e inténtalo de nuevo" |
| Confirmación previa a aceptar | Diálogo de confirmación | "¿Confirmas que deseas aceptar esta comisión?" |
| Confirmación previa a rechazar | Diálogo de confirmación | "¿Confirmas que deseas rechazar esta comisión?" |
| Confirmación previa a avanzar etapa | Diálogo de confirmación | "¿Confirmas que completaste la etapa [nombre de etapa]?" |
| Confirmación previa a completar última etapa | Diálogo de confirmación | "¿Confirmas que el encargo está terminado y listo para entrega?" |
 
---
 
## 7. Entidades (conceptual)
 
- **Comisión:** entidad central de la aplicación. En esta spec se amplía con los campos `status` (máquina de estados), `current_stage` (etapa creativa activa), `rejection_reason` (motivo de rechazo opcional) y `updated_at` (marca temporal de la última modificación).
- **Etapa creativa:** valor de enumerado que indica la fase del trabajo artístico dentro de una comisión activa. No es una tabla separada; es un campo de la comisión.
El diseño de tablas, políticas RLS y contratos TypeScript van en `plan.md`.
 
---
 
## 8. Fuera de alcance de esta spec
 
- Cancelación de una comisión activa por el artista o el cliente (post-MVP).
- Retroceso de etapa creativa (post-MVP).
- Subida de avances o entregables por parte del artista (spec 006).
- Vista del cliente sobre el estado de la comisión (spec 005).
- Notificaciones push al cliente cuando el artista acepta, rechaza o avanza de etapa (spec 008).
- Cupos máximos de comisiones simultáneas del artista (spec 009).
- Estados `EN_REVISION` y `CANCELADA` (reservados, sin flujo en esta spec).
- Manejo de disputas o escalaciones.
---
 
## 9. Decisiones tomadas
 
| ID | Tema | Decisión |
|---|---|---|
| P-4.1 | Secuencia de etapas | Fija: `SKETCH` → `LINEART` → `FINAL`. Estandarizada para todos los servicios, independientemente del tipo. Elimina la complejidad de etapas personalizables por artista en el MVP. |
| P-4.2 | Retroceso de etapa | No se implementa en el MVP. Simplifica la máquina de estados y la validación RLS. |
| P-4.3 | Motivo de rechazo | Opcional. No obligar al artista a justificarse reduce fricción, pero se le da la opción para mantener una buena experiencia para el cliente. |
| P-4.4 | Confirmación de acciones | Se requiere confirmación explícita (diálogo) para aceptar, rechazar y cambiar de etapa, dado que las acciones son irreversibles o de alto impacto. |
| P-4.5 | `current_stage` al completar | Se establece a nulo cuando el estado es `COMPLETADA`. Evita datos inconsistentes (una etapa activa en una comisión terminada). |
| P-4.6 | Estados en el ENUM | Se definen todos los estados del ciclo de vida desde la migración inicial (incluyendo `CANCELADA` y `EN_REVISION`) para evitar migraciones ALTER en specs futuras. |
 
---
 
## 10. Trazabilidad
 
| Requerimiento | Origen SRS | Estado |
|---|---|---|
| RF-07 (aceptar / rechazar / gestionar etapas) | RF-07 del SRS v4.0 | Ampliado y detallado |
| Corrección #10 del SRS | Sección 8 de constitution.md | Implementada: etapas alineadas al plan de negocios |
 
---
 
## 11. Checklist de aceptación
 
- [ ] Un artista puede ver todas sus comisiones en estado `PENDIENTE` y ninguna de otro artista.
- [ ] El detalle de la solicitud muestra todos los campos y las referencias visuales.
- [ ] Aceptar una comisión la lleva a `EN_PROGRESO` con etapa inicial `SKETCH`.
- [ ] Rechazar una comisión la lleva a `RECHAZADA`; el motivo es opcional.
- [ ] Solo el artista propietario puede aceptar, rechazar o cambiar la etapa.
- [ ] Las transiciones de estado inválidas son bloqueadas (tanto en cliente como en RLS).
- [ ] Los saltos de etapa son imposibles; solo se puede avanzar a la etapa inmediata siguiente.
- [ ] Completar la última etapa (`FINAL`) cierra la comisión en `COMPLETADA`.
- [ ] Todos los mensajes de la sección 6 aparecen con el texto exacto.
- [ ] `expo lint` y `tsc` dan 0 errores.
- [ ] Cobertura ≥ 60 % en la lógica de la máquina de estados y transiciones.
- [ ] Las políticas RLS tienen prueba de acceso denegado en `supabase/tests/`.
 