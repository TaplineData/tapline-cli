import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bindInput } from '../src/runtime/bind.js';
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
