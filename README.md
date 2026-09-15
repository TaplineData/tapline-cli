# @tapline/cli

`tapline` puts Tapline's YouTube, Airbnb, GMGN and GeckoTerminal APIs on your command line.
Every endpoint the [TypeScript client](https://www.npmjs.com/package/@tapline/client) exposes is a
command, generated from the same API spec, so the two never drift apart.

## Get started

[Create a Tapline account](https://tapline.sh/sign-up?utm_source=cli&utm_medium=referral&utm_campaign=developer_acquisition&utm_content=main_readme)
and create an API key on the [API keys page](https://tapline.sh/dashboard?tab=api-keys&utm_source=cli&utm_medium=referral&utm_campaign=developer_acquisition&utm_content=main_readme).

```sh
npm install -g @tapline/cli
tapline auth login
```

`auth login` reads the key without echoing it and saves it to
`~/.config/tapline/credentials.json` with owner-only permissions. `tapline auth status` shows
which key is in use, and `tapline auth logout` deletes it.

For scripts and CI, set the same environment variable the other clients read:

```sh
export TAPLINE_API_KEY="your-api-key"
```

A key from `--api-key` wins over `TAPLINE_API_KEY`, which wins over the saved key.

## Calling an endpoint

Commands read `tapline <service> <command>`:

```sh
tapline youtube search "learn typescript"
tapline youtube subtitles jNQXAC9IVRw --language en --subtitle-format txt
tapline gmgn security "$TOKEN" --chain sol
tapline geckoterminal network-latest-pools --network solana
tapline airbnb search "Rio de Janeiro" --check-in 2026-11-01 --check-out 2026-11-05 --adults 2 --currency BRL
```

Every parameter has a flag named after the API's own field, and the parameters an endpoint
requires can also be given positionally, in the order `--help` lists them. Flags bind first, so
these two are the same call:

```sh
tapline gmgn holders sol "$TOKEN"
tapline gmgn holders "$TOKEN" --chain sol
```

`tapline <service> --help` lists that service's commands; `tapline <service> <command> --help`
gives one command's arguments, accepted values, credit cost and pagination.

## Output

A readable summary goes to stdout, and progress, hints and errors go to stderr, so a pipe only
ever sees data. `--json` prints the API response itself, and `--field` prints one value from it:

```sh
tapline youtube search "learn typescript" --json | jq -r '.results[].title'
tapline youtube subtitles jNQXAC9IVRw --subtitle-format txt --field transcript > transcript.txt
tapline gmgn holders "$TOKEN" --chain sol --json > holders.json
```

The summary shows the first columns of a result table and shortens long values; `--json` and
`--field` are the way to get everything. Integers too large for JavaScript to hold exactly come
back as strings, as they do in `@tapline/client`.

A failed command exits non-zero: 2 when the command line is wrong, 1 when the call failed. An
API error names the status, the error code and the request id.

## Complex requests

Endpoints that take a request body accept `--body`, inline or from a file, and flags override
the document's fields:

```sh
tapline airbnb search --body @search.json
tapline airbnb search --body @search.json --currency BRL
```

## Pagination

Pagination is always explicit: one command is one page, one charge. After a page that has more
results, the CLI prints the next cursor to stderr:

```sh
tapline youtube comments jNQXAC9IVRw
# More results: rerun with --cursor Ei0SC2...

tapline youtube comments jNQXAC9IVRw --cursor Ei0SC2...
```

## License

MIT
