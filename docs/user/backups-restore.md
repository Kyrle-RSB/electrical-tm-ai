# Backups and recovery (local app)

The application stores data on the user's device. **A backup is not optional protection when financial records matter.**

1. Open **Backup and recovery** in the cockpit.
2. Click **Choose backup folder**. Choose a directory *outside* the entire application profile, preferably on a separate drive. The selected location is stored as a local-machine preference (not as a cloud account).
3. Click **Back up now**. A new timestamped folder is created with a SQLite snapshot, attached receipt images and stored document assets (if present), and a `manifest.json` of sizes and SHA-256 digests.
4. The backup folder name is shown in the app. Open that folder in Finder or File Explorer to confirm it exists and contains `db/app.sqlite` and `manifest.json`.
5. To restore a synthetic test, choose **Restore verified backup**, select the backup folder (the folder containing `manifest.json`), read the warning and explicitly confirm. The app verifies hashes and database integrity first, makes a rescue copy of the current data, switches to the restored data and reopens its SQLite connection.
6. After restoration, confirm that the restored project and photo data appear. Successful restore clears pre-restore unsaved project and business drafts; cancellation retains them. Other cockpit operations are blocked during restore. If the restore succeeds but the project reload fails, the app reports that distinction and requires a successful Refresh before further project editing. **Keep the rescue copy until you are satisfied**.

A modified file or corrupted backup is rejected. Missing receipts or issued PDF originals referenced by the database also block backup or restore, even if the manifest has been edited to omit them. SHA-256 manifests detect accidental corruption and naive tampering, **not forgery by an attacker who can edit both the files and manifest**. Backups are not encrypted automatically: store them in a protected location and do not share them publicly. Credentials are not included and must be reconnected after recovery.

Check the exact candidate native receipts. The automated synthetic backup verifies referenced assets, actual restore IPC and refreshed cockpit state with runner-owned dialog responses; separate native picker/confirmation interaction and recovery witnesses remain required. Do not delete your only working database to test restoration.

Optional logo: select a synthetic PNG/JPEG in Business profile. Its managed asset ID and checksum are stored locally and included in backup verification; cancel preserves the previous reference. Removing a logo reference retains historical managed bytes. A production logo-rendering invoice template is outside Phase 2.

The restore confirmation is bound to the verified backup manifest and file hashes. If the selected archive changes while you are confirming, the restore is refused. Select and verify the intended backup again; your active database remains the original one.

If both the directory switch and recovery fail, the app must stop instead of creating a new empty business. Preserve the original rollback and verified stage folders. Do not rename, replace or delete them without qualified recovery assistance; preserve copies and verify hashes, schema and the intended business records before reopening. An interrupted restore with missing active data blocks startup.

The saved folder preference refuses linked/redirected settings and oversized or changed records. An explicit folder selection can repair an ordinary malformed preference. A failed preference write preserves the previous selection where the filesystem remains stable. If an unsafe stage is retained, preserve it for inspection rather than deleting an unknown object.

If an archive or restore reports an unsafe changed staging directory, do not delete the retained incomplete folder blindly. The app refuses to delete a substituted staging directory. Preserve the original database and archive, inspect the named folders with support, then select a stable backup location. A failed backup is not a valid recovery archive.

Backup creation now verifies the database snapshot's integrity and foreign keys and compares copied attachment bytes to their source digests before reporting success. If verification fails, keep the original data and investigate; do not rely on a retained incomplete directory as a recovery archive. An uncertain scratch or stage object may be retained rather than deleting through a changed path.

### Verify saved backups

Use **Verify saved backups** after choosing a backup folder. The app checks immediate completed application-named archives in that folder, verifies their file hashes, SQLite integrity, referenced evidence and migration compatibility on disposable scratch copies, then shows each archive ID as verified at scan time or rejected. It does not change your backup folder, restore data, or accept a path from the renderer. Unrelated files and incomplete staging folders are ignored. A rejected archive must not be relied upon. To avoid an unbounded scan, the operation refuses folders with more than 10,000 immediate entries or 100 candidate archives; use a smaller folder. Verification can take time, especially on an external drive. This is an integrity check, not authentication or a replacement for a witnessed restore. Restore continues to require separate OS selection, re-verification and explicit consent.
