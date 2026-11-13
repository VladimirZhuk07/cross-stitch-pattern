// Tiny static file server for local development and for the served-site tests.
// ES modules do not load over file://, so the app needs an HTTP server even locally.
//
// Usage: node scripts/serve.js [--port 8080] [--base cross-stitch-pattern]
//   --port  port to listen on (also read from the PORT environment variable; 0 = any free port)
//   --base  URL prefix the site is served under, to mimic GitHub Pages sub-path hosting.
//           Slashes are optional ('cross-stitch-pattern' = '/cross-stitch-pattern/'). Leave
//           them out in Git Bash on Windows, which rewrites '/name/' into a Windows path.

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_PORT = 8080;
const DEFAULT_HOST = '127.0.0.1';
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
};
const FALLBACK_CONTENT_TYPE = 'application/octet-stream';

/**
 * Starts the static server.
 * options.port      port number, 0 picks a free port (default 8080)
 * options.host      interface to bind (default 127.0.0.1, never exposed to the network)
 * options.root      directory to serve (default: the repository root)
 * options.basePath  URL prefix such as '/repo/' (default '/'); requests outside it get 404
 * Resolves to { url, close }: url is the site's address including the base path,
 * close() stops the server and resolves when it is closed.
 */
export async function startServer(options = {}) {
  const port = options.port ?? DEFAULT_PORT;
  const host = options.host ?? DEFAULT_HOST;
  const root = resolve(options.root ?? REPO_ROOT);
  const basePath = normalizeBasePath(options.basePath ?? '/');

  const server = http.createServer((request, response) => {
    handleRequest(request, response, root, basePath).catch((error) => {
      console.error(error);
      sendText(response, 500, 'Internal server error');
    });
  });

  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(port, host, resolveListen);
  });

  const actualPort = server.address().port;
  return {
    url: `http://${host}:${actualPort}${basePath}`,
    close: () => new Promise((resolveClose, rejectClose) => {
      server.closeAllConnections();
      server.close((error) => (error ? rejectClose(error) : resolveClose()));
    }),
  };
}

/** Makes sure the base path starts and ends with '/', e.g. 'repo' → '/repo/'. */
function normalizeBasePath(basePath) {
  const withLeading = basePath.startsWith('/') ? basePath : `/${basePath}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

async function handleRequest(request, response, root, basePath) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    sendText(response, 405, 'Method not allowed');
    return;
  }

  const filePath = resolveFilePath(request.url ?? '/', root, basePath);
  if (filePath === null) {
    sendText(response, 404, 'Not found');
    return;
  }

  const fileStat = await stat(filePath).catch(() => null);
  if (fileStat === null || !fileStat.isFile()) {
    sendText(response, 404, 'Not found');
    return;
  }

  const contentType = CONTENT_TYPES[extname(filePath).toLowerCase()] ?? FALLBACK_CONTENT_TYPE;
  response.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': fileStat.size,
    'Cache-Control': 'no-store',
  });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  response.end(await readFile(filePath));
}

/**
 * Maps a request URL to a file inside root, or returns null when the request must not be served:
 * outside the base path, undecodable, containing a segment that starts with '.' (dotfiles and
 * '..'), containing a backslash or NUL, or resolving outside root.
 * The raw URL is parsed by hand on purpose: the WHATWG URL parser would silently resolve
 * '%2e%2e' segments, hiding traversal attempts instead of rejecting them.
 */
function resolveFilePath(rawUrl, root, basePath) {
  const pathname = rawUrl.split(/[?#]/)[0];
  if (!pathname.startsWith(basePath)) {
    return null;
  }

  let relativePath;
  try {
    relativePath = decodeURIComponent(pathname.slice(basePath.length));
  } catch {
    return null; // malformed percent-encoding is treated like a missing file
  }
  if (relativePath === '' || relativePath.endsWith('/')) {
    relativePath += 'index.html';
  }
  if (relativePath.includes('\\') || relativePath.includes('\0')) {
    return null;
  }

  const segments = relativePath.split('/');
  if (segments.some((segment) => segment === '' || segment.startsWith('.'))) {
    return null;
  }

  const filePath = resolve(root, ...segments);
  return filePath.startsWith(root + sep) ? filePath : null;
}

function sendText(response, status, text) {
  if (response.headersSent) {
    response.end();
    return;
  }
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end(text);
}

/** Reads --port and --base from the command line, falling back to the PORT variable. */
function parseCommandLine(args, env) {
  const options = { port: env.PORT === undefined ? DEFAULT_PORT : Number(env.PORT), basePath: '/' };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--port') {
      options.port = Number(args[i + 1]);
      i += 1;
    } else if (args[i] === '--base') {
      options.basePath = args[i + 1] ?? '/';
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${args[i]}`);
    }
  }
  if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65535) {
    throw new RangeError(`port must be an integer 0–65535, got ${options.port}`);
  }
  return options;
}

const isRunDirectly = process.argv[1] !== undefined
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isRunDirectly) {
  try {
    const options = parseCommandLine(process.argv.slice(2), process.env);
    const { url } = await startServer(options);
    process.stdout.write(`Serving ${REPO_ROOT} at ${url}\nPress Ctrl+C to stop.\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
