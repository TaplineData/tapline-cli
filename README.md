# @tapline/cli

`tapline` puts Tapline's YouTube, Airbnb, GMGN, GeckoTerminal, GoPlus Security, Pons Family, Twitter (X), Pinterest, Pinterest v2, Instagram, Pumpfun, TikTok, Birdeye, LinkedIn, imovelweb, Zillow, Expedia, Brave Search, Indeed, Facebook Ad Library, Facebook Marketplace, and Facebook APIs on your command line.
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
tapline goplus evm-token-security 1 0x6982508145454ce325ddbe47a25d4ec3d2311933
tapline goplus tron-token-security TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
tapline ponsfamily list-launches --sort volume --page-size 10
tapline twitter profile --handle nasa
tapline twitter tweet https://x.com/Seahawks/status/2106870968048386134
tapline pinterest search-pins "italian pot roast"
tapline pinterest pin https://pin.it/2u9bHtUx6
tapline pinterest board /broadstbullycom/nhl-hockey/
tapline pinterest-v2 search-pins "italian pot roast"
tapline pinterest-v2 pin https://pin.it/2u9bHtUx6
tapline instagram profile nike
tapline instagram post https://www.instagram.com/reel/Dd9Etk7R91I/
tapline tiktok profile --handle stoolpresidente
tapline tiktok video https://www.tiktok.com/@stoolpresidente/video/7517114944362499342
tapline tiktok trending-feed US
tapline birdeye token-overview solana JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN
tapline birdeye list-leaderboard base --interval 7d
tapline linkedin profile https://www.linkedin.com/in/williamhgates/
tapline linkedin search-jobs --keywords "data engineer" --location "New York, United States" --posted-within past_week
tapline imovelweb list-locations pinheiros
tapline imovelweb list-listings --operation rent --location-id V1-Z-52 --min-bedrooms 2
tapline zillow search-homes --location "Austin, TX" --status sold
tapline zillow property-records 15067360
tapline expedia search-locations "new york"
tapline expedia search-hotels 2621 --check-in 2026-12-14 --check-out 2026-12-16 --sort price_low_to_high
tapline expedia list-hotel-rooms 19681371 --check-in 2026-12-14 --check-out 2026-12-16 --adults 2
tapline expedia hotel-calendar 105590218
tapline expedia search-activities 2621 --start-date 2026-12-14 --end-date 2026-12-16
tapline expedia search-flights JFK CDG 2026-12-14 --return-date 2026-12-21 --max-stops 0
tapline brave-search search "rust async runtime" --freshness past_month
tapline brave-search search-places ramen 35.6762 139.6503
tapline indeed search-jobs "registered nurse" --location "Houston, TX" --posted-within-days 7
tapline indeed company d5cd619626c9f6f7
tapline facebook-ad-library search-ads "running shoes" --country GB --status active
tapline facebook-marketplace search-marketplace bike 30.2672 -97.7431 --max-price 300
tapline facebook resolve-url https://www.facebook.com/NASA
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
