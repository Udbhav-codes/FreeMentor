/**
 * Who is signed in — product plan §5 step 2.
 *
 * Google sign-in uses the **web OAuth flow**: a Chrome Custom Tab opens
 * Google, and the result comes back on the `freementor://` deep link. The
 * native one-tap sheet is nicer and is what release should ship, but it needs
 * native code and therefore a development build, so this works in Expo Go
 * today and the two can coexist later.
 *
 * Signing out clears the Supabase session but NOT the local SQLite data. A
 * learner's roadmap, ticks and streak are theirs and work offline; wiping
 * them on sign-out would lose weeks of progress because somebody tapped the
 * wrong button. Deleting the account is the separate, explicit path (§15).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { Session } from '@supabase/supabase-js';
import { bindTokenRefreshToAppState, supabase } from './supabase.ts';

WebBrowser.maybeCompleteAuthSession();

export type SignInResult =
  | { ok: true }
  | { ok: false; reason: 'cancelled' | 'failed'; detail?: string };

interface AuthState {
  loading: boolean;
  session: Session | null;
  signedIn: boolean;
  signInWithGoogle: () => Promise<SignInResult>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

/** Where Google sends the learner back to. Registered in Supabase. */
const redirectTo = Linking.createURL('auth/callback');

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    bindTokenRefreshToAppState();

    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null))
      .finally(() => setLoading(false));

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<SignInResult> => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          // Without this the SDK would try to navigate a browser we do not
          // have; we open the Custom Tab ourselves.
          skipBrowserRedirect: true,
        },
      });
      if (error || !data?.url) {
        return { ok: false, reason: 'failed', detail: error?.message };
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success') return { ok: false, reason: 'cancelled' };

      // Supabase returns the tokens in the URL fragment.
      const fragment = result.url.split('#')[1] ?? '';
      const params = new URLSearchParams(fragment);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');

      if (!access_token || !refresh_token) {
        const described = params.get('error_description');
        return { ok: false, reason: 'failed', detail: described ?? 'No session was returned.' };
      }

      const { error: setError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      if (setError) return { ok: false, reason: 'failed', detail: setError.message };

      return { ok: true };
    } catch (error) {
      return { ok: false, reason: 'failed', detail: String(error) };
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut().catch(() => undefined);
    setSession(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      signedIn: Boolean(session),
      signInWithGoogle,
      signOut,
    }),
    [loading, session, signInWithGoogle, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
