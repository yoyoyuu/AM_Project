import type { PickedAsset } from '../../../lib/media/pickSingleImage';
import { useSubmitPaymentProof } from '../hooks/useSubmitPaymentProof';

jest.mock('../../../lib/supabase', () => ({
  supabase: { rpc: jest.fn() },
}));

jest.mock('../../../lib/storage/uploadLocalFile', () => ({
  newObjectId: jest.fn(() => 'mock-uuid'),
  removeQuietly: jest.fn(),
  uploadLocalFile: jest.fn(),
}));

jest.mock('../utils/compressPaymentProof', () => ({
  compressPaymentProof: jest.fn().mockResolvedValue({ uri: 'file://compressed.jpg' }),
}));

const mockInvalidateQueries = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: jest.fn(() => ({ invalidateQueries: mockInvalidateQueries })),
  useMutation: jest.fn((opts: { mutationFn: (p: unknown) => Promise<unknown>; onSettled?: () => void }) => ({
    mutateAsync: async (p: unknown) => {
      try {
        const result = await opts.mutationFn(p);
        opts.onSettled?.();
        return result;
      } catch (e) {
        opts.onSettled?.();
        throw e;
      }
    },
  })),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { supabase } = require('../../../lib/supabase') as { supabase: { rpc: jest.Mock } };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const storage = require('../../../lib/storage/uploadLocalFile') as {
  uploadLocalFile: jest.Mock;
  removeQuietly: jest.Mock;
  newObjectId: jest.Mock;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { compressPaymentProof } = require('../utils/compressPaymentProof') as {
  compressPaymentProof: jest.Mock;
};

function makeAsset(overrides?: Partial<PickedAsset>): PickedAsset {
  return {
    uri: 'file://photo.jpg',
    fileSize: 300_000,
    mimeType: 'image/jpeg',
    width: 800,
    height: 600,
    ...overrides,
  };
}

const COMMISSION_ID = 'comm-abc';

beforeEach(() => {
  jest.clearAllMocks();
  mockInvalidateQueries.mockClear();
  supabase.rpc.mockResolvedValue({ error: null });
  storage.uploadLocalFile.mockResolvedValue(undefined);
});

// ── happy path ────────────────────────────────────────────────────────────────

describe('useSubmitPaymentProof — happy path', () => {
  it('calls compressPaymentProof with asset data', async () => {
    const { mutateAsync } = useSubmitPaymentProof();
    await mutateAsync({ commissionId: COMMISSION_ID, asset: makeAsset() });
    expect(compressPaymentProof).toHaveBeenCalledWith('file://photo.jpg', 800, 600);
  });

  it('calls uploadLocalFile with payment-proofs bucket', async () => {
    const { mutateAsync } = useSubmitPaymentProof();
    await mutateAsync({ commissionId: COMMISSION_ID, asset: makeAsset() });
    expect(storage.uploadLocalFile).toHaveBeenCalledWith(
      'payment-proofs',
      expect.stringContaining(COMMISSION_ID),
      'file://compressed.jpg',
      'image/jpeg',
    );
  });

  it('calls supabase.rpc submit_payment_proof with commission id', async () => {
    const { mutateAsync } = useSubmitPaymentProof();
    await mutateAsync({ commissionId: COMMISSION_ID, asset: makeAsset(), reference: 'REF-1', note: 'nota' });
    expect(supabase.rpc).toHaveBeenCalledWith(
      'submit_payment_proof',
      expect.objectContaining({ p_commission_id: COMMISSION_ID }),
    );
  });

  it('trims and passes reference and note to rpc', async () => {
    const { mutateAsync } = useSubmitPaymentProof();
    await mutateAsync({ commissionId: COMMISSION_ID, asset: makeAsset(), reference: ' REF ', note: ' nota ' });
    expect(supabase.rpc).toHaveBeenCalledWith(
      'submit_payment_proof',
      expect.objectContaining({ p_reference: 'REF', p_note: 'nota' }),
    );
  });

  it('passes null for empty reference and note', async () => {
    const { mutateAsync } = useSubmitPaymentProof();
    await mutateAsync({ commissionId: COMMISSION_ID, asset: makeAsset(), reference: '', note: '' });
    expect(supabase.rpc).toHaveBeenCalledWith(
      'submit_payment_proof',
      expect.objectContaining({ p_reference: null, p_note: null }),
    );
  });

  it('calls invalidateQueries with commissions key on success', async () => {
    const { mutateAsync } = useSubmitPaymentProof();
    await mutateAsync({ commissionId: COMMISSION_ID, asset: makeAsset() });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['commissions'] });
  });
});

// ── rpc error path ────────────────────────────────────────────────────────────

describe('useSubmitPaymentProof — rpc error', () => {
  it('calls removeQuietly to roll back uploaded file on rpc error', async () => {
    supabase.rpc.mockResolvedValue({ error: { message: 'invalid_payment_state' } });
    const { mutateAsync } = useSubmitPaymentProof();
    await expect(mutateAsync({ commissionId: COMMISSION_ID, asset: makeAsset() })).rejects.toThrow();
    expect(storage.removeQuietly).toHaveBeenCalledWith('payment-proofs', expect.any(String));
  });

  it('still calls invalidateQueries on rpc error', async () => {
    supabase.rpc.mockResolvedValue({ error: { message: 'invalid_payment_state' } });
    const { mutateAsync } = useSubmitPaymentProof();
    await expect(mutateAsync({ commissionId: COMMISSION_ID, asset: makeAsset() })).rejects.toThrow();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['commissions'] });
  });
});

// ── upload error path ─────────────────────────────────────────────────────────

describe('useSubmitPaymentProof — upload error', () => {
  it('throws and does not call rpc when upload fails', async () => {
    storage.uploadLocalFile.mockRejectedValue(new Error('network'));
    const { mutateAsync } = useSubmitPaymentProof();
    await expect(mutateAsync({ commissionId: COMMISSION_ID, asset: makeAsset() })).rejects.toThrow();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
