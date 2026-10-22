# Backups and the health check

Roadmap steps 17h and 17g. Both run on GitHub Actions, free for this public repository.

## Health check (17g)

`.github/workflows/health.yml` runs `pnpm online:health` every hour: the site answers, a guest signs
in, the engine plays, a game with friends opens and is left; then the game and the guest are removed.
It also keeps the free Supabase project from pausing. A failed run is mailed by GitHub to whoever last
changed the schedule. By hand: `pnpm online:health` (with `SUPABASE_SECRET_KEY` set, or the guest stays).

With CAPTCHA protection on (17i) a guest cannot sign in without a browser, and this check fails: it
must then sign in another way before the CAPTCHA is turned on.

## Backups (17h)

`.github/workflows/backup.yml` runs every night at 03:40 UTC: `supabase db dump` of the roles, the
schema and the data (the `auth` accounts included), packed, encrypted with a passphrase (AES-256) and
sent to an S3-compatible bucket outside Supabase. The newest 30 are kept. Nothing is printed and
nothing is kept on GitHub.

Tried 2026-10-20: the dump of the live project restored into an empty Postgres 17 gave the same rows
in every table of the game (`profiles`, `runs`, `games`, `rooms`, `player_days`, …).

## Setting them up, once

In GitHub, repository Settings → Secrets and variables → Actions:

| Kind | Name | What |
|---|---|---|
| Variable | `SUPABASE_URL` | The project's URL |
| Variable | `SUPABASE_PUBLISHABLE_KEY` | The publishable key |
| Variable | `SITE_URL` | The game's address in production |
| Secret | `SUPABASE_SECRET_KEY` | A secret key (`sb_secret_…`), to remove the health check's guest |
| Secret | `SUPABASE_DB_URL` | Dashboard → Connect → Session pooler (IPv4), with the password |
| Secret | `BACKUP_PASSPHRASE` | A long passphrase. Keep it in a password manager too: without it no copy can be read |
| Variable | `BACKUP_BUCKET` | The bucket's name |
| Variable | `BACKUP_ENDPOINT` | Cloudflare R2: `https://<account id>.r2.cloudflarestorage.com` |
| Secret | `BACKUP_ACCESS_KEY_ID`, `BACKUP_SECRET_ACCESS_KEY` | An R2 API token with Object Read & Write on that bucket only |

Then run each workflow once by hand (Actions → the workflow → Run workflow) and see it green.

GitHub turns off scheduled workflows in a public repository after 60 days with no commit: it mails a
warning first, and one click turns them on again.

## The addresses sign-in may come back to

Kept by hand in the hosted project's dashboard: Authentication → URL Configuration → Redirect URLs.
`supabase/config.toml` lists the same addresses, but only for a local project: it is never pushed
(`supabase config push` is not run), so a change there is made in the dashboard too.

| Address | Who comes back to it |
|---|---|
| `https://ratrace-plum.vercel.app/**` | The game in production |
| `http://localhost:3010/**`, `http://localhost:3000/**` | The game on a developer's machine |
| `theratrace://auth` | The phone app, back from Google, exactly this address and nothing else under `theratrace://`. Without it, Supabase sends the player to the Site URL in the browser, and the app never hears back. Add it before the app's accounts ship |

## Restoring

```bash
aws s3 cp s3://<bucket>/<file> . --endpoint-url <endpoint>
gpg --decrypt <file> | tar -xzf -
```

Into a new Supabase project (Supabase's own guide, "Restore a backup"), with its session pooler URL:

```bash
psql --single-transaction --variable ON_ERROR_STOP=1 --file dump/roles.sql --file dump/schema.sql --command 'SET session_replication_role = replica' --file dump/data.sql --dbname "<new database url>"
```

Then point the game at the new project (`NEXT_PUBLIC_SUPABASE_URL` and key in Vercel), deploy the
functions (`pnpm online:deploy`), set their secrets again, and list the addresses sign-in may come
back to (above).
