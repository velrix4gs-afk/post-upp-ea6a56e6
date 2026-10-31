import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = 'https://ccyyxkjpgebjnstevgkw.supabase.co';

interface UploadOptions {
  bucket: string;
  path: string;
  file: Blob;
  contentType?: string;
  upsert?: boolean;
}

/**
 * Uploads to Supabase Storage through XHR so we get real upload progress
 * events (supabase-js uses fetch, which exposes none). Falls back to the
 * SDK when XHR is unavailable so behaviour never regresses.
 *
 * Media now sends cleanly in the background without a progress overlay.
 * Resolves with the public URL of the uploaded object.
 */
export const uploadWithProgress = async ({
  bucket,
  path,
  file,
  contentType,
  upsert = false,
}: UploadOptions): Promise<string> => {
  const publicUrlOf = () => supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  if (typeof XMLHttpRequest === 'undefined' || !token) {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { contentType, upsert });
    if (error) throw error;
    return publicUrlOf();
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, true);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('x-upsert', String(upsert));
    if (contentType) xhr.setRequestHeader('Content-Type', contentType);

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        let message = `Upload failed (${xhr.status})`;
        try {
          const parsed = JSON.parse(xhr.responseText);
          message = parsed.message || parsed.error || message;
        } catch {
          /* keep default message */
        }
        reject(new Error(message));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.onabort = () => reject(new Error('Upload cancelled'));

    xhr.send(file);
  });

  return publicUrlOf();
};
