import { File } from 'expo-file-system';
import { supabase } from '../supabase';

export function newObjectId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Sube un archivo local como ArrayBuffer (más fiable en React Native que fetch().blob(),
 * que puede producir objetos de 0 bytes). upsert: false => nunca sobrescribe.
 */
export async function uploadLocalFile(
  bucket: string,
  path: string,
  uri: string,
  contentType: string,
): Promise<void> {
  const bytes = await new File(uri).arrayBuffer();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, bytes, { contentType, upsert: false });
  if (error) throw error;
}

export async function removeQuietly(bucket: string, path: string): Promise<void> {
  await supabase.storage.from(bucket).remove([path]).catch(() => undefined);
}
