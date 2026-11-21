import type { PickedAsset } from '../../../lib/media/pickSingleImage';
import {
  prepareDeliverableImage,
  DELIVERABLE_MAX_BYTES,
  DELIVERABLE_MAX_SIDE,
} from '../utils/prepareDeliverableImage';

// ── File mock ─────────────────────────────────────────────────────────────────

let mockFileSize = 500_000;

jest.mock('expo-file-system', () => {
  const MockFile = jest.fn().mockImplementation(() => ({ size: mockFileSize }));
  return { File: MockFile };
});

// ── ImageManipulator mock ─────────────────────────────────────────────────────

jest.mock('expo-image-manipulator', () => {
  const mockResize = jest.fn().mockReturnThis();
  const mockSaveAsync = jest.fn().mockResolvedValue({ uri: 'file://saved.jpg' });
  const mockRenderAsync = jest.fn().mockResolvedValue({ saveAsync: mockSaveAsync });
  const mockManipulate = jest.fn().mockReturnValue({
    resize: mockResize,
    renderAsync: mockRenderAsync,
  });
  return {
    ImageManipulator: { manipulate: mockManipulate },
    SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ImageManipulator } = require('expo-image-manipulator') as {
  ImageManipulator: { manipulate: jest.Mock };
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAsset(overrides?: Partial<PickedAsset>): PickedAsset {
  return {
    uri: 'file://photo.jpg',
    fileSize: 500_000,
    mimeType: 'image/jpeg',
    width: 800,
    height: 600,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFileSize = 500_000;
});

// ── pass-through (normal case) ────────────────────────────────────────────────

describe('prepareDeliverableImage — pass-through', () => {
  it('returns original asset uri when within limits', async () => {
    const asset = makeAsset({ fileSize: 1_000_000, width: 800, height: 600 });
    const result = await prepareDeliverableImage(asset);
    expect(result.uri).toBe(asset.uri);
    expect(result.size).toBe(1_000_000);
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.extension).toBe('jpg');
  });

  it('does not call ImageManipulator when pass-through', async () => {
    await prepareDeliverableImage(makeAsset());
    expect(ImageManipulator.manipulate).not.toHaveBeenCalled();
  });

  it('uses File.size when fileSize is null', async () => {
    mockFileSize = 1_000;
    const asset = makeAsset({ fileSize: undefined, width: 100, height: 100 });
    const result = await prepareDeliverableImage(asset);
    expect(result.size).toBe(1_000);
  });
});

// ── resize by width ───────────────────────────────────────────────────────────

describe('prepareDeliverableImage — resize needed (over max side)', () => {
  it('resizes by width when width >= height and exceeds max side', async () => {
    const asset = makeAsset({ width: DELIVERABLE_MAX_SIDE + 100, height: 2000, fileSize: 1_000 });
    await prepareDeliverableImage(asset);
    const ctx = ImageManipulator.manipulate.mock.results[0]?.value as { resize: jest.Mock };
    expect(ctx.resize).toHaveBeenCalledWith({ width: DELIVERABLE_MAX_SIDE });
  });

  it('resizes by height when height > width and exceeds max side', async () => {
    const asset = makeAsset({ width: 2000, height: DELIVERABLE_MAX_SIDE + 100, fileSize: 1_000 });
    await prepareDeliverableImage(asset);
    const ctx = ImageManipulator.manipulate.mock.results[0]?.value as { resize: jest.Mock };
    expect(ctx.resize).toHaveBeenCalledWith({ height: DELIVERABLE_MAX_SIDE });
  });
});

// ── over max bytes (needs compression) ───────────────────────────────────────

describe('prepareDeliverableImage — over max bytes, needs compression', () => {
  it('calls manipulator when fileSize exceeds DELIVERABLE_MAX_BYTES', async () => {
    const asset = makeAsset({ fileSize: DELIVERABLE_MAX_BYTES + 1, width: 800, height: 600 });
    mockFileSize = 500_000;
    await prepareDeliverableImage(asset);
    expect(ImageManipulator.manipulate).toHaveBeenCalled();
  });

  it('returns compressed uri from saveAsync', async () => {
    const asset = makeAsset({ fileSize: DELIVERABLE_MAX_BYTES + 1, width: 800, height: 600 });
    mockFileSize = 500_000;
    const result = await prepareDeliverableImage(asset);
    expect(result.uri).toBe('file://saved.jpg');
  });
});

// ── PNG fallback to JPEG ──────────────────────────────────────────────────────

describe('prepareDeliverableImage — PNG tries both formats', () => {
  it('calls manipulate twice for PNG when first attempt is too large', async () => {
    const asset = makeAsset({
      mimeType: 'image/png',
      fileSize: DELIVERABLE_MAX_BYTES + 1,
      width: 800,
      height: 600,
    });
    // First call (PNG) → still too large; second call (JPEG) → ok
    mockFileSize = DELIVERABLE_MAX_BYTES + 1;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { File: MockFile } = require('expo-file-system') as { File: jest.Mock };
    MockFile.mockReturnValueOnce({ size: DELIVERABLE_MAX_BYTES + 1 })
           .mockReturnValueOnce({ size: 500_000 });

    const result = await prepareDeliverableImage(asset);
    expect(ImageManipulator.manipulate).toHaveBeenCalledTimes(2);
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.extension).toBe('jpg');
  });
});

// ── unsupported format ────────────────────────────────────────────────────────

describe('prepareDeliverableImage — unsupported format', () => {
  it('throws unsupported_format for gif', async () => {
    const asset = makeAsset({ mimeType: 'image/gif' });
    await expect(prepareDeliverableImage(asset)).rejects.toThrow('unsupported_format');
  });
});

// ── file_too_large ────────────────────────────────────────────────────────────

describe('prepareDeliverableImage — file_too_large after all attempts', () => {
  it('throws file_too_large when every attempt exceeds max bytes', async () => {
    const asset = makeAsset({ fileSize: DELIVERABLE_MAX_BYTES + 1, width: 800, height: 600 });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { File: MockFile } = require('expo-file-system') as { File: jest.Mock };
    MockFile.mockImplementation(() => ({ size: DELIVERABLE_MAX_BYTES + 1 }));
    await expect(prepareDeliverableImage(asset)).rejects.toThrow('file_too_large');
  });
});
