import { useCommissionAdvances } from '../hooks/useCommissionAdvances';

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    storage: { from: jest.fn() },
  },
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn((opts: { queryFn: () => Promise<unknown> }) => ({
    _queryFn: opts.queryFn,
  })),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { supabase } = require('../../../lib/supabase') as {
  supabase: {
    from: jest.Mock;
    storage: { from: jest.Mock };
  };
};

// ── Fixtures ───────────────────────────────────────────────────────────────

const COMMISSION_ID = 'cccccccc-0000-0000-0000-000000000000';

type HookResult = { _queryFn: () => Promise<unknown> };

// ── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useCommissionAdvances — sin avances', () => {
  it('retorna un array vacío cuando la comisión no tiene avances', async () => {
    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });

    supabase.storage.from.mockReturnValue({
      createSignedUrl: jest.fn().mockResolvedValue({ data: { signedUrl: null }, error: null }),
    });

    const hook = useCommissionAdvances(COMMISSION_ID) as unknown as HookResult;
    const result = await hook._queryFn();

    expect(result).toEqual([]);
  });
});

describe('useCommissionAdvances — con avances', () => {
  it('retorna los avances con URLs firmadas y conserva el orden del servidor', async () => {
    const mockFiles = [
      { id: 'f1', advance_id: 'a1', storage_path: 'path/0.webp', file_size: 100, sort_order: 0, created_at: '2026-11-01T10:00:00Z' },
    ];
    const mockAdvances = [
      { id: 'a2', commission_id: COMMISSION_ID, artist_id: 'artist-1', stage: 'LINEART', note: null, created_at: '2026-11-02T10:00:00Z', files: [] },
      { id: 'a1', commission_id: COMMISSION_ID, artist_id: 'artist-1', stage: 'SKETCH', note: 'Boceto listo', created_at: '2026-11-01T10:00:00Z', files: mockFiles },
    ];

    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: mockAdvances, error: null }),
        }),
      }),
    });

    supabase.storage.from.mockReturnValue({
      createSignedUrl: jest.fn().mockResolvedValue({
        data: { signedUrl: 'https://signed.url/0.webp' },
        error: null,
      }),
    });

    const hook = useCommissionAdvances(COMMISSION_ID) as unknown as HookResult;
    const result = await hook._queryFn() as { id: string; files: { signed_url: string | null }[] }[];

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('a2');
    expect(result[1].id).toBe('a1');
    expect(result[1].files[0].signed_url).toBe('https://signed.url/0.webp');
  });

  it('asigna signed_url null cuando createSignedUrl no devuelve datos', async () => {
    const mockFiles = [
      { id: 'f1', advance_id: 'a1', storage_path: 'path/0.webp', file_size: 100, sort_order: 0, created_at: '2026-11-01T10:00:00Z' },
    ];
    const mockAdvances = [
      { id: 'a1', commission_id: COMMISSION_ID, artist_id: 'artist-1', stage: 'SKETCH', note: null, created_at: '2026-11-01T10:00:00Z', files: mockFiles },
    ];

    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: mockAdvances, error: null }),
        }),
      }),
    });

    supabase.storage.from.mockReturnValue({
      createSignedUrl: jest.fn().mockResolvedValue({ data: null, error: null }),
    });

    const hook = useCommissionAdvances(COMMISSION_ID) as unknown as HookResult;
    const result = await hook._queryFn() as { files: { signed_url: string | null }[] }[];

    expect(result[0].files[0].signed_url).toBeNull();
  });
});

describe('useCommissionAdvances — error', () => {
  it('lanza el error de Supabase cuando la query falla', async () => {
    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: null, error: new Error('db error') }),
        }),
      }),
    });

    const hook = useCommissionAdvances(COMMISSION_ID) as unknown as HookResult;
    await expect(hook._queryFn()).rejects.toThrow('db error');
  });
});
