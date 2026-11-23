# Bitácora de IA

> Autor: Isis Vanesa Lopez Cisneros (376082) + Apoyo de Claude Code.

Registro de las sesiones de asistencia con IA de **Anthropic (Claude)** utilizadas durante el desarrollo del proyecto **Koma** (AM_Project: aplicación móvil Android con Expo/React Native + Supabase).

Esta bitácora resume *qué se le pidió al asistente*, *qué produjo* y *cómo se incorporó al repositorio*. Las decisiones de diseño y arquitectura que surgieron de estas sesiones se documentan por separado en [`DIARIO_DECISIONES.md`](DIARIO_DECISIONES.md).

---

## Resumen general

- **Herramientas:**
  - **Claude (claude.ai), Proyecto "KOMA":** redacción y revisión de la constitución, specs, planes y tareas; prompts para Claude Code. El proyecto tiene como contexto el plan de negocios (V3) y el SRS ISO 29148 (v6).
  - **Claude Code (CLI + extensión VS Code):** implementación dentro del repositorio.
- **Modelos usados:** familia Claude (Sonnet 5 / Opus 5.5) según disponibilidad.
- **Período registrado:** 2 de noviembre de 2026 – 22 de noviembre de 2026.
  - Diseño de specs (claude.ai): 2 – 19 nov.
  - Implementación (Claude Code): 12 – 22 nov.
- **Modo de trabajo:** desarrollo guiado por *specs* (SDD, principio 1 de la constitución). Cada feature vive en `specs/NNN-feature/` con `spec.md`, `plan.md` y `tasks.md`; el asistente va tachando `tasks.md` conforme implementa.
- **Convenciones:**
  - Toda interacción con Claude Code ocurre dentro del workspace del proyecto.
  - El asistente no hace commits; los hacia yo (Conventional Commits con ID de tarea).
  - Las migraciones SQL las ejecuto manualmente en el editor SQL de Supabase (no vía CLI local).
  - Se corre `npx expo lint` y `npx tsc --noEmit` antes de dar una tarea por terminada.

---

## Fase 0 — Diseño de specs con Claude (claude.ai, Proyecto KOMA)

Antes de escribir código se usó Claude en un Proyecto de claude.ai para convertir el plan de negocios y el SRS en la constitución y las specs. Los borradores que produjo Claude se guardaron en el proyecto con prefijo `claude/`; las versiones revisadas se guardaron sin prefijo y son las que se copiaron a `specs/`.

| Fecha | Trabajo | Salida de Claude | Versión final |
|---|---|---|---|
| 2–3/nov | Constitución v1.0 → v1.1 (solo Android, una cuenta para artista y cliente, push como canal principal, mapa de features) y spec 001 (cuenta, sesión y perfiles) | Constitución, `001-spec/plan/tasks` | `constitution.md`, `001-*.md` (3/nov) |
| 3/nov | Spec 002 — catálogo, TOS y búsqueda por handle | `claude/002-spec.md`, `claude/002-plan.md`, `claude/002-tasks.md` | `002-*.md` (5/nov) |
| 5/nov | Spec 003 — solicitud de comisión | `claude/003-spec.md`, `claude/003-plan.md`, `claude/003-tasks.md` | `specs/003-solicitud-comision/` |
| 8/nov | Spec 004 — gestión de la comisión | `claude/004-spec.md`, `claude/004-plan.md`, `claude/004-tasks.md` | `004-gestion-comision/*` (17/nov) |
| 17–21/nov | Specs 005–008 revisadas y subidas al proyecto como contexto; SRS v6 agregado | — | `005-…` a `008-…` |
| 22/nov | Prompt para aplicar el sistema de diseño "Koma Design System v1.0" (Figma, pensado para web) a la app Android | `claude/prompt-design-system-movil.md` | Usado en la sesión 7 de Claude Code |

**Qué aportó la IA en esta fase:** estructura de cada spec (historias de usuario, RF con escenarios Given/When/Then, tabla de errores y mensajes, RNF, trazabilidad al SRS, checklist), detección de huecos en el SRS (lista de correcciones para la v5.0 en la sección 8 de la constitución) y propuestas de decisiones que fui aceptando o modificando.

**Qué se decidió:** alcance del MVP, reglas de negocio (p. ej. límite de 20 servicios, búsqueda exacta por handle, bloqueo al eliminar servicios con comisiones activas), redacción y aprobación de cada spec junto con la IA

---

## Sesiones de implementación (Claude Code)

### Sesión 0 — 03/nov/2026 · Cuenta, perfiles y catálogo
- **Specs trabajadas:** `001-auth-perfiles`, `002-catalogo-tos`.
- **Entregables:** migraciones 001/002, pantallas de registro, login, verificación, perfil, handle, catálogo, TOS, búsqueda.
- **Notas:** si estas features se implementaron sin asistente o en sesiones no registradas, indicarlo aquí explícitamente.

### Sesión 1 — 12/nov/2026 · Fundamentos y solicitud de comisión
- **Spec trabajada:** `003-solicitud-comision`.
- **Entregables:**
  - Migración `supabase/migrations/003_commissions.sql`.
  - Avance en `specs/003-solicitud-comision/tasks.md`.
- **Tareas del asistente:**
  - Diseñar tabla `commissions` y sus políticas RLS iniciales.
  - Generar tipos TypeScript en `src/features/gestion/types.ts`.
- **Notas:** iteraciones sobre el `constitution.md` dentro del repo para fijar reglas operativas para el agente (uso de Expo Router, convención de carpetas, prohibición de editar `ios/` y `android/`).

### Sesión 2 — 17/nov/2026 · Gestión de la comisión (artista)
- **Spec trabajada:** `004-gestion-comision`.
- **Entregables:**
  - `supabase/migrations/005_commission_management.sql`.
  - Pantallas y hooks para que el artista acepte/rechace/modifique la comisión.
- **Tareas del asistente:** generar RPC de transición de estados y pruebas RLS correspondientes.

### Sesión 3 — 19/nov/2026 · Seguimiento del cliente
- **Spec trabajada:** `005-seguimiento-cliente`.
- **Entregables:**
  - `supabase/migrations/007_client_tracking_indexes.sql`.
  - `supabase/tests/005_rls_client_test.sql`.
- **Tareas del asistente:** optimizar índices para las consultas del cliente sobre sus comisiones y añadir pruebas RLS (commit `2128a1f`).

### Sesión 4 — 20/nov/2026 · Avances de comisión
- **Spec trabajada:** `006-avances`.
- **Entregables:**
  - Migración `010_commission_advances.sql`.
  - Pruebas RLS `supabase/tests/006_rls_test.sql`.
  - Componentes `AdvanceImageGrid` y pantallas asociadas (commits `f7fe80d`, `3d5120a`).
- **Decisiones destacadas:** integración de `expo-image-picker` con permisos declarativos en `app.json` (commit `b8b560a`).

### Sesión 5 — 21/nov/2026 · Pagos y entregable
- **Spec trabajada:** `007-pagos-entregable`.
- **Entregables:**
  - `supabase/migrations/011_payments_deliverables.sql`.
  - Hooks `useCommissionPayment`, `useSubmitPaymentProof`, `useSubmitDeliverable`, `useDeliverablePreviewUrl`.
  - Componentes `ClientPaymentPanel`, `ArtistPaymentPanel`, `ConfirmPaymentDialog`, `RequestCorrectionSheet`, `SubmitPaymentProofSheet`, `ArtistDeliverablePanel`, `ClientDeliverablePanel`, `DeliverableLockedCard`, `SaveToGalleryButton`, `DeliverableImagePreview`.
  - Utilidades: `prepareDeliverableImage`, compresor de prueba de pago, integración con `expo-media-library` (commit `97365e2`).
- **Tests añadidos:** unit tests para preparación de imagen de entregable (commit `924c3f8`).

### Sesión 6 — 22/nov/2026 · Notificaciones push
- **Spec trabajada:** `008-notificaciones-push`.
- **Entregables:**
  - Migración `012_push_notifications.sql` (tabla `device_tokens`, cola `pg_net`, funciones de encolado y resolución de eventos).
  - Edge Function de Supabase para envío de notificaciones (commits `aa5b0e0`, `68ccfee`).
  - Setup Firebase + configuración en `app.json`/`app.config.ts` (commits `c360dca`, `252fb71`).
  - Hooks de permisos (`5093d49`), registro/anulación de token (`283c406`), enrutamiento al tocar la notificación (`1ce449d`).
  - `NotificationSettingsRow` en `AppHomeScreen` (`7cb9ab6`).
  - Tests de manejo de push y enrutamiento (`8696e50`).
- **Rechazo notable:** la usuaria rechazó la ejecución de `supabase db push` desde CLI local; se acordó aplicar migraciones manualmente en el editor SQL web.

### Sesión 7 — 22/nov/2026 · Sistema de UI / tema
- **Origen:** prompt `prompt-design-system-movil.md` redactado con Claude en claude.ai (Fase 0). Pide traducir el "Koma Design System v1.0" (Figma, web) a Android sin cambiar lógica de negocio, sin librerías de estilos ni fuentes nuevas.
- **Spec trabajada:** N/A
- **Entregables:**
  - `src/theme/index.ts` (tokens de color, espaciado, radios, sombras y tipografía).
  - Componentes base `Text`, `Button`, `TextField`, `Badge` en `src/components/ui/` (commit `12f7327`).
  - Refactor de estilos en pantallas de pago y comisión para consumir tokens del tema (commit `690e4ef`).
  - Reemplazo de `ScrollView` por `KeyboardAwareScroll` en varias pantallas (commit `a97c2db`).
  - Mejoras de accesibilidad: `accessibilityLiveRegion` en TosScreen y RegisterScreen (commit `c22c913`).

### Sesión 8 — 22/nov/2026 · Housekeeping
- **Entregables:** `expo-doctor` corriendo limpio (20/20 checks). Revisión de `.env.example` y estado del repo.

### Sesión 9 — 22/nov/2026 · Bitácora y diario (sesión actual)
- Creación de `BITACORA_IA.md` y `DIARIO_DECISIONES.md` con Claude Code, revisando los `.jsonl` locales y el historial de git.
- Revisión y ampliación de la bitácora con Claude (claude.ai), cruzándola con los documentos del Proyecto KOMA: se agregó la Fase 0, las secciones de verificación, rechazos y privacidad, y los pendientes marcados.

---

## Cómo se verificó lo que produjo la IA

Ninguna salida del asistente se aceptó sin revisión. Los controles aplicados fueron:

| Control | Dónde aplica | Evidencia |
|---|---|---|
| Revisión humana de specs antes de aprobarlas | Fase 0 | Borradores `claude/` vs. versiones finales sin prefijo |
| `npx tsc --noEmit` y `npx expo lint` con 0 errores | Cada tarea | Convención del proyecto; definición de hecho (constitución §6) |
| Pruebas unitarias con Jest + `jest-expo` | Lógica de features (meta ≥ 60 % de cobertura, RNF-08) | Commits `924c3f8`, `8696e50` |
| Pruebas de RLS con acceso denegado | Cada migración con tablas nuevas | `supabase/tests/005_rls_client_test.sql`, `006_rls_test.sql`, … |
| Ejecución manual de migraciones en el editor SQL de Supabase | Toda migración | Ver rechazo de `supabase db push` (sesión 6) |
| `expo-doctor` | Configuración del proyecto | Sesión 8 (20/20) |
| Prueba manual en development build | Pantallas nuevas o restyling | Emulaciones desde dispositivo móvil (Samsung Tab S9 FE / Oppo A57) |

---

## Correcciones y rechazos a propuestas de la IA

| Sesión | Propuesta del asistente | Acción del equipo | Motivo |
|---|---|---|---|
| 6 | Ejecutar `supabase db push` desde la CLI local | Rechazada | Las migraciones se aplican a mano en el editor SQL web para revisarlas antes |
| Todas | Hacer commits | No permitido por regla | Constitución §5: los commits los hace la persona |
| 7 | (Prevenido en el prompt) instalar librerías de estilos o fuentes | Prohibido de antemano | Principio 11 (simplicidad) y costo cero |

---

## Privacidad y datos compartidos con la IA

- Al asistente se le compartieron: el código del repositorio, las specs, el plan de negocios y el SRS del equipo.
- **No** se compartieron: `service_role key` de Supabase, credenciales de Firebase ni valores reales de `.env` (constitución, principio 5). `.env.example` solo contiene nombres de variables.
- No se usaron datos personales reales de usuarios en las sesiones.

---

## Patrones de uso observados

- **Dos herramientas, dos roles:** claude.ai para pensar y redactar (constitución, specs, prompts); Claude Code para ejecutar dentro del repo.
- **Flujo spec-driven:** cada feature parte de un `spec.md`, un `plan.md` y un `tasks.md`. El asistente lee el spec, propone implementación y actualiza `tasks.md` con checklist.
- **Prompts como especificación:** para trabajos transversales (sistema de diseño) se redactó un prompt largo con reglas, criterios de aceptación y puntos de parada para aprobación.
- **SQL primero, UI después:** en la mayoría de features se definió primero la migración + RLS + tests, y después los hooks y componentes.
- **Revisión humana antes de commit:** la usuaria valida cambios y ejecuta manualmente comandos destructivos (migraciones, pushes).
- **Idioma:** instrucciones y nombres de spec en español; código y commits en inglés.

---

## Lecciones aprendidas

La implementación de la IA para el desarrollo de esta plataforma supuso muchisimas ventajas en cuestión de eficiencia y tiempo, sin embargo, la integración humana siempre estuvo presente en la revisión total de todo lo que la IA definia y las decisiones a tomar. 

La implementación de SDD fue una ventaja en este proyecto y el poder definir con exactitud que debe hacer la IA benefició mucho al proyecto, eliminandolo de muchos errores (no de todos, existieron algunos presentes que se pudieron resolver).

Sin dudas este proyecto aun tiene puntos de mejora enormes, pero para una primera versión, puedo considerar que se realizó algo estable y capaz de poder entender, algo estructurado que nos permite identificar donde está todo.

---

## Limitaciones conocidas de esta bitácora

- Los *prompts* exactos no se incluyen por volumen; están en los logs locales de Claude Code y en el historial del Proyecto KOMA en claude.ai.
- Las sesiones muy cortas o exploratorias (p. ej. preguntas puntuales que no generaron commits) se omiten.
- Las fechas de Claude Code corresponden a la última modificación del log de sesión, no necesariamente al inicio de la conversación. Las fechas de la Fase 0 corresponden a cuándo se guardó cada documento en el proyecto (convertidas a hora de Tijuana).