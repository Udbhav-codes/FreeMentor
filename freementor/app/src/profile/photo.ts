/**
 * The profile photo — product plan §8.9 ("photo (optional)") and §15.
 *
 * Optional, and local-only for now. §15 asks for minimum data collection, so
 * nothing leaves the device until the backend exists; at M4 this is what gets
 * uploaded to Supabase Storage.
 *
 * The picker hands back a URI in the app's CACHE directory, which Android may
 * clear at any time — a photo stored from there would silently vanish, and
 * the learner would blame us. So the file is copied into the document
 * directory, and the previous one is deleted so changing the picture ten
 * times does not leave ten files behind.
 *
 * Uses the SDK 54+ File/Directory API rather than the legacy
 * `FileSystem.copyAsync` helpers, which are deprecated.
 */
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { initialsFrom } from './initials.ts';

export { initialsFrom };

const PHOTO_DIR_NAME = 'profile';

export type PhotoResult =
  | { ok: true; uri: string }
  | { ok: false; reason: 'cancelled' | 'permission_denied' | 'failed' };

function photoDir(): Directory {
  return new Directory(Paths.document, PHOTO_DIR_NAME);
}

/**
 * Opens the gallery, then copies the chosen image somewhere permanent.
 * Returns the new URI to store on the profile.
 */
export async function pickProfilePhoto(previousUri?: string | null): Promise<PhotoResult> {
  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return { ok: false, reason: 'permission_denied' };

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      // Square, because it is always shown in a circle.
      aspect: [1, 1],
      quality: 0.7,
    });
    const asset = picked.assets?.[0];
    if (picked.canceled || !asset) return { ok: false, reason: 'cancelled' };

    const dir = photoDir();
    if (!dir.exists) dir.create({ intermediates: true });

    // A fresh filename each time, so the image cache cannot serve the old one.
    const destination = new File(dir, `avatar-${Date.now()}.jpg`);
    await new File(asset.uri).copy(destination);

    deletePhotoFile(previousUri);
    return { ok: true, uri: destination.uri };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

/** Removes the stored file. Safe to call with null or a missing file. */
export function deletePhotoFile(uri?: string | null): void {
  if (!uri) return;
  try {
    const file = new File(uri);
    // Only ever delete inside our own folder.
    if (file.uri.includes(`/${PHOTO_DIR_NAME}/`) && file.exists) file.delete();
  } catch {
    // A photo we cannot delete is not worth failing a settings change over.
  }
}

