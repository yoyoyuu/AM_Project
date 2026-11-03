# Constitución de Koma
 
**Versión:** 1.1 · **Fecha:** 2026-11-02 · **Equipo:** Eqüipo--
**Base:** Plan de negocios 2026-2 y SRS ISO 29148 v4.0 (con las correcciones de la sección 8)
 
Este documento fija los principios que **no se negocian** durante el desarrollo. Toda spec, plan y tarea debe cumplirlos. Si una spec los contradice, se corrige la spec o se enmienda esta constitución (sección 9), nunca se ignora.
 
---
 
## 1. Qué es Koma y qué es el MVP
 
Koma centraliza el registro, el seguimiento y el cierre de comisiones de arte digital entre ilustradores independientes y sus clientes. **Todo ocurre dentro de una app móvil Android.**
 
- **Una sola cuenta por persona.** Artista y cliente son **roles** de la misma cuenta. Se es artista al activar el perfil de artista (con un handle público); cualquier usuario puede pedir comisiones.
- **El cliente encuentra al artista** por su handle (o QR) dentro de la app y solicita la comisión ahí.
- **Las notificaciones son push**, para artista y cliente. El correo se usa solo para la autenticación (verificación y recuperación).
**Fecha límite del MVP:** 13 de noviembre de 2026 (RC-04). Existe la posibilidad de extenderla al 22 de noviembre, **pendiente de confirmación escrita de las docentes**. Se planifica para tener algo demostrable el día 13.
 
## 2. Principios no negociables
 
1. **La spec es la fuente de verdad.** No se escribe código sin una spec aprobada. Si el código y la spec difieren, se corrige primero la spec.
2. **Costo cero.** Solo tecnologías gratuitas, de código abierto o con plan gratuito (RC-02, RC-03). Antes de adoptar un servicio se verifican sus límites vigentes. Excepciones aprobadas: el dominio (ya comprado para otro fin).
3. **Una sola base de código, solo Android.** Expo SDK 58 (React Native 0.88, React 19.2, TypeScript estricto) con Expo Router. Se trabaja con development build; no se soporta iOS ni web en esta versión.
4. **Los pagos viven fuera del sistema.** Koma solo registra el estado del pago; nunca procesa, custodia ni reembolsa dinero (RC-01).
5. **Seguridad por defecto.**
   - Row Level Security (RLS) activado en **todas** las tablas.
   - Ningún secreto, `service_role key` ni credencial de Firebase en el repositorio ni en variables `EXPO_PUBLIC_*`.
   - Toda comunicación por HTTPS (RI-04).
6. **Una cuenta para todos.** Autenticación única para artistas y clientes; los permisos se resuelven con RLS a partir del usuario autenticado, nunca con datos que envíe el cliente.
7. **Push como canal principal.** Las notificaciones de eventos de comisión se envían por push. Se vinculan al usuario autenticado y se eliminan al cerrar sesión. El contenido es discreto (sin datos sensibles en pantalla de bloqueo).
8. **Funciones nativas con permisos mínimos.** Galería, cámara y notificaciones se piden solo cuando se necesitan, con un mensaje claro del motivo, y la app funciona razonablemente si el usuario los niega.
9. **Cada criterio de aceptación es una prueba.** Todo escenario Given/When/Then de una spec tiene al menos una prueba automatizada o un caso de prueba manual documentado.
10. **Privacidad conforme a la LFPDPPP.** Aviso de privacidad y consentimiento explícito antes de crear la cuenta (RNF-09, RC-05). Solo se piden los datos necesarios.
11. **Simplicidad.** Se construye lo mínimo que cumple la spec. Sin abstracciones, librerías o configuraciones "por si acaso".
## 3. Stack
 
| Capa | Tecnología |
|---|---|
| App | Expo SDK 58, React Native 0.88, React 19.2, TypeScript (estricto), solo Android |
| Navegación | Expo Router |
| Formularios y validación | React Hook Form + Zod |
| Datos en cliente | TanStack Query |
| Backend | Supabase: Postgres, Auth, Storage, Edge Functions |
| Correo (solo autenticación) | Resend como SMTP de Supabase Auth |
| Notificaciones push | `expo-notifications`, Expo Push Service y Firebase Cloud Messaging |
| Galería y cámara | `expo-image-picker`, `expo-image-manipulator`, `expo-media-library` |
| Builds y distribución | EAS Build (cuota gratuita), development build y APK de distribución interna |
| Calidad | ESLint (`expo lint`), Jest + `jest-expo` |
 
Cambiar cualquier fila requiere enmienda (sección 9). Detalles de librerías y permisos se verifican en la documentación de SDK 58.
 
## 4. Estructura del repositorio
 
```
koma/
├─ constitution.md
├─ AGENTS.md
├─ specs/
│  └─ NNN-nombre/
│     ├─ spec.md      # qué y por qué (sin tecnología)
│     ├─ plan.md      # cómo (arquitectura, datos, contratos)
│     └─ tasks.md     # tareas pequeñas trazables a RF/RNF
├─ src/
│  ├─ app/            # SOLO rutas de Expo Router
│  ├─ features/       # lógica y componentes por feature (auth, catalogo...)
│  ├─ components/     # componentes compartidos
│  └─ lib/            # clientes y utilidades (supabase.ts)
├─ supabase/
│  ├─ migrations/     # SQL versionado, incluye políticas RLS
│  ├─ functions/      # Edge Functions
│  └─ tests/          # scripts de pruebas de RLS
└─ docs/              # SRS y plan de negocios
```
 
## 5. Convenciones
 
- **Idioma:** specs, UI y mensajes de error en **español**; código, nombres de variables y commits en **inglés**.
- **Mensajes de error:** se usan literalmente los definidos en las specs.
- **Commits:** los hace la persona, no el agente. Conventional Commits con el ID de tarea (`feat: T020 supabase client`).
- **Migraciones:** toda tabla nueva incluye su RLS en la misma migración.
- **Tipos:** prohibido `any` salvo justificación en comentario.
## 6. Flujo SDD y definición de hecho
 
1. **Spec** aprobada (sin ambigüedades marcadas como `[PENDIENTE]`).
2. **Plan** técnico derivado de la spec.
3. **Tasks** ordenadas, cada una trazable a un RF/RNF.
4. **Implementación** tarea por tarea.
5. **Validación** contra los criterios de aceptación.
Una feature está **hecha** cuando: todos sus criterios Must pasan, `expo lint` y `tsc` dan 0 errores, la cobertura de la lógica es ≥ 60 % (RNF-08), las políticas RLS tienen prueba de acceso denegado, y la spec refleja lo implementado.
 
## 7. Alcance y mapa de features
 
| Spec | Contenido | Fase |
|---|---|---|
| 001-auth-perfiles | Cuenta, sesión, perfil, activar rol de artista | MVP |
| 002-catalogo-tos | Servicios con precio, tiempo y TOS (RF-02, RF-03); búsqueda por handle | MVP |
| 003-solicitud-comision | Solicitud del cliente con referencias desde galería (RF-06, RF-14) | MVP |
| 004-gestion-comision | Aceptar/rechazar, estados y etapas (RF-07) | MVP |
| 005-seguimiento-cliente | Tablero de estado en la app (RF-01) | MVP |
| 006-avances | Subida de avances desde galería, con compresión (RF-09) | MVP |
| 007-pagos-entregable | Estado de pago, comprobante, desbloqueo y guardado en galería (RF-11, RF-12, RF-15) | MVP |
| 008-notificaciones-push | Push para artista y cliente (reemplaza RF-08 y RF-10 por correo) | MVP |
| 009-cupos-historial-plazos | Cupos, historial, plazos (RF-04, RF-05, RF-13, RF-16) | Post-MVP |
 
**Fuera de alcance (v1):** web, iOS, procesamiento de pagos, marketplace, verificación de identidad o detección de IA, herramientas de dibujo, facturación, mediación de disputas, arte físico, notificaciones por correo de eventos de comisión.
 
## 8. Correcciones pendientes al SRS (para una v5.0)
 
Resolver y avisar a las docentes antes de la entrega final:
 
1. **Alcance de plataforma:** reescribir RC-06, RI-01, RNF-07 y la sección 7: app móvil Android (Expo), sin versión web.
2. **Cuenta para el cliente:** reescribir RNF-04 y el glosario ("token de seguimiento"): una cuenta para todos, JWT y RLS.
3. **Notificaciones:** RF-08 y RF-10 pasan de correo a push; agregar un RF de registro de dispositivo, un RNF de privacidad de notificaciones y las interfaces con Expo Push y FCM (RI-02).
4. **Sección 1.1:** dice "versión 3.0"; debe decir 5.0.
5. **Sección 7:** corregir referencias cruzadas de RNF.
6. **Nuevos RF:** registro, sesión, recuperación de contraseña, perfil y activar rol de artista (spec 001, RF-17 a RF-22); búsqueda de artista; cambio de etapa de la comisión; subida del entregable final; subida del comprobante por el cliente (necesario para RF-15).
7. **RF-11 / RF-15:** agregar el estado "Requiere corrección".
8. **RF-04 / RF-05:** definir qué cuenta como comisión "activa".
9. **RF-16:** definir "acciones automáticas por inactividad" o moverlo fuera del MVP.
10. **Estados:** alinear los estados genéricos con las etapas creativas del plan de negocios (boceto, delineado, color).
11. **RC-04:** si se aprueba la extensión, actualizar la fecha.
12. **Plan de negocios:** ajustar la propuesta de valor y los perfiles (el cliente ahora tiene cuenta y usa la app; amenaza A3).
## 9. Gobierno de la constitución
 
- Cualquier cambio se propone modificando este archivo y se registra aquí. Cada enmienda sube la versión (mayor si cambia un principio o el stack, menor si es aclaración).
| Versión | Fecha | Cambio |
|---|---|---|
| 1.0 | 2026-11-02 | Versión inicial |
| 1.1 | 2026-11-02 | App solo Android; una cuenta para artista y cliente; push como canal principal; funciones nativas (galería, cámara); nuevo mapa de features |
 