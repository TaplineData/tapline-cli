import assert from 'node:assert/strict';
import { test } from 'node:test';

import { commandHelp, serviceHelp } from '../src/runtime/help.js';
import type { CommandSpec } from '../src/runtime/types.js';

const SEARCH: CommandSpec = {
  name: 'search',
  method: 'search',
  summary: 'Search places.',
  credits: 2,
  perResults: 20,
  route: 'GET /v1/google-maps/search',
  hasBody: false,
  params: [],
};

const PLACE: CommandSpec = {
  name: 'place',
  method: 'get_place',
  summary: 'Get one place.',
  credits: 2,
  route: 'GET /v1/google-maps/places/{feature_id}',
  hasBody: false,
  params: [],
};

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

test('a page-size priced command states its price per results', () => {
  assert.match(commandHelp('google-maps', SEARCH), /Search places\. Costs 2 credits per 20 results\./);
});

test('a flat command keeps its per-request price', () => {
  const help = commandHelp('google-maps', PLACE);

  assert.match(help, /Get one place\. Costs 2 credits\./);
  assert.doesNotMatch(help, /per \d+ results/);
});

test('the service list shows each command\'s price', () => {
  const help = serviceHelp({
    name: 'google-maps',
    commands: [SEARCH, PLACE].map((command) => ({ ...command, run: async () => null })),
  });

  assert.match(help, /search\s+Search places\. \(2 credits per 20 results\)/);
  assert.match(help, /place\s+Get one place\. \(2 credits\)/);
});
