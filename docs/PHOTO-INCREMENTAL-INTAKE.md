# Incremental photo intake

1. Export only new, unedited Apple Photos originals (including paired Live Photo MOV files) into `Synergetic-Human-Photos-Inbox`, beside this repository.
2. From the repository, run `pnpm photos:intake`.
3. Review the new batch locally at `http://127.0.0.1:3210`: choose Keep/Maybe/Private, star Wallpaper independently, and correct the visit only when needed.
4. Stop the local server and review `artifacts/photo-intake/current.private/intake-summary.private.json` before any import.

The command hashes incoming files against the validated inventory, skips exact duplicates, preserves originals through read-only symlinks, keeps Live Photo still/MOV pairing through Apple content identifiers, retains capture metadata and private GPS only in gitignored artifacts, and never writes Supabase. The existing derivative builder/importer should later be run in delta mode only after Joe approves the batch; public upload is deliberately a separate explicit staging action.
