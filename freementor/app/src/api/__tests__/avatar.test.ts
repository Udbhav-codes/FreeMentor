/**
 * The app's half of the photo backup.
 *
 * The server side and the storage round trip were exercised against the real
 * Supabase: ticket, PUT with the token in the query string, 403 on another
 * user's path, a signed URL serving the bytes back, replacement deleting the
 * old object, delete returning 204. None of that is re-tested here.
 *
 * What is tested is what only the app can get wrong — and the rule that
 * matters most: **the learner's photo is never lost to a failed upload.**
 * Every failure path has to report a backup problem, never a photo problem.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../auth/supabase.ts', () => ({
  accessToken: async () => token,
  supabase: {},
  bindTokenRefreshToAppState: () => undefined,
  SUPABASE_URL: 'https://example.supabase.co',
}));

/** Swapped per test to simulate signed out / signed in. */
let token: string | null = 'test-token';

/** The fake file the module under test will read. */
let fileSize = 1024;
let fileExists = true;
let uploadStatus = 200;
let uploadCalls: { url: string; options: unknown }[] = [];

vi.mock('expo-file-system', () => {
  // Mirrors the real constructor: a Directory or File part contributes its
  // uri, not its toString().
  const join = (parts: unknown[]): string =>
    parts
      .map((p) => (p && typeof p === 'object' && 'uri' in p ? String((p as { uri: string }).uri) : String(p)))
      .join('/');

  class FakeFile {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists() {
      return fileExists;
    }
    get size() {
      return fileSize;
    }
    async upload(url: string, options: unknown) {
      uploadCalls.push({ url, options });
      return { status: uploadStatus, body: '', headers: {} };
    }
    static downloadFileAsync = async (_url: string, destination: { uri: string }) =>
      ({ uri: destination.uri }) as FakeFile;
  }
  class FakeDirectory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists() {
      return true;
    }
    create() {}
  }
  return { File: FakeFile, Directory: FakeDirectory, Paths: { document: 'file:///doc' } };
});

let queue: { status: number; body: unknown }[] = [];
let calls: { url: string; method: string; body: unknown }[] = [];
const original = globalThis.fetch;

beforeEach(() => {
  // client.ts reads this at module load, and vi.resetModules() below means
  // each test re-imports it — so the value has to be in place beforehand or
  // every call reports "no server configured".
  process.env.EXPO_PUBLIC_API_URL = 'https://api.test';
  token = 'test-token';
  fileSize = 1024;
  fileExists = true;
  uploadStatus = 200;
  uploadCalls = [];
  queue = [];
  calls = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({
      url: String(url),
      method: init?.method ?? 'GET',
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    const next = queue.shift() ?? { status: 200, body: {} };
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      json: async () => next.body,
    } as Response;
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = original;
  vi.resetModules();
});

const load = async () => await import('../avatar.ts');

const ticket = {
  upload_url: 'https://example.supabase.co/storage/v1/object/upload/sign/avatars/uid/abc.jpg',
  token: 'signed+token/with=chars',
  path: 'uid/abc.jpg',
  max_bytes: 2 * 1024 * 1024,
};

describe('when there is nothing to back up to', () => {
  it('reports unavailable without touching the network', async () => {
    // The ordinary state today: nothing is deployed, and the development
    // sign-in bypass has no token.
    token = null;
    const { uploadAvatar } = await load();
    const result = await uploadAvatar('file:///doc/profile/avatar-1.jpg');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unavailable');
    expect(calls).toHaveLength(0);
  });

  it('says the photo stays on the phone, not that it failed', async () => {
    token = null;
    const { uploadAvatar } = await load();
    const result = await uploadAvatar('file:///doc/profile/avatar-1.jpg');
    if (!result.ok) {
      expect(result.detail).toMatch(/stays on this phone/i);
      expect(result.detail).not.toMatch(/\bfail|\berror|\blost/i);
    }
  });
});

describe('the upload sequence', () => {
  it('asks for a ticket, PUTs the bytes, then records the path', async () => {
    const { uploadAvatar } = await load();
    queue = [
      { status: 200, body: ticket },
      { status: 200, body: { path: ticket.path, url: 'https://signed/read' } },
    ];
    const result = await uploadAvatar('file:///doc/profile/avatar-1.jpg');

    expect(result).toEqual({ ok: true, path: 'uid/abc.jpg', url: 'https://signed/read' });
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.url).toContain('/media/avatar/upload-url');
    expect(calls[0]?.url).toContain('content_type=image%2Fjpeg');
    // The bytes go straight to storage, not through the API.
    expect(uploadCalls).toHaveLength(1);
    expect(calls[1]?.method).toBe('PUT');
    expect(calls[1]?.url).toMatch(/\/media\/avatar$/);
    expect(calls[1]?.body).toEqual({ path: 'uid/abc.jpg' });
  });

  it('puts the storage token in the query string, url-encoded', async () => {
    // Supabase's signed upload endpoint takes ?token=, not an Authorization
    // header — and the token contains / and = which must be escaped.
    const { uploadAvatar } = await load();
    queue = [{ status: 200, body: ticket }, { status: 200, body: { path: 'x', url: 'y' } }];
    await uploadAvatar('file:///doc/profile/avatar-1.jpg');
    expect(uploadCalls[0]?.url).toBe(
      `${ticket.upload_url}?token=${encodeURIComponent(ticket.token)}`,
    );
    expect(uploadCalls[0]?.options).toMatchObject({ httpMethod: 'PUT', mimeType: 'image/jpeg' });
  });
});

describe('a photo that cannot be backed up', () => {
  it('refuses one over 2 MB before asking for a ticket', async () => {
    fileSize = 3 * 1024 * 1024;
    const { uploadAvatar } = await load();
    const result = await uploadAvatar('file:///doc/profile/big.jpg');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('too_large');
    // No point minting a signed URL for an upload storage will reject.
    expect(calls).toHaveLength(0);
  });

  it('reports a missing local file plainly', async () => {
    fileExists = false;
    const { uploadAvatar } = await load();
    const result = await uploadAvatar('file:///doc/profile/gone.jpg');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.detail).toMatch(/no longer on this phone/i);
    expect(calls).toHaveLength(0);
  });

  it('reports a storage refusal with its status, and does not record a path', async () => {
    uploadStatus = 413;
    const { uploadAvatar } = await load();
    queue = [{ status: 200, body: ticket }];
    const result = await uploadAvatar('file:///doc/profile/avatar-1.jpg');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.detail).toMatch(/413/);
    // Only the ticket call — nothing was recorded against the profile.
    expect(calls).toHaveLength(1);
  });

  it('distinguishes "uploaded but not saved" from "not uploaded"', async () => {
    const { uploadAvatar } = await load();
    queue = [
      { status: 200, body: ticket },
      { status: 403, body: { detail: 'That is not your photo.' } },
    ];
    const result = await uploadAvatar('file:///doc/profile/avatar-1.jpg');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.detail).toBe('That is not your photo.');
  });

  it('survives a dropped connection as a backup problem, not a lost photo', async () => {
    const { uploadAvatar } = await load();
    globalThis.fetch = (async () => {
      throw new TypeError('Network request failed');
    }) as typeof fetch;
    const result = await uploadAvatar('file:///doc/profile/avatar-1.jpg');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.detail).toMatch(/stays on this phone/i);
      expect(result.reason).toBe('failed');
    }
  });
});

describe('reading it back', () => {
  it('returns a fresh signed url', async () => {
    const { remoteAvatarUrl } = await load();
    queue = [{ status: 200, body: { path: 'uid/abc.jpg', url: 'https://signed/read' } }];
    expect(await remoteAvatarUrl()).toBe('https://signed/read');
  });

  it('returns null when the learner has no photo on the server', async () => {
    const { remoteAvatarUrl } = await load();
    queue = [{ status: 404, body: { detail: 'No photo set.' } }];
    expect(await remoteAvatarUrl()).toBeNull();
  });

  it('returns null rather than throwing when offline', async () => {
    const { remoteAvatarUrl } = await load();
    globalThis.fetch = (async () => {
      throw new Error('offline');
    }) as typeof fetch;
    expect(await remoteAvatarUrl()).toBeNull();
  });
});

describe('restoreAvatar', () => {
  it('downloads to a local file and returns its uri', async () => {
    const { restoreAvatar } = await load();
    queue = [{ status: 200, body: { url: 'https://signed/read' } }];
    const uri = await restoreAvatar();
    expect(uri).toMatch(/profile\/avatar-\d+\.jpg$/);
  });

  it('returns null when there is nothing to restore', async () => {
    const { restoreAvatar } = await load();
    queue = [{ status: 404, body: {} }];
    expect(await restoreAvatar()).toBeNull();
  });
});

describe('deleteRemoteAvatar', () => {
  it('treats a 204 as done', async () => {
    const { deleteRemoteAvatar } = await load();
    queue = [{ status: 204, body: {} }];
    expect(await deleteRemoteAvatar()).toBe(true);
  });

  it('treats a 404 as done too — nothing there is the desired end state', async () => {
    const { deleteRemoteAvatar } = await load();
    queue = [{ status: 404, body: {} }];
    expect(await deleteRemoteAvatar()).toBe(true);
  });

  it('reports failure on a server error, so the UI does not claim success', async () => {
    const { deleteRemoteAvatar } = await load();
    queue = [{ status: 500, body: {} }];
    expect(await deleteRemoteAvatar()).toBe(false);
  });
});
