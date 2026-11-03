# Tareas 001 — Cuenta, sesión y perfiles (modo solo)
 
**Spec:** v0.3 · **Plan:** borrador · **Constitución:** v1.1 · **Versión de tareas:** 3.0 · **Fecha:** 2026-11-02
 
**Leyenda**
- **Tamaño:** S (≤ 1 h), M (1 a 3 h), L (3 a 6 h).
- ⚠️ = detalle de `supabase-js`, Supabase o Expo que hay que verificar al implementar.
- Las pruebas unitarias van **antes** de la implementación que validan.
- Un commit por tarea, hecho por la persona: `feat: T020 supabase client`.
**Antes de cada commit:** `npx expo lint`, `npx tsc --noEmit` y `npx jest`.
 
**Meta de calendario:** fases 0 a 3 en 3 o 4 días. La fase 4 se hace al final.
 
> **Cambios respecto a la v2.0:** el rol de artista se activa con un handle en la misma cuenta, así que cambian las tareas T010 a T012 y T037 a T040. T007 (development build) pasa a **obligatorio** y se agrega T008 (Firebase y push de prueba).
 
---
 
## Fase 0 — Preparación
 
- [x] **T001** Crear el proyecto Expo SDK 58 con TypeScript y Expo Router (rutas en `src/app/`). · S
- [x] **T002** Configurar calidad: `expo lint`, Prettier, Jest con `jest-expo` y scripts `lint` y `test`. · M · Traza: RNF-08
- [x] **T003** Crear la estructura de carpetas (`src/app/`, `src/features/auth/`, `src/lib/`, `supabase/migrations/`, `supabase/tests/`, `docs/`), `.env.example` y `.gitignore` (sin claves). · S
- [x] **T004** *(manual)* Crear **un** proyecto de Supabase (`koma`). Guardar URL y clave pública en `.env` local. · S
- [x] **T005** *(manual)* Copiar al repo `constitution.md`, el SRS y spec, plan y tareas **v nuevas** (carpeta `specs/001-auth-perfiles/`). · S
- [ ] **T007** *(obligatorio, Android)* Generar el development build con EAS: definir `android.package` y `projectId`, y correr `eas build --profile development --platform android`. · M
- [ ] **T008** *(manual)* Crear un proyecto de Firebase con Cloud Messaging, configurar las credenciales en EAS (la clave del servicio **nunca** va al repo) y enviar una **push de prueba** a tu celular con la herramienta de Expo. Reduce el riesgo de la spec 008. · M
**Punto de control:** el development build abre en tu celular, los comandos de calidad corren sin errores y recibes una push de prueba.
 
---
 
## Fase 1 — Base de datos y Auth
 
- [x] **T010** Escribir el **script SQL de pruebas de RLS** (`supabase/tests/rls.sql`) y correrlo a mano con dos usuarios: un usuario no lee ni edita el perfil de otro, `anon` no lee nada, no se editan `privacy_*`, `profile_complete` ni `is_artist`, handle duplicado y reservado rechazados, el handle no se puede borrar, registro sin consentimiento rechazado. · M · Traza: RNF-04, RNF-09, RF-20, RF-21
- [x] **T011** Escribir la migración `0001_profiles.sql` según el plan (tabla, restricciones, triggers, función `is_handle_available`, RLS y permisos por columna). · M · Traza: RF-17, RF-20, RF-21, RNF-09
- [x] **T012** Aplicar la migración y hacer que pase el script de T010. · S
- [x] **T013** Configurar Auth: confirmación de correo **desactivada** por ahora, contraseña mínima de 8, JWT de 24 h, rotación de refresh tokens ⚠️. · S · Traza: RNF-02, RNF-04
- [x] **T014** Redactar las plantillas de correo en español (confirmación y recuperación) mostrando `{{ .Token }}`. · S · Traza: RF-17, RF-19
**Punto de control:** el script de RLS pasa y existen dos usuarios de prueba.
 
---
 
## Fase 2 — Núcleo del cliente
 
- [x] **T020** Cliente de Supabase en `src/lib/supabase.ts`: variables de entorno, almacenamiento cifrado de la sesión ⚠️, `detectSessionInUrl: false` y `AppState` para el refresco. · M · Traza: RF-18, RNF-04
- [x] **T021** `messages.ts` con todos los mensajes de la tabla de errores de la spec, literales. · S
- [x] **T022** Pruebas y luego `schemas.ts` (Zod): registro, login, nombre y handle con reservados. · M · Traza: RF-17, RF-18, RF-20, RF-21
- [x] **T023** Pruebas y luego `errors.ts`: traduce errores de Supabase y Postgres (`23505`, `23514`) a mensajes de `messages.ts` ⚠️. · M · Traza: tabla de errores
- [x] **T024** `api.ts`: `signUp` (con metadatos de privacidad), `signIn`, `signOut` ⚠️. Depende de T020 y T023. · M · Traza: RF-17, RF-18
- [x] **T025** `AuthProvider`, `useProfile` y `useAppMode` (sesión, `onAuthStateChange`, perfil, activar artista, modo local). Depende de T020 y T024. · M · Traza: RF-18, RF-20, RF-21, RF-22
**Punto de control:** pruebas unitarias en verde y se puede registrar e iniciar sesión contra Supabase desde una pantalla temporal.
 
---
 
## Fase 3 — Pantallas principales
 
- [ ] **T030** `register.tsx`: correo, contraseña, casilla de aviso de privacidad (bloquea el envío), errores en español. · M · Traza: RF-17, RNF-09
- [ ] **T032** `login.tsx`: mensaje genérico ante credenciales incorrectas y bloqueo por demasiados intentos. · M · Traza: RF-18
- [ ] **T033** Layouts y **guardas**: sin sesión → login; perfil sin nombre → `profile-setup`; todo en orden → inicio. (La regla de "correo sin verificar" se agrega en T031.) Depende de T025. · L · Traza: RF-18, RF-20
- [ ] **T034** Cerrar sesión: elimina la sesión almacenada y reemplaza la pila para que el botón atrás no regrese a la app. · S · Traza: RF-18
- [ ] **T037** `profile-setup.tsx`: nombre (2 a 50) y errores en español. · S · Traza: RF-20
- [ ] **T038** `artist-setup.tsx`: handle (3 a 30, formato y reservados), disponibilidad en vivo con debounce, errores de duplicado y reservado, advertencia al cambiarlo. · L · Traza: RF-21
- [ ] **T039** `index.tsx` placeholder: si no es artista, dos opciones ("Quiero pedir una comisión", pendiente de la spec 003, y "Quiero ofrecer comisiones", que lleva a `artist-setup`); si es artista, panel básico con su nombre y handle. Incluye botón de cerrar sesión. · M · Traza: RF-21
- [ ] **T040** Alternar modo artista/cliente y recordarlo en el dispositivo. · S · Traza: RF-22
**Punto de control:** el flujo (registro → nombre → activar artista → inicio → cerrar sesión → login) funciona de principio a fin, con verificación desactivada. **Aquí la spec 001 ya cumple el mínimo para seguir con la 002.**
 
---
 
## Fase 4 — Al final, si hay tiempo
 
- [ ] **T031** `verify-email.tsx`: código de 6 dígitos, reenviar con espera, mensaje neutro ante correo ya registrado, código inválido o vencido; y regla de guarda "correo sin verificar". · M · Traza: RF-17
- [ ] **T041** ⏳ **Depende del dominio.** Verificar el subdominio en Resend, configurar SMTP en Supabase, activar la confirmación de correo y subir las plantillas. Después, los usuarios reales ya pueden registrarse. · M · Traza: P-1, RNF-09
- [ ] **T035** `forgot-password.tsx`: aviso neutro exista o no el correo. · S · Traza: RF-19
- [ ] **T036** `reset-password.tsx`: código + nueva contraseña, código vencido o reutilizado rechazado. Añadir `requestPasswordReset` y `resetPassword` a `api.ts`. · M · Traza: RF-19
- [ ] **T046** `profile.tsx`: editar nombre y handle. · M · Traza: RF-20, RF-21
- [ ] **T042** Prueba manual completa con correo real en el celular: registro, código, perfil, activar artista, cierre y reapertura (la sesión persiste), recuperación. · M · Traza: RF-17 a RF-22
- [ ] **T044** Revisar cobertura (≥ 60 % en la lógica) y `expo lint` sin errores. · S · Traza: RNF-08
- [ ] **T045** Revisar el checklist de aceptación, actualizar spec y plan con lo que cambió y cerrar los ⚠️. · S
---
 
## Tareas omitidas en modo solo
 
| Tarea | Motivo | Cómo se compensa |
|---|---|---|
| CI en GitHub Actions | Sin equipo no aporta mucho | Correr lint, typecheck y pruebas antes de cada commit |
| Proyecto `koma-prod` | Un solo proyecto basta para el MVP | Activar la verificación de correo en el mismo proyecto (T041) |
| Keep-alive | Complejidad innecesaria | Reactivar el proyecto desde el panel antes de la demo |
| Pruebas de componentes y guardas | Costo alto para el tiempo disponible | Prueba manual |
 
> Mientras la verificación esté desactivada, las cuentas creadas quedan como verificadas. **Los usuarios reales solo deben registrarse después de T041.**
 
## Ruta crítica
 
T001 → T007 → T004 → T011 → T012 → T020 → T024 → T025 → T033 → T038
 
## Trazabilidad
 
| Requisito | Tareas |
|---|---|
| RF-17 | T011, T014, T022, T024, T030, T031 |
| RF-18 | T020, T024, T025, T032, T033, T034 |
| RF-19 | T014, T035, T036 |
| RF-20 | T010, T011, T022, T033, T037, T046 |
| RF-21 | T010, T011, T022, T038, T039, T046 |
| RF-22 | T025, T040 |
| RNF-02 | T013, T042 |
| RNF-04 | T010, T013, T020 |
| RNF-08 | T002, T044 |
| RNF-09 | T010, T011, T030, T041 |
 