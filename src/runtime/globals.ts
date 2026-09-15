import type { OptionSpec, ParsedArgv } from './args.js';
import { UsageError } from './errors.js';

export interface Globals {
  json: boolean;
  field: string | undefined;
  apiKey: string | undefined;
  baseUrl: string | undefined;
  maxRetries: number | undefined;
  help: boolean;
}

export const GLOBAL_OPTIONS: OptionSpec[] = [
  { flag: 'json', takesValue: false, list: false },
  { flag: 'field', takesValue: true, list: false },
  { flag: 'api-key', takesValue: true, list: false },
  { flag: 'base-url', takesValue: true, list: false },
  { flag: 'max-retries', takesValue: true, list: false },
  { flag: 'help', takesValue: false, list: false },
];

export const GLOBAL_HELP: Array<[string, string]> = [
  ['--json', 'Print the API response as JSON instead of a readable summary.'],
  ['--field <path>', 'Print one value from the response, e.g. --field pagination.next_cursor.'],
  ['--api-key <key>', 'Use this key instead of TAPLINE_API_KEY or your saved credentials.'],
  ['--base-url <url>', 'Call a different API root (or set TAPLINE_BASE_URL).'],
  ['--max-retries <n>', 'How often to retry a retryable failure. Defaults to 3.'],
  ['--help', 'Show this help.'],
];

function only(parsed: ParsedArgv, flag: string): string | undefined {
  const values = parsed.options.get(flag);
  return values?.[values.length - 1];
}

export function readGlobals(parsed: ParsedArgv): Globals {
  const retries = only(parsed, 'max-retries');
  if (retries !== undefined && !/^\d+$/.test(retries)) {
    throw new UsageError(`--max-retries must be a whole number. Got ${retries}.`);
  }
  return {
    json: parsed.options.has('json'),
    field: only(parsed, 'field'),
    apiKey: only(parsed, 'api-key'),
    baseUrl: only(parsed, 'base-url'),
    maxRetries: retries === undefined ? undefined : Number(retries),
    help: parsed.options.has('help'),
  };
}
