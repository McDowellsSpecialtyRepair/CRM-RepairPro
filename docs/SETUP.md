# Local Setup and Transfer

Run commands from the extracted `app/` directory. The delivered application uses a same-origin Express backend and Vite-built frontend; it does not require a Perplexity account or a Perplexity runtime for local operation.

## Prerequisites

- **Runtime:** Node 22 LTS (pinned in `app/.nvmrc` and `package.json` `engines`; supported until April 2027). CI uses the latest 22.x. Node 24 is not yet usable: the pinned `better-sqlite3` 11.x crashes the server on Node 24, and moving to Node 24 requires a reviewed `better-sqlite3` major upgrade. The original handoff was verified on Node 20.20.1, which is now end-of-life.
- **Native dependency:** `better-sqlite3` must install for the recipient's operating system. If a prebuilt binary is unavailable, a working native build toolchain is required.
- **Internet:** Initial `npm ci` requires dependency downloads. Fonts load from external URLs; VIN decoding uses NHTSA. The financial smoke runner does not require those integrations.
- **Platform:** Commands below use a POSIX shell. On Windows use WSL/Linux or translate environment-variable commands to PowerShell. Other operating systems have not been independently tested in this handoff.

## Build and independently verify

```sh
npm ci
npm run check
npm run build
node handoff/verify.mjs
node handoff/fresh-install-check.mjs
npx tsx handoff/calculation-check.ts
```

The same checks run in GitHub Actions on every push and pull request (`.github/workflows/ci.yml`).

`verify.mjs` starts its own temporary server on port 5187, creates a temporary SQLite database, explicitly loads the original built-in sample data into it with `db:seed-demo`, provisions a fresh local owner, generates a random password, exercises all nine services, and deletes the temporary database and credentials afterward. It explicitly clears SMTP credentials in the child process. It never uses the operating database.

`fresh-install-check.mjs` (port 5188 by default) starts a production server on an empty temporary database and confirms that no demonstration customers, users, technicians, staff accounts or credentials are created, that restarts and `db:migrate` are idempotent, and that `db:seed-demo` refuses unsafe targets.

If port 5187 is occupied, set a different port rather than killing an unrelated service:

```sh
HANDOFF_TEST_PORT=5188 node handoff/verify.mjs
```

The API runner is a limited smoke suite, not a browser suite or replacement for independent acceptance tests. Historic scripts in `script/` have additional environment/path/fixture assumptions; do not run all of them blindly.

## Run an interactive development copy

Create a fresh working database, not a copy of the operating database:

```sh
cp .env.example .env
npm start
```

Visit `http://localhost:5000`. Startup runs the application migrations (`server/migrations.ts`). On a brand-new database it loads the reference catalog (service templates, pricing matrices and tax jurisdictions) once. It never loads demonstration customers, users, technicians, jobs or invoices. Keep this service restricted to your development machine; the current server binds to `0.0.0.0`.

To work with the original sample records instead, create a separate new database explicitly before the first start:

```sh
DB_PATH=./demo.db npm run db:seed-demo
```

Then set `DB_PATH=./demo.db` in `.env`. The command refuses to run with `NODE_ENV=production`, without an explicit `DB_PATH`, or against any existing database file. A database created this way is recorded as `demo-data-v1` in `app_migrations`, and the server logs a warning on every start. Never use it for real business records.

With the server started, open a second terminal in `app/` and provision a fresh local owner:

```sh
mkdir -p .private
chmod 700 .private
DB_PATH=./data.db npx tsx script/bootstrap-owner.ts developer@example.invalid .private/owner-invite.json
```

The invitation is written to that private file, not emailed. Use the app's Activate account screen with the same email, the generated activation code, and a new 15–128-character password. Read the code privately; never paste it into a ticket or commit the file.

The invitation is time-limited and single-use. The bootstrap helper refuses to provision an owner if any staff accounts already exist; it is not a way to overwrite the actual McDowells owner. For a fresh disposable local copy, start over with a new database path if necessary. Do not delete or reset a real database to resolve an activation problem.

Add local private files to your own repository ignore rules:

```sh
printf '\n.private/\n' >> .gitignore
```

`npm run dev` runs the TypeScript/Vite development server. `npm start` runs the built `dist/index.cjs`; rebuild before restarting after source changes. The port and database path must match between server and bootstrap commands.

## Configuration

| Variable | Meaning |
|---|---|
| `DB_PATH` | SQLite file; defaults to `data.db` relative to process working directory |
| `EMAIL_OUTPUT_DIR` | Local rendered email copies (contain customer data; not encrypted). Defaults to `emails/` under the server's working directory; set it explicitly in every environment |
| `PORT` | Express port, default 5000 |
| `NODE_ENV` | `production` for built server; development for Vite |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | SMTP settings; credentials must remain empty during onboarding |
| `SMTP_USER`, `SMTP_PASS` | Optional SMTP credentials; never include in source or test reports |

`server/index.ts` loads `.env` via dotenv. Some standalone TypeScript helpers do not, so pass `DB_PATH` explicitly when running them.

## Database migrations

There is one migration path: `runMigrations()` in `server/migrations.ts`. The server runs it on every start, and the same steps can be run explicitly against a stopped server's database:

```sh
DB_PATH=/private/path/to/data.db npm run db:migrate
```

`db:migrate` requires an explicit `DB_PATH`, writes a consistent `*.pre-migrate-<timestamp>.bak` backup of an existing database first (not encrypted; contains private data), runs the migrations, then checks SQLite integrity and foreign keys. It never loads demonstration data. One-time steps are recorded in the `app_migrations` table. Do not use `drizzle-kit push`; it is no longer a project dependency.

## Hosting portability

The source `client/src/lib/queryClient.ts` contains a `__PORT_5000__` token used by the existing preview deployment. When building from this unmodified source outside that deployment, it falls back to relative same-origin API URLs. Do not copy a previously deployed, token-rewritten static bundle.

Use one origin for the frontend and `/api` and `/print` paths to reproduce the verified setup. A static-only hosting account is insufficient: Express and persistent SQLite storage must remain available. HTTPS, process supervision, access restrictions, monitored backups, deployment rollback and a load test are production work still required.

No production Docker image or cloud deployment configuration is certified by this package. Do not upload a live SQLite file to an ephemeral/stateless deployment without a reviewed data-persistence design.
