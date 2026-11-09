import type { LocalImageAsset } from '../types';
import { compressImage } from '../utils/compressImage';

jest.mock('expo-image-manipulator', () => {
  const mockResize = jest.fn().mockReturnThis();
  const mockSaveAsync = jest.fn().mockResolvedValue({ uri: 'file://compressed.jpg' });
  const mockRenderAsync = jest.fn().mockResolvedValue({ saveAsync: mockSaveAsync });
  const mockManipulate = jest.fn().mockReturnValue({
    resize: mockResize,
    renderAsync: mockRenderAsync,
  });
  return {
    ImageManipulator: { manipulate: mockManipulate },
    SaveFormat: { JPEG: 'jpeg' },
  };
});

jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn(),
  EncodingType: { Base64: 'base64' },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ImageManipulator } = require('expo-image-manipulator') as {
  ImageManipulator: { manipulate: jest.Mock };
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const FileSystem = require('expo-file-system') as { getInfoAsync: jest.Mock };

// ── Helpers ────────────────────────────────────────────────────────────────

function makeAsset(overrides?: Partial<LocalImageAsset>): LocalImageAsset {
  return {
    uri: 'file://test.jpg',
    fileName: 'test.jpg',
    fileSize: 500_000,
    mimeType: 'image/jpeg',
    ...overrides,
  };
}

function makeGetDimensions(width: number, height: number) {
  return jest.fn().mockResolvedValue({ width, height });
}

function mockFileSize(size = 50_000) {
  FileSystem.getInfoAsync.mockResolvedValue({ exists: true, uri: 'file://compressed.jpg', size });
}

// ── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

describe('compressImage', () => {
  it('no lanza con una imagen JPEG válida', async () => {
    mockFileSize();
    await expect(
      compressImage(makeAsset(), makeGetDimensions(800, 600)),
    ).resolves.not.toThrow();
  });

  it('devuelve uri del archivo comprimido', async () => {
    mockFileSize(50_000);
    const { uri } = await compressImage(makeAsset(), makeGetDimensions(800, 600));
    expect(typeof uri).toBe('string');
    expect(uri.length).toBeGreaterThan(0);
  });

  it('saveAsync se llama con format JPEG', async () => {
    mockFileSize();
    await compressImage(makeAsset(), makeGetDimensions(800, 600));

    const context = ImageManipulator.manipulate.mock.results[0]?.value as {
      renderAsync: jest.Mock;
    };
    const imageRef = await (context.renderAsync.mock.results[0]?.value as Promise<{
      saveAsync: jest.Mock;
    }>);
    expect(imageRef.saveAsync).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'jpeg' }),
    );
  });

  it('redimensiona por ancho cuando width >= height y width > 1920', async () => {
    mockFileSize();
    await compressImage(makeAsset(), makeGetDimensions(3000, 2000));

    const mockContext = ImageManipulator.manipulate.mock.results[0]?.value as {
      resize: jest.Mock;
    };
    expect(mockContext.resize).toHaveBeenCalledWith({ width: 1920 });
  });

  it('redimensiona por alto cuando height > width y height > 1920', async () => {
    mockFileSize();
    await compressImage(makeAsset(), makeGetDimensions(1200, 2500));

    const mockContext = ImageManipulator.manipulate.mock.results[0]?.value as {
      resize: jest.Mock;
    };
    expect(mockContext.resize).toHaveBeenCalledWith({ height: 1920 });
  });

  it('no llama a resize cuando la imagen ya cabe en 1920 px', async () => {
    mockFileSize();
    await compressImage(makeAsset(), makeGetDimensions(800, 600));

    const mockContext = ImageManipulator.manipulate.mock.results[0]?.value as {
      resize: jest.Mock;
    };
    expect(mockContext.resize).not.toHaveBeenCalled();
  });
});
