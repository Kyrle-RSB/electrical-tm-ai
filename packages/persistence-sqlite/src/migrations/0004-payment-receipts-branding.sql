-- Phase 2 schema contracts; invoicing behavior implemented in later phases.
CREATE TABLE IF NOT EXISTS invoice_drafts (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 body_json TEXT NOT NULL, updated_utc TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS issued_invoices (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
 invoice_number TEXT NOT NULL UNIQUE, immutable_body_json TEXT NOT NULL,
 issued_utc TEXT NOT NULL, amount_cents INTEGER NOT NULL CHECK(amount_cents>=0),
 pdf_sha256 TEXT NOT NULL, pdf_locator TEXT NOT NULL
) STRICT;
CREATE TRIGGER IF NOT EXISTS issued_invoice_no_update BEFORE UPDATE ON issued_invoices
BEGIN SELECT RAISE(ABORT,'Issued invoices are immutable'); END;
CREATE TRIGGER IF NOT EXISTS issued_invoice_no_delete BEFORE DELETE ON issued_invoices
BEGIN SELECT RAISE(ABORT,'Issued invoices are immutable'); END;
CREATE TABLE IF NOT EXISTS payment_events (
 id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL REFERENCES issued_invoices(id) ON DELETE RESTRICT,
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0), paid_day TEXT NOT NULL,method TEXT NOT NULL,
 reference TEXT NOT NULL DEFAULT '', recorded_utc TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS payment_receipts (
 id TEXT PRIMARY KEY, payment_id TEXT NOT NULL UNIQUE REFERENCES payment_events(id) ON DELETE RESTRICT,
 immutable_body_json TEXT NOT NULL, pdf_sha256 TEXT, pdf_locator TEXT, created_utc TEXT NOT NULL
) STRICT;
CREATE TRIGGER IF NOT EXISTS payment_receipt_no_update BEFORE UPDATE ON payment_receipts
BEGIN SELECT RAISE(ABORT,'Issued receipts are immutable'); END;
CREATE TRIGGER IF NOT EXISTS payment_receipt_no_delete BEFORE DELETE ON payment_receipts
BEGIN SELECT RAISE(ABORT,'Issued receipts are immutable'); END;
CREATE TABLE IF NOT EXISTS credit_notes (
 id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL REFERENCES issued_invoices(id) ON DELETE RESTRICT,
 credit_number TEXT NOT NULL UNIQUE, amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
 reason TEXT NOT NULL, issued_utc TEXT NOT NULL, body_json TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS outgoing_drafts (
 id TEXT PRIMARY KEY, document_kind TEXT NOT NULL CHECK(document_kind IN ('invoice','receipt','credit')),
 document_id TEXT NOT NULL, recipients_json TEXT NOT NULL,
 subject TEXT NOT NULL, body TEXT NOT NULL, approved_utc TEXT, updated_utc TEXT NOT NULL
) STRICT;
