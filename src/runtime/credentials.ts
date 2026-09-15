import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';

import { CliError } from './errors.js';

export type KeySource = '--api-key' | 'TAPLINE_API_KEY' | 'saved credentials';

export interface ResolvedKey {
  key: string;
  source: KeySource;
}

export function credentialsPath(): string {
  const config = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(config, 'tapline', 'credentials.json');
}

export function readSavedKey(): string | undefined {
  let text: string;
  try {
    text = readFileSync(credentialsPath(), 'utf8');
  } catch {
    return undefined;
  }
  try {
    const saved = JSON.parse(text) as { api_key?: unknown };
    return typeof saved.api_key === 'string' && saved.api_key !== '' ? saved.api_key : undefined;
  } catch {
    throw new CliError(`${credentialsPath()} is not valid JSON. Run tapline auth login to replace it.`);
  }
}

export function saveKey(key: string): string {
  const path = credentialsPath();
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, `${JSON.stringify({ api_key: key }, null, 2)}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
  return path;
}

export function forgetKey(): boolean {
  const path = credentialsPath();
  if (!existsSync(path)) return false;
  rmSync(path, { force: true });
  return true;
}

export function resolveKey(flagKey: string | undefined): ResolvedKey | undefined {
  if (flagKey) return { key: flagKey, source: '--api-key' };
  const fromEnv = process.env.TAPLINE_API_KEY;
  if (fromEnv) return { key: fromEnv, source: 'TAPLINE_API_KEY' };
  const saved = readSavedKey();
  return saved ? { key: saved, source: 'saved credentials' } : undefined;
}

export function maskKey(key: string): string {
  return key.length > 8 ? `${'*'.repeat(key.length - 4)}${key.slice(-4)}` : '*'.repeat(key.length);
}

/** Read a secret: from the terminal without echoing it, or from a pipe for scripts. */
export async function readSecret(question: string): Promise<string> {
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks).toString('utf8').split('\n')[0]!.trim();
  }
  const rl = createInterface({ input: process.stdin, output: process.stderr, terminal: true });
  const muted = rl as unknown as { _writeToOutput: (text: string) => void };
  let asked = false;
  muted._writeToOutput = (text: string) => {
    if (asked) return;
    asked = true;
    process.stderr.write(text);
  };
  try {
    const answer = await new Promise<string>((resolve) => rl.question(question, resolve));
    process.stderr.write('\n');
    return answer.trim();
  } finally {
    rl.close();
  }
}
