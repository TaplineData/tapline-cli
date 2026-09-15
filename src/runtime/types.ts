import type { TaplineClient } from '@tapline/client';

export type ParamKind = 'string' | 'integer' | 'number' | 'boolean' | 'json';

export type ParamLocation = 'path' | 'query' | 'body';

export interface ParamSpec {
  /** The name the API expects, e.g. `subtitle_format`. */
  name: string;
  /** The command-line flag, without dashes, e.g. `subtitle-format`. */
  flag: string;
  in: ParamLocation;
  kind: ParamKind;
  list: boolean;
  required: boolean;
  /** Whether this parameter can also be given as a positional argument. */
  positional: boolean;
  choices?: string[];
  default?: string;
  description?: string;
}

export interface PaginationSpec {
  /** The flag that asks for the next page. */
  flag: string;
  /** Dotted path to the next page's value in the response, when the API returns one. */
  nextPath?: string;
}

export interface CommandSpec {
  name: string;
  /** The client method this command calls, in the API's own naming. */
  method: string;
  summary: string;
  credits: number | null;
  route: string;
  params: ParamSpec[];
  /** Whether the command sends a request body, and so accepts `--body`. */
  hasBody: boolean;
  pagination?: PaginationSpec;
}

export interface Input {
  params: Record<string, unknown>;
  body: Record<string, unknown>;
}

export interface Command extends CommandSpec {
  run: (client: TaplineClient, input: Input) => Promise<unknown>;
}

export interface Service {
  name: string;
  commands: Command[];
}
