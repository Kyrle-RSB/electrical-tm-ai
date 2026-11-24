# Privacy and credentials

Fork B runs locally for one user. It does not create staff accounts, host a server or synchronize records over the internet.

* The renderer is treated as untrusted. It cannot read the local filesystem or credential files directly.
* The main process may store an optional provider secret through Electron's asynchronous OS-protected `safeStorage` API. The adapter refuses plaintext fallback, protects its files with local account permissions and supports revocation.
* The current cockpit supports **only a fixed fake-token proof**. Do not enter real Claude, Gmail or production credentials in this build.
* Actual API key entry, OAuth scopes, token refresh and reviewed Gmail sending belong to later phases. Those guides will include complete individual setup instructions before release.
* Business records, invoices, receipt images, and backup archives may contain confidential information. Do not upload them to GitHub or attach them to public bug reports.
* Backups are not encrypted by this application. Users are responsible for secured storage and tested recovery.
* On a shared computer, other programs with the same OS user identity may access the local data. Use OS account protections, full-disk encryption and good backup hygiene.
* The OS credential protection must be proved on actual macOS Keychain and Windows mechanisms before it can be certified. The Linux fake provider test is not that proof.

In the internal cockpit use **Revoke fake token** to remove the synthetic credential; do not enter real credentials. On this revision the main process still accepts only the fixed synthetic probe token through the renderer.

The automated packaged lifecycle probe uses a separately marked synthetic temporary profile. It launches the same unsigned binary in three distinct processes, stores and reads a fake credential through the restricted bridge, revokes it, and checks absence after another restart. It never imports actual tokens. This does not substitute for independent OS-account, vault-denial, update/signature or physical-machine review.

Credential reads fail closed if the encrypted record changes or is revoked during asynchronous OS decryption. Automatic re-encryption checks the same record again before replacement and will not recreate a detected revoked record. Re-enter a credential deliberately through the authorized adapter if needed.
