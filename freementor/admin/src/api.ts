/**
 * Talking to the FastAPI admin endpoints.
 *
 * Requests go to `/api/...` and Vite proxies them to the server, so the
 * browser only ever makes same-origin requests and CORS never arises.
 *
 * The token lives in sessionStorage, not localStorage: closing the tab should
 * end the session. This panel lists learners and mints discount codes, and a
 * token that outlives the window on a shared machine is a worse trade than
 * pasting it again.
 */

const TOKEN_KEY = 'freementor.admin.token';

export function getToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setToken(token: string): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* a browser with storage blocked still works for one page load */
  }
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    // FastAPI puts a string in `detail` for an HTTPException and a list of
    // field errors there for a 422. Showing the server's own wording matters:
    // "No admins are configured" and "Not an admin account" are different
    // problems with different fixes.
    let detail = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === 'string') detail = body.detail;
      else if (Array.isArray(body.detail)) {
        const first = body.detail[0] as { msg?: string } | undefined;
        if (first?.msg) detail = first.msg;
      }
    } catch {
      /* not JSON */
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

// --- shapes, mirroring the response models --------------------------------

export interface WhoAmI {
  email: string;
  is_admin: boolean;
}

export interface Stats {
  users: number;
  enrollments: number;
  purchases: number;
  active_coupons: number;
  goals_published: number;
  generated_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  discount_tier: number;
  max_uses: number | null;
  used_count: number;
  status: string;
  valid_from: string | null;
  valid_to: string | null;
  created_at: string;
  basic_product_id: string;
  premium_product_id: string;
}

export interface Learner {
  id: string;
  email: string;
  name: string | null;
  language: string;
  is_minor: boolean;
  created_at: string;
  deleted_at: string | null;
  enrollments: number;
  purchases: number;
}

export interface LibraryEntry {
  goal_id: string;
  goal_name: string | null;
  version: string;
  checksum: string | null;
  published_at: string | null;
}

export interface NewCoupon {
  discount_tier: number;
  code?: string;
  max_uses?: number | null;
  valid_from?: string | null;
  valid_to?: string | null;
}

// --- calls ------------------------------------------------------------------

export const api = {
  whoami: () => request<WhoAmI>('/admin/whoami'),
  stats: () => request<Stats>('/admin/stats'),
  coupons: (status?: string) =>
    request<Coupon[]>(`/admin/coupons${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  createCoupon: (body: NewCoupon) =>
    request<Coupon>('/admin/coupons', { method: 'POST', body: JSON.stringify(body) }),
  setCouponStatus: (id: string, status: string) =>
    request<Coupon>(`/admin/coupons/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  learners: (search?: string) =>
    request<Learner[]>(`/admin/users${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  library: () => request<LibraryEntry[]>('/admin/library'),
};

/** The six tiers that have pre-made Play products (§10.3). */
export const TIERS = [10, 20, 30, 50, 70, 90] as const;
