-- Append-only Phase 2 mutation receipt. Repeated operation IDs are rejected,
-- not re-executed; receipt, audit and mutation commit in the same transaction.
CREATE TABLE operation_receipts (
 operation_id TEXT PRIMARY KEY CHECK(length(operation_id)=36 AND operation_id=lower(operation_id)),
 channel TEXT NOT NULL CHECK(length(channel) BETWEEN 1 AND 120),
 completed_utc TEXT NOT NULL
) STRICT;
