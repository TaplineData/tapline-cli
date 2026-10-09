import assert from 'node:assert/strict';
import { test } from 'node:test';

import { commandHelp } from '../src/runtime/help.js';
import type { CommandSpec } from '../src/runtime/types.js';

test('a false-only boolean documents its usable negated flag', () => {
  const command: CommandSpec = {
    name: 'post',
    method: 'get_post',
    summary: 'Fetch a post.',
    credits: 1,
    route: 'GET /v1/post',
    hasBody: false,
    params: [
      {
        name: 'download_media',
        flag: 'download-media',
        in: 'query',
        kind: 'boolean',
        list: false,
        required: false,
        positional: false,
        choices: ['false'],
      },
    ],
  };

  const help = commandHelp('instagram', command);

  assert.match(help, /--no-download-media/);
  assert.doesNotMatch(help, /^\s*--download-media\s/m);
});
