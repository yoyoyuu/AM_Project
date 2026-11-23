# Diario de Decisiones

> Autor: Isis Vanesa Lopez Cisneros (376082) + Apoyo de Claude Code.

Registro cronológico de las decisiones técnicas y de producto más relevantes tomadas durante el desarrollo de **AM_Project** (aplicación móvil Expo/React Native + Supabase para comisiones de arte).

Cada entrada sigue el formato:

> **Fecha · Título**
> - **Contexto:** el problema o disyuntiva.
> - **Decisión:** qué se eligió.
> - **Alternativas consideradas:** opciones descartadas.
> - **Consecuencias:** impacto previsto (positivo y negativo).

La bitácora cronológica de sesiones con el asistente de IA está en [`BITACORA_IA.md`](BITACORA_IA.md).

---

## D-001 · 12/nov/2026 · Stack: Expo + Supabase (sin backend propio)
- **Contexto:** la versión inicial usaba un backend Node/Prisma propio. Se evaluó si valía la pena mantenerlo contra consumir Supabase directo.
- **Decisión:** eliminar el backend intermedio y consumir Supabase desde el cliente con RLS fuertes como capa de autorización.
- **Alternativas consideradas:** mantener API Node + Prisma; migrar a Firebase.
- **Consecuencias:**
  - (+) Menos superficie que mantener, deploy más simple, sin servidores que gestionar.
  - (+) RLS fuerza a escribir políticas revisables en SQL.
  - (−) Toda lógica de negocio sensible vive en policies/RPC; requiere disciplina y pruebas SQL (`supabase/tests/`).

## D-002 · 12/nov/2026 · Flujo *Spec-Driven Development*
- **Contexto:** se requería ordenar el desarrollo entre features con mucha superposición (comisiones, pagos, entregables, avances).
- **Decisión:** adoptar carpeta `specs/NNN-feature/` con `spec.md`, `plan.md` y `tasks.md`. Cada feature se cierra solo cuando `tasks.md` queda totalmente marcado.
- **Alternativas consideradas:** issues de GitHub, backlog en Notion.
- **Consecuencias:**
  - (+) Trazabilidad local, versionada con el código.
  - (+) El asistente de IA puede leer el spec y proponer implementación coherente.
  - (−) Duplica información respecto al código conforme evoluciona; requiere mantenimiento.

## D-003 · 12/nov/2026 · Navegación con Expo Router (file-based)
- **Contexto:** elegir entre React Navigation manual o Expo Router.
- **Decisión:** usar **Expo Router**; `src/app/` contiene rutas, `_layout.tsx` define navegadores, el código no-ruta vive fuera de `src/app/`.
- **Consecuencias:** rutas tipadas, deep-linking más natural (clave para notificaciones push); se pierde algo de control explícito sobre el árbol de navegación.

## D-004 · 17/nov/2026 · Máquina de estados de comisión en el servidor
- **Contexto:** la transición de estados (`pendiente → aceptada → en_progreso → entregada → cerrada` y rechazos) debe ser atómica y auditable.
- **Decisión:** modelar las transiciones como **RPC de Supabase** con validaciones en SQL, no como múltiples `update` desde el cliente.
- **Alternativas consideradas:** hacer las transiciones desde el cliente controladas por RLS.
- **Consecuencias:**
  - (+) Imposible dejar la comisión en estado inválido desde el cliente.
  - (+) Se pueden escribir pruebas unitarias SQL.
  - (−) Más fricción al agregar un nuevo estado (requiere migración).

## D-005 · 19/nov/2026 · Índices para seguimiento del cliente
- **Contexto:** consultas del cliente sobre todas sus comisiones mostraban latencia conforme crecía la tabla.
- **Decisión:** añadir índices compuestos específicos en migración `007_client_tracking_indexes.sql` en lugar de índices genéricos.
- **Consecuencias:** mejor rendimiento en el *happy path*; ligero costo de escritura y almacenamiento.

## D-006 · 20/nov/2026 · Avances como imágenes en Storage + metadatos en SQL
- **Contexto:** el artista sube varias imágenes por avance.
- **Decisión:** las imágenes viven en Supabase Storage (bucket privado), los metadatos (orden, comentario, fecha) en tabla `commission_advances`. Se accede vía *signed URLs*.
- **Alternativas consideradas:** guardar las imágenes como `bytea` en Postgres.
- **Consecuencias:** separación clara de responsabilidades; se necesita cuidar la caducidad de las *signed URLs* en el cliente.

## D-007 · 21/nov/2026 · Pagos verificados manualmente por el artista
- **Contexto:** no hay pasarela de pago integrada; la aplicación debe convivir con transferencias/SPEI fuera de la app.
- **Decisión:** el cliente sube **comprobante de pago** (imagen), el artista revisa y aprueba o pide corrección. Se registra el estado en `commission_payments` y se desbloquea el entregable solo con pago aprobado.
- **Alternativas consideradas:** integrar Stripe/MercadoPago.
- **Consecuencias:**
  - (+) Compatible con el flujo real de la mayoría de artistas en LATAM.
  - (+) Cero fees de pasarela.
  - (−) Verificación manual, posible fricción; mayor superficie para disputas.

## D-008 · 21/nov/2026 · Entregable bloqueado hasta pago aprobado
- **Contexto:** evitar que el cliente descargue el arte final sin haber pagado.
- **Decisión:** la URL del entregable solo se expone cuando `payment_status = 'approved'`. Hasta entonces, el cliente ve `DeliverableLockedCard`.
- **Consecuencias:** se necesita cuidar también a nivel RLS que el cliente no pueda consultar el objeto antes de tiempo (defensa en profundidad).

## D-009 · 21/nov/2026 · Compresión y preparación de imágenes en el cliente
- **Contexto:** las imágenes de comprobantes y entregables pueden ser muy pesadas (10–30 MB desde cámara).
- **Decisión:** comprimir y redimensionar en el dispositivo antes de subir (`prepareDeliverableImage`, utilidad de compresión de prueba de pago).
- **Consecuencias:** menor costo de storage/ancho de banda; CPU extra en el cliente, pero aceptable.

## D-010 · 22/nov/2026 · Notificaciones push vía FCM + Edge Function
- **Contexto:** se necesitan notificaciones cuando hay eventos en la comisión (nuevo avance, pago aprobado, corrección solicitada).
- **Decisión:**
  - Registrar tokens de dispositivo en tabla `device_tokens`.
  - Usar `pg_net` para encolar envíos desde triggers SQL.
  - Edge Function de Supabase consume la cola y llama a FCM.
- **Alternativas consideradas:** Expo Push API directo (menos control), notificar desde el cliente (inviable sin backend confiable).
- **Consecuencias:** desacople entre evento de dominio y envío; se puede reintentar; añade complejidad operativa (monitorear la cola y la Edge Function).

## D-011 · 22/nov/2026 · Migraciones aplicadas manualmente en Supabase web
- **Contexto:** la usuaria prefiere revisar cada DDL antes de ejecutarlo.
- **Decisión:** el asistente **no** ejecuta `supabase db push`; produce el archivo SQL en `supabase/migrations/` y la usuaria lo corre en el editor SQL de Supabase.
- **Consecuencias:** más control humano; menos automatización. Se mantiene de todos modos el versionado en repo.

## D-012 · 22/nov/2026 · Sistema de tema y componentes UI propios
- **Contexto:** estilos dispersos y colores hardcodeados dificultaban el modo oscuro y la consistencia.
- **Decisión:** crear `src/theme/index.ts` con tokens, y componentes base `Text`, `Button`, `TextField`, `Badge` en `src/components/ui/`. Las pantallas se migran incrementalmente a consumir el tema.
- **Alternativas consideradas:** adoptar una librería (Tamagui, NativeWind, React Native Paper).
- **Consecuencias:**
  - (+) Control total sobre API y tamaño del bundle.
  - (+) Facilita futuras pruebas de accesibilidad (ver D-013).
  - (−) Hay que mantener los componentes a mano.

## D-013 · 22/nov/2026 · Accesibilidad: `accessibilityLiveRegion` para mensajes dinámicos
- **Contexto:** lectores de pantalla no anunciaban errores de formularios que aparecían después del envío.
- **Decisión:** usar `accessibilityLiveRegion` en zonas de mensaje dinámico (TosScreen, RegisterScreen) y, cuando corresponda, roles semánticos ARIA-equivalentes.
- **Consecuencias:** mejor soporte a lectores de pantalla en Android; iOS lo trata mejor vía `accessibilityLiveRegion="polite"`.

## D-014 · 22/nov/2026 · `KeyboardAwareScroll` en lugar de `ScrollView`
- **Contexto:** inputs ocultos por el teclado en pantallas largas.
- **Decisión:** reemplazar `ScrollView` por `KeyboardAwareScroll` en formularios.
- **Consecuencias:** mejor UX de teclado sin configuración por pantalla; dependencia adicional.

## D-015 · continuo · Uso de Claude Code con flujo spec-driven
- **Contexto:** acelerar implementación manteniendo calidad.
- **Decisión:** usar Claude Code (Anthropic) como copiloto; obligar a correr `npx expo lint` + `npx tsc --noEmit` antes de dar una tarea por cerrada; documentar sesiones en `BITACORA_IA.md`.
- **Consecuencias:** ganancia de velocidad; se necesita revisión crítica humana de cada diff para evitar que el asistente "invente" APIs (sobre todo porque Expo cambia por SDK).

---

## Decisiones pendientes / a reevaluar

- **Pasarela de pago:** reconsiderar si el flujo manual escala al crecer la base de usuarios.
- **Observabilidad:** aún no hay monitoreo de la cola `pg_net` ni alertas sobre fallos de Edge Function.
- **E2E tests:** actualmente solo hay unit tests y pruebas SQL.
- **Librería de UI:** si el sistema propio crece mucho, reconsiderar adopción de una librería existente.
