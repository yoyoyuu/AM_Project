import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';

const MAX_SIDE = 1600;
const QUALITY_STEPS = [0.8, 0.65] as const;
const MAX_BYTES = 1024 * 1024;

export interface CompressedProof {
  uri: string;
  size: number;
}

export async function compressPaymentProof(
  uri: string,
  width: number,
  height: number,
): Promise<CompressedProof> {
  for (const compress of QUALITY_STEPS) {
    const ctx = ImageManipulator.manipulate(uri);
    if (Math.max(width, height) > MAX_SIDE) {
      ctx.resize(width >= height ? { width: MAX_SIDE } : { height: MAX_SIDE });
    }
    const rendered = await ctx.renderAsync();
    const saved = await rendered.saveAsync({ compress, format: SaveFormat.JPEG });
    const size = new File(saved.uri).size ?? 0;
    if (size > 0 && size <= MAX_BYTES) return { uri: saved.uri, size };
  }
  throw new Error('proof_too_large');
}
