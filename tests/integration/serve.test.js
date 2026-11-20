// Integration tests for the static dev server in scripts/serve.js.

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer, parseCommandLine } from '../../scripts/serve.js';

/**
 * Creates a throw-away site so the tests do not depend on the repository's files:
 *   <tmp>/outside.txt        must never be served
 *   <tmp>/site/index.html
 *   <tmp>/site/app.webmanifest
 *   <tmp>/site/.git/HEAD     dot-directory, must never be served
 * Returns { tmp, siteRoot }.
 */
async function createFixtureSite() {
  const tmp = await mkdtemp(join(tmpdir(), 'serve-test-'));
  const siteRoot = join(tmp, 'site');
  await mkdir(join(siteRoot, '.git'), { recursive: true });
  await writeFile(join(tmp, 'outside.txt'), 'secret');
  await writeFile(join(siteRoot, 'index.html'), '<!doctype html><title>fixture</title>');
  await writeFile(join(siteRoot, 'app.webmanifest'), '{"name":"fixture"}');
  await writeFile(join(siteRoot, '.git', 'HEAD'), 'ref: refs/heads/main');
  return { tmp, siteRoot };
}

/**
 * Sends one raw HTTP request. Unlike fetch, node:http does not normalize the path,
 * so "/%2e%2e/" reaches the server unchanged.
 * Resolves to { status, contentType, body }.
 */
function request(serverUrl, path, method = 'GET') {
  const { hostname, port } = new URL(serverUrl);
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname, port, path, method }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, contentType: res.headers['content-type'] ?? '', body });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

describe('dev server at the root path', () => {
  let server;
  let fixture;

  before(async () => {
    fixture = await createFixtureSite();
    server = await startServer({ port: 0, root: fixture.siteRoot });
  });

  after(async () => {
    await server.close();
    await rm(fixture.tmp, { recursive: true, force: true });
  });

  it('serves index.html for /', async () => {
    const response = await request(server.url, '/');
    assert.equal(response.status, 200);
    assert.match(response.contentType, /^text\/html/);
    assert.match(response.body, /<title>fixture<\/title>/);
  });

  it('serves a .webmanifest file as application/manifest+json', async () => {
    const response = await request(server.url, '/app.webmanifest');
    assert.equal(response.status, 200);
    assert.equal(response.contentType, 'application/manifest+json');
    assert.equal(response.body, '{"name":"fixture"}');
  });

  it('answers 404 for a missing file', async () => {
    const response = await request(server.url, '/does-not-exist.js');
    assert.equal(response.status, 404);
  });

  it('does not serve files outside the root via an encoded ".."', async () => {
    const response = await request(server.url, '/%2e%2e/outside.txt');
    assert.equal(response.status, 404);
  });

  it('does not serve dotfiles or dot-directories', async () => {
    const response = await request(server.url, '/.git/HEAD');
    assert.equal(response.status, 404);
  });

  it('rejects POST with 405', async () => {
    const response = await request(server.url, '/', 'POST');
    assert.equal(response.status, 405);
  });

  it('answers HEAD with the headers of GET and no body', async () => {
    const response = await request(server.url, '/', 'HEAD');
    assert.equal(response.status, 200);
    assert.match(response.contentType, /^text\/html/);
    assert.equal(response.body, '');
  });
});

describe('dev server under a base path', () => {
  let server;
  let fixture;

  before(async () => {
    fixture = await createFixtureSite();
    server = await startServer({ port: 0, root: fixture.siteRoot, basePath: '/repo/' });
  });

  after(async () => {
    await server.close();
    await rm(fixture.tmp, { recursive: true, force: true });
  });

  it('reports a URL that ends with the base path', () => {
    assert.match(server.url, /^http:\/\/127\.0\.0\.1:\d+\/repo\/$/);
  });

  it('serves index.html for the base path', async () => {
    const response = await request(server.url, '/repo/');
    assert.equal(response.status, 200);
    assert.match(response.contentType, /^text\/html/);
  });

  it('answers 404 for a path outside the base path', async () => {
    const response = await request(server.url, '/index.html');
    assert.equal(response.status, 404);
  });
});

// Only parses arguments: these tests never start a server on 0.0.0.0, which would expose it
// on the network (and open a firewall prompt on Windows).
describe('dev server command line', () => {
  it('defaults to 127.0.0.1, port 8080 and the root path', () => {
    assert.deepEqual(parseCommandLine([], {}), { host: '127.0.0.1', port: 8080, basePath: '/' });
  });

  it('reads --host', () => {
    assert.equal(parseCommandLine(['--host', '0.0.0.0'], {}).host, '0.0.0.0');
  });

  it('rejects --host without a value', () => {
    assert.throws(() => parseCommandLine(['--host'], {}), /--host/);
  });

  it('still reads --port and --base', () => {
    assert.deepEqual(
      parseCommandLine(['--port', '0', '--base', 'repo'], {}),
      { host: '127.0.0.1', port: 0, basePath: 'repo' },
    );
  });
});
