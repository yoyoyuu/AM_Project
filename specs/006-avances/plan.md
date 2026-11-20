# Plan 006 — Subida y Visualización de Avances (`006-avances`)

**Estado:** Borrador · **Versión:** 0.1 · **Fecha:** 2026-11-18
**Derivado de:** `006-avances/spec.md`
**Constitución:** v1.1

> Este documento describe **cómo** se implementa la spec 006. Toda decisión técnica se deriva de los RF y RNF de la spec.

---

## 1. Visión general del flujo técnico

```
Artista (React Native / Expo)
  │
  ├─ [Screen] CommissionWorkScreen (Spec 004)
  │     └─ Sección "Avances" + botón "Agregar avance"
  │           │
  │           ├─ 1. Solicitar permiso de galería (expo-image-picker)
  │           ├─ 2. Abrir selector de imágenes (1–3 imágenes)
  │           ├─ 3. Comprimir cada imagen (expo-image-manipulator)
  │           ├─ 4. Validar estado de la comisión (EN_PROGRESO)
  │           ├─ 5. Subir archivos a Storage bucket "commission-advances"
  │           ├─ 6. INSERT en commission_advances + commission_advance_files
  │           └─ 7. Invalidar query → actualizar historial
  │
  └─ [Sección] AdvancesList (integrado en detalle de comisión)
        ├─ Query: commission_advances + files con URLs firmadas
        └─ Lista cronológica inversa: imagen, etapa, nota, fecha

Cliente (React Native / Expo)
  │
  └─ [Screen] CommissionDetailScreen (Spec 005)
        └─ Sección "Avances" (AdvancesList — solo lectura)

Backend (Supabase)
  ├─ Storage bucket: commission-advances (privado)
  ├─ Tabla: commission_advances
  ├─ Tabla: commission_advance_files
  └─ RLS: artista propietario escribe; artista + cliente leen
```

---

## 2. Esquema de base de datos

### 2.1 Nuevas tablas

```sql
-- supabase/migrations/006_commission_advances.sql

-- Tabla principal de avances
CREATE TABLE public.commission_advances (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id uuid        NOT NULL REFERENCES public.commissions(id) ON DELETE CASCADE,
  artist_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  stage         public.creative_stage NOT NULL,  -- etapa activa al momento de la subida
  note          text        NULL
    CONSTRAINT advance_note_length CHECK (char_length(note) <= 300),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Archivos individuales de cada avance (1–3 por avance)
CREATE TABLE public.commission_advance_files (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  advance_id  uuid        NOT NULL REFERENCES public.commission_advances(id) ON DELETE CASCADE,
  storage_path text       NOT NULL,  -- ruta dentro del bucket commission-advances
  file_size   integer     NOT NULL   -- tamaño en bytes tras la compresión
    CONSTRAINT advance_file_size_positive CHECK (file_size > 0),
  sort_order  smallint    NOT NULL DEFAULT 0,  -- orden de las imágenes dentro del avance
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

### 2.2 Índices

```sql
-- Búsqueda de avances por comisión (caso de uso principal)
CREATE INDEX idx_commission_advances_commission_id
  ON public.commission_advances (commission_id, created_at DESC);

-- Búsqueda de archivos por avance
CREATE INDEX idx_advance_files_advance_id
  ON public.commission_advance_files (advance_id, sort_order);
```

### 2.3 Restricciones adicionales

```sql
-- Garantiza que el artist_id del avance coincide con el de la comisión
-- (refuerzo adicional; RLS es la barrera principal)
ALTER TABLE public.commission_advances
  ADD CONSTRAINT advance_artist_matches_commission
    CHECK (artist_id IS NOT NULL);  -- la validación real la hace RLS; aquí se previene nulos

-- Límite de archivos por avance: se implementa en validación del cliente (Zod)
-- y en la Edge Function si se implementa; no se implementa como CHECK en DB (Principio 11).
```

### 2.4 Vista completa de las nuevas tablas

```
commission_advances
─────────────────────────────────────────────────────────────────
 id            uuid        PK
 commission_id uuid        FK → commissions.id  ON DELETE CASCADE
 artist_id     uuid        FK → auth.users.id   ON DELETE RESTRICT
 stage         creative_stage NOT NULL           -- SKETCH | LINEART | FINAL
 note          text        NULL   CHECK ≤ 300 chars
 created_at    timestamptz NOT NULL DEFAULT now()

commission_advance_files
─────────────────────────────────────────────────────────────────
 id           uuid        PK
 advance_id   uuid        FK → commission_advances.id  ON DELETE CASCADE
 storage_path text        NOT NULL   -- ej: advances/{commission_id}/{advance_id}/{n}.webp
 file_size    integer     NOT NULL   CHECK > 0
 sort_order   smallint    NOT NULL DEFAULT 0
 created_at   timestamptz NOT NULL DEFAULT now()
```

---

## 3. Bucket de Supabase Storage y políticas

### 3.1 Creación del bucket

```sql
-- Se crea desde el SQL Editor o la migración
-- bucket: commission-advances
-- Privado (no acceso público), sin transformaciones habilitadas

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'commission-advances',
  'commission-advances',
  false,                        -- bucket privado
  307200,                       -- límite: 300 KB por archivo (300 * 1024)
  ARRAY['image/webp', 'image/jpeg', 'image/png']
);
```

> **Nota:** el límite de 300 KB en el bucket es la última línea de defensa. La compresión en cliente garantiza que los archivos lleguen por debajo de ese umbral en condiciones normales.

### 3.2 Convención de rutas de Storage

```
commission-advances/
  {commission_id}/
    {advance_id}/
      0.webp   ← primera imagen del avance
      1.webp   ← segunda imagen (si existe)
      2.webp   ← tercera imagen (si existe)
```

Usar `commission_id` como prefijo de carpeta permite borrar todos los avances de una comisión con un solo `remove` de prefijo si fuera necesario en el futuro.

### 3.3 Políticas RLS en `storage.objects`

```sql
-- Política de INSERT en Storage: solo el artista propietario de la comisión puede subir
CREATE POLICY "advance_files_insert_artist"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'commission-advances'
    AND (
      -- Verificar que el primer segmento del path es un commission_id
      -- cuyo artist_id coincide con el usuario autenticado
      EXISTS (
        SELECT 1 FROM public.commissions c
        WHERE c.id = (string_to_array(name, '/'))[1]::uuid
          AND c.artist_id = auth.uid()
          AND c.status = 'EN_PROGRESO'
      )
    )
  );

-- Política de SELECT en Storage: artista o cliente de la comisión pueden leer
CREATE POLICY "advance_files_select_parties"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'commission-advances'
    AND (
      EXISTS (
        SELECT 1 FROM public.commissions c
        WHERE c.id = (string_to_array(name, '/'))[1]::uuid
          AND (c.artist_id = auth.uid() OR c.client_id = auth.uid())
      )
    )
  );

-- DELETE denegado por defecto (sin política); eliminación solo vía service_role en post-MVP
```

### 3.4 Políticas RLS en las tablas de Postgres

```sql
-- Habilitar RLS en las nuevas tablas
ALTER TABLE public.commission_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_advance_files ENABLE ROW LEVEL SECURITY;

-- ── commission_advances ──────────────────────────────────────────

-- INSERT: solo el artista propietario de una comisión EN_PROGRESO
CREATE POLICY "advances_insert_artist"
  ON public.commission_advances FOR INSERT
  TO authenticated
  WITH CHECK (
    artist_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.commissions c
      WHERE c.id = commission_id
        AND c.artist_id = auth.uid()
        AND c.status = 'EN_PROGRESO'
    )
  );

-- SELECT: artista o cliente de la comisión
CREATE POLICY "advances_select_parties"
  ON public.commission_advances FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.commissions c
      WHERE c.id = commission_id
        AND (c.artist_id = auth.uid() OR c.client_id = auth.uid())
    )
  );

-- UPDATE y DELETE: denegados (sin política; RLS deniega por defecto)

-- ── commission_advance_files ─────────────────────────────────────

-- INSERT: solo el artista propietario (via el advance que ya pasó la política anterior)
CREATE POLICY "advance_files_insert_artist"
  ON public.commission_advance_files FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.commission_advances a
        JOIN public.commissions c ON c.id = a.commission_id
      WHERE a.id = advance_id
        AND c.artist_id = auth.uid()
    )
  );

-- SELECT: artista o cliente de la comisión (a través del avance)
CREATE POLICY "advance_files_select_parties"
  ON public.commission_advance_files FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.commission_advances a
        JOIN public.commissions c ON c.id = a.commission_id
      WHERE a.id = advance_id
        AND (c.artist_id = auth.uid() OR c.client_id = auth.uid())
    )
  );

-- UPDATE y DELETE: denegados (sin política; RLS deniega por defecto)
```

---

## 4. Pipeline técnico en cliente

### 4.1 Permisos de galería con `expo-image-picker`

```typescript
// src/features/avances/utils/requestGalleryPermission.ts
import * as ImagePicker from 'expo-image-picker';

export type GalleryPermissionResult =
  | { granted: true }
  | { granted: false; canAskAgain: boolean };

/**
 * Solicita permiso de acceso a la galería y retorna el resultado.
 * No lanza excepción: el llamador decide cómo manejar la denegación.
 */
export async function requestGalleryPermission(): Promise<GalleryPermissionResult> {
  const { status, canAskAgain } =
    await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (status === 'granted') {
    return { granted: true };
  }
  return { granted: false, canAskAgain };
}
```

```typescript
// src/features/avances/utils/pickAdvanceImages.ts
import * as ImagePicker from 'expo-image-picker';

export interface PickedImage {
  uri: string;
  width: number;
  height: number;
}

/**
 * Abre el selector de imágenes de la galería.
 * Permite seleccionar entre 1 y 3 imágenes.
 * Retorna null si el usuario cancela.
 */
export async function pickAdvanceImages(): Promise<PickedImage[] | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: true,
    selectionLimit: 3,
    quality: 1,          // la compresión la hace expo-image-manipulator en el paso siguiente
    exif: false,         // no se necesitan metadatos EXIF (privacidad + peso)
  });

  if (result.canceled || result.assets.length === 0) return null;

  return result.assets.map((asset) => ({
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
  }));
}
```

### 4.2 Compresión con `expo-image-manipulator`

```typescript
// src/features/avances/utils/compressAdvanceImage.ts
import * as ImageManipulator from 'expo-image-manipulator';

/** Dimensión máxima del lado más largo de la imagen comprimida */
const MAX_DIMENSION = 1080;
/** Calidad de compresión JPEG/WebP (0–1) */
const COMPRESS_QUALITY = 0.72;

export interface CompressedImage {
  uri: string;
  width: number;
  height: number;
  /** Tamaño estimado en bytes (obtenido tras la compresión vía FileSystem) */
  fileSize: number;
}

/**
 * Redimensiona y comprime una imagen para subida como avance WIP.
 * Parámetros elegidos para mantener peso ≤ 300 KB en la mayoría de las imágenes.
 * Resultado en formato WebP cuando el dispositivo lo soporta, JPEG como fallback.
 */
export async function compressAdvanceImage(uri: string): Promise<CompressedImage> {
  const compressed = await ImageManipulator.manipulateAsync(
    uri,
    [
      {
        resize: {
          // Redimensiona manteniendo la proporción; solo si supera MAX_DIMENSION
          width: MAX_DIMENSION,
        },
      },
    ],
    {
      compress: COMPRESS_QUALITY,
      format: ImageManipulator.SaveFormat.WEBP,
      base64: false,
    },
  );

  // Obtener el tamaño real del archivo comprimido
  const { FileSystem } = await import('expo-file-system');
  const info = await FileSystem.getInfoAsync(compressed.uri, { size: true });
  const fileSize = info.exists && 'size' in info ? (info.size as number) : 0;

  return {
    uri: compressed.uri,
    width: compressed.width,
    height: compressed.height,
    fileSize,
  };
}
```

> **Fundamento de los parámetros:** 1080 px de ancho con calidad 0.72 en WebP produce archivos típicamente entre 60 KB y 250 KB para dibujos digitales, cumpliendo el límite de 300 KB del RNF. Las imágenes muy detalladas pueden requerir bajar a 0.65; el límite del bucket (300 KB) actúa como seguro final.

### 4.3 Esquemas Zod

```typescript
// src/features/avances/schemas.ts
import { z } from 'zod';

export const uploadAdvanceSchema = z.object({
  note: z
    .string()
    .max(300, 'La nota no puede superar los 300 caracteres')
    .optional()
    .or(z.literal('')),
});

export type UploadAdvanceFormValues = z.infer<typeof uploadAdvanceSchema>;
```

### 4.4 Tipos de dominio

```typescript
// src/features/avances/types.ts
import type { CreativeStage } from '@/features/gestion/types';

export interface CommissionAdvance {
  id: string;
  commission_id: string;
  artist_id: string;
  stage: CreativeStage;
  note: string | null;
  created_at: string;
  files: CommissionAdvanceFile[];
}

export interface CommissionAdvanceFile {
  id: string;
  advance_id: string;
  storage_path: string;
  file_size: number;
  sort_order: number;
  signed_url: string | null;  // generada en cliente, expira en 1 h
}
```

### 4.5 Hook de consulta con TanStack Query

```typescript
// src/features/avances/hooks/useCommissionAdvances.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { CommissionAdvance } from '../types';

export const commissionAdvancesQueryKey = (commissionId: string) =>
  ['commissions', 'advances', commissionId] as const;

export function useCommissionAdvances(commissionId: string) {
  return useQuery({
    queryKey: commissionAdvancesQueryKey(commissionId),
    queryFn: async (): Promise<CommissionAdvance[]> => {
      const { data, error } = await supabase
        .from('commission_advances')
        .select(`
          *,
          files:commission_advance_files (*)
        `)
        .eq('commission_id', commissionId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Generar URLs firmadas para cada archivo (expiración 1 hora)
      const advancesWithUrls = await Promise.all(
        (data ?? []).map(async (advance) => {
          const filesWithUrls = await Promise.all(
            (advance.files ?? []).map(async (file: { storage_path: string; [key: string]: unknown }) => {
              const { data: signed } = await supabase.storage
                .from('commission-advances')
                .createSignedUrl(file.storage_path, 3600);
              return { ...file, signed_url: signed?.signedUrl ?? null };
            }),
          );
          return { ...advance, files: filesWithUrls };
        }),
      );

      return advancesWithUrls as CommissionAdvance[];
    },
    staleTime: 1000 * 60,  // 1 minuto; los avances son menos volátiles que el estado
  });
}
```

### 4.6 Hook de mutación (subida de avance)

```typescript
// src/features/avances/hooks/useUploadAdvance.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { commissionAdvancesQueryKey } from './useCommissionAdvances';
import { compressAdvanceImage } from '../utils/compressAdvanceImage';
import type { CommissionStatus, CreativeStage } from '@/features/gestion/types';
import type { PickedImage } from '../utils/pickAdvanceImages';

interface UploadAdvancePayload {
  commissionId: string;
  artistId: string;
  currentStatus: CommissionStatus;
  currentStage: CreativeStage;
  images: PickedImage[];
  note?: string;
}

export function useUploadAdvance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UploadAdvancePayload) => {
      const { commissionId, artistId, currentStatus, currentStage, images, note } = payload;

      // 1. Validar estado de la comisión en cliente (defensa en profundidad)
      if (currentStatus !== 'EN_PROGRESO') {
        throw new Error('No puedes subir avances en una comisión que no está en progreso');
      }

      // 2. Comprimir todas las imágenes
      const compressed = await Promise.all(images.map((img) => compressAdvanceImage(img.uri)));

      // 3. Crear el registro del avance en BD (obtener el ID antes de subir archivos)
      const { data: advance, error: advanceError } = await supabase
        .from('commission_advances')
        .insert({
          commission_id: commissionId,
          artist_id: artistId,
          stage: currentStage,
          note: note?.trim() || null,
        })
        .select('id')
        .single();

      if (advanceError || !advance) {
        throw new Error('No se pudo subir el avance. Comprueba tu conexión e inténtalo de nuevo');
      }

      const advanceId = advance.id;

      // 4. Subir archivos al bucket (en paralelo)
      const uploadResults = await Promise.all(
        compressed.map(async (img, index) => {
          const path = `${commissionId}/${advanceId}/${index}.webp`;

          // Leer el archivo como blob desde el sistema de archivos del dispositivo
          const response = await fetch(img.uri);
          const blob = await response.blob();

          const { error: storageError } = await supabase.storage
            .from('commission-advances')
            .upload(path, blob, { contentType: 'image/webp', upsert: false });

          if (storageError) throw storageError;

          return { path, fileSize: img.fileSize, sortOrder: index };
        }),
      );

      // 5. Registrar los archivos en BD
      const fileInserts = uploadResults.map((r) => ({
        advance_id: advanceId,
        storage_path: r.path,
        file_size: r.fileSize,
        sort_order: r.sortOrder,
      }));

      const { error: filesError } = await supabase
        .from('commission_advance_files')
        .insert(fileInserts);

      if (filesError) {
        // Intentar limpiar archivos subidos si el registro en BD falla
        await Promise.allSettled(
          uploadResults.map((r) =>
            supabase.storage.from('commission-advances').remove([r.path]),
          ),
        );
        // Eliminar el registro del avance huérfano
        await supabase.from('commission_advances').delete().eq('id', advanceId);
        throw new Error('No se pudo subir el avance. Comprueba tu conexión e inténtalo de nuevo');
      }

      return advanceId;
    },

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: commissionAdvancesQueryKey(variables.commissionId),
      });
    },
  });
}
```

---

## 5. Estructura de archivos

```
src/features/avances/
├── components/
│   ├── AdvanceCard.tsx             # Tarjeta de un avance: imágenes, etapa, nota, fecha
│   ├── AdvanceImageGrid.tsx        # Grid de miniaturas (1–3 imágenes) con lightbox
│   ├── AdvancesList.tsx            # Lista cronológica de avances (reutilizable artista/cliente)
│   ├── UploadAdvanceSheet.tsx      # Bottom sheet: selector de imágenes + campo de nota
│   └── AdvanceStageBadge.tsx       # Chip de etapa creativa del avance
├── hooks/
│   ├── useCommissionAdvances.ts    # Query: lista de avances con URLs firmadas
│   └── useUploadAdvance.ts         # Mutation: pipeline completo de subida
├── utils/
│   ├── requestGalleryPermission.ts # Solicitud de permiso de galería
│   ├── pickAdvanceImages.ts        # Apertura del selector de imágenes
│   └── compressAdvanceImage.ts     # Compresión con expo-image-manipulator
├── schemas.ts                      # Zod: validación del formulario de subida
└── types.ts                        # Tipos de dominio: CommissionAdvance, CommissionAdvanceFile

src/features/gestion/screens/
└── CommissionWorkScreen.tsx        # MODIFICAR: integrar AdvancesList + botón "Agregar avance"

src/features/seguimiento/screens/
└── CommissionDetailScreen.tsx      # MODIFICAR: integrar AdvancesList (solo lectura)

src/app/artist/commissions/[commissionId]/
└── work.tsx                        # Ruta existente (Spec 004): sin cambios de ruta

supabase/
├── migrations/
│   └── 006_commission_advances.sql # Tablas, índices, bucket y políticas RLS
└── tests/
    └── 006_rls_test.sql            # Pruebas de acceso denegado
```

---

## 6. Pruebas RLS

```sql
-- supabase/tests/006_rls_test.sql

-- Prueba 1: artista puede insertar un avance en su comisión EN_PROGRESO
SET LOCAL request.jwt.claims = '{"sub":"artist-uuid-1","role":"authenticated"}';
INSERT INTO public.commission_advances (commission_id, artist_id, stage, note)
VALUES ('commission-uuid-1', 'artist-uuid-1', 'SKETCH', 'Boceto inicial listo');
-- Esperado: 1 fila insertada

-- Prueba 2: artista NO puede insertar un avance en comisión ajena
SET LOCAL request.jwt.claims = '{"sub":"artist-uuid-2","role":"authenticated"}';
INSERT INTO public.commission_advances (commission_id, artist_id, stage, note)
VALUES ('commission-uuid-1', 'artist-uuid-2', 'SKETCH', null);
-- Esperado: error de RLS (0 filas insertadas o violación de política)

-- Prueba 3: artista NO puede insertar un avance en comisión que no está EN_PROGRESO
SET LOCAL request.jwt.claims = '{"sub":"artist-uuid-1","role":"authenticated"}';
-- (commission-uuid-2 está en estado PENDIENTE)
INSERT INTO public.commission_advances (commission_id, artist_id, stage)
VALUES ('commission-uuid-2', 'artist-uuid-1', 'SKETCH');
-- Esperado: error de RLS (la condición status = 'EN_PROGRESO' no se cumple)

-- Prueba 4: artista puede leer sus propios avances
SET LOCAL request.jwt.claims = '{"sub":"artist-uuid-1","role":"authenticated"}';
SELECT * FROM public.commission_advances WHERE commission_id = 'commission-uuid-1';
-- Esperado: filas propias del artista

-- Prueba 5: cliente puede leer avances de su comisión
SET LOCAL request.jwt.claims = '{"sub":"client-uuid-1","role":"authenticated"}';
SELECT * FROM public.commission_advances WHERE commission_id = 'commission-uuid-1';
-- Esperado: filas de la comisión donde client_id = 'client-uuid-1'

-- Prueba 6: tercero NO puede leer avances de una comisión ajena
SET LOCAL request.jwt.claims = '{"sub":"stranger-uuid","role":"authenticated"}';
SELECT * FROM public.commission_advances WHERE commission_id = 'commission-uuid-1';
-- Esperado: 0 filas

-- Prueba 7: nadie puede hacer UPDATE en un avance
SET LOCAL request.jwt.claims = '{"sub":"artist-uuid-1","role":"authenticated"}';
UPDATE public.commission_advances SET note = 'nota modificada' WHERE id = 'advance-uuid-1';
-- Esperado: 0 filas actualizadas (sin política UPDATE; RLS deniega)

-- Prueba 8: nadie puede hacer DELETE en un avance (vía cliente autenticado)
SET LOCAL request.jwt.claims = '{"sub":"artist-uuid-1","role":"authenticated"}';
DELETE FROM public.commission_advances WHERE id = 'advance-uuid-1';
-- Esperado: 0 filas eliminadas (sin política DELETE; RLS deniega)

-- Prueba 9: nota supera 300 caracteres (CHECK constraint)
SET LOCAL request.jwt.claims = '{"sub":"artist-uuid-1","role":"authenticated"}';
INSERT INTO public.commission_advances (commission_id, artist_id, stage, note)
VALUES ('commission-uuid-1', 'artist-uuid-1', 'SKETCH', repeat('x', 301));
-- Esperado: error de CHECK constraint

-- Prueba 10: archivo huérfano no se puede insertar (advance_id no existe)
SET LOCAL request.jwt.claims = '{"sub":"artist-uuid-1","role":"authenticated"}';
INSERT INTO public.commission_advance_files (advance_id, storage_path, file_size, sort_order)
VALUES ('non-existent-uuid', 'some/path.webp', 1024, 0);
-- Esperado: error de FK constraint
```

---

## 7. Consideraciones de rendimiento y cuota gratuita

| Recurso | Consideración |
|---|---|
| Tamaño de archivos en Storage | Compresión obligatoria en cliente (≤ 300 KB/imagen). Un proyecto típico con 10 avances de 3 imágenes = máx. 9 MB; muy por debajo del límite gratuito de Supabase Storage (1 GB). |
| URLs firmadas | Se generan al consultar el historial, con expiración de 1 hora. No se cachean más allá de la vida del componente para evitar URLs expiradas. |
| `staleTime` de TanStack Query | 1 minuto para los avances. Los cambios en avances no son tiempo-real críticos (el artista sube, el cliente recibe notificación por push en Spec 008). |
| Operación de subida en paralelo | Las imágenes de un avance se comprimen y suben en paralelo (`Promise.all`) para minimizar el tiempo total de espera. |
| Limpieza de huérfanos | Si el INSERT en `commission_advance_files` falla, el hook intenta borrar los archivos de Storage y el registro del avance. Esto reduce la deuda de almacenamiento sin necesidad de un job de limpieza. |

---

## 8. Decisiones técnicas

| ID | Tema | Decisión |
|---|---|---|
| DT-6.1 | Dos tablas vs. columna de array | Se separan `commission_advances` y `commission_advance_files` en lugar de usar un array de `storage_path`. Permite RLS granular por archivo, FK a Storage y extensibilidad futura (ej. metadatos por imagen). |
| DT-6.2 | WebP como formato de salida | WebP ofrece mejor compresión que JPEG a calidad equivalente. `expo-image-manipulator` lo soporta en Android. Fallback a JPEG si el dispositivo no soporta WebP (el bucket también acepta JPEG). |
| DT-6.3 | INSERT del avance antes de subir archivos | Se crea el registro de `commission_advances` primero para obtener el `advance_id` necesario para la ruta de Storage. Si la subida falla, el avance huérfano se elimina en el handler de error. |
| DT-6.4 | Validación de estado en cliente y RLS | La política RLS en Storage verifica `c.status = 'EN_PROGRESO'`; el cliente también valida antes de abrir el picker. Doble barrera sin duplicar lógica de negocio compleja. |
| DT-6.5 | Sin Edge Function para la subida | La subida se hace directamente desde el cliente (Supabase JS SDK + Storage). No se requiere una Edge Function para el MVP (Principio 11). |
| DT-6.6 | Expiración de URLs firmadas | 1 hora, igual que las referencias de la Spec 004. Suficiente para una sesión de revisión sin exponer las imágenes permanentemente. |