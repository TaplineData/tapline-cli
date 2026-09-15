import { parseArgv } from '../runtime/args.js';
import { credentialsPath, forgetKey, maskKey, readSecret, resolveKey, saveKey } from '../runtime/credentials.js';
import { EXIT_OK, UsageError } from '../runtime/errors.js';
import { authHelp } from '../runtime/help.js';
import type { Output } from '../runtime/output.js';

const USAGE = 'tapline auth <login|status|logout>';

async function login(out: Output): Promise<number> {
  const key = await readSecret('Tapline API key: ');
  if (key === '') throw new UsageError('No key given; nothing was saved.', USAGE);
  const path = saveKey(key);
  out.note(`API key saved to ${path}`);
  return EXIT_OK;
}

function status(out: Output): number {
  const resolved = resolveKey(undefined);
  if (!resolved) {
    out.note(`No API key. Run tapline auth login, or set TAPLINE_API_KEY. Saved keys live in ${credentialsPath()}.`);
    return EXIT_OK;
  }
  out.note(`API key configured: ${maskKey(resolved.key)}. Source: ${resolved.source}.`);
  return EXIT_OK;
}

function logout(out: Output): number {
  out.note(forgetKey() ? `Removed ${credentialsPath()}` : 'No saved key to remove.');
  return EXIT_OK;
}

export async function runAuth(argv: string[], out: Output): Promise<number> {
  const [subcommand, ...rest] = argv;
  if (subcommand === undefined || subcommand === '--help' || subcommand === '-h') {
    out.data(authHelp());
    return EXIT_OK;
  }
  parseArgv(rest, [], USAGE);
  switch (subcommand) {
    case 'login':
      return login(out);
    case 'status':
      return status(out);
    case 'logout':
      return logout(out);
    default:
      throw new UsageError(`Unknown auth command ${subcommand}.`, USAGE);
  }
}
