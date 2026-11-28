-- Additive status reason evidence; no historical audit event is rewritten or backfilled.
ALTER TABLE audit_events ADD COLUMN reason TEXT CHECK(reason IS NULL OR length(trim(reason)) BETWEEN 1 AND 500);
