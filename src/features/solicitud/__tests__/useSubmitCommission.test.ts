import type { SubmitCommissionPayload } from '../hooks/useSubmitCommission';
import type { LocalImageAsset } from '../types';
import { useSubmitCommission } from '../hooks/useSubmitCommission';

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    storage: { from: jest.fn() },
    from: jest.fn(),
  },
}));

jest.mock('../utils/compressImage', () => ({
  compressImage: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({
    base64: jest.fn().mockResolvedValue('base64data=='),
  })),
}));

// Capture mutationFn without needing a React renderer
jest.mock('@tanstack/react-query', () => ({
  useMutation: jest.fn((opts: { mutationFn: (p: unknown) => Promise<unknown> }) => ({
    mutateAsync: (payload: unknown) => opts.mutationFn(payload),
  })),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { supabase } = require('../../../lib/supabase') as {
  supabase: {
    auth: { getUser: jest.Mock };
    storage: { from: jest.Mock };
    from: jest.Mock;
  };
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { compressImage } = require('../utils/compressImage') as {
  compressImage: jest.Mock;
};

// ── Fixtures ───────────────────────────────────────────────────────────────

const COMMISSION_ID = 'aaaaaaaa-0000-0000-0000-000000000000';

const baseForm = {
  description: 'Descripción con más de veinte caracteres',
  intended_use: 'personal' as const,
};

function makeImage(n = 1): LocalImageAsset {
  return {
    uri: `file://img${n}.jpg`,
    fileName: `img${n}.jpg`,
    fileSize: 100_000,
    mimeType: 'image/jpeg',
  };
}

function makePayload(overrides?: Partial<SubmitCommissionPayload>): SubmitCommissionPayload {
  return {
    artistId: 'artist-uuid',
    serviceId: 'service-uuid',
    form: baseForm,
    images: [],
    hasArtistTos: false,
    ...overrides,
  };
}

const CLIENT_ID = 'cccccccc-0000-0000-0000-000000000000';

function mockAuth() {
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: CLIENT_ID } }, error: null });
}

// Sets up the full happy-path supabase mock chain
function setupHappyPath() {
  mockAuth();
  const mockUpload = jest.fn().mockResolvedValue({ error: null });
  supabase.storage.from.mockReturnValue({ upload: mockUpload });

  const mockRefsInsert = jest.fn().mockResolvedValue({ error: null });
  const mockCommissionSingle = jest
    .fn()
    .mockResolvedValue({ data: { id: COMMISSION_ID }, error: null });
  const mockCommissionSelect = jest.fn().mockReturnValue({ single: mockCommissionSingle });
  const mockCommissionInsert = jest.fn().mockReturnValue({ select: mockCommissionSelect });

  supabase.from.mockImplementation((table: string) => {
    if (table === 'commissions') return { insert: mockCommissionInsert };
    return { insert: mockRefsInsert };
  });

  return { mockUpload, mockCommissionInsert, mockRefsInsert };
}

// ── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useSubmitCommission — flujo exitoso', () => {
  it('sin imágenes: inserta comisión y no llama a commission_references', async () => {
    const { mockCommissionInsert, mockRefsInsert } = setupHappyPath();

    const hook = useSubmitCommission() as unknown as {
      mutateAsync: (p: SubmitCommissionPayload) => Promise<{ id: string }>;
    };
    const result = await hook.mutateAsync(makePayload());

    expect(result).toEqual({ id: COMMISSION_ID });
    expect(mockCommissionInsert).toHaveBeenCalledTimes(1);
    expect(mockRefsInsert).not.toHaveBeenCalled();
    expect(compressImage).not.toHaveBeenCalled();
  });

  it('con imágenes: comprime, sube al bucket e inserta referencias', async () => {
    compressImage.mockResolvedValue({ uri: 'file://compressed.jpg', size: 50_000 });

    const { mockUpload, mockCommissionInsert, mockRefsInsert } = setupHappyPath();

    const hook = useSubmitCommission() as unknown as {
      mutateAsync: (p: SubmitCommissionPayload) => Promise<{ id: string }>;
    };
    await hook.mutateAsync(makePayload({ images: [makeImage(1), makeImage(2)] }));

    expect(compressImage).toHaveBeenCalledTimes(2);
    expect(supabase.storage.from).toHaveBeenCalledWith('commission-references');
    expect(mockUpload).toHaveBeenCalledTimes(2);
    expect(mockCommissionInsert).toHaveBeenCalledTimes(1);
    expect(mockRefsInsert).toHaveBeenCalledTimes(1);

    // References include the correct commission_id
    const refs = mockRefsInsert.mock.calls[0][0] as { commission_id: string }[];
    expect(refs).toHaveLength(2);
    expect(refs[0].commission_id).toBe(COMMISSION_ID);
  });

  it('con TOS: terms_accepted_at no es null', async () => {
    const { mockCommissionInsert } = setupHappyPath();

    const hook = useSubmitCommission() as unknown as {
      mutateAsync: (p: SubmitCommissionPayload) => Promise<{ id: string }>;
    };
    await hook.mutateAsync(makePayload({ hasArtistTos: true }));

    const inserted = mockCommissionInsert.mock.calls[0][0] as { terms_accepted_at: string | null };
    expect(inserted.terms_accepted_at).not.toBeNull();
  });

  it('sin TOS: terms_accepted_at es null', async () => {
    const { mockCommissionInsert } = setupHappyPath();

    const hook = useSubmitCommission() as unknown as {
      mutateAsync: (p: SubmitCommissionPayload) => Promise<{ id: string }>;
    };
    await hook.mutateAsync(makePayload({ hasArtistTos: false }));

    const inserted = mockCommissionInsert.mock.calls[0][0] as { terms_accepted_at: string | null };
    expect(inserted.terms_accepted_at).toBeNull();
  });
});

describe('useSubmitCommission — errores', () => {
  it('error de subida lanza el mensaje correcto', async () => {
    mockAuth();
    compressImage.mockResolvedValue({ uri: 'file://compressed.jpg', size: 50_000 });

    // La comisión se crea primero (nuevo orden); el upload falla después
    const mockCommissionSingle = jest
      .fn()
      .mockResolvedValue({ data: { id: COMMISSION_ID }, error: null });
    supabase.from.mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({ single: mockCommissionSingle }),
      }),
    });
    supabase.storage.from.mockReturnValue({
      upload: jest.fn().mockResolvedValue({ error: new Error('network') }),
    });

    const hook = useSubmitCommission() as unknown as {
      mutateAsync: (p: SubmitCommissionPayload) => Promise<unknown>;
    };

    await expect(
      hook.mutateAsync(makePayload({ images: [makeImage()] })),
    ).rejects.toThrow('No se pudo subir una o más imágenes. Comprueba tu conexión e inténtalo de nuevo');
  });

  it('error en INSERT de comisión lanza el mensaje correcto', async () => {
    mockAuth();
    supabase.storage.from.mockReturnValue({ upload: jest.fn().mockResolvedValue({ error: null }) });

    const mockSingle = jest
      .fn()
      .mockResolvedValue({ data: null, error: new Error('db error') });
    supabase.from.mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({ single: mockSingle }),
      }),
    });

    const hook = useSubmitCommission() as unknown as {
      mutateAsync: (p: SubmitCommissionPayload) => Promise<unknown>;
    };

    await expect(hook.mutateAsync(makePayload())).rejects.toThrow(
      'No se pudo enviar la solicitud, comprueba tu conexión e inténtalo de nuevo',
    );
  });

  it('error en INSERT de references lanza el mensaje correcto', async () => {
    mockAuth();
    compressImage.mockResolvedValue({ uri: 'file://compressed.jpg', size: 50_000 });

    supabase.storage.from.mockReturnValue({
      upload: jest.fn().mockResolvedValue({ error: null }),
    });

    const mockRefsInsert = jest.fn().mockResolvedValue({ error: new Error('refs fail') });
    const mockCommissionSingle = jest
      .fn()
      .mockResolvedValue({ data: { id: COMMISSION_ID }, error: null });
    supabase.from.mockImplementation((table: string) => {
      if (table === 'commissions') {
        return {
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({ single: mockCommissionSingle }),
          }),
        };
      }
      return { insert: mockRefsInsert };
    });

    const hook = useSubmitCommission() as unknown as {
      mutateAsync: (p: SubmitCommissionPayload) => Promise<unknown>;
    };

    await expect(
      hook.mutateAsync(makePayload({ images: [makeImage()] })),
    ).rejects.toThrow(
      'No se pudo enviar la solicitud, comprueba tu conexión e inténtalo de nuevo',
    );
  });
});
