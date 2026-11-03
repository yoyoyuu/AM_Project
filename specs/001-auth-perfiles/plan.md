# Plan técnico 001 — Cuenta, sesión y perfiles
 
**Spec:** `spec.md` v0.3 · **Constitución:** v1.1 · **Fecha:** 2026-11-02
**Estado:** Borrador
 
> Este plan dice **cómo** se cumple la spec. Los códigos de error, tipos de OTP y opciones de configuración deben **verificarse contra la versión instalada de `supabase-js` y el panel de Supabase**; están marcados con ⚠️.
 
---
 
## 1. Decisiones de diseño
 
| # | Decisión | Motivo |
|---|---|---|
| D1 | Supabase Auth maneja cuentas, bcrypt, JWT y refresh tokens | Cubre RNF-02 y RNF-04 sin backend propio |
| D2 | Verificación y recuperación con **código de 6 dígitos**, no enlace | Evita deep links y App Links (que exigen dominio verificado en Android) |
| D3 | Tabla `profiles` (una fila por usuario) con RLS; `is_artist` se deriva del handle | Una sola cuenta para ambos roles |
| D4 | El perfil se crea con un trigger al registrarse | El cliente nunca inserta filas de perfiles |
| D5 | Flujo de verificación implementado desde el inicio, activado cuando haya dominio | Acordado en P-1 |
| D6 | Un solo proyecto Supabase (`koma`) | Trabajo individual; se activa la verificación al final |
| D7 | Modo artista/cliente se guarda **localmente** en el dispositivo | Es preferencia de interfaz, no dato de seguridad |
 
## 2. Arquitectura
 
```
App Expo (Android)
  ├─ supabase-js ──► Supabase Auth ──► SMTP (Resend) ──► correo con código
  │         │
  │         └──────► PostgREST ──► tabla profiles (RLS)
  └─ Expo Router: grupos (auth) y (app) con guardas por estado de sesión
```
 
No hay servidor propio ni Edge Functions en esta spec.
 
## 3. Modelo de datos
 
Migración: `supabase/migrations/0001_profiles.sql`
 
```sql
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  handle text,
  privacy_accepted_at timestamptz not null,
  privacy_notice_version text not null,
  profile_complete boolean generated always as (display_name is not null) stored,
  is_artist boolean generated always as (handle is not null) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
 
  constraint profiles_display_name_len
    check (display_name is null or char_length(display_name) between 2 and 50),
  constraint profiles_handle_format
    check (handle is null or (
      char_length(handle) between 3 and 30
      and handle ~ '^[a-z0-9]+(-[a-z0-9]+)*$')),
  constraint profiles_handle_reserved
    check (handle is null or handle <> all (array[
      'admin','api','app','auth','login','logout','register','registro',
      'signup','signin','verify','reset','forgot','profile','perfil',
      'settings','ajustes','support','soporte','help','ayuda','koma',
      'www','mail','root','about','terms','privacy','privacidad',
      'comisiones','catalogo','artista','artistas','cliente','clientes']))
);
 
create unique index profiles_handle_key on public.profiles (handle);
 
create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;
 
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
 
-- El perfil de artista no se puede desactivar (RF-21)
create function public.prevent_handle_unset() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.handle is not null and new.handle is null then
    raise exception 'artist_profile_cannot_be_unset';
  end if;
  return new;
end; $$;
 
create trigger profiles_prevent_handle_unset before update on public.profiles
for each row execute function public.prevent_handle_unset();
 
-- Crea el perfil al registrarse y exige el consentimiento (RNF-09)
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.raw_user_meta_data ->> 'privacy_accepted', 'false') <> 'true' then
    raise exception 'privacy_not_accepted';
  end if;
  insert into public.profiles (id, privacy_accepted_at, privacy_notice_version)
  values (new.id, now(), coalesce(new.raw_user_meta_data ->> 'privacy_notice_version', 'v1'));
  return new;
end; $$;
 
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();
 
-- Disponibilidad de handle (sin exponer la tabla)
create function public.is_handle_available(p_handle text) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.profiles where handle = p_handle);
$$;
revoke execute on function public.is_handle_available(text) from public, anon;
grant execute on function public.is_handle_available(text) to authenticated;
 
-- RLS
alter table public.profiles enable row level security;
 
create policy "usuario lee su perfil" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
 
create policy "usuario edita su perfil" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
 
-- Permisos por columna: solo nombre y handle son editables
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, handle) on public.profiles to authenticated;
```
 
Notas:
- No hay políticas de `insert` ni `delete` para el cliente: lo crea el trigger y lo borra la cascada de `auth.users`.
- La búsqueda de artistas por handle y la visibilidad del nombre entre artista y cliente se resolverán en las specs 002 y 003 con funciones controladas, **no** abriendo `profiles` con políticas amplias.
- Un handle duplicado produce el error Postgres `23505`; se traduce a "Ese identificador ya está en uso". Un handle reservado viola `profiles_handle_reserved` (`23514`); se traduce a "Ese identificador no está disponible".
## 4. Configuración de Supabase Auth
 
| Ajuste | Valor |
|---|---|
| Proveedor Email | Activo |
| Confirm email | **Desactivado** hasta tener el dominio; luego **Activado** (T041) |
| Longitud mínima de contraseña | 8 |
| JWT expiry | 86400 s (24 h) ⚠️ verificar rango permitido |
| Refresh token rotation | Activada ⚠️ |
| SMTP personalizado | Resend (`smtp.resend.com`) al activar la verificación |
| Plantillas de correo | En español, con `{{ .Token }}` |
 
⚠️ Con la verificación activa, registrar un correo existente no devuelve error (devuelve un usuario "ofuscado"), lo que encaja con P-2. Con la verificación desactivada sí puede devolver error de usuario existente; la UI debe tratar ambos casos igual.
 
## 5. Cliente Expo (Android)
 
### 5.1 Cliente de Supabase (`src/lib/supabase.ts`)
 
- Variables: `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_KEY` (clave pública; la protege RLS). **Nunca** la `service_role`.
- Opciones: `autoRefreshToken: true`, `persistSession: true`, `detectSessionInUrl: false`.
- **Almacenamiento de sesión:** `expo-secure-store` tiene un límite de tamaño por valor que una sesión puede superar. Usar el patrón de Supabase: clave AES en SecureStore que cifra la sesión guardada en AsyncStorage. ⚠️ Confirmar el patrón vigente.
- `AppState` listener: `startAutoRefresh()` en primer plano y `stopAutoRefresh()` en segundo plano.
### 5.2 Rutas (Expo Router, en `src/app/`)
 
```
src/app/
├─ _layout.tsx                 # providers (Query, Auth) y splash hasta resolver la sesión
├─ (auth)/
│  ├─ _layout.tsx
│  ├─ login.tsx
│  ├─ register.tsx
│  ├─ verify-email.tsx         # código de 6 dígitos + reenviar
│  ├─ forgot-password.tsx
│  └─ reset-password.tsx
└─ (app)/
   ├─ _layout.tsx              # solo accesible con sesión
   ├─ profile-setup.tsx        # RF-20: nombre
   ├─ artist-setup.tsx         # RF-21: activar perfil de artista (handle)
   ├─ index.tsx                # inicio según modo (RF-22)
   └─ profile.tsx              # editar nombre y handle, cerrar sesión
```
 
**Guardas**, en este orden:
 
1. Sin sesión → `(auth)/login`.
2. Sesión con correo sin verificar (solo si la verificación está activa) → `(auth)/verify-email`.
3. Sesión verificada y `profile_complete = false` → `(app)/profile-setup`.
4. Todo en orden → `(app)/index`.
`artist-setup` no es obligatoria: se llega desde el inicio con la opción "Quiero ofrecer comisiones". En `index`, un usuario sin `is_artist` ve dos opciones: pedir una comisión (placeholder hasta la spec 003) y ofrecer comisiones (lleva a `artist-setup`). Un artista ve su panel o la vista de cliente según el modo guardado en AsyncStorage.
 
### 5.3 Código (`src/features/auth/`)
 
| Archivo | Responsabilidad |
|---|---|
| `schemas.ts` | Esquemas Zod: registro, login, recuperar, restablecer, nombre y handle (con reservados) |
| `messages.ts` | **Todos** los mensajes de la tabla de errores de la spec, literales |
| `errors.ts` | Traduce errores de Supabase y Postgres a un mensaje de `messages.ts` |
| `api.ts` | `signUp`, `verifyEmail`, `resendCode`, `signIn`, `signOut`, `requestPasswordReset`, `resetPassword` |
| `AuthProvider.tsx` | Estado de sesión, `onAuthStateChange`, perfil del usuario |
| `useProfile.ts` | Lectura y edición del perfil con TanStack Query; activar artista |
| `useAppMode.ts` | Modo artista/cliente en AsyncStorage |
 
### 5.4 Flujos
 
**Registro (RF-17):** formulario (correo, contraseña, casilla de aviso) → `signUp` con metadatos `privacy_accepted: true` y `privacy_notice_version` → pantalla `verify-email` con mensaje neutro → `verifyOtp` con el código ⚠️ (el `type` depende de la versión de `supabase-js`) → sesión → `profile-setup`.
 
**Verificación desactivada:** `signUp` devuelve sesión directamente y se salta `verify-email`.
 
**Inicio de sesión (RF-18):** `signInWithPassword`. Si el error indica correo sin confirmar → `verify-email`. Cualquier credencial incorrecta muestra el mensaje genérico. Al cerrar sesión se limpia la sesión y, desde la spec 008, se elimina el token push del dispositivo.
 
**Recuperación (RF-19):** `resetPasswordForEmail` → aviso neutro → `verifyOtp` de tipo recuperación ⚠️ → `updateUser({ password })` → login.
 
**Nombre (RF-20) y artista (RF-21):** validar con Zod → `update` sobre `profiles`. En el handle, `is_handle_available` sugiere en vivo con debounce y la base es la autoridad final (`23505`, `23514`).

### 5.5 Mapeo de errores

⚠️ Verificar códigos exactos en la versión instalada.

| Condición | Origen | Mensaje |
|---|---|---|
| Credenciales incorrectas | `invalid_credentials` | "Correo o contraseña incorrectos" |
| Correo sin confirmar | `email_not_confirmed` | "Verifica tu correo para continuar" |
| Contraseña débil | `weak_password` | "La contraseña debe tener al menos 8 caracteres" |
| Límite de peticiones o correos | `over_request_rate_limit`, `over_email_send_rate_limit` | "Demasiados intentos, inténtalo más tarde" |
| Código inválido o vencido | `otp_expired` y similares | "El código no es válido o venció, solicita uno nuevo" |
| Nombre fuera de longitud | Restricción `profiles_display_name_len` | "El nombre debe tener entre 2 y 50 caracteres" |
| Handle duplicado | Postgres `23505` | "Ese identificador ya está en uso" |
| Handle reservado | Restricción `profiles_handle_reserved` | "Ese identificador no está disponible" |
| Handle con formato inválido | Restricción `profiles_handle_format` | "Usa solo minúsculas, números y guiones (3 a 30 caracteres)" |
| Sin conexión | Error de red | "No se pudo conectar, reintente más tarde" |
| Cualquier otro | Resto | "No se pudo completar la acción, inténtalo de nuevo" |

## 6. Seguridad

- RLS activo en `profiles`, con permisos de columna restringidos.
- La `service_role` no existe en el repo ni en variables `EXPO_PUBLIC_*`.
- Mensajes neutros en registro, login y recuperación.
- Consentimiento de privacidad verificado en el servidor y guardado con fecha y versión.
- El perfil de artista no puede desactivarse (trigger).
- Límites de peticiones de Supabase Auth activos ⚠️ confirmar el límite de intentos de verificación de OTP.
- No registrar correos ni contraseñas en logs.

## 7. Estrategia de pruebas

| Nivel | Qué cubre | Herramienta |
|---|---|---|
| Unitarias | Esquemas Zod (handle, contraseña, nombre), `errors.ts`, reservados | Jest + `jest-expo` |
| Base de datos y RLS | Un usuario no lee ni edita el perfil de otro; `anon` no lee nada; no se editan `privacy_*`, `profile_complete` ni `is_artist`; handle duplicado y reservado rechazados; handle no se puede borrar; registro sin consentimiento rechazado | Script SQL manual con dos usuarios de prueba |
| Manual | Verificación real por correo, recuperación, sesión persistente, flujo completo en el celular Android | Checklist de la spec |
  
Meta: ≥ 60 % de cobertura en la lógica (RNF-08) y `expo lint` sin errores.
 
## 8. Trazabilidad
  
| Requisito | Componentes |
|---|---|
| RF-17 | `register.tsx`, `verify-email.tsx`, `handle_new_user`, `schemas.ts` |
| RF-18 | `login.tsx`, `AuthProvider.tsx`, sesión segura, guardas |
| RF-19 | `forgot-password.tsx`, `reset-password.tsx`, plantillas |
| RF-20 | `profile-setup.tsx`, tabla `profiles` |
| RF-21 | `artist-setup.tsx`, restricciones y triggers del handle |
| RF-22 | `useAppMode.ts`, `index.tsx` |
| RNF-02 | Supabase Auth (bcrypt) |
| RNF-04 | JWT 24 h + RLS |
| RNF-09 | Casilla en el registro + trigger de consentimiento |
  
## 9. Riesgos y dependencias
  
| Riesgo | Mitigación |
|---|---|
| El dominio de Resend no está listo antes de la entrega | Demo con verificación desactivada, declarándolo; plan B: Brevo |
| Pausa del proyecto gratuito de Supabase por inactividad | Reactivar desde el panel antes de la demo |
| Códigos de `supabase-js` distintos a lo supuesto | Marcados con ⚠️; verificar al implementar |
| Compatibilidad de librerías con RN 0.88 | Probar en el development build desde el primer día |

## 10. Fuera de este plan

Catálogo y búsqueda de artistas (spec 002), solicitud y seguimiento (specs 003 a 005), avances y pagos (006 y 007) y notificaciones push (008).
