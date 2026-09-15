import { readFileSync } from 'node:fs';

import type { OptionSpec, ParsedArgv } from './args.js';
import { CliError, UsageError } from './errors.js';
import type { CommandSpec, Input, ParamSpec } from './types.js';

export const BODY_FLAG = 'body';

export function commandOptions(command: CommandSpec): OptionSpec[] {
  const options: OptionSpec[] = command.params.map((param) => ({
    flag: param.flag,
    takesValue: !(param.kind === 'boolean' && !param.list),
    list: param.list,
  }));
  if (command.hasBody) options.push({ flag: BODY_FLAG, takesValue: true, list: false });
  return options;
}

/** A JSON document given inline or, with a leading `@`, read from a file. */
export function readJsonValue(raw: string, flag: string): unknown {
  let text = raw;
  if (raw.startsWith('@')) {
    const path = raw.slice(1);
    try {
      text = readFileSync(path, 'utf8');
    } catch (e) {
      throw new CliError(`--${flag} cannot read ${path}: ${(e as Error).message}`);
    }
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (e) {
    throw new UsageError(`--${flag} is not valid JSON: ${(e as Error).message}`);
  }
}

function scalar(param: ParamSpec, raw: string): unknown {
  if (param.choices && !param.choices.includes(raw)) {
    throw new UsageError(`--${param.flag} must be one of: ${param.choices.join(', ')}. Got ${raw}.`);
  }
  switch (param.kind) {
    case 'string':
      return raw;
    case 'integer':
      if (!/^-?\d+$/.test(raw)) throw new UsageError(`--${param.flag} must be a whole number. Got ${raw}.`);
      return Number(raw);
    case 'number':
      if (!Number.isFinite(Number(raw)) || raw.trim() === '') {
        throw new UsageError(`--${param.flag} must be a number. Got ${raw}.`);
      }
      return Number(raw);
    case 'boolean':
      if (['true', '1', 'yes'].includes(raw)) return true;
      if (['false', '0', 'no'].includes(raw)) return false;
      throw new UsageError(`--${param.flag} must be true or false. Got ${raw}.`);
    case 'json':
      return readJsonValue(raw, param.flag);
  }
}

function coerce(param: ParamSpec, raws: string[]): unknown {
  if (!param.list) return scalar(param, raws[raws.length - 1]!);
  const members = param.kind === 'json' ? raws : raws.flatMap((raw) => raw.split(',').map((part) => part.trim()));
  return members.map((member) => scalar(param, member));
}

function bodyFields(command: CommandSpec): ParamSpec[] {
  return command.params.filter((param) => param.in === 'body');
}

function documentFromBodyFlag(command: CommandSpec, parsed: ParsedArgv): Record<string, unknown> {
  const raw = parsed.options.get(BODY_FLAG);
  if (!raw) return {};
  const value = readJsonValue(raw[raw.length - 1]!, BODY_FLAG);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new UsageError(`--${BODY_FLAG} must be a JSON object.`);
  }
  const known = new Set(bodyFields(command).map((param) => param.name));
  const unknown = Object.keys(value).filter((key) => !known.has(key));
  if (unknown.length > 0) {
    throw new UsageError(
      `--${BODY_FLAG} has field(s) this endpoint does not accept: ${unknown.join(', ')}. ` +
        `Accepted: ${[...known].join(', ')}.`,
    );
  }
  return value as Record<string, unknown>;
}

/** Flags first, then positionals fill whatever required parameters are still unset. */
export function bindInput(command: CommandSpec, parsed: ParsedArgv, usage: string): Input {
  const params: Record<string, unknown> = {};
  const body = documentFromBodyFlag(command, parsed);
  const target = (param: ParamSpec): Record<string, unknown> => (param.in === 'body' ? body : params);

  for (const param of command.params) {
    const raws = parsed.options.get(param.flag);
    if (raws) target(param)[param.name] = coerce(param, raws);
  }

  const slots = command.params.filter((param) => param.positional && !(param.name in target(param)));
  const extra = parsed.positionals.length - slots.length;
  if (extra > 0) {
    const shape = command.params
      .filter((param) => param.positional)
      .map((param) => `<${param.flag}>`)
      .join(' ');
    throw new UsageError(
      `${command.name} takes ${slots.length === 0 ? 'no' : slots.length} more positional argument(s)` +
        `${shape ? ` (${shape})` : ''}; got ${parsed.positionals.length}.`,
      usage,
    );
  }
  slots.forEach((param, index) => {
    const value = parsed.positionals[index];
    if (value !== undefined) target(param)[param.name] = coerce(param, [value]);
  });

  const missing = command.params
    .filter((param) => param.required && !(param.name in target(param)))
    .map((param) => `--${param.flag}`);
  if (missing.length > 0) {
    throw new UsageError(`${command.name} needs ${missing.join(', ')}.`, usage);
  }
  return { params, body };
}
