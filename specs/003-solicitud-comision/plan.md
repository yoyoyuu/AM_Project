# Plan 003 — Solicitud de comisión

**Estado:** Borrador · **Versión:** 0.1 · **Fecha:** 2026-11-05
**Derivado de:** `003-spec.md`
**Constitución:** v1.1

> Este documento describe **cómo** se implementa la spec 003. Toda decisión técnica debe derivarse de los RF y RNF de la spec.

---

## 1. Visión general del flujo técnico

```
Cliente (React Native / Expo)
  │
  ├─ Pantalla de perfil del artista (spec 002)
  │     └─ Botón "Solicitar" en un servicio activo
  │
  ├─ [Guard] Verifica que client_id ≠ artist_id → error en cliente
  │
  ├─ [Screen] CommissionRequestScreen
  │     ├─ Muestra resumen del servicio (precio base, tiempo estimado)
  │     ├─ Muestra TOS del artista (si existe) + casilla de aceptación
  │     ├─ Formulario React Hook Form + Zod (RF-06)
  │     └─ Sección de referencias (RF-14)
  │           ├─ expo-image-picker → selección de galería
  │           ├─ Validación: formato, tamaño ≤ 10 MB, cantidad ≤ 5
  │           └─ expo-image-manipulator → compresión local
  │
  ├─ Al presionar "Enviar solicitud":
  │     1. Validar formulario Zod (cliente)
  │     2. Subir imágenes a Supabase Storage (bucket commission-references)
  │        → Obtener storage_path de cada imagen subida
  │     3. INSERT en tabla `commissions` (Supabase RPC o endpoint directo)
  │     4. INSERT en tabla `commission_references` (un registro por imagen)
  │     5. Navegar a pantalla de confirmación
  │
  └─ Pantalla de confirmación
        └─ Mensaje "Tu solicitud fue enviada. El artista la revisará pronto"

Backend (Supabase)
  ├─ Postgres con RLS en `commissions` y `commission_references`
  ├─ Storage: bucket privado `commission-references` con políticas RLS
  └─ [Futuro - spec 008] Edge Function o trigger para push al artista
```

---

## 2. Esquema de base de datos

### 2.1 Tabla `commissions`

```sql
CREATE TABLE public.commissions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  artist_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  service_id      uuid        NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  status          text        NOT NULL DEFAULT 'PENDIENTE'
                                CHECK (status IN (
                                  'PENDIENTE','ACEPTADA','RECHAZADA',
                                  'EN_PROGRESO','EN_REVISION','COMPLETADA','CANCELADA'
                                )),
  description     text        NOT NULL CHECK (char_length(description) BETWEEN 20 AND 2000),
  pose            text        CHECK (char_length(pose) <= 500),
  key_elements    text        CHECK (char_length(key_elements) <= 500),
  intended_use    text        NOT NULL CHECK (intended_use IN ('personal','comercial')),
  additional_notes text       CHECK (char_length(additional_notes) <= 500),
  terms_accepted_at timestamptz,   -- NULL si el artista no tenía TOS
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_ne_artist CHECK (client_id <> artist_id)
);

-- Índices
CREATE INDEX idx_commissions_client_id  ON public.commissions (client_id);
CREATE INDEX idx_commissions_artist_id  ON public.commissions (artist_id);
CREATE INDEX idx_commissions_status     ON public.commissions (status);
```

### 2.2 Tabla `commission_references`

```sql
CREATE TABLE public.commission_references (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id  uuid    NOT NULL REFERENCES public.commissions(id) ON DELETE CASCADE,
  storage_path   text    NOT NULL,  -- ruta dentro del bucket: {commission_id}/{filename}
  file_size      integer NOT NULL CHECK (file_size > 0),  -- bytes, tras compresión
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_commission_refs_commission_id ON public.commission_references (commission_id);
```

> **Nota de migración:** ambas tablas se crean en la misma migración `supabase/migrations/003_commissions.sql`, junto con sus políticas RLS y los índices. Los estados futuros (`EN_PROGRESO`, etc.) se definen ahora en el `CHECK` para evitar migraciones posteriores de tipo alter.

---

## 3. Políticas RLS — Postgres

RLS habilitado en ambas tablas (Principio 5 de la Constitución).

### 3.1 Tabla `commissions`

```sql
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

-- INSERT: solo el cliente autenticado puede crear comisiones y solo para sí mismo
CREATE POLICY "commissions_insert_client"
  ON public.commissions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = client_id);

-- SELECT: el cliente o el artista de la comisión puede leerla
CREATE POLICY "commissions_select_parties"
  ON public.commissions FOR SELECT
  TO authenticated
  USING (auth.uid() = client_id OR auth.uid() = artist_id);

-- UPDATE: solo el artista puede cambiar el estado (spec 004 definirá los detalles)
CREATE POLICY "commissions_update_artist"
  ON public.commissions FOR UPDATE
  TO authenticated
  USING (auth.uid() = artist_id)
  WITH CHECK (auth.uid() = artist_id);

-- DELETE: prohibido (ningún rol puede eliminar comisiones en esta versión)
-- Sin política DELETE → denegado por defecto con RLS habilitado
```

### 3.2 Tabla `commission_references`

```sql
ALTER TABLE public.commission_references ENABLE ROW LEVEL SECURITY;

-- INSERT: el cliente de la comisión puede insertar referencias
CREATE POLICY "refs_insert_client"
  ON public.commission_references FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.commissions c
      WHERE c.id = commission_id
        AND c.client_id = auth.uid()
    )
  );

-- SELECT: cliente o artista de la comisión pueden ver las referencias
CREATE POLICY "refs_select_parties"
  ON public.commission_references FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.commissions c
      WHERE c.id = commission_id
        AND (c.client_id = auth.uid() OR c.artist_id = auth.uid())
    )
  );

-- DELETE: el cliente puede eliminar referencias mientras la comisión está en PENDIENTE
-- (solo relevante si se implementa cancelación; para esta spec, no se expone en la UI)
```

---

## 4. Supabase Storage — bucket `commission-references`

### 4.1 Configuración del bucket

```sql
-- Ejecutar en el dashboard de Supabase o mediante supabase CLI
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'commission-references',
  'commission-references',
  false,                                    -- privado: sin acceso público
  10485760,                                 -- 10 MB límite por archivo (pre-compresión en cliente)
  ARRAY['image/jpeg','image/png']           -- solo JPEG y PNG
);
```

### 4.2 Políticas RLS del bucket

```sql
-- UPLOAD (INSERT): solo el cliente de la comisión puede subir
-- La ruta esperada es: commission-references/{commission_id}/{filename}
CREATE POLICY "storage_upload_client"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'commission-references'
    AND EXISTS (
      SELECT 1 FROM public.commissions c
      WHERE c.id::text = (string_to_array(name, '/'))[1]
        AND c.client_id = auth.uid()
        AND c.status = 'PENDIENTE'
    )
  );

-- SELECT: cliente o artista de la comisión pueden obtener una URL firmada
CREATE POLICY "storage_select_parties"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'commission-references'
    AND EXISTS (
      SELECT 1 FROM public.commissions c
      WHERE c.id::text = (string_to_array(name, '/'))[1]
        AND (c.client_id = auth.uid() OR c.artist_id = auth.uid())
    )
  );

-- DELETE: prohibido (las referencias son inmutables tras el envío)
```

> Las URLs de descarga se generan con `supabase.storage.from('commission-references').createSignedUrl(path, 3600)` (expiración de 1 hora). Nunca se expone una URL pública.

---

## 5. Contratos TypeScript

### 5.1 Tipos de dominio

```typescript
// src/features/solicitud/types.ts

export type CommissionStatus =
  | 'PENDIENTE'
  | 'ACEPTADA'
  | 'RECHAZADA'
  | 'EN_PROGRESO'
  | 'EN_REVISION'
  | 'COMPLETADA'
  | 'CANCELADA';

export type IntendedUse = 'personal' | 'comercial';

export interface Commission {
  id: string;
  client_id: string;
  artist_id: string;
  service_id: string;
  status: CommissionStatus;
  description: string;
  pose: string | null;
  key_elements: string | null;
  intended_use: IntendedUse;
  additional_notes: string | null;
  terms_accepted_at: string | null; // ISO 8601
  created_at: string;
}

export interface CommissionReference {
  id: string;
  commission_id: string;
  storage_path: string;
  file_size: number;
  created_at: string;
}

export interface LocalImageAsset {
  uri: string;
  fileName: string;
  fileSize: number;    // bytes, antes de compresión
  mimeType: string;
}
```

### 5.2 Esquema Zod para React Hook Form

```typescript
// src/features/solicitud/schemas.ts
import { z } from 'zod';

export const commissionRequestSchema = z.object({
  description: z
    .string()
    .min(20, 'La descripción debe tener al menos 20 caracteres')
    .max(2000, 'La descripción no puede superar los 2 000 caracteres'),
  pose: z
    .string()
    .max(500, 'Este campo no puede superar los 500 caracteres')
    .optional(),
  key_elements: z
    .string()
    .max(500, 'Este campo no puede superar los 500 caracteres')
    .optional(),
  intended_use: z.enum(['personal', 'comercial'], {
    errorMap: () => ({ message: 'Indica el uso previsto de la comisión' }),
  }),
  additional_notes: z
    .string()
    .max(500, 'Este campo no puede superar los 500 caracteres')
    .optional(),
  terms_accepted: z.boolean().optional(), // se valida en el submit si el artista tiene TOS
});

export type CommissionRequestFormValues = z.infer<typeof commissionRequestSchema>;
```

### 5.3 Hook de mutación con TanStack Query

```typescript
// src/features/solicitud/hooks/useSubmitCommission.ts
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { CommissionRequestFormValues } from '../schemas';
import type { LocalImageAsset } from '../types';

interface SubmitPayload {
  artistId: string;
  serviceId: string;
  form: CommissionRequestFormValues;
  images: LocalImageAsset[];
  hasArtistTos: boolean;
}

export function useSubmitCommission() {
  return useMutation({
    mutationFn: async (payload: SubmitPayload) => {
      const { artistId, serviceId, form, images, hasArtistTos } = payload;

      // 1. Subir imágenes al bucket
      const uploadedPaths: { path: string; size: number }[] = [];
      const tempCommissionId = crypto.randomUUID(); // se usa como prefijo de ruta temporal

      for (const img of images) {
        const compressed = await compressImage(img); // ver sección 6
        const fileName = `${tempCommissionId}/${Date.now()}-${img.fileName}`;
        const { error } = await supabase.storage
          .from('commission-references')
          .upload(fileName, compressed.blob, { contentType: img.mimeType });
        if (error) throw new Error('No se pudo subir una o más imágenes. Comprueba tu conexión e inténtalo de nuevo');
        uploadedPaths.push({ path: fileName, size: compressed.size });
      }

      // 2. Crear la comisión
      const { data: commission, error: commError } = await supabase
        .from('commissions')
        .insert({
          artist_id: artistId,
          service_id: serviceId,
          description: form.description,
          pose: form.pose ?? null,
          key_elements: form.key_elements ?? null,
          intended_use: form.intended_use,
          additional_notes: form.additional_notes ?? null,
          terms_accepted_at: hasArtistTos ? new Date().toISOString() : null,
        })
        .select('id')
        .single();

      if (commError || !commission) {
        throw new Error('No se pudo enviar la solicitud, comprueba tu conexión e inténtalo de nuevo');
      }

      // 3. Renombrar paths si se usó un ID temporal (opcional según implementación)
      // 4. Insertar referencias
      if (uploadedPaths.length > 0) {
        const refs = uploadedPaths.map((p) => ({
          commission_id: commission.id,
          storage_path: p.path,
          file_size: p.size,
        }));
        const { error: refError } = await supabase.from('commission_references').insert(refs);
        if (refError) throw new Error('No se pudo enviar la solicitud, comprueba tu conexión e inténtalo de nuevo');
      }

      return commission;
    },
  });
}
```

---

## 6. Pipeline de compresión local de imágenes

```typescript
// src/features/solicitud/utils/compressImage.ts
import * as ImageManipulator from 'expo-image-manipulator';
import type { LocalImageAsset } from '../types';

const MAX_DIMENSION = 1920; // px en el lado más largo
const JPEG_QUALITY = 0.75;  // 75 % calidad JPEG

export async function compressImage(asset: LocalImageAsset): Promise<{ blob: Blob; size: number }> {
  const result = await ImageManipulator.manipulateAsync(
    asset.uri,
    [{ resize: { width: MAX_DIMENSION } }], // expo-image-manipulator mantiene el aspect ratio
    { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
  );

  const response = await fetch(result.uri);
  const blob = await response.blob();
  return { blob, size: blob.size };
}
```

**Parámetros de compresión:**
- Redimensionado máximo: 1 920 px en el lado más largo (mantiene aspect ratio).
- Calidad JPEG de salida: 75 %.
- Formato de salida: siempre JPEG (simplifica las políticas del bucket).
- Resultado esperado: imágenes < 1 MB en la mayoría de los casos de galería de Android.

---

## 7. Manejo de permisos de galería

```typescript
// src/features/solicitud/hooks/useGalleryPermission.ts
import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

export async function requestGalleryPermission(): Promise<boolean> {
  const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (status === 'granted') return true;

  if (!canAskAgain) {
    // El usuario ya denegó y marcó "No volver a preguntar"
    Alert.alert(
      'Permiso de galería',
      'Permiso de galería denegado. Puedes habilitarlo en Ajustes del sistema',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Ir a Ajustes', onPress: () => Linking.openSettings() },
      ]
    );
  }

  return false;
}
```

---

## 8. Estructura de archivos

```
src/features/solicitud/
├── screens/
│   ├── CommissionRequestScreen.tsx   # Pantalla principal del formulario
│   └── CommissionSuccessScreen.tsx   # Pantalla de confirmación
├── components/
│   ├── ServiceSummaryCard.tsx        # Muestra precio y tiempo estimado (read-only)
│   ├── TosAcceptanceBlock.tsx        # TOS + casilla de aceptación (si existe TOS)
│   ├── ReferenceImagePicker.tsx      # Selector y previsualización de imágenes
│   └── ReferenceImageThumbnail.tsx   # Miniatura individual con botón eliminar
├── hooks/
│   ├── useSubmitCommission.ts        # Mutación TanStack Query (sección 5.3)
│   └── useGalleryPermission.ts       # Manejo de permisos (sección 7)
├── utils/
│   └── compressImage.ts              # Pipeline de compresión (sección 6)
├── schemas.ts                        # Zod + tipos de formulario (sección 5.2)
└── types.ts                          # Tipos de dominio (sección 5.1)

src/app/
└── commission/
    └── request/
        └── [serviceId].tsx           # Ruta de Expo Router para la solicitud

supabase/
├── migrations/
│   └── 003_commissions.sql           # Tablas + RLS + índices (secciones 2 y 3)
├── storage/
│   └── 003_commission_references_bucket.sql  # Bucket + políticas (sección 4)
└── tests/
    └── 003_rls_test.sql              # Pruebas de acceso denegado
```

---

## 9. Validaciones en el cliente (guard de auto-solicitud)

```typescript
// En CommissionRequestScreen.tsx — antes de renderizar el formulario
const { data: session } = useSession(); // hook de spec 001
const isOwnProfile = session?.user.id === artistUserId;

if (isOwnProfile) {
  return <ErrorState message="No puedes enviarte una solicitud a ti mismo" />;
}
```

La política RLS de `commissions` refuerza este bloqueo con la restricción `CONSTRAINT client_ne_artist CHECK (client_id <> artist_id)`.

---

## 10. Consideraciones de rendimiento y cuota gratuita

| Recurso | Límite del plan gratuito Supabase | Mitigación |
|---|---|---|
| Storage | 1 GB | Compresión local a < 1 MB por imagen; 5 imágenes × 1 MB = 5 MB por comisión |
| Ancho de banda storage | 2 GB/mes | URLs firmadas con 1 h de expiración; sin CDN en esta versión |
| Postgres | 500 MB | Tablas ligeras; los binarios van a Storage |
| Edge Functions | 500K invocaciones/mes | No se usan en esta spec; spec 008 evaluará el trigger de push |

---

## 11. Pruebas de RLS (esqueleto)

```sql
-- supabase/tests/003_rls_test.sql

-- Prueba 1: cliente puede crear su propia comisión
SET request.jwt.claims = '{"sub": "client-uuid-1", "role": "authenticated"}';
INSERT INTO public.commissions (..., client_id, artist_id, ...)
VALUES (..., 'client-uuid-1', 'artist-uuid-1', ...);
-- Esperado: éxito

-- Prueba 2: cliente NO puede crear comisión con client_id de otro usuario
SET request.jwt.claims = '{"sub": "client-uuid-1", "role": "authenticated"}';
INSERT INTO public.commissions (..., client_id, artist_id, ...)
VALUES (..., 'client-uuid-2', 'artist-uuid-1', ...);
-- Esperado: error de RLS (new row violates row-level security policy)

-- Prueba 3: tercero NO puede leer comisiones ajenas
SET request.jwt.claims = '{"sub": "stranger-uuid", "role": "authenticated"}';
SELECT * FROM public.commissions WHERE id = 'commission-uuid-1';
-- Esperado: 0 filas

-- Prueba 4: artista SÍ puede leer comisiones que le pertenecen
SET request.jwt.claims = '{"sub": "artist-uuid-1", "role": "authenticated"}';
SELECT * FROM public.commissions WHERE id = 'commission-uuid-1';
-- Esperado: 1 fila

-- Prueba 5: CHECK constraint impide client_id = artist_id
SET request.jwt.claims = '{"sub": "user-uuid-1", "role": "authenticated"}';
INSERT INTO public.commissions (..., client_id, artist_id, ...)
VALUES (..., 'user-uuid-1', 'user-uuid-1', ...);
-- Esperado: error de CHECK constraint
```