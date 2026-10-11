/**
 * Backing up the profile photo to Supabase Storage — §15.
 *
 * The photo stays a local file and that local file is what the UI shows. This
 * is a backup, not a move, for two reasons:
 *
 *  · the app has to work offline, and a signed URL needs a network;
 *  · the read URL the server issues expires after an hour, so a stored URL
 *    would be a broken image by tomorrow. A stored *path* plus a fresh signed
 *    URL on demand is the only shape that works.
 *
 * The bytes never pass through the API process. The server issues a
 * short-lived signed ticket and the file goes straight to storage, which is
 * both faster and keeps a 2 MB image out of a Python request.
 *
 * Nothing here throws, and nothing here is required: a learner whose upload
 * fails still has their photo. It is restored from the server only when the
 * local file is gone — a reinstall, or a new phone.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { api, apiConfigured, authToken, errorDetail } from './client.ts';

/** Mirrors MAX_BYTES in server/app/routers/media.py. */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

/** The picker always writes a JPEG, so only one content type is needed. */
const CONTENT_TYPE = 'image/jpeg';

/** Same folder pickProfilePhoto() uses, so restore and pick agree. */
const PHOTO_DIR_NAME = 'profile';

export type AvatarUpload =
  | { ok: true; path: string; url: string }
  | {
      ok: false;
      detail: string;
      /** 'unavailable' is the normal case today: no server, or no session. */
      reason: 'unavailable' | 'too_large' | 'failed';
    };

interface UploadTicket {
  upload_url: string;
  token: string;
  path: string;
  max_bytes: number;
}

async function reachable(): Promise<boolean> {
  if (!apiConfigured) return false;
  return (await authToken()) !== null;
}

/**
 * Uploads a local photo and records it against the profile.
 *
 * Three calls: ask for a ticket, PUT the bytes straight to storage, then tell
 * the API which path to point the profile at. The API re-checks that path
 * belongs to the caller, so a tampered client cannot claim someone else's
 * photo.
 */
export async function uploadAvatar(localUri: string): Promise<AvatarUpload> {
  if (!(await reachable())) {
    return {
      ok: false,
      reason: 'unavailable',
      detail: 'Not signed in, or this build has no server — your photo stays on this phone.',
    };
  }

  let file: File;
  try {
    file = new File(localUri);
    if (!file.exists) {
      return { ok: false, reason: 'failed', detail: 'That photo is no longer on this phone.' };
    }
    // Checked before asking for a ticket: no point minting a signed URL for
    // an upload storage will reject.
    if (typeof file.size === 'number' && file.size > MAX_PHOTO_BYTES) {
      return {
        ok: false,
        reason: 'too_large',
        detail: 'That photo is over 2 MB. Try a smaller one.',
      };
    }
  } catch {
    return { ok: false, reason: 'failed', detail: 'Could not read that photo.' };
  }

  try {
    const ticketResponse = await api(
      `/media/avatar/upload-url?content_type=${encodeURIComponent(CONTENT_TYPE)}`,
      { method: 'POST' },
    );
    if (!ticketResponse.ok) {
      return {
        ok: false,
        reason: 'failed',
        detail: await errorDetail(ticketResponse, 'Could not start the upload.'),
      };
    }
    const ticket = (await ticketResponse.json()) as UploadTicket;

    // The token goes in the query string, which is what Supabase's signed
    // upload endpoint expects — not an Authorization header, which here would
    // be the caller's own token and would be refused.
    const result = await file.upload(
      `${ticket.upload_url}?token=${encodeURIComponent(ticket.token)}`,
      { httpMethod: 'PUT', mimeType: CONTENT_TYPE },
    );
    if (result.status < 200 || result.status >= 300) {
      return {
        ok: false,
        reason: 'failed',
        detail: `Storage refused the photo (${result.status}).`,
      };
    }

    const recorded = await api('/media/avatar', {
      method: 'PUT',
      body: JSON.stringify({ path: ticket.path }),
    });
    if (!recorded.ok) {
      return {
        ok: false,
        reason: 'failed',
        detail: await errorDetail(recorded, 'Uploaded, but could not save it to your profile.'),
      };
    }

    const body = (await recorded.json()) as { path: string; url: string };
    return { ok: true, path: body.path, url: body.url };
  } catch {
    return {
      ok: false,
      reason: 'failed',
      detail: 'No connection. Your photo stays on this phone for now.',
    };
  }
}

/**
 * A fresh signed read URL, or null if there is no photo on the server.
 *
 * Valid for an hour, so it is fetched when needed rather than stored.
 */
export async function remoteAvatarUrl(): Promise<string | null> {
  if (!(await reachable())) return null;
  try {
    const response = await api('/media/avatar');
    if (!response.ok) return null; // 404 when no photo is set.
    const body = (await response.json()) as { url?: string };
    return body.url ?? null;
  } catch {
    return null;
  }
}

/**
 * Pulls the photo back down to a local file.
 *
 * For a reinstall or a new phone, where the profile row is empty but the
 * server still has the photo. Returns the new local URI, or null if there was
 * nothing to restore.
 */
export async function restoreAvatar(): Promise<string | null> {
  const url = await remoteAvatarUrl();
  if (!url) return null;
  try {
    const dir = new Directory(Paths.document, PHOTO_DIR_NAME);
    if (!dir.exists) dir.create({ intermediates: true });
    // A fresh name, so no image cache can serve a previous photo.
    const destination = new File(dir, `avatar-${Date.now()}.jpg`);
    const downloaded = await File.downloadFileAsync(url, destination);
    return downloaded.uri;
  } catch {
    return null;
  }
}

/** Removes the photo from the server. The local file is handled separately. */
export async function deleteRemoteAvatar(): Promise<boolean> {
  if (!(await reachable())) return false;
  try {
    const response = await api('/media/avatar', { method: 'DELETE' });
    // 204 on success; 404 means there was nothing there, which is also fine.
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}
