# Tareas 001 — Autenticación y perfil del artista (modo solo)
 
**Spec:** v0.2 · **Plan:** borrador · **Constitución:** v1.0 · **Versión de tareas:** 2.0 (reducida para trabajo individual) · **Fecha:** 2026-11-02
 
**Leyenda**
- **Tamaño:** S (≤ 1 h), M (1 a 3 h), L (3 a 6 h).
- **Traza:** requisito que cumple la tarea.
- ⚠️ = detalle de `supabase-js`, Supabase o Expo que hay que verificar al implementar (ver plan).
- Las pruebas unitarias van **antes** de la implementación que validan.
- Se trabaja en `main` con un commit por tarea: `feat: T020 supabase client`.
**Antes de cada commit corre:** `npx expo lint`, `npx tsc --noEmit` y `npx jest`.
 
**Meta de calendario:** terminar la parte principal (fases 0 a 3) en 3 o 4 días. Las tareas de la fase 4 se hacen al final si hay tiempo.
 
---
 
## Fase 0 — Preparación
 
- [x] **T001** Crear el proyecto Expo SDK 58 con TypeScript y Expo Router (rutas en `src/app/`). Verificar que abre en un dispositivo o emulador. · S
  - *Hecho cuando:* `npx expo start` abre la app vacía.
  - *Nota:* probar primero con Expo Go de SDK 58; si no está disponible o falla, ver T007.
- [x] **T002** Configurar calidad: `expo lint`, Prettier, Jest con `jest-expo` y scripts `lint` y `test`. · M · Traza: RNF-08
- [ ] **T003** Crear la estructura de carpetas del plan (`src/app/`, `src/features/auth/`, `src/lib/`, `supabase/migrations/`, `docs/`), `.env.example` y `.gitignore` (sin claves). · S
- [ ] **T004** Crear **un** proyecto de Supabase (`koma`). Guardar URL y clave pública en `.env` local. · S
- [ ] **T005** Copiar al repo `constitution.md`, el SRS y spec, plan y tareas. · S
- [ ] **T007** *(solo si Expo Go no sirve)* Generar el development build con EAS. · M
**Punto de control:** la app abre en un dispositivo o emulador y los comandos de calidad corren sin errores.
 
---
 
## Fase 1 — Base de datos y Auth
 
- [ ] **T010** Escribir un **script SQL de pruebas de RLS** (`supabase/tests/rls.sql`) y correrlo a mano con dos usuarios de prueba: un artista no lee ni edita la fila de otro, `anon` no lee nada, no se editan `privacy_*` ni `profile_complete`, handle duplicado y reservado rechazados, registro sin consentimiento rechazado. · M · Traza: RNF-04, RNF-09, RF-20
- [ ] **T011** Escribir la migración `0001_artists.sql` (tabla, restricciones, triggers, función `is_handle_available`, RLS y permisos por columna) según el plan. · M · Traza: RF-17, RF-20, RNF-09
- [ ] **T012** Aplicar la migración y hacer que pase el script de T010. · S
- [ ] **T013** Configurar Auth: confirmación de correo **desactivada** por ahora, contraseña mínima de 8, JWT de 24 h, rotación de refresh tokens ⚠️. · S · Traza: RNF-02, RNF-04
- [ ] **T014** Redactar las plantillas de correo en español (confirmación y recuperación) mostrando `{{ .Token }}`. · S · Traza: RF-17, RF-19
**Punto de control:** el script de RLS pasa y existen dos usuarios de prueba.
 
---
 
## Fase 2 — Núcleo del cliente
 
- [ ] **T020** Cliente de Supabase en `src/lib/supabase.ts`: variables de entorno, almacenamiento cifrado de la sesión (AES en SecureStore y datos en AsyncStorage ⚠️), `detectSessionInUrl: false` y `AppState` para iniciar y detener el refresco. · M · Traza: RF-18, RNF-04
- [ ] **T021** `messages.ts` con todos los mensajes de la tabla de errores de la spec, literales. · S
- [ ] **T022** Pruebas y luego `schemas.ts` (Zod): registro, login y perfil, con reglas de handle y lista de reservados. · M · Traza: RF-17, RF-18, RF-20
- [ ] **T023** Pruebas y luego `errors.ts`: traduce códigos de error de Supabase y Postgres `23505` a mensajes de `messages.ts` ⚠️. · M · Traza: tabla de errores de la spec
- [ ] **T024** `api.ts`: `signUp` (con metadatos de privacidad), `signIn`, `signOut` ⚠️. Depende de T020 y T023. · M · Traza: RF-17, RF-18
- [ ] **T025** `AuthProvider` y `useArtistProfile` (sesión, `onAuthStateChange`, lectura y edición del perfil). Depende de T020 y T024. · M · Traza: RF-18, RF-20
**Punto de control:** pruebas unitarias en verde y se puede registrar e iniciar sesión contra Supabase desde una pantalla temporal.
 
---
 
## Fase 3 — Pantallas principales
 
- [ ] **T030** `register.tsx`: correo, contraseña, casilla de aviso de privacidad (bloquea el envío), errores en español. Depende de T022 y T024. · M · Traza: RF-17, RNF-09, RI-01
- [ ] **T032** `login.tsx`: mensaje genérico ante credenciales incorrectas y bloqueo por demasiados intentos. · M · Traza: RF-18
- [ ] **T033** Layouts y **guardas** de navegación: sin sesión → login; sesión con perfil incompleto → `profile-setup`; todo en orden → panel. (La regla de "correo sin verificar" se agrega en T031.) Depende de T025. · L · Traza: RF-18, RF-20
- [ ] **T034** Cerrar sesión: elimina la sesión almacenada y reemplaza la pila para que el botón atrás no regrese al panel. · S · Traza: RF-18
- [ ] **T037** `profile-setup.tsx`: nombre (2 a 50), handle (3 a 30, formato y reservados), disponibilidad en vivo con debounce, error de handle duplicado, muestra el enlace resultante. · L · Traza: RF-20
- [ ] **T039** Panel placeholder (`(app)/index.tsx`) con el nombre del artista y botón de cerrar sesión, hasta la spec 004. · S
**Punto de control:** el flujo completo (registro → perfil → panel → cerrar sesión → login) funciona de principio a fin, con verificación desactivada. **Aquí la spec 001 ya cumple el mínimo para seguir con la 002.**
 
---
 
## Fase 4 — Al final, si hay tiempo
 
- [ ] **T031** `verify-email.tsx`: código de 6 dígitos, reenviar con espera, mensaje neutro ante correo ya registrado, código inválido o vencido; y regla de guarda "correo sin verificar". · M · Traza: RF-17
- [ ] **T041** ⏳ **Depende del dominio.** Verificar el subdominio de envío en Resend, configurar SMTP en Supabase, activar la confirmación de correo y subir las plantillas. Después, los artistas reales ya pueden registrarse. · M · Traza: P-1, RNF-09
- [ ] **T035** `forgot-password.tsx`: aviso neutro exista o no el correo. · S · Traza: RF-19
- [ ] **T036** `reset-password.tsx`: código + nueva contraseña, código vencido o reutilizado rechazado, cierre de otras sesiones ⚠️. Añadir `requestPasswordReset` y `resetPassword` a `api.ts`. · M · Traza: RF-19
- [ ] **T038** Editar perfil (`profile.tsx`) con advertencia al cambiar el handle. · M · Traza: RF-20
- [ ] **T042** Prueba manual completa con correo real: registro, código, perfil, cierre y reapertura de la app (la sesión persiste), recuperación de contraseña. · M · Traza: RF-17 a RF-20
- [ ] **T044** Revisar cobertura (≥ 60 % en la lógica) y `expo lint` sin errores. · S · Traza: RNF-08
- [ ] **T045** Revisar el checklist de aceptación de la spec, actualizar spec y plan con lo que cambió y cerrar los ⚠️. · S
---
 
## Tareas omitidas en modo solo
 
| Tarea | Motivo | Cómo se compensa |
|---|---|---|
| T006 CI en GitHub Actions | Sin equipo no aporta mucho | Correr lint, typecheck y pruebas antes de cada commit |
| T040 proyecto `koma-prod` | Un solo proyecto basta para el MVP | Activar la verificación de correo en el mismo proyecto (T041) |
| T043 keep-alive | Complejidad innecesaria | Reactivar el proyecto desde el panel de Supabase antes de la demo |
| Pruebas de componentes y de guardas | Costo alto para el tiempo disponible | Prueba manual de los flujos |
 
> Al usar un solo proyecto, las cuentas de prueba creadas con la verificación desactivada quedan como verificadas. **Los artistas reales solo deben registrarse después de T041.**
 
## Ruta crítica
 
T001 → T004 → T011 → T012 → T020 → T024 → T025 → T033 → T037
 
## Trazabilidad
 
| Requisito | Tareas |
|---|---|
| RF-17 | T011, T014, T022, T024, T030, T031 |
| RF-18 | T020, T024, T025, T032, T033, T034 |
| RF-19 | T014, T035, T036 |
| RF-20 | T010, T011, T022, T037, T038 |
| RNF-02 | T013, T042 |
| RNF-04 | T010, T013, T020 |
| RNF-08 | T002, T044 |
| RNF-09 | T010, T011, T030, T041 |
| RI-01 | T030, T033, T037 |