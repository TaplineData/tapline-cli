import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, beforeEach, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { run } from '../src/run.js';
import type { Output } from '../src/runtime/output.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, '..', '..', 'fixtures');
const SEARCH = JSON.parse(readFileSync(join(FIXTURES, 'youtube', 'search.default.json'), 'utf8')) as {
  pagination: { next_cursor: string };
};

interface Call {
  method: string;
  url: string;
  apiKey: string | undefined;
  body: unknown;
}

interface Reply {
  status: number;
  payload: unknown;
}

class Stub {
  readonly calls: Call[] = [];
  private reply: Reply = { status: 200, payload: {} };
  private server!: Server;

  async start(): Promise<void> {
    this.server = createServer((request, response) => {
      void this.record(request).then(() => {
        response.writeHead(this.reply.status, { 'content-type': 'application/json', 'x-request-id': 'req_test' });
        response.end(JSON.stringify(this.reply.payload));
      });
    });
    await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve));
  }

  private async record(request: IncomingMessage): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(chunk as Buffer);
    const raw = Buffer.concat(chunks).toString('utf8');
    this.calls.push({
      method: request.method ?? '',
      url: request.url ?? '',
      apiKey: request.headers['x-api-key'] as string | undefined,
      body: raw === '' ? undefined : (JSON.parse(raw) as unknown),
    });
  }

  answers(status: number, payload: unknown): void {
    this.reply = { status, payload };
    this.calls.length = 0;
  }

  get url(): string {
    const address = this.server.address();
    return typeof address === 'object' && address ? `http://127.0.0.1:${address.port}` : '';
  }

  get last(): Call {
    return this.calls[this.calls.length - 1]!;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) => this.server.close((e) => (e ? reject(e) : resolve())));
  }
}

function capture(): { out: Output; data: () => string; notes: () => string } {
  const data: string[] = [];
  const notes: string[] = [];
  return {
    out: { data: (text) => data.push(text), note: (text) => notes.push(text) },
    data: () => data.join('\n'),
    notes: () => notes.join('\n'),
  };
}

describe('the tapline command', () => {
  const stub = new Stub();
  let home: string;

  before(async () => {
    await stub.start();
  });
  after(async () => {
    await stub.stop();
  });

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'tapline-cli-'));
    process.env.XDG_CONFIG_HOME = home;
    process.env.TAPLINE_API_KEY = 'env-key';
    delete process.env.TAPLINE_BASE_URL;
    stub.answers(200, SEARCH);
  });

  async function call(argv: string[]): Promise<{ code: number; data: string; notes: string }> {
    const sink = capture();
    const code = await run([...argv, '--base-url', stub.url], sink.out);
    return { code, data: sink.data(), notes: sink.notes() };
  }

  test('sends the query the arguments describe and prints a readable summary', async () => {
    const result = await call(['youtube', 'search', 'learn typescript', '--sort', 'view_count']);

    assert.equal(result.code, 0);
    assert.equal(stub.last.method, 'GET');
    assert.equal(stub.last.url, '/api/v1/youtube/search?query=learn+typescript&sort=view_count');
    assert.equal(stub.last.apiKey, 'env-key');
    assert.match(result.data, /results: \d+ item\(s\)/);
    assert.match(result.notes, new RegExp(`rerun with --cursor ${SEARCH.pagination.next_cursor}`));
  });

  test('--json prints the response unchanged, and nothing else reaches stdout', async () => {
    const result = await call(['youtube', 'search', 'learn typescript', '--json']);

    assert.deepEqual(JSON.parse(result.data), SEARCH);
  });

  test('--field prints one value, so it can be piped', async () => {
    const result = await call(['youtube', 'search', 'x', '--field', 'pagination.next_cursor']);

    assert.equal(result.data, SEARCH.pagination.next_cursor);
  });

  test('takes path parameters as flags and the remaining required one positionally', async () => {
    stub.answers(200, { code: 0, msg: 'success', data: { list: [], next: '' } });
    await call(['gmgn', 'holders', 'So11111111111111111111111111111111111111112', '--chain', 'sol', '--limit', '10']);

    assert.equal(
      stub.last.url,
      '/api/v1/gmgn/sol/token/So11111111111111111111111111111111111111112/holders?limit=10',
    );
  });

  test('--body supplies the whole request body, and flags override its fields', async () => {
    const bodyFile = join(home, 'search.json');
    const { writeFileSync } = await import('node:fs');
    writeFileSync(bodyFile, JSON.stringify({ query: 'Rio de Janeiro', adults: 1, currency: 'USD' }));
    stub.answers(200, { listings: [], cursor: null, has_next_page: false });

    const result = await call(['airbnb', 'search', '--body', `@${bodyFile}`, '--currency', 'BRL', '--adults', '2']);

    assert.equal(result.code, 0);
    assert.equal(stub.last.method, 'POST');
    assert.deepEqual(stub.last.body, { query: 'Rio de Janeiro', adults: 2, currency: 'BRL' });
  });

  test('refuses a --body field the endpoint does not accept', async () => {
    const result = await call(['airbnb', 'search', '--body', '{"nope": 1}']);

    assert.equal(result.code, 2);
    assert.match(result.notes, /does not accept: nope/);
  });

  test('reports an API error on stderr and exits non-zero', async () => {
    stub.answers(404, { code: 'not_found', message: 'No such video', request_id: 'req_test' });

    const result = await call(['youtube', 'metadata', 'dQw4w9WgXcQ']);

    assert.equal(result.code, 1);
    assert.equal(result.data, '');
    assert.match(result.notes, /HTTP 404 not_found: No such video \(request_id=req_test\)/);
  });

  test('exits 2 when a required argument is missing', async () => {
    const result = await call(['youtube', 'subtitles']);

    assert.equal(result.code, 2);
    assert.match(result.notes, /needs --video-id/);
    assert.equal(stub.calls.length, 0);
  });

  test('suggests the command the user meant', async () => {
    const result = await call(['youtub', 'search', 'x']);

    assert.equal(result.code, 2);
    assert.match(result.notes, /Did you mean youtube\?/);
  });

  test('refuses a value outside the enum before spending a credit', async () => {
    const result = await call(['youtube', 'search', 'x', '--sort', 'sideways']);

    assert.equal(result.code, 2);
    assert.match(result.notes, /--sort must be one of: relevance, upload_date, view_count, rating/);
    assert.equal(stub.calls.length, 0);
  });

  test('command help explains the cost, the values and pagination', async () => {
    const result = await call(['youtube', 'subtitles', '--help']);

    assert.equal(result.code, 0);
    assert.match(result.data, /Costs 2 credits/);
    assert.match(result.data, /One of: srt, vtt, json3, ttml, txt/);
    assert.match(result.data, /--language <value>/);
  });

  test('service help lists every command', async () => {
    const result = await call(['youtube', '--help']);

    assert.match(result.data, /11 command\(s\)/);
    assert.match(result.data, /subtitle-tracks/);
  });

  test('--api-key wins over the environment, which wins over saved credentials', async () => {
    const { saveKey } = await import('../src/runtime/credentials.js');
    saveKey('saved-key');

    await call(['youtube', 'search', 'x']);
    assert.equal(stub.last.apiKey, 'env-key');

    await call(['youtube', 'search', 'x', '--api-key', 'flag-key']);
    assert.equal(stub.last.apiKey, 'flag-key');

    delete process.env.TAPLINE_API_KEY;
    await call(['youtube', 'search', 'x']);
    assert.equal(stub.last.apiKey, 'saved-key');
  });

  test('says how to get a key when there is none', async () => {
    delete process.env.TAPLINE_API_KEY;

    const result = await call(['youtube', 'search', 'x']);

    assert.equal(result.code, 2);
    assert.match(result.notes, /tapline auth login/);
  });

  test('auth login saves a key from stdin that auth status then finds', () => {
    const env: NodeJS.ProcessEnv = { ...process.env, XDG_CONFIG_HOME: home };
    delete env.TAPLINE_API_KEY;
    const bin = join(HERE, '..', 'src', 'bin.ts');
    const tapline = (args: string[], input = ''): { status: number | null; stderr: string } =>
      spawnSync(process.execPath, ['--import', 'tsx', bin, ...args], { env, input, encoding: 'utf8' });

    const login = tapline(['auth', 'login'], 'secret-key\n');
    assert.equal(login.status, 0);
    assert.match(login.stderr, /API key saved to/);

    const credentials = join(home, 'tapline', 'credentials.json');
    assert.deepEqual(JSON.parse(readFileSync(credentials, 'utf8')), { api_key: 'secret-key' });
    assert.equal(statSync(credentials).mode & 0o777, 0o600);

    const status = tapline(['auth', 'status']);
    assert.match(status.stderr, /Source: saved credentials/);
    assert.doesNotMatch(status.stderr, /secret-key/);

    assert.equal(tapline(['auth', 'logout']).status, 0);
    assert.match(tapline(['auth', 'status']).stderr, /No API key/);
  });
});
