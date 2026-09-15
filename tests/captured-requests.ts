import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { parseArgv } from '../src/runtime/args.js';
import { bindInput, commandOptions } from '../src/runtime/bind.js';
import { UsageError } from '../src/runtime/errors.js';
import { GLOBAL_OPTIONS } from '../src/runtime/globals.js';
import type { CommandSpec, Input, ParamSpec } from '../src/runtime/types.js';

const SUFFIX = '.request.json';
const FIXTURES = process.env.GENERATE_CLIENT_FIXTURES ?? join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'fixtures');

interface CapturedRequest {
  params?: Record<string, unknown>;
  body?: Record<string, unknown>;
}

function stems(service: string): string[] {
  const directory = join(FIXTURES, service);
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => name.endsWith(SUFFIX))
    .map((name) => name.slice(0, -SUFFIX.length))
    .sort();
}

function asText(param: ParamSpec, value: unknown): string {
  return param.kind === 'json' ? JSON.stringify(value) : String(value);
}

function flagsFor(param: ParamSpec, value: unknown): string[] {
  if (param.kind === 'boolean' && !param.list) return [value === true ? `--${param.flag}` : `--no-${param.flag}`];
  const members = param.list && Array.isArray(value) ? value : [value];
  return members.flatMap((member) => [`--${param.flag}`, asText(param, member)]);
}

function bind(command: CommandSpec, argv: string[]): Input {
  const usage = `tapline ${command.name}`;
  return bindInput(command, parseArgv(argv, [...commandOptions(command), ...GLOBAL_OPTIONS], usage), usage);
}

/** The captured call as flags only, and again with as many values positional as the slots allow. */
function argvVariants(command: CommandSpec, given: Map<string, unknown>): string[][] {
  const flagsOnly = [...given].flatMap(([name, value]) => {
    const param = command.params.find((candidate) => candidate.name === name)!;
    return flagsFor(param, value);
  });

  const slots = command.params.filter((param) => param.positional);
  const usable: ParamSpec[] = [];
  for (const slot of slots) {
    if (!given.has(slot.name)) break;
    usable.push(slot);
  }
  const positional = [
    ...usable.map((param) => asText(param, given.get(param.name))),
    ...[...given]
      .filter(([name]) => !usable.some((param) => param.name === name))
      .flatMap(([name, value]) => flagsFor(command.params.find((candidate) => candidate.name === name)!, value)),
  ];
  return [flagsOnly, positional];
}

/** Whether a captured value breaks a constraint the spec declares, e.g. an unknown enum member. */
function breaksAConstraint(command: CommandSpec, given: Map<string, unknown>): boolean {
  return [...given].some(([name, value]) => {
    const param = command.params.find((candidate) => candidate.name === name);
    if (!param?.choices) return false;
    const members = Array.isArray(value) ? value : [value];
    return members.some((member) => !param.choices!.includes(String(member)));
  });
}

/** Every request the capture step recorded has to be expressible as command-line input. */
export function checkCapturedRequests(service: string, commands: CommandSpec[]): void {
  const byMethod = new Map(commands.map((command) => [command.method, command]));
  const captured = stems(service);

  test(`${service}: every captured method is a command`, () => {
    const methods = [...new Set(captured.map((stem) => stem.split('.', 1)[0]!))].sort();
    assert.deepEqual(
      methods.filter((method) => !byMethod.has(method)),
      [],
    );
    assert.notEqual(captured.length, 0, `no captured requests in ${join(FIXTURES, service)}`);
  });

  for (const stem of captured) {
    const command = byMethod.get(stem.split('.', 1)[0]!);
    if (!command) continue;
    test(`${service} ${stem} is expressible on the command line`, () => {
      const request = JSON.parse(readFileSync(join(FIXTURES, service, `${stem}${SUFFIX}`), 'utf8')) as CapturedRequest;
      const expected: Input = { params: request.params ?? {}, body: request.body ?? {} };
      const given = new Map([...Object.entries(expected.params), ...Object.entries(expected.body)]);

      const unsupported = [...given.keys()].filter(
        (name) => !command.params.some((param) => param.name === name),
      );
      assert.deepEqual(unsupported, [], `${command.name} has no flag for ${unsupported.join(', ')}`);

      for (const argv of argvVariants(command, given)) {
        if (breaksAConstraint(command, given)) {
          assert.throws(() => bind(command, argv), UsageError, `should be refused: ${argv.join(' ')}`);
          continue;
        }
        assert.deepEqual(bind(command, argv), expected, `from: ${argv.join(' ')}`);
      }
    });
  }
}
