import { useUploadAdvance } from '../hooks/useUploadAdvance';
import type { UploadAdvancePayload } from '../hooks/useUploadAdvance';

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    storage: { from: jest.fn() },
  },
}));

jest.mock('../utils/compressAdvanceImage', () => ({
  compressAdvanceImage: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({
    base64: jest.fn().mockResolvedValue('AAAA'),
  })),
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: jest.fn((opts: { mutationFn: (p: unknown) => Promise<unknown> }) => ({
    mutateAsync: (payload: unknown) => opts.mutationFn(payload),
  })),
  useQueryClient: jest.fn(() => ({
    invalidateQueries: jest.fn(),
  })),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { supabase } = require('../../../lib/supabase') as {
  supabase: {
    from: jest.Mock;
    storage: { from: jest.Mock };
  };
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { compressAdvanceImage } = require('../utils/compressAdvanceImage') as {
  compressAdvanceImage: jest.Mock;
};

// ── Fixtures ───────────────────────────────────────────────────────────────

const COMMISSION_ID = 'cccccccc-0000-0000-0000-000000000000';
const ARTIST_ID = 'aaaaaaaa-0000-0000-0000-000000000000';
const ADVANCE_ID = 'dddddddd-0000-0000-0000-000000000000';

function makePayload(overrides?: Partial<UploadAdvancePayload>): UploadAdvancePayload {
  return {
    commissionId: COMMISSION_ID,
    artistId: ARTIST_ID,
    currentStatus: 'EN_PROGRESO',
    currentStage: 'SKETCH',
    images: [{ uri: 'file://img.jpg', width: 800, height: 600 }],
    note: 'Boceto inicial',
    ...overrides,
  };
}

type HookResult = { mutateAsync: (p: UploadAdvancePayload) => Promise<unknown> };

// ── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useUploadAdvance — validación de estado', () => {
  it('lanza el mensaje literal cuando currentStatus !== EN_PROGRESO', async () => {
    const hook = useUploadAdvance() as unknown as HookResult;

    await expect(
      hook.mutateAsync(makePayload({ currentStatus: 'COMPLETADA' })),
    ).rejects.toThrow('No puedes subir avances en una comisión que no está en progreso');

    await expect(
      hook.mutateAsync(makePayload({ currentStatus: 'PENDIENTE' })),
    ).rejects.toThrow('No puedes subir avances en una comisión que no está en progreso');
  });
});

describe('useUploadAdvance — fallo en commission_advance_files', () => {
  it('elimina los archivos de Storage y el avance huérfano cuando falla el INSERT de files', async () => {
    compressAdvanceImage.mockResolvedValue({
      uri: 'file://compressed.webp',
      width: 1080,
      height: 810,
      fileSize: 150_000,
    });

    // fetch global mock
    (globalThis as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({
      blob: jest.fn().mockResolvedValue(new Blob()),
    });

    const mockDelete = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    });
    const mockStorageRemove = jest.fn().mockResolvedValue({ error: null });

    // commission_advances INSERT → ok; commission_advance_files INSERT → error
    supabase.from.mockImplementation((table: string) => {
      if (table === 'commission_advances') {
        return {
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { id: ADVANCE_ID }, error: null }),
            }),
          }),
          delete: mockDelete,
        };
      }
      // commission_advance_files
      return {
        insert: jest.fn().mockResolvedValue({ error: new Error('db error') }),
      };
    });

    supabase.storage.from.mockReturnValue({
      upload: jest.fn().mockResolvedValue({ error: null }),
      remove: mockStorageRemove,
    });

    const hook = useUploadAdvance() as unknown as HookResult;

    await expect(hook.mutateAsync(makePayload())).rejects.toThrow(
      'No se pudo subir el avance. Comprueba tu conexión e inténtalo de nuevo',
    );

    // Debe haber intentado limpiar el archivo de Storage
    expect(mockStorageRemove).toHaveBeenCalledWith([`${COMMISSION_ID}/${ADVANCE_ID}/0.webp`]);
    // Debe haber eliminado el registro del avance huérfano
    expect(mockDelete).toHaveBeenCalled();
  });
});

describe('useUploadAdvance — subida exitosa', () => {
  it('retorna el advanceId e invalida la query correcta', async () => {
    compressAdvanceImage.mockResolvedValue({
      uri: 'file://compressed.webp',
      width: 1080,
      height: 810,
      fileSize: 150_000,
    });

    (globalThis as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({
      blob: jest.fn().mockResolvedValue(new Blob()),
    });

    supabase.from.mockImplementation((table: string) => {
      if (table === 'commission_advances') {
        return {
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { id: ADVANCE_ID }, error: null }),
            }),
          }),
        };
      }
      return { insert: jest.fn().mockResolvedValue({ error: null }) };
    });

    supabase.storage.from.mockReturnValue({
      upload: jest.fn().mockResolvedValue({ error: null }),
    });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useQueryClient } = require('@tanstack/react-query') as {
      useQueryClient: jest.Mock;
    };
    const mockInvalidate = jest.fn();
    useQueryClient.mockReturnValue({ invalidateQueries: mockInvalidate });

    const hook = useUploadAdvance() as unknown as HookResult;
    const result = await hook.mutateAsync(makePayload());

    expect(result).toBe(ADVANCE_ID);
  });
});
