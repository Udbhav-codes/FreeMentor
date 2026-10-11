/**
 * Verifiable parental consent — product plan §15, DPDP Act 2023.
 *
 * A 16- or 17-year-old needs their parent's agreement, and a learner ticking
 * a box about their own parent is not that. The server sends a 6-digit code
 * to the parent's email or phone and only records consent when that code
 * comes back, so the app's job here is: tell the server the birth year, ask
 * for a code, pass the code back.
 *
 * The code itself never touches this app's storage. It is hashed server-side
 * with the consent row's id as salt, expires in 10 minutes, and dies on five
 * wrong attempts.
 *
 * Every function returns a result rather than throwing. The server's own
 * wording is passed through on failure, because "that code has expired" and
 * "too many attempts" are different problems and the learner has to be told
 * which one they have.
 */
import { api, apiConfigured, authToken, errorDetail } from './client.ts';

/** The code is 6 digits; mirrors server/app/otp.py CODE_LENGTH. */
export const CODE_LENGTH = 6;
/** Server-side resend limit, for the countdown on the button. */
export const RESEND_SECONDS = 60;

export type ConsentMethod = 'email' | 'sms';

export type Reachability =
  | { usable: true }
  /** No EXPO_PUBLIC_API_URL in this build — there is no server to ask. */
  | { usable: false; reason: 'not_configured' }
  /** Signed out, or using the development sign-in bypass, so no token. */
  | { usable: false; reason: 'no_session' };

/**
 * Whether verified consent can be attempted at all.
 *
 * Checked before the UI commits to the OTP path. Without this the consent
 * step would dead-end on any build with no server — which is every build
 * today, since nothing is deployed yet.
 */
export async function consentReachable(): Promise<Reachability> {
  if (!apiConfigured) return { usable: false, reason: 'not_configured' };
  const token = await authToken();
  if (!token) return { usable: false, reason: 'no_session' };
  return { usable: true };
}

/**
 * Whether the server already has verified consent for this account.
 *
 * Worth asking before showing the code flow. A learner who reinstalls has a
 * consented row on the server, and `POST /consent/request` creates a *new*
 * request when the old one is already confirmed — so re-asking would quietly
 * replace verified consent with an unconfirmed request.
 */
export async function alreadyConsented(): Promise<boolean> {
  try {
    const response = await api('/account/me');
    if (!response.ok) return false;
    const body = (await response.json()) as { consent_given?: boolean };
    return body.consent_given === true;
  } catch {
    return false;
  }
}

export type SendResult =
  | { ok: true; expiresInSeconds: number; demoCode: string | null }
  | { ok: false; detail: string; tooSoon?: boolean };

/**
 * Records the birth year, then asks for a code.
 *
 * The birth year has to go first: the server refuses a consent request unless
 * it already knows the account belongs to a minor, and it learns that from
 * the birth year. Doing it in one call from the app's point of view keeps the
 * two from drifting apart.
 */
export async function sendParentCode(input: {
  birthYear: number;
  parentContact: string;
  method: ConsentMethod;
}): Promise<SendResult> {
  try {
    const patched = await api('/account/me', {
      method: 'PATCH',
      body: JSON.stringify({ birth_year: input.birthYear }),
    });
    if (!patched.ok) {
      return { ok: false, detail: await errorDetail(patched, 'Could not save your age.') };
    }

    const response = await api('/account/consent/request', {
      method: 'POST',
      body: JSON.stringify({
        parent_contact: input.parentContact.trim(),
        method: input.method,
      }),
    });

    if (!response.ok) {
      return {
        ok: false,
        detail: await errorDetail(response, 'Could not send the code.'),
        tooSoon: response.status === 429,
      };
    }

    const body = (await response.json()) as {
      expires_in_seconds?: number;
      demo_code?: string | null;
    };
    return {
      ok: true,
      expiresInSeconds: body.expires_in_seconds ?? 600,
      // Only ever present while OTP_ECHO is on, which production refuses to
      // start with. It saves wiring an email provider to test the flow.
      demoCode: body.demo_code ?? null,
    };
  } catch {
    return { ok: false, detail: 'No connection. Check your internet and try again.' };
  }
}

export type ConfirmResult = { ok: true } | { ok: false; detail: string };

export async function confirmParentCode(code: string): Promise<ConfirmResult> {
  const trimmed = code.trim();
  // Checked here as well as on the server so an obvious typo does not burn
  // one of the five attempts.
  if (!/^\d+$/.test(trimmed) || trimmed.length !== CODE_LENGTH) {
    return { ok: false, detail: `Enter the ${CODE_LENGTH}-digit code.` };
  }

  try {
    const response = await api('/account/consent/confirm', {
      method: 'POST',
      body: JSON.stringify({ code: trimmed }),
    });
    if (!response.ok) {
      return { ok: false, detail: await errorDetail(response, 'That code did not work.') };
    }
    return { ok: true };
  } catch {
    return { ok: false, detail: 'No connection. Check your internet and try again.' };
  }
}

/** Plain-English version of why verified consent is unavailable. */
export function describeUnreachable(reason: 'not_configured' | 'no_session'): string {
  return reason === 'not_configured'
    ? 'This build has no server to send the code through yet.'
    : 'Sign in first and we can send your parent a code.';
}
