import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseArgv } from '../src/runtime/args.js';
import { bindInput, commandOptions } from '../src/runtime/bind.js';
import { UsageError } from '../src/runtime/errors.js';
import { commandHelp } from '../src/runtime/help.js';
import type { CommandSpec } from '../src/runtime/types.js';

test('at least one parameter group is enforced before a request', () => {
  const command: CommandSpec = {
    name: 'highlights',
    method: 'get_highlights',
    summary: 'Fetch highlights.',
    credits: 1,
    route: 'GET /v1/highlights',
    hasBody: false,
    atLeastOne: [['handle', 'user_id']],
    params: [
      {
        name: 'handle',
        flag: 'handle',
        in: 'query',
        kind: 'string',
        list: false,
        required: false,
        positional: false,
      },
      {
        name: 'user_id',
        flag: 'user-id',
        in: 'query',
        kind: 'string',
        list: false,
        required: false,
        positional: false,
      },
    ],
  };

  assert.throws(
    () => bindInput(command, { options: new Map(), positionals: [] }, 'tapline instagram highlights'),
    (error: unknown) => error instanceof UsageError && /--handle or --user-id/.test(error.message),
  );
  assert.match(commandHelp('instagram', command), /Requires one of: --handle, --user-id\./);
});

test('a list of coordinate pairs keeps each pair whole and a negative number binds positionally', () => {
  const command: CommandSpec = {
    name: 'directions',
    method: 'get_directions',
    summary: 'Get routes.',
    credits: 1,
    route: 'GET /v1/directions',
    hasBody: false,
    params: [
      { name: 'longitude', flag: 'longitude', in: 'query', kind: 'number', list: false, required: true, positional: true },
      {
        name: 'via',
        flag: 'via',
        in: 'query',
        kind: 'string',
        list: true,
        commaSeparated: false,
        required: false,
        positional: false,
      },
    ],
  };
  const usage = 'tapline maps directions';

  const parsed = parseArgv(['-87.6298', '--via', '41.86,-87.61', '--via', '41.87,-87.62'], commandOptions(command), usage);

  assert.deepEqual(bindInput(command, parsed, usage), {
    params: { longitude: -87.6298, via: ['41.86,-87.61', '41.87,-87.62'] },
    body: {},
  });
  assert.match(commandHelp('maps', command), /Repeatable\.(?! or)/);
});
