# Plan técnico 002 — Catálogo de servicios, TOS y búsqueda de artistas
 
**Spec:** `spec.md` v0.1 · **Constitución:** v1.1 · **Fecha:** 2026-11-03
**Estado:** Borrador
**Depende de:** migración `0001_profiles.sql` (spec 001)
 
> Este plan dice **cómo** se cumple la spec. Los tipos de dato, límites de columna y comportamiento de RLS deben **verificarse contra la versión instalada de `supabase-js`**; ítems a verificar marcados con ⚠️.
 
---
 
## 1. Decisiones de diseño
 
| # | Decisión | Motivo |
|---|---|---|
| D1 | Tabla `services` separada de `profiles` | Un artista tiene 0–20 servicios; relación 1:N natural. |
| D2 | Tabla `artist_tos` separada (1:1 con `profiles`) | El TOS es un documento opcional independiente; evita columna `text` nullable de tamaño variable en `profiles`. |
| D3 | Función SQL `find_artist_by_handle` para la búsqueda pública | Expone solo los campos autorizados sin abrir `profiles` con una política `select` amplia. Patrón de la spec 001 (§2 nota). |
| D4 | El campo `price_mxn` es `integer` (pesos enteros) | Concuerda con P-2.4 de la spec; evita aritmética de punto flotante. |
| D5 | Estado del servicio: columna `status text` con check | `'active'` / `'paused'`. Extensible a valores futuros sin migración. |
| D6 | El límite de 20 servicios se hace cumplir con un trigger | No depende de que el cliente lo valide; la base es la autoridad final. |
| D7 | Los servicios se ordenan por `created_at desc` en la query del cliente | Reflejo del criterio de la spec §RF-02B. Se indexa `created_at`. |
| D8 | Búsqueda exacta con normalización de `@` en la capa de aplicación | Simplicidad del MVP (P-2.1). No se usa `pg_trgm` ni `fts`. |
 
---
 
## 2. Modelo de datos
 
Migración: `supabase/migrations/0002_catalogo_tos.sql`
 
### 2.1 Tabla `services`
 
```sql
create table public.services (
  id            uuid primary key default gen_random_uuid(),
  artist_id     uuid not null references public.profiles (id) on delete cascade,
  title         text not null,
  description   text,
  price_mxn     integer not null,
  delivery_days integer not null,
  status        text not null default 'active',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
 
  constraint services_title_len
    check (char_length(title) between 3 and 80),
  constraint services_description_len
    check (description is null or char_length(description) <= 1000),
  constraint services_price_positive
    check (price_mxn > 0),
  constraint services_delivery_days_range
    check (delivery_days between 1 and 365),
  constraint services_status_valid
    check (status in ('active', 'paused'))
);
 
-- Índices
create index services_artist_id_idx      on public.services (artist_id);
create index services_artist_status_idx  on public.services (artist_id, status);
create index services_created_at_idx     on public.services (artist_id, created_at desc);
 
-- Trigger updated_at (reutiliza la función creada en la migración 0001)
create trigger services_set_updated_at before update on public.services
for each row execute function public.set_updated_at();
 
-- ─── Límite de 20 servicios por artista (RF-02) ───────────────────────────
create function public.check_services_limit() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.services
  where artist_id = new.artist_id;
 
  if v_count >= 20 then
    raise exception 'services_limit_reached';
  end if;
  return new;
end; $$;
 
create trigger services_enforce_limit before insert on public.services
for each row execute function public.check_services_limit();
 
-- ─── Solo artistas pueden crear servicios (RF-02) ─────────────────────────
-- (refuerzo en DB; el RLS impide la inserción desde otro usuario, pero
--  esto evita que un usuario sin handle inserte aunque pase el RLS)
create function public.check_artist_role() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = new.artist_id and handle is not null
  ) then
    raise exception 'not_an_artist';
  end if;
  return new;
end; $$;
 
create trigger services_require_artist before insert on public.services
for each row execute function public.check_artist_role();
```
 
### 2.2 Tabla `artist_tos`
 
```sql
create table public.artist_tos (
  artist_id  uuid primary key references public.profiles (id) on delete cascade,
  content    text,
  updated_at timestamptz not null default now(),
 
  constraint artist_tos_content_len
    check (content is null or char_length(content) between 10 and 5000)
);
 
-- Trigger updated_at
create trigger artist_tos_set_updated_at before update on public.artist_tos
for each row execute function public.set_updated_at();
```
 
### 2.3 Función pública de búsqueda por handle
 
```sql
-- Devuelve perfil público + servicios activos + TOS en una sola llamada.
-- Solo expone columnas autorizadas; no abre policies SELECT amplias en profiles.
create function public.get_artist_public_profile(p_handle text)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_profile  record;
  v_services jsonb;
  v_tos      text;
begin
  -- 1. Buscar el perfil (solo si es artista)
  select id, display_name, handle
  into v_profile
  from public.profiles
  where handle = p_handle;
 
  if not found then
    return null;
  end if;
 
  -- 2. Servicios activos, ordenados por fecha de creación desc
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',            s.id,
      'title',         s.title,
      'description',   s.description,
      'price_mxn',     s.price_mxn,
      'delivery_days', s.delivery_days,
      'created_at',    s.created_at
    ) order by s.created_at desc
  ), '[]'::jsonb)
  into v_services
  from public.services s
  where s.artist_id = v_profile.id
    and s.status    = 'active';
 
  -- 3. TOS
  select content into v_tos
  from public.artist_tos
  where artist_id = v_profile.id;
 
  return jsonb_build_object(
    'display_name', v_profile.display_name,
    'handle',       v_profile.handle,
    'services',     v_services,
    'tos',          v_tos
  );
end; $$;
 
-- Solo usuarios autenticados pueden llamar esta función
revoke execute on function public.get_artist_public_profile(text) from public, anon;
grant  execute on function public.get_artist_public_profile(text) to authenticated;
```
 
### 2.4 Políticas RLS
 
```sql
-- ─── services ─────────────────────────────────────────────────────────────
alter table public.services enable row level security;
 
-- El artista ve todos sus servicios (activos y pausados)
create policy "artista lee sus servicios" on public.services
  for select to authenticated
  using (artist_id = (select auth.uid()));
 
-- El artista inserta sus propios servicios
create policy "artista crea servicios" on public.services
  for insert to authenticated
  with check (artist_id = (select auth.uid()));
 
-- El artista actualiza solo sus servicios
create policy "artista edita sus servicios" on public.services
  for update to authenticated
  using  (artist_id = (select auth.uid()))
  with check (artist_id = (select auth.uid()));
 
-- El artista elimina solo sus servicios
create policy "artista elimina sus servicios" on public.services
  for delete to authenticated
  using (artist_id = (select auth.uid()));
 
-- ─── artist_tos ───────────────────────────────────────────────────────────
alter table public.artist_tos enable row level security;
 
-- El artista lee su propio TOS
create policy "artista lee su tos" on public.artist_tos
  for select to authenticated
  using (artist_id = (select auth.uid()));
 
-- El artista inserta su TOS (upsert usa insert + update)
create policy "artista crea su tos" on public.artist_tos
  for insert to authenticated
  with check (artist_id = (select auth.uid()));
 
-- El artista actualiza su TOS
create policy "artista edita su tos" on public.artist_tos
  for update to authenticated
  using  (artist_id = (select auth.uid()))
  with check (artist_id = (select auth.uid()));
 
-- Permisos de tabla (no se otorga delete a artist_tos en la API del cliente;
-- "eliminar" el TOS = poner content en null)
revoke all on public.services    from anon, authenticated;
revoke all on public.artist_tos  from anon, authenticated;
 
grant select, insert, update, delete on public.services   to authenticated;
grant select, insert, update         on public.artist_tos to authenticated;
```
 
> **Nota:** el perfil público de los servicios se obtiene exclusivamente a través de `get_artist_public_profile`, que corre como `security definer`. Los usuarios autenticados que no son dueños del catálogo **no tienen policy SELECT** sobre `services` ni `artist_tos`, por lo que no pueden listar datos ajenos directamente.
 
---
 
## 3. Contratos TypeScript
 
Archivo: `src/features/catalogo/types.ts`
 
```typescript
// ──────────────────────────────────────────────────────────────────────────
// Tipos de dominio — generados desde la DB; no usar `any`
// ──────────────────────────────────────────────────────────────────────────
 
export type ServiceStatus = 'active' | 'paused';
 
export interface Service {
  id: string;
  artist_id: string;
  title: string;
  description: string | null;
  price_mxn: number;
  delivery_days: number;
  status: ServiceStatus;
  created_at: string;
  updated_at: string;
}
 
export type ServiceCreate = Omit<Service, 'id' | 'artist_id' | 'created_at' | 'updated_at'>;
export type ServiceUpdate = Partial<ServiceCreate>;
 
export interface ArtistTos {
  artist_id: string;
  content: string | null;
  updated_at: string;
}
 
// ─── Perfil público (retorno de get_artist_public_profile) ────────────────
export interface PublicServiceItem {
  id: string;
  title: string;
  description: string | null;
  price_mxn: number;
  delivery_days: number;
  created_at: string;
}
 
export interface ArtistPublicProfile {
  display_name: string;
  handle: string;
  services: PublicServiceItem[];
  tos: string | null;
}
```
 
---
 
## 4. Esquemas de validación Zod
 
Archivo: `src/features/catalogo/schemas.ts`
 
```typescript
import { z } from 'zod';
 
// ─── Servicio ─────────────────────────────────────────────────────────────
export const serviceSchema = z.object({
  title: z
    .string()
    .min(3,  'El título debe tener entre 3 y 80 caracteres')
    .max(80, 'El título debe tener entre 3 y 80 caracteres'),
  description: z
    .string()
    .max(1000, 'La descripción no puede superar los 1 000 caracteres')
    .nullable()
    .optional(),
  price_mxn: z
    .number({ invalid_type_error: 'El precio debe ser un número entero mayor que cero' })
    .int('El precio debe ser un número entero mayor que cero')
    .positive('El precio debe ser un número entero mayor que cero'),
  delivery_days: z
    .number({ invalid_type_error: 'El tiempo de entrega debe ser entre 1 y 365 días' })
    .int('El tiempo de entrega debe ser entre 1 y 365 días')
    .min(1,   'El tiempo de entrega debe ser entre 1 y 365 días')
    .max(365, 'El tiempo de entrega debe ser entre 1 y 365 días'),
});
 
export type ServiceFormValues = z.infer<typeof serviceSchema>;
 
// ─── TOS ──────────────────────────────────────────────────────────────────
export const tosSchema = z.object({
  content: z
    .string()
    .min(10,  'Los términos de servicio deben tener al menos 10 caracteres')
    .max(5000, 'Los términos de servicio no pueden superar los 5 000 caracteres'),
});
 
export type TosFormValues = z.infer<typeof tosSchema>;
 
// ─── Búsqueda ─────────────────────────────────────────────────────────────
export const searchHandleSchema = z.object({
  query: z
    .string()
    .min(1, 'Completa todos los campos obligatorios')
    .transform((val) => val.startsWith('@') ? val.slice(1) : val),
});
 
export type SearchHandleValues = z.infer<typeof searchHandleSchema>;
```
 
---
 
## 5. Formularios con React Hook Form
 
Archivo: `src/features/catalogo/hooks/useServiceForm.ts`
 
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { serviceSchema, type ServiceFormValues } from '../schemas';
import type { Service } from '../types';
 
export function useServiceForm(defaultValues?: Partial<ServiceFormValues>) {
  return useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      title:         defaultValues?.title         ?? '',
      description:   defaultValues?.description   ?? null,
      price_mxn:     defaultValues?.price_mxn     ?? undefined,
      delivery_days: defaultValues?.delivery_days ?? undefined,
    },
    mode: 'onBlur',
  });
}
 
// ─── TOS ──────────────────────────────────────────────────────────────────
import { tosSchema, type TosFormValues } from '../schemas';
 
export function useTosForm(defaultValues?: Partial<TosFormValues>) {
  return useForm<TosFormValues>({
    resolver: zodResolver(tosSchema),
    defaultValues: { content: defaultValues?.content ?? '' },
    mode: 'onChange', // contador de caracteres en tiempo real
  });
}
```
 
---
 
## 6. Capa de acceso a datos
 
Archivo: `src/features/catalogo/api.ts`
 
```typescript
import { supabase } from '@/lib/supabase';
import type {
  Service, ServiceCreate, ServiceUpdate,
  ArtistTos, ArtistPublicProfile,
} from './types';
 
// ─── Catálogo del artista (autenticado, dueño) ────────────────────────────
 
/** Lista todos los servicios del artista autenticado (activos + pausados). */
export async function getMyServices(): Promise<Service[]> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
 
/** Crea un nuevo servicio. El `artist_id` lo inyecta RLS (auth.uid()). */
export async function createService(payload: ServiceCreate): Promise<Service> {
  const { data, error } = await supabase
    .from('services')
    .insert({ ...payload, artist_id: (await supabase.auth.getUser()).data.user!.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}
 
/** Actualiza un servicio existente (title, description, price, days, status). */
export async function updateService(id: string, payload: ServiceUpdate): Promise<Service> {
  const { data, error } = await supabase
    .from('services')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
 
/** Elimina un servicio; una FK activa llega como PostgREST error code `23503`. */
export async function deleteService(id: string): Promise<void> {
  const { error } = await supabase.from('services').delete().eq('id', id);
  if (error) throw error;
}
 
// ─── TOS ──────────────────────────────────────────────────────────────────
 
/** Lee el TOS propio (puede ser null si no existe). */
export async function getMyTos(): Promise<ArtistTos | null> {
  const { data, error } = await supabase
    .from('artist_tos')
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data;
}
 
/** Crea o actualiza el TOS (upsert). */
export async function upsertTos(content: string): Promise<ArtistTos> {
  const userId = (await supabase.auth.getUser()).data.user!.id;
  const { data, error } = await supabase
    .from('artist_tos')
    .upsert({ artist_id: userId, content })
    .select()
    .single();
  if (error) throw error;
  return data;
}
 
// ─── Perfil público (cualquier usuario autenticado) ───────────────────────
 
/** Devuelve el perfil público del artista o null si no existe. */
export async function getArtistPublicProfile(handle: string): Promise<ArtistPublicProfile | null> {
  const { data, error } = await supabase.rpc('get_artist_public_profile', {
    p_handle: handle,
  });
  if (error) throw error;
  return data as ArtistPublicProfile | null;
}
```
 
---
 
## 7. Estrategia de consultas y cacheo con TanStack Query
 
Archivo: `src/features/catalogo/queries.ts`
 
```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from './api';
import type { ServiceCreate, ServiceUpdate } from './types';
import { catalogoErrors } from './errors';
 
// ─── Query keys ───────────────────────────────────────────────────────────
export const catalogoKeys = {
  myServices:   () => ['catalogo', 'my-services']           as const,
  myTos:        () => ['catalogo', 'my-tos']                as const,
  publicProfile: (handle: string) => ['catalogo', 'public', handle] as const,
};
 
// ─── Leer mis servicios ───────────────────────────────────────────────────
export function useMyServices() {
  return useQuery({
    queryKey: catalogoKeys.myServices(),
    queryFn:  api.getMyServices,
    staleTime: 1000 * 60 * 2, // 2 min
  });
}
 
// ─── Leer mi TOS ─────────────────────────────────────────────────────────
export function useMyTos() {
  return useQuery({
    queryKey: catalogoKeys.myTos(),
    queryFn:  api.getMyTos,
    staleTime: 1000 * 60 * 5, // 5 min
  });
}
 
// ─── Crear servicio ───────────────────────────────────────────────────────
export function useCreateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ServiceCreate) => api.createService(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: catalogoKeys.myServices() }); },
    onError:   (err) => catalogoErrors.handle(err),
  });
}
 
// ─── Actualizar servicio ──────────────────────────────────────────────────
export function useUpdateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ServiceUpdate }) =>
      api.updateService(id, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: catalogoKeys.myServices() }); },
    onError:   (err) => catalogoErrors.handle(err),
  });
}
 
// ─── Eliminar servicio ────────────────────────────────────────────────────
export function useDeleteService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteService(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: catalogoKeys.myServices() }); },
    onError:   (err) => catalogoErrors.handle(err),
  });
}
 
// ─── Upsert TOS ───────────────────────────────────────────────────────────
export function useUpsertTos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => api.upsertTos(content),
    onSuccess: () => { qc.invalidateQueries({ queryKey: catalogoKeys.myTos() }); },
    onError:   (err) => catalogoErrors.handle(err),
  });
}
 
// ─── Perfil público ───────────────────────────────────────────────────────
export function useArtistPublicProfile(handle: string) {
  return useQuery({
    queryKey: catalogoKeys.publicProfile(handle),
    queryFn:  () => api.getArtistPublicProfile(handle),
    enabled:  handle.length > 0,
    staleTime: 1000 * 60 * 1, // 1 min (el catálogo puede cambiar frecuentemente)
  });
}
```
 
---
 
## 8. Manejo de errores
 
Archivo: `src/features/catalogo/errors.ts`
 
```typescript
import { MESSAGES } from './messages';
 
/** Traduce errores de Supabase/Postgres a mensajes de la spec. */
export const catalogoErrors = {
  handle(err: unknown): string {
    if (err instanceof Error) {
      const msg = err.message;
      if (msg.includes('services_limit_reached'))  return MESSAGES.limitReached;
      if (msg.includes('not_an_artist'))            return MESSAGES.notAnArtist;
      if (msg.includes('23503'))                    return MESSAGES.activeCommissions; // FK violation
      if (msg.includes('services_title_len'))       return MESSAGES.titleLen;
      if (msg.includes('services_price_positive'))  return MESSAGES.pricePositive;
      if (msg.includes('services_delivery'))        return MESSAGES.deliveryRange;
      if (msg.includes('services_description_len')) return MESSAGES.descriptionLen;
      if (msg.includes('artist_tos_content_len'))   return MESSAGES.tosLen;
      if (msg.includes('NetworkError') || msg.includes('Failed to fetch'))
        return MESSAGES.noConnection;
    }
    return MESSAGES.generic;
  },
};
```
 
### Comportamientos verificados de `supabase-js` 2.118.0

El cliente instalado es `@supabase/supabase-js` `2.118.0`, que usa
`@supabase/postgrest-js` `2.118.0`. Las respuestas de PostgREST con error se
normalizan a un `PostgrestError` con las propiedades `code`, `message`,
`details` y `hint`.

1. **Límite de servicios.** `raise exception 'services_limit_reached'` no
   define un código SQL explícito, por lo que Postgres lo entrega con el
   código `P0001` y el mensaje literal `services_limit_reached`. El cliente
   recibe, conceptualmente:

   ```typescript
   {
     code: 'P0001',
     message: 'services_limit_reached',
     details: '',
     hint: '',
   }
   ```

   Por ello `errors.ts` debe revisar `error.message` para este trigger, no
   esperar que `error.code` sea `services_limit_reached`.

2. **RPC sin artista.** La función devuelve SQL `null`. PostgREST serializa
   ese resultado como JSON `null` y `supabase-js` asigna `data = null` sin
   error:

   ```typescript
   const { data, error } = await supabase.rpc(
     'get_artist_public_profile',
     { p_handle: 'handle-inexistente' },
   );
   // data === null
   // error === null
   ```

3. **FK de comisiones activas.** Una eliminación bloqueada por la FK llega
   como error PostgreSQL `23503`. El mensaje es el texto estándar de
   violación de clave foránea y puede variar con los nombres de tablas o
   restricciones; el cliente debe mapear por `error.code`:

   ```typescript
   {
     code: '23503',
     message: 'update or delete on table "services" violates foreign key constraint ...',
     details: '',
     hint: '',
   }
   ```

   La FK `commissions.service_id` pertenece a la spec 004; T100 no puede
   producir este error mientras esa tabla aún no exista.

Archivo: `src/features/catalogo/messages.ts`
 
```typescript
/** Mensajes literales definidos en spec.md §4. No modificar sin actualizar la spec. */
export const MESSAGES = {
  requiredFields:    'Completa todos los campos obligatorios',
  titleLen:          'El título debe tener entre 3 y 80 caracteres',
  pricePositive:     'El precio debe ser un número entero mayor que cero',
  deliveryRange:     'El tiempo de entrega debe ser entre 1 y 365 días',
  descriptionLen:    'La descripción no puede superar los 1 000 caracteres',
  limitReached:      'Alcanzaste el límite de 20 servicios. Elimina uno antes de crear otro',
  activeCommissions: 'No puedes eliminar este servicio porque tiene comisiones activas',
  tosMin:            'Los términos de servicio deben tener al menos 10 caracteres',
  tosMax:            'Los términos de servicio no pueden superar los 5 000 caracteres',
  tosLen:            'Los términos de servicio deben tener al menos 10 caracteres',
  handleNotFound:    'No se encontró ningún artista con ese identificador',
  catalogEmpty:      'Este artista aún no tiene servicios disponibles',
  noTos:             'Este artista aún no ha publicado sus términos de servicio',
  noConnection:      'No se pudo conectar, reintente más tarde',
  notAnArtist:       'No se pudo completar la acción, inténtalo de nuevo',
  generic:           'No se pudo completar la acción, inténtalo de nuevo',
} as const;
```
 
---
 
## 9. Rutas (Expo Router)
 
```
src/app/
└─ (app)/
   ├─ catalogo/
   │  ├─ index.tsx          # Lista de servicios del artista (panel de gestión)
   │  ├─ nuevo.tsx          # Formulario de creación de servicio
   │  ├─ [id].tsx           # Formulario de edición / pausar / eliminar
   │  └─ tos.tsx            # Editor de TOS del artista
   └─ buscar.tsx            # Pantalla de búsqueda por handle + resultado (perfil público)
```
 
**Notas de navegación:**
- `catalogo/index` requiere `is_artist = true`; si el usuario no tiene perfil de artista, muestra el CTA para activarlo (lleva a `artist-setup` de spec 001).
- `buscar.tsx` es accesible para cualquier usuario autenticado.
- El perfil público del artista se renderiza inline en `buscar.tsx` (sin ruta separada en esta versión).
---
 
## 10. Arquitectura del módulo
 
```
src/features/catalogo/
├─ types.ts        # interfaces TypeScript de dominio
├─ schemas.ts      # Zod: servicio, TOS, búsqueda
├─ messages.ts     # mensajes de error literales
├─ errors.ts       # traductor de errores Postgres/Supabase → mensajes
├─ api.ts          # llamadas a Supabase (servicios, TOS, perfil público)
├─ queries.ts      # TanStack Query: hooks de lectura y mutación
└─ hooks/
   ├─ useServiceForm.ts   # React Hook Form + zodResolver para servicios
   └─ useTosForm.ts       # React Hook Form + zodResolver para TOS
```
 
---
 
## 11. Seguridad
 
- RLS activo en `services` y `artist_tos`; sin policy `select` para datos ajenos.
- El perfil público solo se expone a través de la función `get_artist_public_profile` (`security definer`), que filtra explícitamente el `status = 'active'` y los campos permitidos.
- El límite de 20 servicios se hace cumplir en la base de datos (trigger), no solo en la UI.
- La regla de artista (handle requerido) se valida en el trigger `services_require_artist` y en el RLS (el `artist_id` debe ser `auth.uid()`, y ese usuario debe tener handle).
- El correo del artista nunca se expone en el perfil público.
- La `service_role` no se usa ni referencia en el cliente.
---
 
## 12. Estrategia de pruebas
 
| Nivel | Qué cubre | Herramienta |
|---|---|---|
| Unitarias | Esquemas Zod (límites de campo, normalización de `@`), `errors.ts`, `messages.ts` | Jest + `jest-expo` |
| Base de datos y RLS | Usuario A no puede leer ni editar servicios de usuario B; `anon` obtiene 403 en servicios y TOS; límite de 20 servicios rechaza el 21º; trigger de artista rechaza usuario sin handle; FK impide eliminar servicio con comisión activa (⚠️ spec 004 debe crear la FK en `commissions.service_id`); `get_artist_public_profile` no devuelve servicios pausados | Script SQL manual en `supabase/tests/002_rls.sql` |
| Manual | Flujo completo en dispositivo Android: crear → editar → pausar → reactivar → eliminar; buscar artista; ver perfil público | Checklist de la spec |
 
---
 
## 13. Riesgos y dependencias
 
| Riesgo | Mitigación |
|---|---|
| La FK `commissions.service_id` (spec 004) no existe aún | Cuando llegue spec 004, la eliminación bloqueada llegará como error con `code = '23503'`; el cliente mapeará ese código. |
| `get_artist_public_profile` devuelve `null` vs. `{}` según la versión de `supabase-js` | Verificado con `supabase-js` 2.118.0: una función que devuelve SQL `null` llega como `data === null` y `error === null`. |
| Pausa del proyecto gratuito de Supabase | Reactivar antes de la demo. |
 
---
 
## 14. Trazabilidad
 
| Requisito | Componentes |
|---|---|
| RF-02 (crear/editar/pausar/eliminar servicio) | `services` table, trigger límite, trigger artista, RLS, `api.ts`, `queries.ts`, `catalogo/index.tsx`, `catalogo/nuevo.tsx`, `catalogo/[id].tsx` |
| RF-03 (TOS) | `artist_tos` table, RLS, `api.ts`, `queries.ts`, `catalogo/tos.tsx` |
| RF-02B (búsqueda y perfil público) | `get_artist_public_profile`, `api.ts`, `queries.ts`, `buscar.tsx` |
| RNF-01 (rendimiento) | Índices en `services`, staleTime en queries |
| RNF-04 (autenticación y RLS) | Políticas RLS, `security definer` en función pública |
| RC-01 (sin pagos) | `price_mxn` como entero informativo; sin lógica de cobro |
 
---
 
## 15. Fuera de este plan
 
Solicitudes de comisión (spec 003), gestión de estados (spec 004), cupos (spec 009), notificaciones push (spec 008).
 