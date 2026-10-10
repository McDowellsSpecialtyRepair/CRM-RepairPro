# Backup and Recovery Procedure

This is the operating procedure for protecting and restoring the RepairPro database. It applies to every hosting choice. Commands run from the `app/` folder on the server. Nothing in this document is a real key, and no real key may ever be placed in GitHub, a ticket, an email, a chat, or a screenshot.

## Roles

| Responsibility | Who |
|---|---|
| Owns the backup encryption key and its password-manager entry | Business owner |
| Runs and monitors nightly backups; performs restore drills | Administrator / developer |
| Approves any restore of the live system | Business owner |

## What is protected

- **Database:** the SQLite file at `DB_PATH` (for example `/srv/repairpro/data/data.db`). This is the complete business record: customers, estimates, invoices, payments, staff accounts and audit history. Never copy the live `.db` file directly; the active WAL file holds recent changes. Always use the backup command below, which takes a consistent snapshot.
- **Configuration:** the server's `.env` file (SMTP credentials and settings). Keep a copy of its *values* in the password manager, not in backups or GitHub.
- **Not needed in backups:** the built application (rebuilt from GitHub), and saved email copies (rendered copies of documents whose records are in the database).

## 1. One-time setup: the encryption key

1. On the server, generate a key:
   ```sh
   node handoff/database.mjs keygen
   ```
   It prints 64 hexadecimal characters. That printout is the only copy until you save it.
2. The business owner saves it in the company password manager as **"RepairPro — BACKUP_ENCRYPTION_KEY"**, with the date created. Add a second, emergency copy that a trusted person can reach if the owner is unavailable (for example the password manager's emergency-access feature, or a sealed printed copy in the office safe).
3. For unattended nightly backups, the server also needs the key. Store it in a root-only file outside the application folder, never in the repository:
   ```sh
   sudo install -d -m 700 /etc/repairpro
   sudo sh -c 'umask 077; printf "BACKUP_ENCRYPTION_KEY=%s\n" "<paste key here>" > /etc/repairpro/backup.env'
   ```
4. Clear the terminal scrollback after pasting. Do not paste the key into any other tool.

**If the key is lost, every backup made with it is permanently unreadable.** The password-manager entry is the master copy; the server file is a working copy.

## 2. Nightly encrypted backups

Run once per night (for example 02:30) with a systemd timer or cron job as the application's service user:

```sh
set -a; . /etc/repairpro/backup.env; set +a
cd /srv/repairpro/app
node handoff/database.mjs backup /srv/repairpro/data/data.db \
  /srv/repairpro/backups/repairpro-$(date +%Y-%m-%d).enc
```

- The command checks database integrity first, writes a consistent snapshot, encrypts it (AES-256-GCM), and refuses to overwrite an existing file. The output file is owner-only.
- **Off-site copy:** after each backup, copy the new `.enc` file to separate storage outside the server (object storage in another provider or region). Because the file is encrypted, the storage provider cannot read it; the key is never uploaded.
- **Retention (recommended):** keep 30 nightly backups and 12 month-end backups; keep year-end backups for 7 years, matching typical accounting-record retention. Confirm the period with the accountant.
- **Monitoring:** alert someone if a nightly backup is missing or the command exits with an error.

The hosting provider's own server snapshots are a useful extra layer but are not a substitute: they are usually unencrypted, live with the same provider, and may capture the database mid-write.

## 3. Before every update or migration

`npm run db:migrate` (and any deployment that changes the database) first writes an encrypted pre-migration backup when `BACKUP_ENCRYPTION_KEY` is set:

```sh
set -a; . /etc/repairpro/backup.env; set +a
DB_PATH=/srv/repairpro/data/data.db npm run db:migrate
```

Keep that `*.pre-migrate-*.bak.enc` file until the update has been confirmed working for at least a week.

## 4. Restoring (always into an isolated copy first)

Never decrypt over, or replace, the live database without the owner's approval.

1. Get the key from the password manager and decrypt into a **new** file:
   ```sh
   BACKUP_ENCRYPTION_KEY=<from password manager> \
     node handoff/database.mjs decrypt /srv/repairpro/backups/repairpro-2026-10-09.enc /srv/repairpro/restore/restore-check.db
   ```
   The command only produces a file if the backup is authentic (a modified file or wrong key is rejected) and then runs integrity and foreign-key checks.
2. Inspect the restored copy without touching the live system: start a temporary instance with `DB_PATH=/srv/repairpro/restore/restore-check.db`, `PORT=5099`, `HOST=127.0.0.1`, no SMTP settings, and compare record counts, the latest invoices and payment totals with what you expect.
3. To replace the live database (owner approval required):
   1. Stop the application service.
   2. Make an encrypted backup of the current live database anyway (section 2), so the replacement can be undone.
   3. Move the current `data.db`, `data.db-wal` and `data.db-shm` aside (do not delete them).
   4. Copy the verified restored file into place as `data.db`, owner-only permissions, owned by the service user.
   5. Start the service. Startup runs migrations automatically; confirm it starts cleanly.
   6. Sign in and verify recent customers, invoices and payments. Record what was restored, from which date, and who approved it.
4. Delete the temporary restore copies once finished; they contain personal data.

## 5. Restore drill (every 3 months)

Pick a random recent backup, perform section 4 steps 1–2 on a separate machine or folder, record the date, backup used, time taken and any problems in the operations log, then delete the restored copy. A backup that has never been restored is not proven.

## 6. Changing the key (rotation)

Rotate if the key may have been exposed, or when someone with access leaves:

1. Generate a new key (section 1) and save it as a new password-manager entry with today's date.
2. Update `/etc/repairpro/backup.env`; the next nightly backup uses the new key.
3. Keep the old key entry, labelled with its date range, for as long as backups made with it are retained. Delete it only when the last of those backups has been deleted.
4. If the old key was exposed, also re-encrypt any retained backups: decrypt each with the old key and back up the restored copy again with the new key, then delete the old files from every location.

## 7. If something goes wrong

| Situation | Action |
|---|---|
| A backup file is lost or leaked, key safe | No data exposure (encrypted). Note it; check off-site copies exist. |
| The key may be exposed | Rotate immediately (section 6), re-encrypt retained backups, review who had access. |
| The key is lost | Make a fresh backup with a new key at once; older backups cannot be recovered. |
| The live database is damaged | Stop the service, keep the damaged files, restore per section 4 with owner approval. |
| Nightly backup failing | Fix the same day; make a manual backup before any change to the server. |
