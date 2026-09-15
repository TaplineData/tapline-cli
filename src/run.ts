import { readFileSync } from 'node:fs';

import { TaplineClient, TaplineError } from '@tapline/client';

import { runAuth } from './commands/auth.js';
import { SERVICES } from './registry.js';
import { nearest, parseArgv } from './runtime/args.js';
import { bindInput, commandOptions } from './runtime/bind.js';
import { resolveKey } from './runtime/credentials.js';
import { CliError, EXIT_FAILED, EXIT_OK, EXIT_USAGE, UsageError } from './runtime/errors.js';
import { GLOBAL_OPTIONS, readGlobals } from './runtime/globals.js';
import { commandHelp, rootHelp, serviceHelp, usageFor } from './runtime/help.js';
import type { Output } from './runtime/output.js';
import { render, valueAt } from './runtime/render.js';
import type { Command, Service } from './runtime/types.js';

const ROOT_USAGE = 'tapline <command> [arguments] [options]';

function version(): string {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    version: string;
  };
  return manifest.version;
}

function findService(name: string): Service {
  const service = SERVICES.find((candidate) => candidate.name === name);
  if (service) return service;
  const suggestion = nearest(name, [...SERVICES.map((s) => s.name), 'auth']);
  throw new UsageError(
    `Unknown command ${name}.${suggestion ? ` Did you mean ${suggestion}?` : ''}`,
    ROOT_USAGE,
  );
}

function findCommand(service: Service, name: string): Command {
  const command = service.commands.find((candidate) => candidate.name === name);
  if (command) return command;
  const suggestion = nearest(name, service.commands.map((candidate) => candidate.name));
  throw new UsageError(
    `${service.name} has no command ${name}.${suggestion ? ` Did you mean ${suggestion}?` : ''}`,
    `tapline ${service.name} --help`,
  );
}

function describeError(e: unknown): string {
  if (e instanceof TaplineError) {
    return `HTTP ${e.status} ${e.code}: ${e.message} (request_id=${e.requestId})`;
  }
  return e instanceof Error ? e.message : String(e);
}

function report(result: unknown, command: Command, out: Output, json: boolean, field: string | undefined): number {
  if (field !== undefined) {
    const value = valueAt(result, field);
    if (value === undefined) {
      out.note(`No value at ${field} in the response.`);
      return EXIT_FAILED;
    }
    out.data(typeof value === 'object' && value !== null ? JSON.stringify(value, null, 2) : String(value));
    return EXIT_OK;
  }
  out.data(json ? JSON.stringify(result, null, 2) : render(result));
  const next = command.pagination?.nextPath ? valueAt(result, command.pagination.nextPath) : undefined;
  if (typeof next === 'string' && next !== '') {
    out.note(`More results: rerun with --${command.pagination!.flag} ${next}`);
  }
  return EXIT_OK;
}

async function runCommand(service: Service, command: Command, argv: string[], out: Output): Promise<number> {
  const usage = usageFor(service.name, command);
  const parsed = parseArgv(argv, [...commandOptions(command), ...GLOBAL_OPTIONS], usage);
  const globals = readGlobals(parsed);
  if (globals.help) {
    out.data(commandHelp(service.name, command));
    return EXIT_OK;
  }
  const input = bindInput(command, parsed, usage);
  const resolved = resolveKey(globals.apiKey);
  if (!resolved) {
    throw new UsageError('No API key. Run tapline auth login, set TAPLINE_API_KEY, or pass --api-key.', usage);
  }
  const client = new TaplineClient({
    apiKey: resolved.key,
    baseUrl: globals.baseUrl,
    retry: globals.maxRetries === undefined ? undefined : { maxRetries: globals.maxRetries },
  });
  const result = await command.run(client, input);
  return report(result, command, out, globals.json, globals.field);
}

async function dispatch(argv: string[], out: Output): Promise<number> {
  const [head, ...rest] = argv;
  if (head === undefined || head === '--help' || head === '-h') {
    out.data(rootHelp(SERVICES));
    return EXIT_OK;
  }
  if (head === '--version') {
    out.data(`tapline ${version()}`);
    return EXIT_OK;
  }
  if (head === 'auth') return runAuth(rest, out);

  const service = findService(head);
  const [name, ...args] = rest;
  if (name === undefined) {
    out.note(serviceHelp(service));
    return EXIT_USAGE;
  }
  if (name === '--help' || name === '-h') {
    out.data(serviceHelp(service));
    return EXIT_OK;
  }
  return runCommand(service, findCommand(service, name), args, out);
}

export async function run(argv: string[], out: Output): Promise<number> {
  try {
    return await dispatch(argv, out);
  } catch (e) {
    if (e instanceof UsageError) {
      out.note(e.message);
      if (e.usage) out.note(`Usage: ${e.usage}`);
      return EXIT_USAGE;
    }
    if (e instanceof CliError) {
      out.note(e.message);
      return EXIT_FAILED;
    }
    out.note(describeError(e));
    return EXIT_FAILED;
  }
}
