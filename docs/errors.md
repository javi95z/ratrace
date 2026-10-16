# Errors: where they go, and what they never carry

Roadmap step 17e. The errors of the page and of the server functions are kept in one place, in the
game's own Supabase project, grouped by kind; a new kind, or one back after a quiet day, sends an
alert. Nothing personal is kept or sent.

## What is caught

- **On the page** (production builds only): errors nobody caught, promises rejected and never
  handled, and everything the game itself writes as an error (`console.error`: a step the engine
  refused, a screen that could not be drawn, a room that could not be looked for). A page reports
  each kind once, ten at most, and only once someone is signed in; what comes before waits, up to
  ten, and is sent then. Errors of browser extensions, the empty "Script error." of other sites'
  scripts and the harmless "ResizeObserver loop" are left out.
- **In the functions**: every answer of 500 and above, and anything a function throws, under the
  function's name. The detail of a 500 the function caught itself is in its logs in the Supabase
  dashboard; the alert says so. Each function is watched by wrapping its handler in `watched`
  (`supabase/functions/_shared/watch.ts`); `rooms` is not wrapped yet.

## What a report holds

The message and the stack, cleaned; the page it happened on, as one of the game's pages with no
language, query or hash (`/play`, `/room`...; anything else is `/other`); the version of the game
(engine and content, and the commit where the build names it); the browser's name, major version
and system. Before anything leaves the page, and again on the server, these are taken out: e-mail
addresses, tokens (anything that looks like a JWT or a key, and any run of 24 letters, digits, `-`
or `_`), ids (UUIDs), machines' addresses (IPv4), runs of six digits or more, and whatever follows
`?` or `#` in an address or a path. The server also takes out control characters, so nothing kept
can act on a terminal, and refuses a report longer than a page ever sends.

The server knows who sends a report, to hold them to a limit (twenty calls a day), and keeps
nothing of it with the errors: not the player, not the address, not the time of each report. It
keeps one row a kind: when it was first and last seen, how many times, and the last example of it.
The counter of calls, one row a player in the table every function's limit uses, is the only
place that says a player sent reports, and when their day of them began.

## Where to look

```bash
pnpm online:errors
```

lists the kinds, the latest first. In the dashboard they are in the table `error_kinds`, which no
player can read.

## The alert

When a kind is seen for the first time, or again after a day without it, the server sends one
message: no more than ten in an hour for the pages, and ten for the functions, so that made-up
reports from a page never silence the functions. A kind that came when there was no alert left is
alerted the next time it comes and there is one. The same split holds for what is kept, a thousand
kinds of each, the ones seen longest ago making room. The alert is sent after the player's answer,
never before it. It goes to the address in the Edge Function secret `ALERT_URL`:

- a Discord webhook (`https://discord.com/api/webhooks/...`),
- a Slack incoming webhook (`https://hooks.slack.com/...`),
- or an ntfy topic (`https://ntfy.sh/<a-topic-nobody-could-guess>`), which needs no account: install
  the ntfy app and subscribe to the same topic.

What a report says was sent by a player, and any player could write anything there: Discord and
Slack show it in a block of code, as text, with no mention that could ping anyone and no link made
of it; ntfy shows it as plain text. The page in an alert's title is one of the game's own.

With no `ALERT_URL` the errors are kept all the same, and no message is sent. Set it once, in the
dashboard (Edge Functions → Secrets) or with the CLI from a checkout linked to the project:

```bash
supabase secrets set ALERT_URL=<the address>
```

## Deploying

`pnpm online:deploy` deploys `report-error` with the other functions.
