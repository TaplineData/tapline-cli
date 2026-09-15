import { UsageError } from './errors.js';

export interface OptionSpec {
  flag: string;
  takesValue: boolean;
  list: boolean;
}

export interface ParsedArgv {
  options: Map<string, string[]>;
  positionals: string[];
}

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length]!;
}

export function nearest(name: string, known: string[]): string | undefined {
  const ranked = known
    .map((candidate) => ({ candidate, score: distance(name, candidate) }))
    .filter(({ score, candidate }) => score <= Math.max(2, Math.floor(candidate.length / 3)))
    .sort((a, b) => a.score - b.score || a.candidate.localeCompare(b.candidate));
  return ranked[0]?.candidate;
}

function unknownFlag(name: string, known: string[], usage: string): UsageError {
  const suggestion = nearest(name, known);
  const hint = suggestion ? ` Did you mean --${suggestion}?` : '';
  return new UsageError(`Unknown option --${name}.${hint}`, usage);
}

/** Split argv into option values and positionals, using the option table for arity. */
export function parseArgv(argv: string[], options: OptionSpec[], usage: string): ParsedArgv {
  const table = new Map(options.map((option) => [option.flag, option]));
  const values = new Map<string, string[]>();
  const positionals: string[] = [];
  let onlyPositionals = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (onlyPositionals || arg === '-' || !arg.startsWith('-')) {
      positionals.push(arg);
      continue;
    }
    if (arg === '--') {
      onlyPositionals = true;
      continue;
    }
    if (!arg.startsWith('--')) {
      if (arg === '-h') {
        values.set('help', ['true']);
        continue;
      }
      throw new UsageError(`Unknown option ${arg}. Options are spelled out in full, e.g. --json.`, usage);
    }

    const [head, ...rest] = arg.slice(2).split('=');
    const name = head!;
    const inline = rest.length > 0 ? rest.join('=') : undefined;
    let option = table.get(name);
    let value = inline;

    if (!option && name.startsWith('no-')) {
      const negated = table.get(name.slice(3));
      if (negated && !negated.takesValue) {
        option = negated;
        value = 'false';
      }
    }
    if (!option) throw unknownFlag(name, [...table.keys()], usage);

    if (!option.takesValue) {
      value = value ?? 'true';
    } else if (value === undefined) {
      const next = argv[i + 1];
      if (next === undefined) throw new UsageError(`--${option.flag} needs a value.`, usage);
      value = next;
      i += 1;
    }

    const seen = values.get(option.flag);
    if (!seen) {
      values.set(option.flag, [value]);
    } else if (option.list) {
      seen.push(value);
    } else {
      throw new UsageError(`--${option.flag} was given more than once.`, usage);
    }
  }

  return { options: values, positionals };
}
