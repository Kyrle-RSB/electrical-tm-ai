-- Append-only integrity additions. Do not edit historical migrations 0001-0004.
-- Frozen issued documents and recorded cash evidence require compensating events, not silent edits.
CREATE TRIGGER IF NOT EXISTS credit_note_no_update BEFORE UPDATE ON credit_notes
BEGIN SELECT RAISE(ABORT,'Issued credit notes are immutable'); END;
CREATE TRIGGER IF NOT EXISTS credit_note_no_delete BEFORE DELETE ON credit_notes
BEGIN SELECT RAISE(ABORT,'Issued credit notes are immutable'); END;
CREATE TRIGGER IF NOT EXISTS payment_event_no_update BEFORE UPDATE ON payment_events
BEGIN SELECT RAISE(ABORT,'Recorded payments are immutable; use explicit correction events'); END;
CREATE TRIGGER IF NOT EXISTS payment_event_no_delete BEFORE DELETE ON payment_events
BEGIN SELECT RAISE(ABORT,'Recorded payments are immutable; use explicit correction events'); END;
CREATE TRIGGER IF NOT EXISTS approved_outgoing_draft_no_update BEFORE UPDATE ON outgoing_drafts
WHEN OLD.approved_utc IS NOT NULL
BEGIN SELECT RAISE(ABORT,'Approved outgoing drafts are immutable'); END;
CREATE TRIGGER IF NOT EXISTS approved_outgoing_draft_no_delete BEFORE DELETE ON outgoing_drafts
WHEN OLD.approved_utc IS NOT NULL
BEGIN SELECT RAISE(ABORT,'Approved outgoing drafts are immutable'); END;
-- The SQL store must protect the same split quantity invariant as the pure domain helper.
CREATE TRIGGER IF NOT EXISTS material_split_capacity_insert BEFORE INSERT ON material_dispositions
WHEN NEW.quantity_mills + COALESCE((SELECT SUM(quantity_mills) FROM material_dispositions WHERE line_id=NEW.line_id),0)
  > (SELECT supplier_quantity_mills FROM purchase_lines WHERE id=NEW.line_id)
BEGIN SELECT RAISE(ABORT,'Material allocations exceed supplier quantity'); END;
CREATE TRIGGER IF NOT EXISTS material_split_capacity_update BEFORE UPDATE ON material_dispositions
WHEN NEW.quantity_mills + COALESCE((SELECT SUM(quantity_mills) FROM material_dispositions WHERE line_id=NEW.line_id AND id<>OLD.id),0)
  > (SELECT supplier_quantity_mills FROM purchase_lines WHERE id=NEW.line_id)
BEGIN SELECT RAISE(ABORT,'Material allocations exceed supplier quantity'); END;
-- Unapproved overlapping projects would invent an overhead distribution policy.
CREATE TRIGGER IF NOT EXISTS overhead_capacity_insert BEFORE INSERT ON overhead_project_days
WHEN NEW.half_days+COALESCE((SELECT SUM(half_days) FROM overhead_project_days WHERE day=NEW.day),0)>2
BEGIN SELECT RAISE(ABORT,'Overhead day exceeds two half-day capacity'); END;
CREATE TRIGGER IF NOT EXISTS overhead_capacity_update BEFORE UPDATE ON overhead_project_days
WHEN NEW.half_days+COALESCE((SELECT SUM(half_days) FROM overhead_project_days WHERE day=NEW.day AND NOT(day=OLD.day AND project_id=OLD.project_id)),0)>2
BEGIN SELECT RAISE(ABORT,'Overhead day exceeds two half-day capacity'); END;
