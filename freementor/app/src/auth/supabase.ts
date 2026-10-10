/**
 * The Supabase client.
 *
 * Only the PUBLISHABLE key lives here. It identifies the project and grants
 * nothing on its own — row-level security decides what a caller may touch,
 * which is why it is safe inside an app bundle anyone can unzip. The service
 * key, the JWT secret and the database password stay on the server
 * (CLAUDE.md), and none of them should ever appear in this directory.
 *
 * The session is persisted in AsyncStorage so a learner signs in once rather
 * than every time they open the app.
 */
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://demkvsslqfkreicbjjmm.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_KEY ?? 'sb_publishable_npXHgnLqTnC2LyEfH3UxoQ_5m9u8S66';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // There is no URL bar on a phone; the deep-link handler parses the
    // callback itself.
    detectSessionInUrl: false,
  },
});

/**
 * Refresh tokens only while the app is in front of the learner.
 *
 * Without this the timer keeps running in the background, which drains
 * battery and — worse — can fire mid-suspend and leave the session in a
 * half-refreshed state that presents as a random sign-out.
 */
let appStateBound = false;

export function bindTokenRefreshToAppState(): void {
  if (appStateBound) return;
  appStateBound = true;
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
}

/** The current access token, or null. Used by the sync client. */
export async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
