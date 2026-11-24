# Invoice and PDF state (construction preview)

The visible **Save synthetic PDF** action produces a clearly watermarked engineering proof only. It is NOT a usable tax or service invoice.

If the PDF filename is already in use, the native Save dialog can offer Replace. The app then asks for an explicit additional replacement confirmation. Only the synthetic test PDF may be replaced. The writer stages new bytes into a temporary same-directory file and swaps it into place. Cancellation must preserve the original. A symlink target is refused.

Issued financial invoices and payment receipts are represented by immutable database snapshot constraints. Actual invoice approvals, allocations, credit notes, payment receipts, company-logo PDF layouts, customer email drafts and Gmail sending are not built yet.

Do not distribute or use this construction build for client billing.
