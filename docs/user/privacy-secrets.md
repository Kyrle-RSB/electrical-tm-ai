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
