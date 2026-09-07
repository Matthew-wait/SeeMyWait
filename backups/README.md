# Database backups

`data.sql` is an automated daily `pg_dump` (data-only, INSERT statements) of the
important tables, written by [.github/workflows/db-backup.yml](../.github/workflows/db-backup.yml).

The file is overwritten each run, so **git history is the backup history** — to
restore a previous state, open an older version of `data.sql` and run it in the
Supabase SQL Editor.

Tables covered: `clinics`, `clinic_suggestions`, `app_settings`, `user_roles`.
(Add more `-t public.<table>` lines to the workflow to include others.)
