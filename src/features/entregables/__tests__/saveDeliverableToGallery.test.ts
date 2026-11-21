import { saveDeliverableToGallery } from '../utils/saveDeliverableToGallery';

// ── Supabase mock ─────────────────────────────────────────────────────────────

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    storage: { from: jest.fn() },
  },
}));

// ── expo-file-system mock (factory must not reference outer variables) ────────

jest.mock('expo-file-system', () => ({
  File: jest.fn(),
  Paths: { cache: 'file://cache' },
}));

// ── expo-media-library mock ───────────────────────────────────────────────────

jest.mock('expo-media-library', () => ({
  Asset: { create: jest.fn() },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { supabase } = require('../../../lib/supabase') as {
  supabase: { storage: { from: jest.Mock } };
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const FileSystem = require('expo-file-system') as { File: jest.Mock; Paths: { cache: string } };
const MockFile = FileSystem.File as jest.Mock & { downloadFileAsync: jest.Mock };
// Add static method (must exist for the import to work)
MockFile.downloadFileAsync = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Asset } = require('expo-media-library') as { Asset: { create: jest.Mock } };

let targetDeleteFn: jest.Mock;
let downloadedDeleteFn: jest.Mock;
let mockTargetFile: { exists: boolean; delete: jest.Mock; uri: string };
let mockDownloadedFile: { exists: boolean; delete: jest.Mock; uri: string };

function mockStorage(signedUrl: string | null, error: unknown = null) {
  supabase.storage.from.mockReturnValue({
    createSignedUrl: jest.fn().mockResolvedValue({
      data: signedUrl ? { signedUrl } : null,
      error,
    }),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  targetDeleteFn = jest.fn();
  downloadedDeleteFn = jest.fn();
  mockTargetFile = { exists: false, delete: targetDeleteFn, uri: 'file://cache/koma-comm-1.jpg' };
  mockDownloadedFile = { exists: true, delete: downloadedDeleteFn, uri: 'file://cache/koma-comm-1.jpg' };
  MockFile.mockReturnValue(mockTargetFile);
  MockFile.downloadFileAsync.mockResolvedValue(mockDownloadedFile);
  Asset.create.mockResolvedValue({});
});

const PATH = 'comm-1/final-abc.jpg';
const COMMISSION_ID = 'comm-1';

// ── locked (storage RLS rejects) ──────────────────────────────────────────────

describe('saveDeliverableToGallery — locked', () => {
  it('throws SaveDeliverableError with code "locked" when createSignedUrl fails', async () => {
    mockStorage(null, { message: 'Policy violation' });
    await expect(saveDeliverableToGallery(PATH, COMMISSION_ID)).rejects.toMatchObject({
      code: 'locked',
    });
    expect(MockFile.downloadFileAsync).not.toHaveBeenCalled();
  });

  it('throws "locked" when data is null with no error', async () => {
    mockStorage(null);
    await expect(saveDeliverableToGallery(PATH, COMMISSION_ID)).rejects.toMatchObject({
      code: 'locked',
    });
  });
});

// ── download errors ───────────────────────────────────────────────────────────

describe('saveDeliverableToGallery — download errors', () => {
  it('throws "network" when download fails with generic error', async () => {
    mockStorage('https://example.com/file.jpg');
    MockFile.downloadFileAsync.mockRejectedValue(new Error('connection reset'));
    await expect(saveDeliverableToGallery(PATH, COMMISSION_ID)).rejects.toMatchObject({
      code: 'network',
    });
  });

  it('throws "no_space" when download fails with space error', async () => {
    mockStorage('https://example.com/file.jpg');
    MockFile.downloadFileAsync.mockRejectedValue(new Error('no space left on device'));
    await expect(saveDeliverableToGallery(PATH, COMMISSION_ID)).rejects.toMatchObject({
      code: 'no_space',
    });
  });
});

// ── Asset.create errors ───────────────────────────────────────────────────────

describe('saveDeliverableToGallery — Asset.create errors', () => {
  it('throws "unknown" when Asset.create fails with generic error', async () => {
    mockStorage('https://example.com/file.jpg');
    Asset.create.mockRejectedValue(new Error('permission denied'));
    await expect(saveDeliverableToGallery(PATH, COMMISSION_ID)).rejects.toMatchObject({
      code: 'unknown',
    });
  });

  it('throws "no_space" when Asset.create fails with space error', async () => {
    mockStorage('https://example.com/file.jpg');
    Asset.create.mockRejectedValue(new Error('disk space'));
    await expect(saveDeliverableToGallery(PATH, COMMISSION_ID)).rejects.toMatchObject({
      code: 'no_space',
    });
  });
});

// ── happy path ────────────────────────────────────────────────────────────────

describe('saveDeliverableToGallery — happy path', () => {
  it('calls Asset.create with downloaded file uri', async () => {
    mockStorage('https://example.com/file.jpg');
    await saveDeliverableToGallery(PATH, COMMISSION_ID);
    expect(Asset.create).toHaveBeenCalledWith(mockDownloadedFile.uri);
  });

  it('resolves without throwing on success', async () => {
    mockStorage('https://example.com/file.jpg');
    await expect(saveDeliverableToGallery(PATH, COMMISSION_ID)).resolves.toBeUndefined();
  });
});

// ── cleanup ───────────────────────────────────────────────────────────────────

describe('saveDeliverableToGallery — cleanup', () => {
  it('deletes temp file after successful save', async () => {
    mockStorage('https://example.com/file.jpg');
    await saveDeliverableToGallery(PATH, COMMISSION_ID);
    expect(downloadedDeleteFn).toHaveBeenCalled();
  });

  it('deletes temp file even when Asset.create throws', async () => {
    mockStorage('https://example.com/file.jpg');
    Asset.create.mockRejectedValue(new Error('error'));
    await expect(saveDeliverableToGallery(PATH, COMMISSION_ID)).rejects.toThrow();
    expect(downloadedDeleteFn).toHaveBeenCalled();
  });
});
