# Backups and recovery (local app)

The application stores data on the user's device. **A backup is not optional protection when financial records matter.**

1. Open **Backup and recovery** in the cockpit.
2. Click **Choose backup folder**. Choose a directory *outside* the app's data directory, preferably on a separate drive. The selected location is stored as a local-machine preference (not as a cloud account).
3. Click **Back up now**. A new timestamped folder is created with a SQLite snapshot, attached receipt images and stored document assets (if present), and a `manifest.json` of sizes and SHA-256 digests.
4. The backup folder name is shown in the app. Open that folder in Finder or File Explorer to confirm it exists and contains `db/app.sqlite` and `manifest.json`.
5. To restore a synthetic test, choose **Restore verified backup**, select the backup folder (the folder containing `manifest.json`), read the warning and explicitly confirm. The app verifies hashes and database integrity first, makes a rescue copy of the current data, switches to the restored data and reopens its SQLite connection.
6. After restoration, confirm that the restored project and photo data appear. **Keep the rescue copy until you are satisfied**.

A modified file or corrupted backup is rejected. SHA-256 manifests detect accidental corruption and naive tampering, **not forgery by an attacker who can edit both the files and manifest**. Backups are not encrypted automatically: store them in a protected location and do not share them publicly. Credentials are not included and must be reconnected after recovery.

**The packaged backup and restoration scenario still requires native macOS and Windows verification on this exact revision.** Do not delete your only working database to test restoration.
