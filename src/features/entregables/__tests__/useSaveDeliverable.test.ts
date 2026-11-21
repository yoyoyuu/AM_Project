import { SAVE_MESSAGES, useSaveDeliverable } from '../hooks/useSaveDeliverable';

jest.mock('react-native', () => ({
  Linking: { openSettings: jest.fn() },
}));

jest.mock('../utils/requestMediaLibraryWritePermission', () => ({
  requestMediaLibraryWritePermission: jest.fn(),
}));

jest.mock('../utils/saveDeliverableToGallery', () => ({
  saveDeliverableToGallery: jest.fn(),
  SaveDeliverableError: class SaveDeliverableError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: jest.fn((opts: { mutationFn: (p: unknown) => Promise<unknown> }) => ({
    mutateAsync: (p: unknown) => opts.mutationFn(p),
  })),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { requestMediaLibraryWritePermission } = require('../utils/requestMediaLibraryWritePermission') as {
  requestMediaLibraryWritePermission: jest.Mock;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { saveDeliverableToGallery, SaveDeliverableError } = require('../utils/saveDeliverableToGallery') as {
  saveDeliverableToGallery: jest.Mock;
  SaveDeliverableError: new (code: string) => Error & { code: string };
};

const PAYLOAD = { commissionId: 'comm-1', deliverablePath: 'comm-1/final-abc.jpg' };

beforeEach(() => {
  jest.clearAllMocks();
});

// ── permission denied ─────────────────────────────────────────────────────────

describe('useSaveDeliverable — permission denied', () => {
  it('returns ok:false with showOpenSettings:true when permission not granted', async () => {
    requestMediaLibraryWritePermission.mockResolvedValue({ granted: false, canAskAgain: false });
    const { mutateAsync } = useSaveDeliverable();
    const result = await mutateAsync(PAYLOAD);
    expect(result).toEqual({
      ok: false,
      message: SAVE_MESSAGES.denied,
      showOpenSettings: true,
    });
    expect(saveDeliverableToGallery).not.toHaveBeenCalled();
  });
});

// ── success ───────────────────────────────────────────────────────────────────

describe('useSaveDeliverable — success', () => {
  it('returns ok:true when permission granted and save succeeds', async () => {
    requestMediaLibraryWritePermission.mockResolvedValue({ granted: true });
    saveDeliverableToGallery.mockResolvedValue(undefined);
    const { mutateAsync } = useSaveDeliverable();
    const result = await mutateAsync(PAYLOAD);
    expect(result).toEqual({ ok: true });
  });

  it('calls saveDeliverableToGallery with correct path and commissionId', async () => {
    requestMediaLibraryWritePermission.mockResolvedValue({ granted: true });
    saveDeliverableToGallery.mockResolvedValue(undefined);
    const { mutateAsync } = useSaveDeliverable();
    await mutateAsync(PAYLOAD);
    expect(saveDeliverableToGallery).toHaveBeenCalledWith(
      PAYLOAD.deliverablePath,
      PAYLOAD.commissionId,
    );
  });
});

// ── save error outcomes ───────────────────────────────────────────────────────

describe('useSaveDeliverable — save errors', () => {
  beforeEach(() => {
    requestMediaLibraryWritePermission.mockResolvedValue({ granted: true });
  });

  it('returns locked message when save throws SaveDeliverableError("locked")', async () => {
    saveDeliverableToGallery.mockRejectedValue(new SaveDeliverableError('locked'));
    const { mutateAsync } = useSaveDeliverable();
    const result = await mutateAsync(PAYLOAD);
    expect(result).toEqual({
      ok: false,
      message: SAVE_MESSAGES.locked,
      showOpenSettings: false,
    });
  });

  it('returns network message when save throws SaveDeliverableError("network")', async () => {
    saveDeliverableToGallery.mockRejectedValue(new SaveDeliverableError('network'));
    const { mutateAsync } = useSaveDeliverable();
    const result = await mutateAsync(PAYLOAD);
    expect(result).toEqual({
      ok: false,
      message: SAVE_MESSAGES.network,
      showOpenSettings: false,
    });
  });

  it('returns no_space message when save throws SaveDeliverableError("no_space")', async () => {
    saveDeliverableToGallery.mockRejectedValue(new SaveDeliverableError('no_space'));
    const { mutateAsync } = useSaveDeliverable();
    const result = await mutateAsync(PAYLOAD);
    expect(result).toEqual({
      ok: false,
      message: SAVE_MESSAGES.no_space,
      showOpenSettings: false,
    });
  });

  it('returns unknown message for non-SaveDeliverableError', async () => {
    saveDeliverableToGallery.mockRejectedValue(new Error('unexpected'));
    const { mutateAsync } = useSaveDeliverable();
    const result = await mutateAsync(PAYLOAD);
    expect(result).toEqual({
      ok: false,
      message: SAVE_MESSAGES.unknown,
      showOpenSettings: false,
    });
  });
});
