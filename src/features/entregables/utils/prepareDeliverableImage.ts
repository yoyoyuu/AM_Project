import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';

import type { PickedAsset } from '../../../lib/media/pickSingleImage';

export const DELIVERABLE_MAX_BYTES = 10 * 1024 * 1024;
export const DELIVERABLE_MAX_SIDE = 4096;

export interface PreparedDeliverable {
  uri: string;
  size: number;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  extension: 'jpg' | 'png' | 'webp';
}

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const;

export async function prepareDeliverableImage(asset: PickedAsset): Promise<PreparedDeliverable> {
  const mime = asset.mimeType as keyof typeof EXT;
  if (!(mime in EXT)) throw new Error('unsupported_format');

  const originalSize = asset.fileSize ?? new File(asset.uri).size ?? 0;
  const fitsSide = Math.max(asset.width, asset.height) <= DELIVERABLE_MAX_SIDE;

  // 1) Normal case: upload original without recompression (RF-24-A)
  if (fitsSide && originalSize > 0 && originalSize <= DELIVERABLE_MAX_BYTES) {
    return { uri: asset.uri, size: originalSize, mimeType: mime, extension: EXT[mime] };
  }

  // 2) Exceeds limits: resize to 4096 px. PNG tries to preserve PNG (transparency);
  //    if still > 10 MB, falls back to JPEG 0.92.
  const attempts: {
    format: SaveFormat;
    mime: PreparedDeliverable['mimeType'];
    compress: number;
  }[] =
    mime === 'image/png'
      ? [
          { format: SaveFormat.PNG, mime: 'image/png', compress: 1 },
          { format: SaveFormat.JPEG, mime: 'image/jpeg', compress: 0.92 },
        ]
      : [{ format: SaveFormat.JPEG, mime: 'image/jpeg', compress: 0.92 }];

  for (const a of attempts) {
    const ctx = ImageManipulator.manipulate(asset.uri);
    if (!fitsSide) {
      ctx.resize(
        asset.width >= asset.height
          ? { width: DELIVERABLE_MAX_SIDE }
          : { height: DELIVERABLE_MAX_SIDE },
      );
    }
    const rendered = await ctx.renderAsync();
    const saved = await rendered.saveAsync({ compress: a.compress, format: a.format });
    const size = new File(saved.uri).size ?? 0;
    if (size > 0 && size <= DELIVERABLE_MAX_BYTES) {
      return { uri: saved.uri, size, mimeType: a.mime, extension: EXT[a.mime] };
    }
  }

  throw new Error('file_too_large');
}
