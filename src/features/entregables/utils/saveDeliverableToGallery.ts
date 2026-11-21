import { File, Paths } from 'expo-file-system';
import { Asset } from 'expo-media-library';

import { supabase } from '../../../lib/supabase';

export type SaveErrorCode = 'locked' | 'network' | 'no_space' | 'unknown';

export class SaveDeliverableError extends Error {
  constructor(readonly code: SaveErrorCode) {
    super(code);
  }
}

const SIGNED_URL_TTL_S = 60;

export async function saveDeliverableToGallery(
  deliverablePath: string,
  commissionId: string,
): Promise<void> {
  // 1) Signed URL — if payment not VERIFIED, Storage RLS rejects here
  const { data, error } = await supabase.storage
    .from('commission-deliverables')
    .createSignedUrl(deliverablePath, SIGNED_URL_TTL_S);
  if (error || !data) throw new SaveDeliverableError('locked');

  // 2) Download to app cache (no gallery permission needed for this step)
  const ext = deliverablePath.split('.').pop() ?? 'jpg';
  const target = new File(Paths.cache, `koma-${commissionId}.${ext}`);
  if (target.exists) target.delete();

  let downloaded: File;
  try {
    downloaded = await File.downloadFileAsync(data.signedUrl, target);
  } catch (e) {
    if (target.exists) target.delete();
    const msg = String((e as Error).message).toLowerCase();
    throw new SaveDeliverableError(msg.includes('space') ? 'no_space' : 'network');
  }

  // 3) Save to gallery; 4) always clean up the temp file
  try {
    await Asset.create(downloaded.uri);
  } catch (e) {
    const msg = String((e as Error).message).toLowerCase();
    throw new SaveDeliverableError(msg.includes('space') ? 'no_space' : 'unknown');
  } finally {
    if (downloaded.exists) downloaded.delete();
  }
}
