/**
 * Dev-only static server for the goal files, standing in for Supabase Storage
 * until M4. Binds on all interfaces so a phone on the same Wi-Fi can reach it.
 *
 *   node scripts/serve-library.mjs
 *   EXPO_PUBLIC_LIBRARY_URL=http://<your-lan-ip>:8787 npx expo start
 */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { dirname, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '../../../library/FreeMentor_Library');
const PORT = Number(process.env.PORT ?? 8787);

const server = createServer(async (req, res) => {
  const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
  // Keep the server inside the library folder even if the path tries to climb.
  const target = normalize(resolve(ROOT, `.${path}`));
  if (target !== ROOT && !target.startsWith(ROOT + sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const info = await stat(target);
    if (!info.isFile()) throw new Error('not a file');
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': info.size,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    });
    createReadStream(target).pipe(res);
    console.log(`200 ${path} (${(info.size / 1024).toFixed(0)} KB)`);
  } catch {
    console.log(`404 ${path}`);
    res.writeHead(404).end('Not found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = Object.values(networkInterfaces())
    .flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => n.address);
  console.log(`Serving ${ROOT}\n  http://localhost:${PORT}`);
  for (const ip of ips) console.log(`  http://${ip}:${PORT}   <- use this on your phone`);
});
