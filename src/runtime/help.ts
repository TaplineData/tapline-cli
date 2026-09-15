import { GLOBAL_HELP } from './globals.js';
import type { CommandSpec, ParamSpec, Service } from './types.js';

const WIDTH = 88;
const MAX_INLINE_CHOICES = 4;

function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line === '') line = word;
    else if (`${line} ${word}`.length <= width) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

/** Two aligned columns, wrapping the right-hand text under its own indent. */
function columns(entries: Array<[string, string]>, indent = '  '): string[] {
  const width = Math.max(0, ...entries.map(([left]) => left.length));
  const gap = 2;
  return entries.flatMap(([left, right]) => {
    const wrapped = wrap(right, Math.max(24, WIDTH - indent.length - width - gap));
    const pad = ' '.repeat(indent.length + width + gap);
    return wrapped.length === 0
      ? [`${indent}${left}`]
      : wrapped.map((line, index) =>
          index === 0 ? `${indent}${left.padEnd(width)}${' '.repeat(gap)}${line}` : `${pad}${line}`,
        );
  });
}

function placeholder(param: ParamSpec): string {
  if (param.kind === 'boolean' && !param.list) return '';
  if (param.choices && param.choices.length <= MAX_INLINE_CHOICES) return `<${param.choices.join('|')}>`;
  if (param.kind === 'json') return '<json>';
  return param.list ? '<value...>' : '<value>';
}

function describe(param: ParamSpec): string {
  const parts: string[] = [];
  if (param.description) parts.push(param.description);
  if (param.choices && param.choices.length > MAX_INLINE_CHOICES) {
    parts.push(`One of: ${param.choices.join(', ')}.`);
  }
  if (param.list) parts.push('Repeatable, or comma-separated.');
  if (param.kind === 'json') parts.push('A JSON value, or @file to read one.');
  if (param.default !== undefined) parts.push(`The API defaults to ${param.default}.`);
  return parts.join(' ');
}

function argumentShape(param: ParamSpec): string {
  return param.required ? `<${param.flag}>` : `[${param.flag}]`;
}

export function usageFor(service: string, command: CommandSpec): string {
  const shapes = command.params.filter((param) => param.positional).map(argumentShape);
  return `tapline ${service} ${command.name} ${[...shapes, '[options]'].join(' ')}`.replace(/\s+/g, ' ');
}

export function commandHelp(service: string, command: CommandSpec): string {
  const out: string[] = [`Usage: ${usageFor(service, command)}`, ''];
  const credits = command.credits === null ? '' : ` Costs ${command.credits} credit${command.credits === 1 ? '' : 's'}.`;
  if (command.summary || credits) out.push(...wrap(`${command.summary}${credits}`.trim(), WIDTH), '');
  out.push(command.route, '');

  const positionals = command.params.filter((param) => param.positional);
  if (positionals.length > 0) {
    out.push('Arguments:');
    out.push(
      ...columns(
        positionals.map((param) => [
          argumentShape(param),
          `${describe(param)} Can also be given as --${param.flag}.`.trim(),
        ]),
      ),
      '',
    );
  }

  const options = command.params.filter((param) => !param.positional);
  if (options.length > 0 || command.hasBody) {
    out.push('Options:');
    const entries: Array<[string, string]> = options.map((param) => [
      `--${param.flag} ${placeholder(param)}`.trim(),
      describe(param),
    ]);
    if (command.hasBody) {
      entries.push(['--body <json>', 'The whole request body as JSON, or @file to read it. Flags override its fields.']);
    }
    out.push(...columns(entries), '');
  }

  if (command.pagination) {
    const next = command.pagination.nextPath
      ? `The next page's value is at ${command.pagination.nextPath} in the response, and is printed after each page.`
      : 'Ask for each page yourself.';
    out.push('Pagination:', ...columns([[`--${command.pagination.flag}`, `One page per call. ${next}`]]), '');
  }

  out.push('Global options:', ...columns(GLOBAL_HELP));
  return out.join('\n');
}

export function serviceHelp(service: Service): string {
  const out = [
    `Usage: tapline ${service.name} <command> [arguments] [options]`,
    '',
    `${service.commands.length} command(s). Run tapline ${service.name} <command> --help for one command's options.`,
    '',
    'Commands:',
    ...columns(
      service.commands.map((command) => {
        const credits = command.credits === null ? '' : ` (${command.credits} credits)`;
        return [command.name, `${command.summary}${credits}`.trim()] as [string, string];
      }),
    ),
    '',
    'Global options:',
    ...columns(GLOBAL_HELP),
  ];
  return out.join('\n');
}

export function rootHelp(services: Service[]): string {
  const entries: Array<[string, string]> = [['auth', 'Save, show or forget your API key.']];
  for (const service of services) {
    const examples = service.commands.slice(0, 3).map((command) => command.name);
    entries.push([service.name, `${service.commands.length} commands, e.g. ${examples.join(', ')}.`]);
  }
  return [
    'Usage: tapline <command> [arguments] [options]',
    '',
    'Commands:',
    ...columns(entries),
    '',
    'Global options:',
    ...columns(GLOBAL_HELP),
    '',
    'Your API key comes from --api-key, then TAPLINE_API_KEY, then tapline auth login.',
  ].join('\n');
}

export function authHelp(): string {
  return [
    'Usage: tapline auth <command>',
    '',
    'Commands:',
    ...columns([
      ['login', 'Read an API key from the terminal (or stdin) and save it.'],
      ['status', 'Show which key the CLI would use, and where it comes from.'],
      ['logout', 'Delete the saved key.'],
    ]),
  ].join('\n');
}
