# Roadmap

This is the plan from today's foundation to an app a one-truck to small-crew electrical contractor can run their whole time and materials day in: on one computer, with no account and no internet.

Nothing here is released. Dates are not promised; the steps happen in order, one small reviewed change at a time. Every money figure stays exact (integer cents) and traceable to the hours and materials behind it, and every step ships with tests. All screenshots and sample data are fictional.

## Where it stands today

The app runs from source as a local foundation: projects, a business profile with logo, managed photos, verified backup and restore, and a sample PDF. Underneath, the exact money rules, dated labour rates, half-day overhead, material splits and locked invoice records exist in code and in the local database, but most of them have no screens yet. CI runs 169 tests on every change and builds the app on macOS and Windows.

## 1. Look and feel, and a demo company
- One design system: colour, type and spacing, light and dark, with shared buttons, fields, tables, dialogs and badges.
- A new layout with Today, Jobs, Customers, Crew, Materials, Invoices, Reports and Settings, a search box and a command palette (Cmd or Ctrl+K).
- End-to-end tests that drive the real app and save a screenshot of every screen.
- A demo company (a fictional crew of four, 25 jobs, a month of work) you can load in one click and reset to empty. It never mixes with your own data.
- First-run setup: business name, logo, province or state, tax lines, default rates and backup folder, or "explore with demo data".

## 2. Customers, jobs and crew
- Customers with contacts and site addresses; each customer has many jobs.
- Jobs with number, site, PO or work order, type (service call, T&M, change order) and status.
- A job page showing the unbilled total, with tabs for time, materials, tickets, invoices, photos and notes.
- Crew with roles, dated bill-out and cost rates, and overtime and after-hours multipliers.
- Search across customers, jobs and invoices.

## 3. Time and the T&M ticket
- Log time for one or more people on a job in a few keystrokes, or with a timer.
- A weekly timesheet per person and per job; edits are recorded and locked once invoiced.
- A daily T&M ticket per job as a PDF with your logo, signed by the customer on screen or by a photo of a signed paper copy. A signed ticket is locked.
- A day overhead view; an overbooked day is shown, never silently split.

## 4. Materials
- A price book with supplier, unit, cost and default markup, importable from CSV.
- Supplier receipts with a photo, split across jobs and stock.
- Add materials to a job quickly, with markup and margin both shown.
- Supplier returns and credits flow back to the job.

## 5. Invoices, payments and credit notes
- Named tax lines and rates you set yourself; the app makes no legal or tax claim.
- Build an invoice from a job's unbilled time and materials, grouped or itemised, including progress billing.
- Gapless invoice numbers. An issued invoice is frozen and can only be corrected with a credit note.
- A branded invoice PDF with your terms and the T&M tickets attached.
- Full and part payments, statuses from draft to paid and overdue, and a payment receipt PDF.

## 6. Reports and export
- A Today dashboard: unbilled work, invoices due and overdue, this month's billed and collected.
- A per-job Estimated Profit report.
- CSV exports for your accountant: invoices, payments, time and materials for a date range.
- Backup reminders, a last-backup badge, and restore from inside the app.

## 7. Ready to share
- Fast: opens in under two seconds, and every screen responds in under 100 ms with the demo company loaded.
- Accessible: works by keyboard alone, with clear focus, good contrast and screen reader labels.
- An independent security review of file access, the app's internal messaging and PDF output.
- Packaged macOS and Windows builds checked against the release checklist and a clean-machine install.
- A public user guide and screenshots, all from demo data.

Optional features such as reading receipts with Claude or sending invoices through Gmail stay off until they are explicitly turned on in a later, separate step.

## How progress is tracked

Each step above is one or more small pull requests against `main`, each with its own tests and green CI. The repository's history and CI runs are the record of what is done. See `docs/releases/RELEASE-CHECKLIST.md` for what must hold before any release.
