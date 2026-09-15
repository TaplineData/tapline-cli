/** A mistake in what the user typed: the CLI exits 2 and prints usage guidance. */
export class UsageError extends Error {
  readonly usage: string | undefined;

  constructor(message: string, usage?: string) {
    super(message);
    this.name = 'UsageError';
    this.usage = usage;
  }
}

/** The CLI could not do what was asked for a reason that is not a typo, e.g. an unreadable file. */
export class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliError';
  }
}

export const EXIT_OK = 0;
export const EXIT_FAILED = 1;
export const EXIT_USAGE = 2;
